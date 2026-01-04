const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const isDev = !app.isPackaged;

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: '#111111',
        titleBarStyle: 'hidden', // Custom title bar style (optional, for modern feel)
        titleBarOverlay: {
            color: '#1e1e1e',
            symbolColor: '#ffffff',
            height: 32
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
            sandbox: false, // Required for some deep native integration if needed, but stricter is better.
        },
        show: false, // Prevent flickering
    });

    // Load App
    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools({ mode: 'detach' });
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.once('ready-to-show', () => {
        win.show();
    });
}

app.whenReady().then(() => {
    // --- WebSocket Server for Remote Viewers ---
    const wss = new WebSocketServer({ port: 8080 });
    let lastState = null;

    wss.on('connection', (ws) => {
        logToFile("[WSS] New Remote Viewer connected");

        // Send current state to new connection
        if (lastState) {
            ws.send(JSON.stringify({ type: 'SNAPSHOT', payload: lastState }));
        }

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'REQUEST_SNAPSHOT' && lastState) {
                    ws.send(JSON.stringify({ type: 'SNAPSHOT', payload: lastState }));
                }
            } catch (e) {
                logToFile("[WSS] Error parsing message: " + e.message);
            }
        });

        ws.on('close', () => logToFile("[WSS] Remote Viewer disconnected"));
    });

    function broadcastToWebSockets(payload) {
        const dataStr = JSON.stringify({ type: 'SNAPSHOT', payload });
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(dataStr);
            }
        });
    }

    createWindow();

    ipcMain.handle('get-app-version', () => app.getVersion());

    // Window Control IPC
    ipcMain.on('window-minimize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.minimize();
    });

    ipcMain.on('window-maximize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            if (win.isMaximized()) win.unmaximize();
            else win.maximize();
        }
    });

    ipcMain.on('window-close', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.close();
    });

    const fsSync = require('fs');
    const logPath = path.join(__dirname, '../debug_ipc.txt');

    function logToFile(msg) {
        try {
            fsSync.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) {
            console.error("Log Error:", e);
        }
    }

    // Log startup
    logToFile("--- MAIN PROCESS STARTUP ---");

    ipcMain.on('log-debug', (event, msg) => {
        logToFile(`[Renderer] ${msg}`);
    });

    // --- NATIVE SYNC SYSTEM (IPC Relay) ---
    // Acts as a central hub: GM sends data here, we forward it to ALL windows (including Player View).
    ipcMain.on('app:broadcast-state', (event, payload) => {
        lastState = (typeof payload === 'string') ? JSON.parse(payload) : payload;

        const wins = BrowserWindow.getAllWindows();
        // logToFile(`[Main] Relaying Broadcast State to ${wins.length} windows. Payload size: ${JSON.stringify(payload)?.length}`);

        // 1. Send to all Electron windows
        wins.forEach(win => {
            win.webContents.send('app:broadcast-state', payload);
        });

        // 2. Send to all WebSocket clients (Browser/Remote)
        broadcastToWebSockets(lastState);
    });

    // --- Player View IPC ---
    ipcMain.handle('open-player-view', () => {
        const displays = require('electron').screen.getAllDisplays();
        const externalDisplay = displays.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0);

        const playerWin = new BrowserWindow({
            width: 1000,
            height: 600,
            x: externalDisplay ? externalDisplay.bounds.x + 50 : 50,
            y: externalDisplay ? externalDisplay.bounds.y + 50 : 50,
            backgroundColor: '#000000',
            autoHideMenuBar: true,
            titleBarStyle: 'hidden',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.cjs'),
            },
        });

        if (isDev) {
            playerWin.loadURL('http://localhost:5173/?viewer=true');
            playerWin.webContents.openDevTools({ mode: 'detach' }); // Enable DevTools for debugging
        } else {
            playerWin.loadFile(path.join(__dirname, '../dist/index.html'), { query: { viewer: 'true' } });
        }
    });

    // --- Persistence IPC ---
    const fsPromises = require('fs/promises');
    const { dialog } = require('electron');

    ipcMain.handle('save-file', async (event, content) => {
        const win = BrowserWindow.getFocusedWindow();
        const { filePath } = await dialog.showSaveDialog(win, {
            title: 'Save JdrHex Campaign',
            defaultPath: 'campaign.json',
            filters: [{ name: 'JdrHex Files', extensions: ['json'] }]
        });

        if (filePath) {
            await fsPromises.writeFile(filePath, content, 'utf-8');
            return { success: true, path: filePath };
        }
        return { success: false };
    });

    ipcMain.handle('open-file', async () => {
        const win = BrowserWindow.getFocusedWindow();
        const { filePaths } = await dialog.showOpenDialog(win, {
            title: 'Open JdrHex Campaign',
            properties: ['openFile'],
            filters: [{ name: 'JdrHex Files', extensions: ['json'] }]
        });

        if (filePaths && filePaths[0]) {
            const content = await fsPromises.readFile(filePaths[0], 'utf-8');
            return { success: true, content, path: filePaths[0] };
        }
        return { success: false };
    });

    // Auto-Save / Internal Persistence
    ipcMain.handle('save-app-state', async (event, content) => {
        try {
            const userDataPath = app.getPath('userData');
            const togglePath = path.join(userDataPath, 'state.json');
            // Write async but we don't block
            await fsPromises.writeFile(togglePath, content, 'utf-8');
            return { success: true };
        } catch (e) {
            console.error('Save App State Failed:', e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('load-app-state', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const togglePath = path.join(userDataPath, 'state.json');
            const data = await fsPromises.readFile(togglePath, 'utf-8');
            return { success: true, content: data };
        } catch (e) {
            // Ignore ENOENT (file not found) usually means first run
            return { success: false, error: e.message };
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
