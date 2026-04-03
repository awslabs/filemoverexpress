package hot_folder

import (
    "os"
    "path/filepath"
    "reflect"
    "slices"
    "strings"
    "sync"
    "time"

    "github.com/radovskyb/watcher"

    "github.com/awslabs/filemoverexpress/core/upload"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
    transfer "github.com/awslabs/filemoverexpress/types/transfertypes"
)

var (
    Watcher            *watcher.Watcher
    lastUpdated        time.Time
    pendingUploads     []string
    mtx                *sync.Mutex
    fileUpdateWaitTime = 10 * time.Second
    // key: hot folder name, value: hot folder struct
    hotFolders map[string]*HotFolder
)

type HotFolder struct {
    Name         string
    Enabled      bool
    SourceFolder string
    // key: transfer profile name, value: destination folder
    TransferProfilesAndDestinationFolders map[string]string
}

// init creates a new Watcher, initializes its hotFolders map, and starts goroutines that process filesystem events
func init() {
    hotFolders = make(map[string]*HotFolder)
    lastUpdated = time.Now()
    mtx = &sync.Mutex{}

    Watcher = watcher.New()
    Watcher.FilterOps(watcher.Rename, watcher.Move, watcher.Create, watcher.Write)
    initializeHotFolders()

    go waitForFileSystemEvents()
    go processFileUpdates()
}

// initializeHotFolders reads the hot folders from the config, and updates the local hot folder map
func initializeHotFolders() {
    cfgHotFolders := globals.GetInstance().GetCfg().UploadHotFolders
    for _, cfgHotFolder := range cfgHotFolders {
        hotFolderTransferConfigs := cfgHotFolder.RemoteConfigurations
        hotFolderTxMap := make(map[string]string)
        for _, config := range hotFolderTransferConfigs {
            hotFolderTxMap[config.RemoteConfigurationName] = config.S3DestinationFolder
        }

        hotFolder := HotFolder{
            Name:                                  cfgHotFolder.Name,
            Enabled:                               cfgHotFolder.Enabled,
            SourceFolder:                          cfgHotFolder.LocalSourceFolder,
            TransferProfilesAndDestinationFolders: hotFolderTxMap,
        }
        ConfigureHotFolderWatcher(hotFolder)
    }
}

// RemoveOldHotFolders gets rid of any cached hot folders that are no longer in the config
func RemoveOldHotFolders() {
    configHotFolders := globals.GetInstance().GetCfg().UploadHotFolders
    for _, cachedHotFolder := range hotFolders {
        removed := true
        for _, configHotFolder := range configHotFolders {
            if configHotFolder.Name == cachedHotFolder.Name {
                removed = false
                break
            }
        }
        if removed {
            delete(hotFolders, cachedHotFolder.Name)
        }
    }
}

// IsSourceFolderStillUsed returns true if the source folder is still being used by another hot folder
func IsSourceFolderStillUsed(sourceFolder string) bool {
    for _, hotFolder := range globals.GetInstance().GetCfg().UploadHotFolders {
        if sourceFolder == hotFolder.LocalSourceFolder {
            return true
        }
    }
    return false
}

// ConfigureHotFolderWatcher updates the hot folder cache, and adds/removes filepath watchers as needed.
// Returns true if a new watcher was added
func ConfigureHotFolderWatcher(newHotFolder HotFolder) bool {
    duplicates := removeDuplicateNamedHotFolders()
    if slices.Contains(duplicates, newHotFolder.Name) {
        return false
    }
    if !isSourceFolderValid(newHotFolder) {
        return false
    }

    if cachedHotFolder, found := hotFolders[newHotFolder.Name]; found {
        if reflect.DeepEqual(newHotFolder, *cachedHotFolder) {
            return false
        }
        if !IsSourceFolderStillUsed(cachedHotFolder.SourceFolder) {
            err := Watcher.RemoveRecursive(cachedHotFolder.SourceFolder)
            if err != nil {
                events.Events.Warn(strErrorRemovingHotFolder, cachedHotFolder.SourceFolder, err)
            }
        }
    }

    if err := Watcher.AddRecursive(newHotFolder.SourceFolder); err != nil {
        events.Events.Warn(strErrorAddingHotFolder, newHotFolder.Name, err.Error())
        return false
    }
    hotFolders[newHotFolder.Name] = &newHotFolder
    return true
}

