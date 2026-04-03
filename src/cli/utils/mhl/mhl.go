package mhl

import (
    "encoding/xml"
    "errors"
    "io"
    "os"
    "path"
    "path/filepath"
    "time"

    "github.com/araddon/dateparse"

    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/types/checksumtypes"
    "github.com/awslabs/filemoverexpress/types/sourcetypes"
    "github.com/awslabs/filemoverexpress/utils/fs"
)

type (
    CreatorInfo struct {
        Name       string  `xml:"name"`
        Username   string  `xml:"username"`
        Hostname   string  `xml:"hostname"`
        StartDate  MHLDate `xml:"startdate"`
        FinishDate MHLDate `xml:"finishdate"`
    }
    Hash struct {
        File                 string  `xml:"file"`
        MD5                  string  `xml:"md5"`
        XXHash               string  `xml:"xxhash"`
        XXHash64             string  `xml:"xxhash64"`
        XXH3                 string  `xml:"xxh3"`
        Size                 int64   `xml:"size"`
        LastModificationDate MHLDate `xml:"lastmodificationdate"`
        HashDate             MHLDate `xml:"hashdate"`
    }
    HashList struct {
        CreatorInfo CreatorInfo `xml:"creatorinfo"`
        HashList    []Hash      `xml:"hash"`
    }
    MHLDate struct {
        time.Time
    }
)

// UnmarshalXML tries to parse the provided XML document as an MHL file
func (mhl *MHLDate) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
    var v string
    if err := d.DecodeElement(&v, &start); err != nil {
        return err
    }

    parse, err := dateparse.ParseStrict(v)
    if err != nil {
        return err
    }

    *mhl = MHLDate{parse}
    return nil
}

// LoadMHLFile takes a path and attempts to parse the MHL file structure
func LoadMHLFile(mhlPath string) (HashList, error) {
    var mhl HashList
    f, err := os.Open(filepath.Clean(mhlPath))
    if err != nil {
        return mhl, err
    }

    xmlFile, err := io.ReadAll(f)
    if err != nil {
        fs.CloseFile(fs.CloseFileInput{File: f, Exit: false})
        return mhl, err
    }

    if err := xml.Unmarshal(xmlFile, &mhl); err != nil {
        events.Events.Error(strFailedReadingXML, mhlPath, err.Error())
        fs.CloseFile(fs.CloseFileInput{File: f, Exit: false})
        return mhl, err
    }

    fs.CloseFile(fs.CloseFileInput{File: f, Exit: false})
    return mhl, nil
}

func ParseMhl(sourceFile string, removedFiles *map[string]bool, output *[]*sourcetypes.SourceFile) {
    mhlfile, err := LoadMHLFile(sourceFile)
    if err != nil {
        events.Events.Error(strFailedParsingMhl, sourceFile, err)
    }

    for _, fileEntry := range mhlfile.HashList {
        entry, err := parseMhlEntry(fileEntry, sourceFile, removedFiles)
        if err == nil {
            *output = append(*output, &entry)
        }
    }
}

func parseMhlEntry(fileEntry Hash, sourceFile string, removedFiles *map[string]bool) (sourcetypes.SourceFile, error) {
    dirname := path.Dir(sourceFile)
    if noChecksumEntry(fileEntry) {
        events.Events.Warn(strNoMHLChecksumFound, fileEntry.File)
        //nolint:staticcheck
        return sourcetypes.SourceFile{}, errors.New(strNoMHLChecksumFound)
    }
    mhlFileEntryPath := getMhlPathByOs(path.Join(dirname, fileEntry.File))

    fInfo, err := os.Stat(mhlFileEntryPath)
    if err != nil {
        sendInvalidMhlFileEvent(sourceFile, mhlFileEntryPath, err)
        (*removedFiles)[mhlFileEntryPath] = true
        return sourcetypes.SourceFile{}, errors.New(strFailedProcessingMhlElement)
    }

    if fileEntry.LastModificationDate.After(fInfo.ModTime()) || fileEntry.Size != fInfo.Size() {
        events.Events.Warn(strFileChanged, mhlFileEntryPath, sourceFile)
        return sourcetypes.SourceFile{}, errors.New(strFileChanged)
    }

    (*removedFiles)[mhlFileEntryPath] = true

    return sourcetypes.SourceFile{
        Path: mhlFileEntryPath,
        Size: fileEntry.Size,
        Checksums: &checksumtypes.Checksum{
            MD5Hex:   fileEntry.MD5,
            XXHash:   fileEntry.XXHash,
            XXHash64: fileEntry.XXHash64,
            XXH3:     fileEntry.XXH3,
        },
    }, nil
}

func sendInvalidMhlFileEvent(sourceFile string, mhlFileEntryPath string, err error) {
    if os.IsNotExist(err) {
        events.Events.Warn(strMhlReferencesMissingFile, sourceFile, mhlFileEntryPath)
    } else {
        events.Events.Error(
            strFailedProcessingMhlElement,
            mhlFileEntryPath,
            sourceFile,
            err,
        )
    }
}

func noChecksumEntry(fileEntry Hash) bool {
    return fileEntry.MD5 == "" && fileEntry.XXHash == "" && fileEntry.XXHash64 == "" &&
        fileEntry.XXH3 == ""
}
