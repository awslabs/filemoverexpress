import { ThemePalette } from '@angular/material/core';

export type DropdownItemType = 'section-header' | 'section-item' | 'item';
// allowed colors for an icon in the dropdown
export type DropdownIconColor = 'inherit' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'white' | 'gray';
// Material icon font family style
export type DropdownIconStyle = 'filled' | 'outlined';

export interface DropdownFieldContent {
    text: string,
    leadingIcon?: DropdownIcon,
}

export type DropdownClickHandler = () => void;

export interface DropdownIcon {
    icon: string,
    iconColor: DropdownIconColor, // use 'inherit' if you don't want to set the color using iconColor
    iconThemePalette?: ThemePalette,
    style?: DropdownIconStyle,
    tooltipText?: string,
}

export interface ClickableIcon {
    id: string,
    type: 'action-icon',
    dropdownIcon: DropdownIcon,
    iconClickHandler: DropdownClickHandler,
}

// represents empty space with the same size as an icon
export interface PlaceholderEmptySpace {
    id: string,
    type: 'placeholder',
}

export type ActionIcon = ClickableIcon | PlaceholderEmptySpace;

export interface DropdownItem {
    id: string,
    type: DropdownItemType,
    text: string,
    tooltipText?: string,
    // Optional per-row status indicator rendered in the leading status slot (before
    // leadingIcon). When set, it replaces the default "selected row gets a check"
    // behavior and is shown on EVERY row that provides one, so rows stay aligned.
    statusIcon?: DropdownIcon,
    leadingIcon?: DropdownIcon,
    itemClickHandler?: DropdownClickHandler,
    actionIcons?: ActionIcon[],
}
