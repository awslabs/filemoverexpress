import { app, BrowserWindow, globalShortcut, ipcMain, session, shell } from 'electron';
import * as path from 'path';
import { ChildProcess, execSync, spawn } from 'child_process';
import * as os from 'os';
import * as log from 'electron-log/main';
import { FIRST_LAUNCH_COMPLETE_FILE_NAME, productNames } from './constants';
import * as fs from 'fs';
import 'find-process';
import { Subject } from 'rxjs';
import { default as find } from 'find-process';
import { SpawnOptions } from 'node:child_process';

let mainWindow: BrowserWindow | null = null;
let daemonProcess: ChildProcess | null = null;
let daemonRunning = false;
let firstLaunchComplete = false;
const minimumWindowWidth = 1450;
const minimumWindowHeight = 1000;

if (process.platform === 'darwin') {
    process.env.PATH = `${process.env.PATH}:${path.join(path.dirname(__dirname), 'bin')}`;
}
log.initialize();
log.info(`${productNames.PRODUCT_NAME} starting...`);


function createWindow() {
    const iconPath = path.join(__dirname, 'assets/icons/png/icon_128x128.png');
    const appUrl = `file://${path.join(__dirname, '/app/index.html')}`;
    const firstLaunchCompleteFilePath = path.join(app.getPath('userData'), FIRST_LAUNCH_COMPLETE_FILE_NAME);

    if (fs.existsSync(firstLaunchCompleteFilePath)) {
        firstLaunchComplete = true;
    } else {
        fs.writeFile(firstLaunchCompleteFilePath, '', 'utf-8', (error) => {
            if (error) {
                log.error('Unable to write first launch completed file to local storage: ' + error);
            } else {
                if (isWindowsOS()) {
                    execCommand(`attrib +h "${firstLaunchCompleteFilePath}"`);
                }
            }
        });
    }

    mainWindow = new BrowserWindow({
        x: 0,
        y: 0,
        width: minimumWindowWidth,
        height: minimumWindowHeight,
        minWidth: minimumWindowWidth,
        minHeight: minimumWindowHeight,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: iconPath,
    });
    mainWindow.loadURL(appUrl).then();

    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Origin'] = 'electron://fme-app';
        callback({cancel: false, requestHeaders: details.requestHeaders});
    });

    mainWindow.on('close', (e) => {
        if (!mainWindow) {
            return;
        }

        e.preventDefault();
        mainWindow.webContents.send('app-close');
    });

    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }
}

/**
 * Return the absolute path to the CLI executable
 */
function getDaemonPath(): string {
    return path.join(path.dirname(__dirname), 'bin', isWindowsOS() ? productNames.PRODUCT_DAEMON_LAUNCHER : productNames.PRODUCT_CLI_NAME);
}

function checkIfDaemonRunning(sub: Subject<boolean>) {
    const binPath = getDaemonPath();
    const binName = path.basename(binPath);
    const userHomeDir = os.homedir();
    const pidPath = path.join(userHomeDir, '.filemoverexpress', 'filemoverexpress.pid');
    if (fs.existsSync(pidPath)) {
        const pid = Number(fs.readFileSync(pidPath).toString());
        find('pid', pid)
            .then(
                data => {
                    if (data.length == 1) {
                        if (data[0].cmd.endsWith(`${binName} daemon`)) {
                            sub.next(true);
                            sub.complete();
                        }
                    }
                    sub.next(false);
                    sub.complete();
                },
            )
            .catch(
                () => {
                    sub.next(false);
                    sub.complete();
                },
            );
    } else {
        sub.next(false);
        sub.complete();
    }
}

function isWindowsOS() {
    let windowsPlatforms = ['win32', 'win64', 'windows', 'wince'];
    return windowsPlatforms.includes(process.platform.toLowerCase());
}

/**
 * Safely runs execSync with no options argument. Returns the execSync output, or null if execSync fails to run.
 * @param {string} command - Command to run
 * @returns {(Buffer | null)} - The execSync output Buffer, or null if execSync fails to run
 */
