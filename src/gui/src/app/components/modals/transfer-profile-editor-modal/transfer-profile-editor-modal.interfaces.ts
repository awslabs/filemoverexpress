import { TransferProfile } from '@app/classes/config';
import { EditorMode } from '@containers/forms/transfer-profile-form/transfer-profile-form.interfaces';

export interface TransferProfileEditorModalData {
    transferProfile?: TransferProfile,
    mode: EditorMode,
}
