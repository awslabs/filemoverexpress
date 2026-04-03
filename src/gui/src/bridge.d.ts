import { IpcMain, IpcRenderer, IpcRendererEvent } from 'electron';

export {};

type StartDaemon = () => Promise<void>;

type StopDaemon = () => Promise<void>;

type SystemOpen = (path: string) => Promise<void>;

type SystemShowItemInFolder = (path: string) => Promise<void>;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
 * Suppressing error on using type any since callback type exactly matches Electron library type
**/
type On = (channel: string, callback: ((event: IpcRendererEvent, ...args: any[]) => void)) => IpcMain;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any --
 * Suppressing error on using type any since args type exactly matches Electron library type
**/
type Send = (channel: string, ...args: any[]) => void;

type RemoveAllListeners = (channel: string) => IpcRenderer;

type ExternalLink = (url: string) => Promise<void>;

type FatalShutdown = () => Promise<void>;

type AppVersion = () => Promise<string>;

type FirstLaunchComplete = () => Promise<boolean>;

interface FmeClient {
    startDaemon: StartDaemon,
    stopDaemon: StopDaemon,
    systemOpen: SystemOpen,
    systemShowItemInFolder: SystemShowItemInFolder,
    on: On,
    send: Send,
    removeAllListeners: RemoveAllListeners,
    externalLink: ExternalLink,
    fatalShutdown: FatalShutdown,
    appVersion: AppVersion,
    firstLaunchComplete: FirstLaunchComplete,
}

declare global {
    interface Window {
        fme?: FmeClient,
    }
}
