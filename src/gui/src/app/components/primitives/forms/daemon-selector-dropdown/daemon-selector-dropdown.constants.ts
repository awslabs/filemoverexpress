import { DropdownIcon } from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.interfaces';

export const PLACEHOLDER_TEXT = 'File System';

export const STAR_ICON: DropdownIcon = {
    icon: 'star',
    iconColor: 'yellow',
};

export const DISCONNECTED_ICON: DropdownIcon = {
    // Hollow grey ring — a calm "not connected" marker (the panel's connection pill is
    // the authoritative state). Rendered as a CSS shape so it's a clean ring.
    icon: '',
    iconColor: 'gray',
    shape: 'ring',
};

export const CONNECTING_ICON: DropdownIcon = {
    // Solid orange dot while connecting.
    icon: '',
    iconColor: 'orange',
    shape: 'dot',
};

export const CONNECTED_ICON: DropdownIcon = {
    // Solid green dot when connected (matches the approved menu mockup).
    icon: '',
    iconColor: 'green',
    shape: 'dot',
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
