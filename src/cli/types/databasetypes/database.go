package databasetypes

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"os"
	"os/user"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"go.etcd.io/bbolt"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/events"
	ftErrors "github.com/awslabs/filemoverexpress/fme-errors"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

const (
	MaxTransferRecords           = 30
	PruneTransferRecordFrequency = 2 * time.Minute
)

var (
	db                  = Database{}
	DBLock              = sync.Mutex{}
	BucketObjects       = []byte("objects")
	BucketTimestamps    = []byte("list_timestamps")
	BucketUploads       = []byte("uploads")
	BucketDownloads     = []byte("downloads")
	BucketChecksumCache = []byte("checksum_cache")
)

type (
	AddDownloadRecordInput struct {
		Bucket       string
		Key          string
		Destination  string
		LastModified time.Time
		Size         int64
		Start        time.Time
		End          time.Time
		Region       string
	}
	DatabaseObject struct {
		Bucket       string
		Key          string
		Destination  string
		Size         int64
		LastModified time.Time
	}
	DownloadRecord struct {
		ID          int
		S3Bucket    string
		Region      string
		Destination string
		Size        int64
		Start       time.Time
		End         time.Time
	}
	UploadRecord struct {
		ID       int
		Source   string
		S3Bucket string
		Region   string
		Size     int64
		Start    time.Time
		End      time.Time
	}
	Database struct {
		DB          *bbolt.DB
		initialized bool
	}
	ChecksumRecord struct {
		LastModified time.Time
		Size         int64
		MD5Hex       string
		XXHash       string
		XXHash64     string
		XXH3         string
	}
)

// BuildKey returns a byte-array key value for a Database record
func (obj *DatabaseObject) BuildKey() []byte {
	return []byte(strings.Join([]string{obj.Bucket, obj.Key}, "/"))
}

// Initialize sets up the Database, creating it if necessary, and then opens the Database
func (db *Database) Initialize() error {
	usr, err := user.Current()
	if err != nil {
		return err
	}
	database, err := openDatabase(getDbFile(usr))
	if err != nil {
		return err
	}

	err = performInitTransaction(database)
	if err != nil {
		return err
	}

	db.DB = database

	go db.cleanupLoop()
	return nil
}

func openDatabase(dbFile string) (*bbolt.DB, error) {
	database, err := bbolt.Open(dbFile, 0644, &bbolt.Options{Timeout: 5 * time.Second})
	if err != nil {
		if err.Error() == "timeout" {
			events.Events.Fatal(strUnableToObtainDbLock, constants.ProductCLIName)
		}
		return nil, err
	}
	return database, err
}

func getDbFile(usr *user.User) string {
	dbDir, exists := os.LookupEnv("FME_CONFIG_DIR")
	if !exists {
		dbDir = path.Join(usr.HomeDir, constants.DefaultAppDir)
	}
	dbFile := path.Join(dbDir, constants.DatabaseFilename)
	return dbFile
}

func performInitTransaction(database *bbolt.DB) error {
	tx, err := database.Begin(true)
	if err != nil {
		return err
	}

	err = initBuckets(tx)
	if err != nil {
		return err
	}

	err = tx.Commit()
	return err
}

func initBuckets(tx *bbolt.Tx) error {
	buckets := [][]byte{
		BucketObjects,
		BucketUploads,
		BucketDownloads,
		BucketTimestamps,
		BucketChecksumCache,
	}

	for _, bucket := range buckets {
		_, err := tx.CreateBucketIfNotExists(bucket)
		if err != nil {
			return err
		}
	}

	return nil
}

func (db *Database) cleanupLoop() {
	for {
		<-time.After(PruneTransferRecordFrequency)
		go db.pruneTransferRecords(BucketUploads)
		go db.pruneTransferRecords(BucketDownloads)
	}
}

func (db *Database) pruneTransferRecords(boltBucket []byte) {
	err := db.DB.Batch(func(tx *bbolt.Tx) error {
		b := tx.Bucket(boltBucket)

		c := b.Cursor()
		counter := 0
		for k, _ := c.Last(); k != nil; k, _ = c.Prev() {
			counter++
			if counter > MaxTransferRecords {
				if deleteErr := b.Delete(k); deleteErr != nil {
					events.Events.Warn("Failed to delete transfer record %s: %s", string(k), deleteErr.Error())
				}
			}
		}

		return nil
	})

	if err != nil {
		events.Events.Warn("Failed to prune transfer records: %s", err)
	}
}

// FindObject searches the Database for the provided path. It takes the path and builds the Key to search for and
// returns the object if found. If the object is not found, an error with value of "no such key" is returned
func (db *Database) FindObject(objPath []byte) (DatabaseObject, error) {
	var object DatabaseObject
	err := db.DB.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketObjects)
		res := b.Get(objPath)

		if len(res) == 0 {
			return ftErrors.ErrDBNoSuchKey
		}

		err := json.Unmarshal(res, &object)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return DatabaseObject{}, err
	}

	return object, nil
}

// StoreObject takes a DatabaseObject, and stores it in the Database
func (db *Database) StoreObject(obj DatabaseObject) error {
	return db.DB.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketObjects)
		marshalled, err := json.Marshal(obj)
		if err != nil {
			return err
		}
		key := BuildKey(obj.Bucket, obj.Key, obj.Destination)
		return b.Put(key, marshalled)
	})
}

