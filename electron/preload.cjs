const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Example native function
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    // Window Controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    // Persistence
    saveCampaign: (content) => ipcRenderer.invoke('save-file', content),
    loadCampaign: () => ipcRenderer.invoke('open-file'),
    // Player View
    openPlayerView: () => ipcRenderer.invoke('open-player-view'),

    // Legacy Persistence (can keep or remove if unused, keeping for safety)
    saveFile: (content) => ipcRenderer.invoke('save-file', content),
    openFile: () => ipcRenderer.invoke('open-file'),

    // State Persistence
    saveAppState: (content) => ipcRenderer.invoke('save-app-state', content),
    loadAppState: () => ipcRenderer.invoke('load-app-state'),

    // --- NATIVE SYNC (IPC) ---
    broadcastState: (payload) => ipcRenderer.send('app:broadcast-state', payload),
    onBroadcastState: (callback) => {
        const handler = (event, payload) => {
            ipcRenderer.send('log-debug', 'Preload received app:broadcast-state (Payload: ' + (typeof payload) + ')');
            callback(payload);
        };
        ipcRenderer.on('app:broadcast-state', handler);
        // Return cleanup function to remove listener
        return () => ipcRenderer.removeListener('app:broadcast-state', handler);
    },

    // Debug
    log: (msg) => ipcRenderer.send('log-debug', msg)
});
