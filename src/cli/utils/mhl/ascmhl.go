package mhl

import (
	"encoding/xml"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/awslabs/filemoverexpress/constants"
)

// ASC MHL (ASC Media Hash List, namespace urn:ASC:MHL:v2.0) parsing. This is the
// current ASC standard and is distinct from the legacy mediahashlist.org v1.0
// format parsed in mhl.go. An ASC MHL manifest lives inside an ascmhl/ folder at
// the root of the hashed tree; file paths in the manifest are relative to the
// PARENT of that ascmhl/ folder, not to the manifest file's own directory.
//
// XML element names are matched by local name; the default namespace on the
// document does not need to be spelled out in the struct tags (encoding/xml
// matches on local name when the tag omits a namespace).

const (
	ascMHLNamespace = "urn:ASC:MHL"

	// ascDetectionWindow is how many leading bytes of an .mhl file are inspected
	// to decide whether it is an ASC MHL v2 manifest. The root <hashlist> element
	// and its xmlns declaration appear in the first few lines, well within this
	// window.
	ascDetectionWindow = 1024
)

type (
	ascHashValue struct {
		Value  string `xml:",chardata"`
		Action string `xml:"action,attr"`
	}

	ascPath struct {
		Value                string `xml:",chardata"`
		Size                 int64  `xml:"size,attr"`
		LastModificationDate string `xml:"lastmodificationdate,attr"`
	}

	// ascHash is a single <hash> entry. <directoryhash> entries are not matched
	// by the "hash" tag and are therefore ignored (directory hashing is out of
	// scope for this pass).
	ascHash struct {
		Path   ascPath      `xml:"path"`
		MD5    ascHashValue `xml:"md5"`
		SHA1   ascHashValue `xml:"sha1"`
		XXH64  ascHashValue `xml:"xxh64"`
		XXH3   ascHashValue `xml:"xxh3"`
		XXH128 ascHashValue `xml:"xxh128"`
		C4     ascHashValue `xml:"c4"`
	}

	ascHashListXML struct {
		XMLName xml.Name  `xml:"hashlist"`
		Version string    `xml:"version,attr"`
		Hashes  []ascHash `xml:"hashes>hash"`
	}

	// ASCFileEntry is one file listed in an ASC MHL manifest, reduced to what FME
	// needs: the manifest-relative path, the declared size, the hashes in
	// algorithms FME can compute, and the names of any manifest algorithms FME
	// cannot honor (so the caller can warn about them).
	ASCFileEntry struct {
		RelativePath     string
		Size             int64
		Hashes           map[constants.ChecksumAlgorithm]string
		UnsupportedAlgos []string
	}

	// ASCManifest is a parsed ASC MHL manifest.
	ASCManifest struct {
		Version string
		Entries []ASCFileEntry
	}
)

// IsASCMHL reports whether an .mhl file is an ASC MHL v2 manifest (as opposed to
// the legacy v1.0 hashlist). It matches on the urn:ASC:MHL namespace declared on
// the root element. Legacy v1.0 files declare no namespace, so this cleanly
// discriminates the two formats.
func IsASCMHL(path string) (bool, error) {
	f, err := os.Open(filepath.Clean(path))
	if err != nil {
		return false, err
	}
	defer func() { _ = f.Close() }()

	buf := make([]byte, ascDetectionWindow)
	n, err := f.Read(buf)
	if err != nil && err != io.EOF {
		return false, err
	}

	return strings.Contains(string(buf[:n]), ascMHLNamespace), nil
}

// LoadASCMHLFile parses an ASC MHL v2 manifest and reduces each file entry to an
// ASCFileEntry. Entries with no FME-supported hash still appear (with their
// UnsupportedAlgos populated) so the caller can report that the manifest hash
// could not be honored.
func LoadASCMHLFile(path string) (ASCManifest, error) {
	var manifest ASCManifest

	raw, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return manifest, err
	}

	var doc ascHashListXML
	if err := xml.Unmarshal(raw, &doc); err != nil {
		return manifest, err
	}

	manifest.Version = doc.Version
	manifest.Entries = make([]ASCFileEntry, 0, len(doc.Hashes))
	for _, h := range doc.Hashes {
		relPath := strings.TrimSpace(h.Path.Value)
		if relPath == "" {
			continue
		}
		manifest.Entries = append(manifest.Entries, newASCFileEntry(relPath, h))
	}

	return manifest, nil
}

// newASCFileEntry maps the raw XML hash element onto FME's supported algorithms.
func newASCFileEntry(relPath string, h ascHash) ASCFileEntry {
	entry := ASCFileEntry{
		RelativePath: relPath,
		Size:         h.Path.Size,
		Hashes:       make(map[constants.ChecksumAlgorithm]string),
	}

	supported := []struct {
		algo  constants.ChecksumAlgorithm
		value string
	}{
		{constants.AlgorithmMD5, h.MD5.Value},
		{constants.AlgorithmXXHash64, h.XXH64.Value},
		{constants.AlgorithmXXH3, h.XXH3.Value},
		{constants.AlgorithmC4, h.C4.Value},
	}
	for _, s := range supported {
		if v := strings.TrimSpace(s.value); v != "" {
			entry.Hashes[s.algo] = v
		}
	}

	for _, u := range []struct{ name, value string }{
		{"sha1", h.SHA1.Value},
		{"xxh128", h.XXH128.Value},
	} {
		if strings.TrimSpace(u.value) != "" {
			entry.UnsupportedAlgos = append(entry.UnsupportedAlgos, u.name)
		}
	}

	return entry
}
