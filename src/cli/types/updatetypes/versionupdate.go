package updatetypes

type (
    Manifest struct {
        Product Product `json:"filemoverexpress"`
    }
    Product struct {
        Versions     map[string]any      `json:"versions"`
        ReleaseNotes map[string][]string `json:"releasenotes"`
    }
    ReleaseNotes struct {
        Notes map[string]interface{} `json:"-"`
    }
    UpdateInfo struct {
        NewVersionAvailable bool
        NewVersion          string
    }
)

func (manifest *Manifest) GetVersionList() (versions []string) {
    for k := range manifest.Product.Versions {
        versions = append(versions, k)
    }
    return versions
}

func (manifest *Manifest) GetReleaseNotes() map[string][]string {
    return manifest.Product.ReleaseNotes
}