// waitForFileSystemEvents sits and reads filesystem events that are sent by the Watcher. Upon a new event,
// it will update the time for the most recent filesystem event received, and add any new filesystem events to the pending uploads.
// Note that one file being dragged into the hot folder may cause multiple filesystem events if it is large enough
func waitForFileSystemEvents() {
    for {
        select {
        case evt := <-Watcher.Event:
            if evt.IsDir() {
                continue
            }
            lastUpdated = time.Now()
            mtx.Lock()
            if !slices.Contains(pendingUploads, evt.Path) {
                pendingUploads = append(pendingUploads, evt.Path)
            }
            mtx.Unlock()
        case err := <-Watcher.Error:
            events.Events.Error(strErrorRunningHotFolder, err.Error())
        case <-Watcher.Closed:
            return
        default:
            time.Sleep(100 * time.Millisecond)
        }
    }
}

// processFileUpdates will periodically check if there are any pending hot folder uploads.
// An upload will not be started until time since the last filesystem event is greater than some value (10 seconds)
func processFileUpdates() {
    for {
        mtx.Lock()
        if len(pendingUploads) > 0 {
            duration := time.Since(lastUpdated)
            if duration > fileUpdateWaitTime {
                hotFolderUpload(pendingUploads)
                pendingUploads = pendingUploads[:0]
            }
        }
        mtx.Unlock()
        time.Sleep(time.Second)
    }
}

// hotFolderUpload takes a slice of files to upload, and checks which hot folder(s) the file belongs to.
// It then calls StartHotFolderUpload for each hot folder that the upload belongs to
func hotFolderUpload(inputFiles []string) {
    for _, hotFolder := range hotFolders {
        if !hotFolder.Enabled {
            continue
        }
        var uploads []string
        for _, inputFile := range inputFiles {
            if strings.HasPrefix(inputFile, hotFolder.SourceFolder) {
                key := strings.TrimPrefix(inputFile, hotFolder.SourceFolder)
                key = strings.TrimPrefix(key, string(filepath.Separator))
                key = filepath.Clean(key)
                uploads = append(uploads, key)
            }
        }
        if len(uploads) > 0 {
            jobName := buildJobName(uploads)
            StartHotFolderUpload(hotFolder, uploads, jobName)
        }
    }
}

// buildJobName builds the hot folder job name based on the files that will be uploaded by the hot folder
func buildJobName(filesToUpload []string) string {
    jobName := "Hot Folder - "
    if len(filesToUpload) > 0 {
        fileParts := strings.Split(filesToUpload[0], string(filepath.Separator))
        fileName := fileParts[len(fileParts)-1]
        jobName += fileName
    }
    if len(filesToUpload) > 1 {
        jobName += " & others"
    }
    return jobName
}

// StartHotFolderUpload Creates a job and starts an Upload for each remote configuration in the hot folder
func StartHotFolderUpload(hotFolder *HotFolder, keys []string, jobName string) {
    for transferProfileName, destinationFolder := range hotFolder.TransferProfilesAndDestinationFolders {
        transferProfile, err := globals.GetInstance().GetCfg().GetTransferProfile(transferProfileName)
        if err != nil {
            events.Events.Warn(strErrorGenericUpload, hotFolder.Name, err)
            continue
        }
        job, err := jobmanagertypes.NewJob(jobmanagertypes.JobConfig{
            Direction:       transfer.Upload,
            Name:            jobName,
            TransferProfile: &transferProfile,
            Sources:         keys,
            Destination:     trimHotFolderDestinationPath(destinationFolder, transferProfile.Bucket),
            Force:           true,
            UploadBasePath:  hotFolder.SourceFolder,
        })
        if err != nil {
            events.Events.Warn(strErrorUploadWithRemoteConfig, transferProfile.Name,
                hotFolder.Name, err)
            continue
        }
        upload.Uploader(job)
    }
}

