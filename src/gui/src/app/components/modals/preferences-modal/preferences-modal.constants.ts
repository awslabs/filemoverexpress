import { PrefsAutoHideDelay, PrefsDaemonShutdown, PrefsPosition } from './preferences-modal.interfaces';

export const NotificationDelay: PrefsAutoHideDelay[] = [
    {
        name: '2.5 seconds',
        value: 2500,
    },
    {
        name: '5 seconds',
        value: 5000,
    },
    {
        name: '10 seconds',
        value: 10000,
    },
    {
        name: 'Disabled',
        value: -1,
    },
];

export const NotificationPositions: PrefsPosition[] = [
    {
        name: 'Top left',
        position: {
            horizontal: 'left',
            vertical: 'top',
        },
    },
    {
        name: 'Top center',
        position: {
            horizontal: 'center',
            vertical: 'top',
        },
    },
    {
        name: 'Top right',
        position: {
            horizontal: 'right',
            vertical: 'top',
        },
    },
    {
        name: 'Bottom left',
        position: {
            horizontal: 'left',
            vertical: 'bottom',
        },
    },
    {
        name: 'Bottom center',
        position: {
            horizontal: 'center',
            vertical: 'bottom',
        },
    },
    {
        name: 'Bottom right',
        position: {
            horizontal: 'right',
            vertical: 'bottom',
        },
    },
];

export const DaemonCloseOptions: PrefsDaemonShutdown[] = [
    {
        name: 'Ask',
        value: 'ask',
    },
    {
        name: 'Leave running',
        value: 'never',
    },
    {
        name: 'Stop daemon',
        value: 'always',
    },
];
