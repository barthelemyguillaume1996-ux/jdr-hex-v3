const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const win = new BrowserWindow({
        width: Math.min(1440, width),
        height: Math.min(960, height),
        backgroundColor: '#111111',
        show: false, // Don't show until ready-to-show to prevent white flash
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
            backgroundThrottling: false, // Keep app active in background
        },
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../public/favicon.ico'),
    });

    win.once('ready-to-show', () => {
        win.show();
        if (isDev) win.maximize();
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        // Open DevTools loosely to avoid blocking if it fails
        win.webContents.openDevTools({ mode: 'detach' });
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
