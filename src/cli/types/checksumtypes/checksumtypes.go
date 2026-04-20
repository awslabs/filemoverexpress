package checksumtypes

import (
	"encoding/json"
	"os"
	"time"

	"github.com/mitchellh/panicwrap"
	"go.etcd.io/bbolt"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/databasetypes"
)

//nolint:mnd
const (
	PruneCachedChecksumMaxAge    = -1 * (175 * time.Hour)
	PruneCachedChecksumFrequency = 30 * time.Minute
)

type (
	Checksum struct {
		MD5Hex   string
		XXHash   string
		XXHash64 string
		XXH3     string
	}

	ChecksumCacheObject struct {
		Size         int64     `json:"size"`
		LastModified time.Time `json:"last_modified"`
		Checksums    Checksum  `json:"checksums"`
		Timestamp    time.Time `json:"timestamp"`
	}
)

// init setups the automated checksum cache pruning system.
//
// To ensure the cache gets pruned regularly, but without having too tight of a loop as it can be expensive
// we first wait 10 seconds, to allow for the bbolt db and bucket(s) to be initialized. Then we enter our for loop,
// prune records, and then wait for 30 minutes until the next prune.
func init() {
	// Exit if we are running during E2E testing
	if _, found := os.LookupEnv("FME_E2E"); found {
		return
	}

	// Exit if we are not inside the wrapped panicwrap started function to avoid DB contention
	if _, found := os.LookupEnv(panicwrap.DEFAULT_COOKIE_KEY); !found {
		return
	}

	pruneInterval := 10
	go func() {
		<-time.After(time.Duration(pruneInterval) * time.Second)
		for {
			pruneChecksumCache()
			<-time.After(PruneCachedChecksumFrequency)
		}
	}()
}

func pruneChecksumCache() {
	db, err := databasetypes.New()
	if err != nil {
		events.Events.Error(strFailedInitializingDb, err)
		return
	}

	_ = db.DB.Update(func(tx *bbolt.Tx) error {
		pruneDate := time.Now().Add(PruneCachedChecksumMaxAge)
		b := tx.Bucket(databasetypes.BucketChecksumCache)
		c := b.Cursor()

		for k, v := c.First(); k != nil; k, v = c.Next() {
			var cobj ChecksumCacheObject
			err := json.Unmarshal(v, &cobj)
			if err != nil {
				return err
			}

			if cobj.Timestamp.Before(pruneDate) {
				if deleteErr := b.Delete(k); deleteErr != nil {
					events.Events.Warn("Failed to prune checksum cache record %s: %s", string(k), deleteErr.Error())
				}
			}
		}

		return nil
	})
}
