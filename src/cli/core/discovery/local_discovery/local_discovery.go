package local_discovery

import (
    "fmt"
    "os"
    "path"
    "path/filepath"

    "github.com/awslabs/filemoverexpress/core/discovery"
    transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
    "github.com/awslabs/filemoverexpress/utils/fs"
)

type LocalDiscovery struct {
    prefix      string
    jobId       string
    pathToStrip string
}

// NewLocalDiscovery returns a new LocalDiscovery
func NewLocalDiscovery(prefix string, jobId string, pathToStrip string) LocalDiscovery {
    return LocalDiscovery{
        prefix:      prefix,
        jobId:       jobId,
        pathToStrip: pathToStrip,
    }
}

// Discover is responsible for recursively listing all files for each of the paths provided,
// and calculating the destination object key for the S3 destination
func (ld *LocalDiscovery) Discover(paths []string) ([]*jobmanagertypes.Task, []error) {
    output := make([]*jobmanagertypes.Task, 0)
    discoveryErrors := make([]error, 0)

    for _, sourcePath := range paths {
        if err := discovery.ValidatePathLength(sourcePath); err != nil {
            discoveryErrors = append(discoveryErrors, err)
            continue
        }

        pathExists, err := fs.PathExists(sourcePath)
        if err != nil {
            discoveryErrors = append(discoveryErrors, err)
            continue
        }

        // nolint:nestif
        if pathExists {
            if err := discovery.ValidateSourceSymlink(sourcePath); err != nil {
                discoveryErrors = append(discoveryErrors, fmt.Errorf("%s: %s", sourcePath, err))
                continue
            }

            pathIsFile, err := fs.PathIsFile(sourcePath)
            if err != nil {
                discoveryErrors = append(discoveryErrors, err)
                continue
            }

            if pathIsFile {
                task, err := ld.processFile(sourcePath)
                if err != nil {
                    discoveryErrors = append(discoveryErrors, err)
                    continue
                }
                output = append(output, task)
            } else {
                tasks, errs := ld.processDir(sourcePath)
                output = append(output, tasks...)
                discoveryErrors = append(discoveryErrors, errs...)
            }
        } else {
            discoveryErrors = append(discoveryErrors, discovery.NewDiscoveryError(discovery.StrSourceDoesNotExists, sourcePath))
        }
    }

    return output, discoveryErrors
}

func (ld *LocalDiscovery) calculateDestination(source string) (string, error) {
    var destination string
    var err error
    if ld.pathToStrip != "" {
        source, err = filepath.Rel(ld.pathToStrip, source)
        if err != nil {
            return "", err
        }
    }
    if ld.prefix != "" {
        destination = path.Join(ld.prefix, source)
    } else {
        destination = source
    }
    destination = path.Clean(filepath.ToSlash(destination))
    if transferapi.ContainsUnsafeS3Chars(destination) {
        events.Events.Warn(discovery.StrContainsUnsafeChars, destination)
    }
    return destination, nil
}

// processFile is a helper function to validate and process a single file source
func (ld *LocalDiscovery) processFile(sourcePath string) (*jobmanagertypes.Task, error) {
    if err := discovery.ValidatePathLength(sourcePath); err != nil {
        return nil, discovery.NewDiscoveryError(discovery.StrPathTooLong, sourcePath)
    }

    if err := discovery.ValidateFileAccess(sourcePath); err != nil {
        return nil, err
    }

    fileInfo, err := os.Stat(sourcePath)
    if err != nil {
        return nil, discovery.NewDiscoveryError(discovery.StrFailedGettingFileInfo, sourcePath, err)
    }

    destination, err := ld.calculateDestination(sourcePath)
    if err != nil {
        return nil, discovery.NewDiscoveryError(discovery.StrFailedCalculatingDestination, sourcePath, err)
    }

    task, err := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
        Destination: destination,
        LocalFile: jobmanagertypes.LocalFile{
            LastModified: fileInfo.ModTime(),
            Path:         sourcePath,
            Size:         fileInfo.Size(),
        },
        JobId:         ld.jobId,
        TaskDirection: jobmanagertypes.TaskDirectionUpload,
    })
    if err != nil {
        return nil, err
    }

    return task, nil
}

// processDir is a helper function to recursively walk a directory and return a list of Task and errors
func (ld *LocalDiscovery) processDir(sourcePath string) ([]*jobmanagertypes.Task, []error) {
    output := make([]*jobmanagertypes.Task, 0)
    discoveryErrors := make([]error, 0)

    walkErr := filepath.Walk(sourcePath, func(filePath string, info os.FileInfo, walkFnErr error) error {
        if walkFnErr != nil {
            return walkFnErr
        }

        if err := discovery.ValidateSourceSymlink(filePath); err != nil {
            discoveryErrors = append(discoveryErrors, fmt.Errorf("%s: %s", filePath, err))
            return nil
        }

        if !info.IsDir() {
            if err := discovery.ValidatePathLength(filePath); err != nil {
                discoveryErrors = append(discoveryErrors, discovery.NewDiscoveryError(discovery.StrPathTooLong, filePath))
                return nil
            }

            if err := discovery.ValidateFileAccess(sourcePath); err != nil {
                discoveryErrors = append(discoveryErrors, err)
                return nil
            }
            destination, err := ld.calculateDestination(filePath)
            if err != nil {
                discoveryErrors = append(
                    discoveryErrors,
                    discovery.NewDiscoveryError(discovery.StrFailedCalculatingDestination, sourcePath, err),
                )
                return nil
            }
            task, err := jobmanagertypes.NewTask(jobmanagertypes.TaskConfig{
                Destination: destination,
                LocalFile: jobmanagertypes.LocalFile{
                    LastModified: info.ModTime(),
                    Path:         filePath,
                    Size:         info.Size(),
                },
                JobId:         ld.jobId,
                TaskDirection: jobmanagertypes.TaskDirectionUpload,
            })
            if err != nil {
                discoveryErrors = append(discoveryErrors, err)
                return nil
            }
            output = append(output, task)
        }
        return nil
    })
    if walkErr != nil {
        discoveryErrors = append(discoveryErrors, discovery.NewDiscoveryError(discovery.StrFailedListingDir, walkErr))
    }

    return output, discoveryErrors
}
