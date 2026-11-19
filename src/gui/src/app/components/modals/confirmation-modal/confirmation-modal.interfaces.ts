import { ThemePalette } from '@angular/material/core';
import { ButtonType } from '@primitives/buttons/button/button.interfaces';

export interface ConfirmationModalData {
    cancelText: string;
    confirmText: string;
    message: string;
    title: string;
    cancelType: ButtonType;
    confirmType: ButtonType;
    cancelClass: ThemePalette | null;
    confirmClass: ThemePalette | null;
    // When set, an acknowledgement checkbox with this label is shown and the
    // confirm button stays disabled until it is checked. Used by the pre-upload
    // verification gate so "Upload anyway" is a deliberate, acknowledged choice.
    acknowledgeText?: string;
}

export const ConfirmationModalDataDefaults: ConfirmationModalData = {
    cancelText: 'Cancel',
    confirmText: 'Confirm',
    message: '',
    title: '',
    cancelType: 'stroked',
    confirmType: 'filled',
    cancelClass: null,
    confirmClass: null,
};