function execCommand(command: string): Buffer | null {
    try {
        return execSync(command);
    } catch (e) {
        log.error('Error occurred in execSync: ' + e);
        return null;
    }
}

app.whenReady().then(
    () => {
        globalShortcut.register('Alt+CommandOrControl+I', () => {
            mainWindow?.webContents.openDevTools();
        });
        globalShortcut.register('CommandOrControl+Q', () => {
            mainWindow = null;
            app.quit();
        });
    },
).then(() => {
    const sub = new Subject<boolean>();
    // subscribe before checkIfDaemonRunning so Subject doesn't complete before subscription
    sub.asObservable().subscribe(result => {
        daemonRunning = result;
        createWindow();
    });
    checkIfDaemonRunning(sub);
});

app.on('window-all-closed', function() {
    log.debug('window-all-closed called');
    mainWindow = null;
    app.quit();
});

app.on('activate', function() {
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

/* 'before-quit' is emitted when Electron receives
 * the signal to exit and wants to start closing windows */
app.on('before-quit', () => {
    log.info('before-quit event invoked on app');
    try {
        ipcMain.removeAllListeners('startDaemon');
        ipcMain.removeAllListeners('systemOpen');
        ipcMain.removeAllListeners('systemShowItemInFolder');
        ipcMain.removeAllListeners('externalLink');
        ipcMain.removeAllListeners('fatalShutdown');
        ipcMain.removeAllListeners('appVersion');
        ipcMain.removeAllListeners('firstLaunchComplete');
    } catch (err) {
        log.error(`Failed to unregister event listeners: ${err}`);
    }
});

ipcMain.on('quit', () => {
    log.info('quit event invoked on ipc main process');
});

ipcMain.on('closed', (_e) => {
    log.info('closed event invoked on ipc main process');
    mainWindow = null;
    app.quit();
});

ipcMain.handle('startDaemon', () => {
    log.info('startDaemon invoked on ipc main process');
    if (daemonRunning) {
        console.debug('Daemon is already running');
        return;
    }
    daemonRunning = true;

    // A separate daemon is needed for windows so that the console window doesn't appeear
    const spawnOpts: SpawnOptions = {
        detached: true,
        env: {FILETRANSFER_GUI_DAEMON: 'true'},
        stdio: 'ignore',
    };
    const cliBinary = getDaemonPath();
    log.debug(`Starting binary ${cliBinary}`);

    daemonProcess = isWindowsOS()
        ? daemonProcess = spawn(cliBinary, [], spawnOpts)
        : daemonProcess = spawn(cliBinary, ['daemon'], spawnOpts);

    daemonProcess.on('error', (err) => {
        log.error(`${productNames.PRODUCT_NAME} daemon encountered a terminal error: ${err}`);
        daemonProcess = null;
        daemonRunning = false;
    });

    daemonProcess.on('exit', (code, signal) => {
        if (signal !== null) {
            log.warn(`child process exited due to signal ${signal}`);
        } else {
            if (code !== 0) {
                log.info(`child process exited with code ${code?.toString()}`);
                // console.log(daemonProcess.stdout);
                // console.log(daemonProcess.stderr);
            }
        }
        daemonProcess = null;
        daemonRunning = false;
    });
});

ipcMain.handle('fatalShutdown', () => mainWindow?.webContents.send('fatal-shutdown'));

ipcMain.handle('systemOpen', async (_event, filePath) => {
    shell.openPath(filePath).then();
});

ipcMain.handle('systemShowItemInFolder', async (_event, filePath) => {
    shell.showItemInFolder(filePath);
});

ipcMain.handle('externalLink', async (_event, url) => {
    shell.openExternal(url).then();
});

ipcMain.handle('appVersion', async () => {
    if (!app.isPackaged) {
        return null;
    }
    let version = app.getVersion().replace(/^v/, '');
    // handle possible case where electron sets version number to 0.0 when it cannot find it in electron's package.json
    if (version === '0.0') {
        version = '0.0.0';
        log.debug(`Electron build has missing version. Changing version from 0.0 to 0.0.0`);
    }
    return version;
});

ipcMain.handle('firstLaunchComplete', async () => {
    return firstLaunchComplete;
});
