package service

import (
	"testing"

	"github.com/awslabs/filemoverexpress/types/configtypes"
)

func TestValidateNotificationDestinations(t *testing.T) {
	var ok configtypes.FmeConfig
	ok.Notifications.Destinations = []configtypes.NotificationDestination{
		{Name: "Slack"}, {Name: "team-ops"}, {Name: "v1..2"},
	}
	if err := validateNotificationDestinations(ok); err != nil {
		t.Fatalf("valid destination names rejected: %v", err)
	}

	for _, bad := range []string{"../oidc-tokens/prod", "a/b", `a\b`, "a:b", "CON", ""} {
		var cfg configtypes.FmeConfig
		cfg.Notifications.Destinations = []configtypes.NotificationDestination{{Name: bad}}
		if err := validateNotificationDestinations(cfg); err == nil {
			t.Errorf("destination name %q accepted, want rejection", bad)
		}
	}
}
