package notifications

import (
	"fmt"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/types/configtypes"
)

const urlHintTail = 4

// Upsert stores a destination's metadata in the config file and, when url is
// non-empty, its webhook URL in the encrypted store. The URL is never written to
// config. On an edit with an empty url the stored URL and its display hint are
// left unchanged. Returns the metadata as persisted.
func (m *Manager) Upsert(
	dest configtypes.NotificationDestination,
	url string,
) (configtypes.NotificationDestination, error) {
	if url != "" {
		if err := m.store.Save(dest.Name, url); err != nil {
			return dest, err
		}
		dest.URLHint = hintFor(url)
	} else if existing, ok := findDestination(config.LoadConfiguration(), dest.Name); ok {
		dest.URLHint = existing.URLHint
	}

	cfg := config.LoadConfiguration()
	cfg.Notifications.Destinations = applyDefault(
		replaceDestination(cfg.Notifications.Destinations, dest), dest,
	)
	if err := config.SaveConfig(&cfg); err != nil {
		return dest, fmt.Errorf("save config: %w", err)
	}
	return dest, nil
}

// Remove deletes a destination's metadata from config and its stored URL.
func (m *Manager) Remove(name string) error {
	cfg := config.LoadConfiguration()
	cfg.Notifications.Destinations = removeDestination(cfg.Notifications.Destinations, name)
	if err := config.SaveConfig(&cfg); err != nil {
		return fmt.Errorf("save config: %w", err)
	}
	return m.store.Delete(name)
}

func replaceDestination(
	list []configtypes.NotificationDestination,
	dest configtypes.NotificationDestination,
) []configtypes.NotificationDestination {
	out := make([]configtypes.NotificationDestination, 0, len(list)+1)
	replaced := false
	for _, d := range list {
		if d.Name == dest.Name {
			out = append(out, dest)
			replaced = true
			continue
		}
		out = append(out, d)
	}
	if !replaced {
		out = append(out, dest)
	}
	return out
}

func removeDestination(
	list []configtypes.NotificationDestination,
	name string,
) []configtypes.NotificationDestination {
	out := make([]configtypes.NotificationDestination, 0, len(list))
	for _, d := range list {
		if d.Name != name {
			out = append(out, d)
		}
	}
	return out
}

// applyDefault clears is_default on every other destination when dest is default.
func applyDefault(
	list []configtypes.NotificationDestination,
	dest configtypes.NotificationDestination,
) []configtypes.NotificationDestination {
	if !dest.IsDefault {
		return list
	}
	for i := range list {
		list[i].IsDefault = list[i].Name == dest.Name
	}
	return list
}

func hintFor(url string) string {
	if len(url) <= urlHintTail {
		return "..."
	}
	return "..." + url[len(url)-urlHintTail:]
}
