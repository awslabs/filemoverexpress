// Command gen-syso generates a Windows resource (.syso) with an icon, an
// application manifest, and a VERSIONINFO block that Windows Explorer, the
// taskbar, and the file Properties dialog can actually read.
//
// Why this exists instead of `wails3 generate syso`:
//
// `wails3 generate syso` loads build/windows/info.json via
// version.Info.UnmarshalJSON and hands the result straight to
// ResourceSet.SetVersionInfo. On tc-hib/winres v0.3.1 (the version wails3
// v3.0.0-beta.16 pins), a VERSIONINFO populated ONLY by UnmarshalJSON serializes
// to a resource whose string table is not surfaced by the Win32
// GetFileVersionInfo API: every string field (ProductName, FileDescription,
// CompanyName, ...) reads back empty, so the taskbar shows no name. winres'
// own SetFileVersion/SetProductVersion doc says they "should be called after
// json.Unmarshal", and doing so is what makes the string table readable.
//
// This helper reproduces the readable path deterministically: it reads the
// string values from info.json, re-applies them under an explicit language ID
// (en-US, 0x0409), and always calls SetFileVersion/SetProductVersion so the
// fixed block and the string table agree. The version can be overridden from
// the build (-version) so the embedded resource tracks the real BUILD_VERSION
// instead of a frozen constant.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/tc-hib/winres"
	"github.com/tc-hib/winres/version"
)

// langEnUS is the LCID for en-US. winres only surfaces a string table that is
// keyed to a concrete language; a neutral (0x0000) block is not read back by
// the Win32 version API.
const langEnUS = 0x0409

// infoFile mirrors the subset of build/windows/info.json this helper consumes.
// Only the string table under info."<lang>" is read for its values; the block
// key itself is ignored because this helper re-keys everything under en-US.
type infoFile struct {
	Info map[string]map[string]string `json:"info"`
}

func main() {
	var (
		infoPath     = flag.String("info", "", "path to info.json")
		iconPath     = flag.String("icon", "", "path to the .ico file")
		manifestPath = flag.String("manifest", "", "path to the .exe.manifest file")
		outPath      = flag.String("out", "", "output .syso path")
		arch         = flag.String("arch", "amd64", "target architecture (amd64, arm64, 386)")
		ver          = flag.String("version", "", "dotted version to embed; overrides info.json when set")
	)
	flag.Parse()

	if err := run(*infoPath, *iconPath, *manifestPath, *outPath, *arch, *ver); err != nil {
		fmt.Fprintln(os.Stderr, "gen-syso:", err)
		os.Exit(1)
	}
}

func run(infoPath, iconPath, manifestPath, outPath, arch, ver string) error {
	if infoPath == "" || iconPath == "" || manifestPath == "" || outPath == "" {
		return fmt.Errorf("-info, -icon, -manifest and -out are all required")
	}

	targetArch, err := archOf(arch)
	if err != nil {
		return err
	}

	vi, err := versionInfoFrom(infoPath, ver)
	if err != nil {
		return err
	}

	rs := winres.ResourceSet{}
	if err := setIcon(&rs, iconPath); err != nil {
		return err
	}
	if err := setManifest(&rs, manifestPath); err != nil {
		return err
	}
	rs.SetVersionInfo(*vi)

	return writeSyso(&rs, outPath, targetArch)
}

func archOf(arch string) (winres.Arch, error) {
	switch arch {
	case "amd64":
		return winres.ArchAMD64, nil
	case "arm64":
		return winres.ArchARM64, nil
	case "386":
		return winres.ArchI386, nil
	default:
		return "", fmt.Errorf("unsupported arch %q", arch)
	}
}

// versionInfoFrom builds a readable VERSIONINFO from info.json. It reads the
// string values from whatever single language block info.json contains, then
// re-applies them under en-US and forces the fixed/string versions to agree via
// SetFileVersion/SetProductVersion (the winres-readable path).
func versionInfoFrom(infoPath, ver string) (*version.Info, error) {
	raw, err := os.ReadFile(infoPath)
	if err != nil {
		return nil, err
	}

	var parsed infoFile
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", infoPath, err)
	}

	strings := firstStringTable(parsed.Info)

	vi := &version.Info{}
	for key, value := range strings {
		if value == "" {
			continue
		}
		if err := vi.Set(langEnUS, key, value); err != nil {
			return nil, fmt.Errorf("setting %s: %w", key, err)
		}
	}

	// Resolve the version: the -version flag wins, else info.json's
	// ProductVersion, else a safe default. SetFileVersion/SetProductVersion must
	// run so the string table is surfaced by the Win32 version API.
	resolved := ver
	if resolved == "" {
		resolved = strings[version.ProductVersion]
	}
	if resolved == "" {
		resolved = "0.0.0"
	}
	vi.SetFileVersion(resolved)
	vi.SetProductVersion(resolved)

	return vi, nil
}

// firstStringTable returns the string table from the single language block in
// info.json. The project's info.json carries exactly one block; if more are
// ever added, the lowest key wins deterministically.
func firstStringTable(info map[string]map[string]string) map[string]string {
	if len(info) == 0 {
		return map[string]string{}
	}
	var chosen string
	for key := range info {
		if chosen == "" || key < chosen {
			chosen = key
		}
	}
	return info[chosen]
}

func setIcon(rs *winres.ResourceSet, iconPath string) error {
	f, err := os.Open(iconPath)
	if err != nil {
		return err
	}
	defer f.Close()
	ico, err := winres.LoadICO(f)
	if err != nil {
		return fmt.Errorf("loading icon %s: %w", iconPath, err)
	}
	return rs.SetIcon(winres.RT_ICON, ico)
}

func setManifest(rs *winres.ResourceSet, manifestPath string) error {
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return err
	}
	xml, err := winres.AppManifestFromXML(data)
	if err != nil {
		return fmt.Errorf("parsing manifest %s: %w", manifestPath, err)
	}
	rs.SetManifest(xml)
	return nil
}

func writeSyso(rs *winres.ResourceSet, outPath string, targetArch winres.Arch) (err error) {
	out, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := out.Close(); err == nil {
			err = cerr
		}
	}()
	return rs.WriteObject(out, targetArch)
}
