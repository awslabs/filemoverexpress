package supportfile

import "os"

type (
    createZipFileOutput struct {
        outputFile string
        outputDir  string
        fh         *os.File
    }
)
