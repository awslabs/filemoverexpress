import { DropdownIcon } from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.interfaces';

export const PLACEHOLDER_TEXT = 'File System';

export const STAR_ICON: DropdownIcon = {
    icon: 'star',
    iconColor: 'yellow',
};

export const DISCONNECTED_ICON: DropdownIcon = {
    icon: 'remove_circle_outline',
    iconColor: 'red',
    style: 'outlined',
};

export const CONNECTING_ICON: DropdownIcon = {
    icon: 'pending',
    iconColor: 'gray',
    style: 'outlined',
};

export const CONNECTED_ICON: DropdownIcon = {
    icon: 'check_circle_outline',
    iconColor: 'green',
    style: 'outlined',
};
