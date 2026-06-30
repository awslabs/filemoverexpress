package e2e

import (
	"context"
	"log"
	"os"
	"path"
	"regexp"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestMetadataRefresh_ClientEdit(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping e2e tests in short mode")
	}
	//skipping this test — it needs to be reworked for the koanf-based config system
	t.Skip()
	setUp()

	go assertMetadataRefreshOnClientEdit(t)

	out, err := executeCommand("daemon")
	if err != nil && err.Error() != "exit status 1" {
		t.Log(out)
		log.Fatalf("failed setting configs: %s", err.Error())
		return
	}

	assert.Contains(t, out, "GRPC host is shutting down. Reason: User-initiated daemon mode shutdown.")
}

func assertMetadataRefreshOnClientEdit(t *testing.T) {
	client, stream := getFmeClientAndStream()
	go scheduleShutdown(t, client)

	// save initial config
	configFile := path.Join(config.GetConfigDir(), config.GetConfigName()+"."+constants.ConfigFileExt)
	oldConfig, err := os.ReadFile(configFile)
	if err != nil {
		log.Fatalf("%s", err.Error())
	}

	getCfgRequest := fmev1.GetConfigurationRequest{}
	resp, err := client.GetConfiguration(context.TODO(), req[fmev1.GetConfigurationRequest](&getCfgRequest))
	if err != nil {
		log.Fatalf("Unable to connect to grpc host to get configuration... exiting")
	}
	initialConfig := resp.Msg
	assert.IsType(t, &fmev1.GRPCFmeConfig{}, initialConfig)
	assert.Equal(t, 1, len(initialConfig.Protocols.S3.TransferProfiles))

	// watch for metadata events
	metadataEvtCount := 0
	expectedMetadataEvtCount := 2
	configEdit := "e2e-test-local-path123"
	//go func() {
evtLoop:
	for {
		if success := stream.Receive(); !success {
			t.Fatalf("Stream receive failed: %s", stream.Err())
		}

		resp := stream.Msg()
		if resp.EventType == fmev1.EventType_EVENT_TYPE_METADATA_EVENT_TYPE {
			metadataEvtCount++
			time.Sleep(time.Second)

			// if we just got initial metadata event, edit config through client
			if metadataEvtCount == 1 {
				success := false
				initialConfig.Protocols.S3.TransferProfiles["e2e-test"].Paths.Local = configEdit
				for i := 0; i < 5 && !success; i++ {
					_, setErr := client.SetConfiguration(context.TODO(), req[fmev1.GRPCFmeConfig](initialConfig))
					if setErr != nil {
						t.Logf("Failed setting configuration, attempt no %d: %s", i+1, setErr)
						time.Sleep(time.Second)
						continue
					}
					success = true
				}
				if !success {
					log.Fatal("Unable to connect to grpc host to set configuration... exiting")
				}
			}

			// if we got all the expected metadata events, exit
			if metadataEvtCount == expectedMetadataEvtCount {
				_, err = client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
				if err != nil {
					t.Errorf("Failed to shutdown daemon: %s", err)
				}
				break evtLoop
			}
		}

		time.Sleep(time.Millisecond)
	}

	// assert all metadata events received
	assert.Equal(t, expectedMetadataEvtCount, metadataEvtCount, "Expected %d MetadataEvents, Received %d",
		expectedMetadataEvtCount, metadataEvtCount)
	// assert that config file has our edit
	rgx := regexp.MustCompile(configEdit)
	editedConfig, readErr := os.ReadFile(configFile)
	if readErr != nil {
		log.Fatalf("%s", readErr.Error())
	}
	foundVendorEdit := rgx.Find(editedConfig)
	assert.NotNil(t, foundVendorEdit, "Expected to find %s in edited config, but wasn't there", configEdit)

	// change config file back to initial
	err = os.WriteFile(configFile, oldConfig, 0644)
	if err != nil {
		log.Fatal(err)
	}
	//}()
}