// BulkStoreObjects takes a slice of DatabaseObject's to add to the local cache of already downloaded files
func (db *Database) BulkStoreObjects(objects []*DatabaseObject) error {
	DBLock.Lock()
	defer DBLock.Unlock()
	return db.DB.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketObjects)
		for _, obj := range objects {
			marshalled, err := json.Marshal(obj)
			if err != nil {
				return err
			}
			key := BuildKey(obj.Bucket, obj.Key, obj.Destination)
			err = b.Put(key, marshalled)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func (db *Database) CreateUploadRecord(u *UploadRecord) error {
	return db.DB.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketUploads)

		id, err := b.NextSequence()
		if err != nil {
			return errors.New("upload record sequence ID overflow: " + err.Error())
		}

		entityID, err := safeconv.Uint64ToInt(id)
		if err != nil {
			return errors.New("upload record sequence ID overflow: " + err.Error())
		}
		u.ID = entityID

		buf, err := json.Marshal(u)
		if err != nil {
			return err
		}

		key, err := itob(u.ID)
		if err != nil {
			return err
		}
		return b.Put(key, buf)
	})
}

func (db *Database) CreateDownloadRecord(u *DownloadRecord) error {
	return db.DB.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketDownloads)

		id, err := b.NextSequence()
		if err != nil {
			return errors.New("download record sequence ID overflow: " + err.Error())
		}

		entityID, err := safeconv.Uint64ToInt(id)
		if err != nil {
			return errors.New("download record sequence ID overflow: " + err.Error())
		}
		u.ID = entityID

		buf, err := json.Marshal(u)
		if err != nil {
			return err
		}

		key, err := itob(u.ID)
		if err != nil {
			return err
		}
		return b.Put(key, buf)
	})
}

func (db *Database) AddDownloadRecords(adri AddDownloadRecordInput) error {
	err := db.StoreObject(DatabaseObject{
		Bucket:       adri.Bucket,
		Key:          adri.Key,
		Destination:  adri.Destination,
		LastModified: time.Now(),
		Size:         adri.Size,
	})

	if err != nil {
		return errors.New(strFailedToUpdateDb)
	}
	return nil
}

// GetCachedChecksum takes a file path and checks to see if there is a corresponding ChecksumRecord in the database. If there is no record
// found, GetCachedChecksum will return a ft_errors.ErrChecksumNotCached error
func (db *Database) GetCachedChecksum(fsPath string) (ChecksumRecord, error) {
	var itm ChecksumRecord
	key := []byte(fsPath)

	DBLock.Lock()
	err := db.DB.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketChecksumCache)
		res := b.Get(key)

		if len(res) == 0 {
			return ftErrors.ErrChecksumNotCached
		}

		err := json.Unmarshal(res, &itm)
		if err != nil {
			logger.Error("Failed to unmarshal checksum cache for %s: %s", fsPath, err)
		}
		return err
	})
	DBLock.Unlock()

	return itm, err
}

// StoreChecksumCache takes a file path and ChecksumRecord and stores it in the database
func (db *Database) StoreChecksumCache(fsPath string, checksums ChecksumRecord) error {
	absPath, absErr := filepath.Abs(fsPath)
	if absErr != nil {
		logger.Error("Failed to get absolute path for %s: %s", fsPath, absErr)
	}

	DBLock.Lock()
	defer DBLock.Unlock()

	err := db.DB.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketChecksumCache)
		marshalled, err := json.Marshal(checksums)
		if err != nil {
			return err
		}

		key := []byte(absPath)

		return b.Put(key, marshalled)
	})

	return err
}

// DeleteCachedChecksum removes a record from the checksum cache bucket, if present
func (db *Database) DeleteCachedChecksum(fsPath string) error {
	DBLock.Lock()
	defer DBLock.Unlock()
	key := []byte(fsPath)
	return db.DB.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketChecksumCache)
		return b.Delete(key)
	})
}

// convert integer to 8bit big endian
//
//nolint:gci
func itob(v int) ([]byte, error) {
	sequenceValue, err := safeconv.IntToUint64(v)
	if err != nil {
		return nil, errors.New("sequence value conversion overflow: " + err.Error())
	}

	bits := 8
	b := make([]byte, bits)
	binary.BigEndian.PutUint64(b, sequenceValue)
	return b, nil
}

func (db *Database) Delete(dbKey []byte) error {
	DBLock.Lock()
	defer DBLock.Unlock()
	return db.DB.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(BucketObjects)
		return b.Delete(dbKey)
	})
}

func (db *Database) Close() {
	err := db.DB.Close()
	if err != nil {
		events.Events.Warn(strFailedToCloseDbConnection, err)
		return
	}
	db.initialized = false
}

// BuildKey takes bucket, key and destination strings and returns the Database key value for the object
func BuildKey(bucket string, key string, destination string) []byte {
	destination = strings.TrimSuffix(destination, "/")
	h := sha256.New()
	_, err := h.Write([]byte(bucket + key + destination))
	if err != nil {
		events.Events.Error(strFailedUpdatingDb, err)
	}
	return h.Sum(nil)
}

func New() (*Database, error) {
	DBLock.Lock()
	defer DBLock.Unlock()

	if !db.initialized {
		db = Database{}
		if err := db.Initialize(); err != nil {
			events.Events.Fatal(strFailedInitializingDb, err)
			return nil, err
		}
		db.initialized = true
	}

	return &db, nil
}
