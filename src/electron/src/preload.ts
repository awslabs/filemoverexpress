import { contextBridge, ipcRenderer } from 'electron';

export const fmeClient = {
    startDaemon: () => ipcRenderer.invoke('startDaemon'),
    systemOpen: (path: string) => ipcRenderer.invoke('systemOpen', path),
    systemShowItemInFolder: (path: string) => ipcRenderer.invoke('systemShowItemInFolder', path),
    on: (channel: string, callback: Function) => ipcRenderer.on(channel, (_, data) => callback(data)),
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
    externalLink: (url: string) => ipcRenderer.invoke('externalLink', url),
    fatalShutdown: () => ipcRenderer.invoke('fatalShutdown'),
    appVersion: () => ipcRenderer.invoke('appVersion'),
    firstLaunchComplete: () => ipcRenderer.invoke('firstLaunchComplete'),
};

contextBridge.exposeInMainWorld('fme', fmeClient);
