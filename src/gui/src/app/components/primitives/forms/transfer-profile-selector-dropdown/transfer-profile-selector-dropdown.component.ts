import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { SelectMenuDropdownComponent } from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.component';
import { ADD_ICON, EDIT_ICON, TRASH_ICON } from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.constants';
import { ActionIcon, DropdownItem } from '@primitives/forms/select-menu-dropdown/select-menu-dropdown.interfaces';
import { MetadataService } from '@services/metadata/metadata.service';
import { TransferProfileService } from '@services/transfer-profile/transfer-profile.service';
import { CLOUD_ICON, PLACEHOLDER_TEXT } from './transfer-profile-selector-dropdown.constants';

@Component({
    selector: 'fme-transfer-profile-selector-dropdown',
    templateUrl: './transfer-profile-selector-dropdown.component.html',
    styleUrls: ['./transfer-profile-selector-dropdown.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [SelectMenuDropdownComponent],
})
export class TransferProfileSelectorDropdownComponent {
    protected readonly PLACEHOLDER_TEXT = PLACEHOLDER_TEXT;
    protected txpService = inject(TransferProfileService);
    private metadata = inject(MetadataService);
    currentTransferProfile = computed(() => this.txpService.transferProfileStateSig()?.currentTransferProfile);
    disabled = computed(() => !this.txpService.transferProfileStateSig()?.transferProfileList);
    private allowUiConfiguration = computed(() => !!this.metadata.metadataSig().permissions?.allowUiConfiguration);
    protected dropdownItems = computed(() => {
        const transferProfiles = this.txpService.transferProfileStateSig();
        if (!transferProfiles.transferProfileList) {
            return [];
        }

        return [
            this.createTransferProfileHeaderRow(),
            ...transferProfiles.transferProfileList.map(
                (itm) => this.createTransferProfileNameSubRow(itm, this.allowUiConfiguration()),
            ),
            this.createAddTransferProfileSubRow(),
        ];
    });

    /**
     * Creates the DropdownItem row for section title in the dropdown
     * @private
     */
    private createTransferProfileHeaderRow(): DropdownItem {
        return {
            id: 'transfer-profile-header-row',
            type: 'label',
            text: 'Remote Configurations',
        };
    }

    /**
     * Creates the DropdownItem row for a transfer profile in the dropdown
     * @param transferProfile Transfer profile name to display
     * @param allowUiConfiguration
     * @private
     */
    private createTransferProfileNameSubRow(transferProfile: string, allowUiConfiguration: boolean): DropdownItem {
        let actionIcons: ActionIcon[] = [];
        if (allowUiConfiguration) {
            actionIcons = [
                {
                    id: 'edit-action-icon',
                    type: 'action-icon',
                    dropdownIcon: EDIT_ICON,
                    iconClickHandler: () => {
                        this.editTransferProfile(transferProfile);
                    },
                }, {
                    id: 'delete-action-icon',
                    type: 'action-icon',
                    dropdownIcon: TRASH_ICON,
                    iconClickHandler: () => {
                        this.deleteTransferProfile(transferProfile);
                    },
                },
            ];
        }
        return {
            id: `transfer-profile-name-sub-row-${transferProfile}`,
            type: 'section-item',
            leadingIcon: CLOUD_ICON,
            text: transferProfile,
            actionIcons: actionIcons,
            itemClickHandler: () => {
                this.selectTransferProfile(transferProfile);
            },
        };
    }

    /**
     * Creates the DropdownItem row for the add transfer profile option in the dropdown
     * @private
     */
    private createAddTransferProfileSubRow(): DropdownItem {
        if (this.allowUiConfiguration()) {
            return {
                id: 'add-transfer-profile-sub-row',
                type: 'section-item',
                leadingIcon: {...ADD_ICON, iconColor: 'blue'},
                textColor: 'blue',
                dividerAbove: true,
                text: 'Add Remote Configuration...',
                itemClickHandler: () => {
                    this.addTransferProfile();
                },
            };
        }
        return {
            id: 'add-transfer-profile-sub-row',
            type: 'section-item',
            leadingIcon: {...ADD_ICON, iconColor: 'blue'},
            textColor: 'blue',
            dividerAbove: true,
            text: 'Add Remote Configuration...',
            tooltipText: `The configuration for this daemon doesn't allow editing it through the GUI.
            Update the configuration file on the daemon machine to add a Remote Configuration.`,
        };
    }

    /**
     * Uses TransferProfileService to set the currently selected transfer profile
     * @param transferProfile Name of the transfer profile to select
     * @private
     */
    private selectTransferProfile(transferProfile: string) {
        this.txpService.select(transferProfile);
    }

    /**
     * Uses the TransferProfileService to open the transfer profile editor for a given transfer profile
     * @param transferProfile Name of the transfer profile to edit
     * @private
     */
    private editTransferProfile(transferProfile: string) {
        this.txpService.edit(transferProfile);
    }

    /**
     * Uses the TransferProfileService to delete the given transfer profile if the user confirms in the confirmation modal
     * @param transferProfile Name of the transfer profile to delete
     * @private
     */
    private deleteTransferProfile(transferProfile: string) {
        this.txpService.delete(transferProfile);
    }

    /**
     * Uses the TransferProfileService to open the transfer profile editor to add a new transfer profile
     * @private
     */
    private addTransferProfile() {
        this.txpService.add();
    }
}
