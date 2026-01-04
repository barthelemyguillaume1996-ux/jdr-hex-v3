import React, { useState } from 'react';
import HexBoard from './components/HexBoard/HexBoard';
import { StateProvider, useAppState, useAppDispatch } from './state/StateProvider';
import LeftPanel from './components/Layout/LeftPanel';
import RightPanel from './components/Layout/RightPanel';
import CastBridge from './components/Cast/CastBridge';
import CombatTimeline from './components/Combat/CombatTimeline';
import { useCastStore } from './cast/castClient';




function ConnectionStatus({ lastSync }) {
    const [now, setNow] = React.useState(Date.now());

    React.useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const diff = now - (lastSync || 0);
    const isOnline = diff < 4000; // 4s timeout (Heartbeat is 1s)
    const hasApi = !!(window.api && window.api.onBroadcastState);
    const rxCount = window.__ipcRxCount || 0; // Using global for persistence across re-renders if needed, or pass prop?
    // Let's pass prop from AppContent.

    return (
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${isOnline ? 'bg-green-900/50 border-green-500/50 text-green-200' : 'bg-red-900/50 border-red-500/50 text-red-200'}`}>
            {isOnline ? "● CONNECTÉ" : "○ DÉCONNECTÉ"} ({Math.floor(diff / 1000)}s) | API: {hasApi ? 'OK' : 'ERR'} | RX: {lastSync ? 'OK' : '0'}
        </span>
    );
}

function AppContent() {
    const state = useAppState();
    const dispatch = useAppDispatch();

    const handleSave = async () => {
        const json = JSON.stringify(state, null, 2);
        const result = await window.api.saveCampaign(json);
        if (result.success) console.log("Saved to", result.path);
    };

    const handleLoad = async () => {
        const result = await window.api.loadCampaign();
        if (result.success && result.content) {
            try {
                const data = JSON.parse(result.content);
                dispatch({ type: 'LOAD_STATE', payload: data });
            } catch (e) {
                console.error("Failed to parse", e);
            }
        }
    };

    // --- Viewer Mode Logic ---
    const isViewer = new URLSearchParams(window.location.search).has("viewer");
    const castState = useCastStore();
    const [lastRxTime, setLastRxTime] = useState(Date.now());

    React.useEffect(() => {
        if (isViewer) {
            console.log("[App] Player View Mode - Setting up IPC listener");
            document.title = "JdrHex - Vue Joueur";

            // ONLY use IPC listener, no initial sync from castState
            if (window.api && window.api.onBroadcastState) {
                const cleanup = window.api.onBroadcastState((payload) => {
                    let data = payload;
                    if (typeof data === "string") {
                        try { data = JSON.parse(data); } catch (e) {
                            console.error("App IPC Parse Error", e);
                            return;
                        }
                    }

                    console.log("[App] Received IPC update:", {
                        tokens: data.tokens?.length,
                        overlayTiles: data.overlayTiles?.length,
                        pencilStrokes: data.pencilStrokes?.length,
                        combatMode: data.combatMode,
                        activeId: data.activeId
                    });

                    // Dispatch directly to React State
                    dispatch({ type: 'SYNC_FROM_CAST', payload: data });
                    setLastRxTime(Date.now());
                });
                return cleanup;
            }
        }
    }, [isViewer, dispatch]); // ✅ Removed castState from dependencies

    // Force refresh of status UI
    const [now, setNow] = useState(Date.now());
    React.useEffect(() => {
        if (!isViewer) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [isViewer]);

    // Status Logic
    const isOnline = (now - lastRxTime) < 3000; // 3 seconds timeout


    if (isViewer) {
        const toggleFullscreen = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        };

        return (
            <div className="h-screen w-screen bg-black overflow-hidden relative">
                <div className="absolute inset-0">
                    <HexBoard locked={true} />
                </div>

                {/* Combat Timeline for Viewer */}
                <CombatTimeline />

                {/* Fullscreen Control Bar */}
                <div className="absolute top-0 left-0 right-0 h-10 bg-transparent hover:bg-black/50 transition-colors flex items-center justify-end px-4 z-50 opacity-0 hover:opacity-100 duration-300">
                    <button
                        onClick={toggleFullscreen}
                        className="text-white/70 hover:text-white font-medium text-xs border border-white/20 bg-black/40 px-3 py-1 rounded">
                        ⛶ Plein Écran
                    </button>
                </div>

                {/* Optional: Add a subtle indicator or overlay if needed */}
                <div className="absolute bottom-2 right-2 text-white/20 text-xs pointer-events-none flex flex-col items-end gap-1">
                    <span>Vue Joueur v1.4 (No Flicker)</span>
                    <ConnectionStatus lastSync={castState?._lastRx} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-background text-white">
            {/* Title Bar (Native drag area + Controls) */}
            <div className="h-10 bg-surface border-b border-white/10 flex items-center justify-between px-4 select-none draggable-region text-sm">
                <span className="font-medium tracking-wider text-white/50">JDR HEX • DESKTOP</span>

                {/* Window Controls (No-Drag Clean Zone) */}
                <div className="flex items-center gap-2 no-drag">
                    <button onClick={handleSave} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded">Save</button>
                    <button onClick={handleLoad} className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded">Load</button>
                    <div className="w-4" /> {/* spacer */}

                    <button onClick={() => window.api.minimize()} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/60 hover:text-white" title="Minimize">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
                    </button>
                    <button onClick={() => window.api.maximize()} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/60 hover:text-white" title="Maximize">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /></svg>
                    </button>
                    <button onClick={() => window.api.close()} className="p-1.5 hover:bg-red-500/80 hover:text-white rounded-md transition-colors text-white/60" title="Close">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
                <LeftPanel />

                {/* Workspace */}
                <main className="flex-1 relative bg-background flex flex-col overflow-hidden">
                    <HexBoard />
                    <CastBridge />
                    {/* Combat Timeline for Desktop */}
                    <CombatTimeline />
                </main>

                <RightPanel />
            </div>
        </div>
    );
}

export default function App() {
    return (
        <StateProvider>
            <AppContent />
        </StateProvider>
    );
}
