package hot_folder

const (
    strTrimmingHotFolder           = "Trimming '%s' from hot folder destination '%s'"
    strSourceFolderInvalid         = "Hot folder %s does not exist or is not a directory. Ignoring"
    strSourceFolderInaccessible    = "hot folder %s has source folder that is not accessible"
    strSourceFolderNotAbsolute     = "hot folder %s has source folder %s. Source folders must be absolute paths"
    strEmptySourceFolder           = "hot folder %s has an empty source folder. Ignoring hot folder"
    strDuplicateHotFolderName      = "duplicate hot folder name %s found. Hot folder names must be unique. Ignoring both hot folders"
    strErrorRemovingHotFolder      = "Error removing %s as a hot folder: %s"
    strErrorAddingHotFolder        = "Error adding hot folder %s: %s"
    strErrorRunningHotFolder       = "error running hot folder: %s"
    strErrorGenericUpload          = "Upload for hot folder %s failed: %s"
    strErrorUploadWithRemoteConfig = "Upload to remote configuration %s failed for hot folder %s: %s"
)
