import { PanelLevel } from './notifications.constants';

export interface QueuedMessage {
    message: string;
    level: PanelLevel;
}

export interface NotificationHistoryEntry {
    timestamp: Date;
    message: string;
    level: PanelLevel;
}
