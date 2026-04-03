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
