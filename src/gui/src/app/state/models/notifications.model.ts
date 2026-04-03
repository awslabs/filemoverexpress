import { PanelLevel } from '@services/notifications/notifications.constants';

export interface FTNotification {
    id: string;
    timestamp: Date;
    message: string;
    level: PanelLevel;
}
