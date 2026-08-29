import { DropdownIcon } from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.interfaces';

export const PLACEHOLDER_TEXT = 'File System';

export const STAR_ICON: DropdownIcon = {
    icon: 'star',
    iconColor: 'yellow',
};

export const DISCONNECTED_ICON: DropdownIcon = {
    // Neutral, muted "not connected" indicator. The old red remove_circle_outline read
    // like an error; connection state is now surfaced authoritatively by the panel's
    // connection pill, so this only needs a calm at-a-glance marker.
    icon: 'radio_button_unchecked',
    iconColor: 'gray',
    style: 'outlined',
};

export const CONNECTING_ICON: DropdownIcon = {
    icon: 'pending',
    iconColor: 'orange',
    style: 'outlined',
};

export const CONNECTED_ICON: DropdownIcon = {
    icon: 'check_circle_outline',
    iconColor: 'green',
    style: 'outlined',
};

// Type marker for the built-in local daemon row (this computer).
export const LOCAL_DAEMON_ICON: DropdownIcon = {
    icon: 'computer',
    iconColor: 'inherit',
};

// Type marker for a remote daemon row, so remote daemons are visually
// distinct from the local file system at a glance in the selector.
export const REMOTE_DAEMON_ICON: DropdownIcon = {
    icon: 'dns',
    iconColor: 'inherit',
};