// HotFolderUploadSourceDirectory Starts an upload for the entire source directory of a hot folder
func HotFolderUploadSourceDirectory(hotFolder *HotFolder) {
    fileParts := strings.Split(hotFolder.SourceFolder, string(filepath.Separator))
    hotFolderDir := fileParts[len(fileParts)-1]
    StartHotFolderUpload(hotFolder, []string{"."}, strings.Join([]string{"Hot Folder", hotFolderDir}, " - "))
}

// InitialHotFolderUpload is called when the daemon starts, and uploads the source directory of each hot folder
func InitialHotFolderUpload() {
    for _, hotFolder := range hotFolders {
        if hotFolder.Enabled {
            HotFolderUploadSourceDirectory(hotFolder)
        }
    }
}

// removeDuplicateNamedHotFolders checks for any duplicate-named hot folders from the config. If there is a duplicate,
// it deletes the entry from the hotfolder map and removes the listener if no other hot folders are using the same source folder.
// Returns a list of all hot folder names that had duplicates
func removeDuplicateNamedHotFolders() (duplicates []string) {
    hotFolderNamesCount := make(map[string]int)
    for _, hotFolder := range globals.GetInstance().GetCfg().UploadHotFolders {
        if _, alreadyExists := hotFolderNamesCount[hotFolder.Name]; alreadyExists {
            events.Events.Error(strDuplicateHotFolderName, hotFolder.Name)
            hotFolderNamesCount[hotFolder.Name]++
        } else {
            hotFolderNamesCount[hotFolder.Name] = 1
        }
    }
    for hotFolderName, count := range hotFolderNamesCount {
        if count != 1 {
            duplicates = append(duplicates, hotFolderName)
            // the entry will not exist when this function is ran for the first time
            if hotFolder, entryExists := hotFolders[hotFolderName]; entryExists {
                sourceFolder := hotFolder.SourceFolder
                delete(hotFolders, hotFolderName)
                if !IsSourceFolderStillUsed(sourceFolder) {
                    err := Watcher.RemoveRecursive(sourceFolder)
                    if err != nil {
                        events.Events.Warn(strErrorRemovingHotFolder, sourceFolder, err)
                    }
                }
            }
        }
    }
    return duplicates
}

// trimHotFolderDestinationPath trims common mistakes off of the hot folder destination path, so that it is in an acceptable format
func trimHotFolderDestinationPath(prefix string, bucket string) string {
    prefixTrims := []string{
        strings.Join([]string{"s3://", bucket, "/"}, ""),
        strings.Join([]string{"S3://", bucket, "/"}, ""),
        "s3://",
        "S3://",
        "/",
    }
    for _, prefixTrim := range prefixTrims {
        if strings.HasPrefix(prefix, prefixTrim) {
            events.Events.Info(strTrimmingHotFolder, prefixTrim, prefix)
            prefix = strings.TrimPrefix(prefix, prefixTrim)
        }
    }
    return prefix
}

func isSourceFolderValid(hotFolder HotFolder) bool {
    if hotFolder.SourceFolder == "" {
        events.Events.Error(strEmptySourceFolder, hotFolder.Name)
        return false
    }

    if !filepath.IsAbs(hotFolder.SourceFolder) {
        events.Events.Error(strSourceFolderNotAbsolute, hotFolder.Name, hotFolder.SourceFolder)
        return false
    }

    isAccessible, err := isBasePathAccessible(hotFolder.SourceFolder)
    if err != nil {
        events.Events.Error(strSourceFolderInaccessible, hotFolder.Name)
        return false
    }
    return isAccessible
}

func isBasePathAccessible(sourceFolder string) (bool, error) {
    info, err := os.Stat(sourceFolder)
    if err != nil {
        return false, err
    }

    if info == nil || !info.IsDir() {
        events.Events.Error(strSourceFolderInvalid, sourceFolder)
        return false, nil
    }
    return true, nil
}
