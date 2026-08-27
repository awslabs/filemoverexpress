import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { CHECK_ICON } from './select-menu-dropdown.constants';
import { ActionIcon, DropdownIcon, DropdownItem } from './select-menu-dropdown.interfaces';

@Component({
    selector: 'fme-select-menu-dropdown',
    templateUrl: './select-menu-dropdown.component.html',
    styleUrls: ['./select-menu-dropdown.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        NgClass,
        MatMenuTrigger,
        NgTemplateOutlet,
        MatIcon,
        MatMenu,
        MatTooltip,
    ],
})
export class SelectMenuDropdownComponent {
    dropdownItems = input.required<DropdownItem[]>();
    disabled = input<boolean>(false);
    placeholder = input<string>('');
    selectedValue = input<string | null>(null);
    fieldLeadingIcon = input<DropdownIcon | null>(null);

    protected selectedField = computed(() => {
        if (this.selectedValue()) {
            const selectedItem =
                this.dropdownItems().find((dropdownItem) => dropdownItem.text === this.selectedValue());
            if (selectedItem) {
                return {
                    text: selectedItem.text,
                    leadingIcon: selectedItem.leadingIcon,
                };
            }
        }

        return {
            text: this.placeholder(),
        };
    });
    // selectedFieldContent: DropdownFieldContent = {text: ''};
    protected readonly CHECK_ICON = CHECK_ICON;

    /**
     * Calls the dropdown row's click handler function if it has one. If there is no click handler, nothing happens
     * and the menu does not close
     * @param event Mouse click event
     * @param dropdownRow Row that was clicked on
     */
    handleRowClick(event: Event, dropdownRow: DropdownItem) {
        if (dropdownRow.itemClickHandler) {
            dropdownRow.itemClickHandler();
        } else {
            event.stopPropagation();
        }
    }

    /**
     * Calls the icon's handler function if it is a ClickableIcon, or else handles the click as clicking on the row
     * since the icon is actually an empty placeholder space
     * @param event Mouse click event
     * @param actionIcon Icon that was clicked on
     * @param dropdownRow DropdownItem row that the icon is in
     */
    handleIconClick(event: MouseEvent, actionIcon: ActionIcon, dropdownRow: DropdownItem) {
        if (actionIcon.type === 'action-icon') {
            actionIcon.iconClickHandler();
        } else {
            this.handleRowClick(event, dropdownRow);
        }
    }
}
