import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { hexDistance } from '../lib/hexMath';

const StateContext = createContext();
const DispatchContext = createContext();

const initialState = {
    tokens: [],
    overlayTiles: [],
    draftOverlayTiles: [],
    mapConfig: {
        hexRadius: 50
    },
    // UI State
    ui: {
        leftPanelOpen: true,
        rightPanelOpen: true,
        combatMode: false,
        drawMode: false,
        pencilMode: false,
        currentBrush: { size: 1, color: "rgba(255, 100, 100, 0.5)", type: "default" },
        activeTokenId: null,
        zoom: 1,
    },
    // Data
    drawings: [],
    pencilStrokes: [],
    maps: [],
    currentMapUrl: null,
    currentPencilStroke: null, // Transient state for live sync
};

function reducer(state, action) {
    switch (action.type) {
        case 'LOAD_STATE':
            return { ...state, ...action.payload };
        case 'TOGGLE_UI_PANEL':
            return { ...state, ui: { ...state.ui, [action.panel]: !state.ui[action.panel] } };
        case 'SET_MODE':
            return { ...state, ui: { ...state.ui, [action.mode]: action.value } };
        case 'SET_BRUSH':
            // Merge payload into currentBrush, handle specific key updates
            const newBrush = { ...state.ui.currentBrush, ...action.payload };
            // If payload has 'size', update it in ui directly? Or put size in currentBrush?
            // Let's put size in currentBrush for consistency
            return { ...state, ui: { ...state.ui, currentBrush: newBrush } };
        case 'SET_BRUSH_SIZE':
            return { ...state, ui: { ...state.ui, currentBrush: { ...state.ui.currentBrush, size: action.size } } };
        case 'SET_ZOOM':
            return { ...state, ui: { ...state.ui, zoom: action.zoom } };

        case 'SET_CURRENT_PENCIL_STROKE':
            return { ...state, currentPencilStroke: action.payload };

        case 'ADD_PENCIL_STROKE':
            return { ...state, pencilStrokes: [...state.pencilStrokes, action.payload] };

        case 'FINISH_PENCIL_STROKE':
            // Atomic update: Add stroke AND clear current
            return {
                ...state,
                pencilStrokes: [...state.pencilStrokes, action.payload],
                currentPencilStroke: null
            };

        case 'CLEAR_PENCIL':
            return { ...state, pencilStrokes: [] };
        case 'SET_CURRENT_MAP':
            return { ...state, currentMapUrl: action.url };
        case 'ADD_TOKEN':
            return { ...state, tokens: [...state.tokens, action.payload] };
        case 'UPDATE_TOKEN':
            return {
                ...state,
                tokens: state.tokens.map(t => t.id === action.id ? { ...t, ...action.changes } : t)
            };
        case 'DELETE_TOKEN':
            const remaining = state.tokens.filter(t => t.id !== action.id);
            return { ...state, tokens: remaining };

        case 'UPDATE_TOKEN_POSITION': {
            const { id, newQ, newR, startQ, startR } = action;

            return {
                ...state,
                tokens: state.tokens.map(t => {
                    if (t.id !== id) return t;

                    // Calculate distance moved
                    const distance = hexDistance(startQ, startR, newQ, newR);
                    const remainingSpeed = t.remainingSpeed !== undefined ? t.remainingSpeed : (t.speed || 30);

                    // Consume speed
                    const newRemainingSpeed = Math.max(0, remainingSpeed - distance);

                    return {
                        ...t,
                        q: newQ,
                        r: newR,
                        remainingSpeed: newRemainingSpeed,
                        isDragging: false
                    };
                })
            };
        }

        case 'RESET_TOKEN_SPEED': {
            return {
                ...state,
                tokens: state.tokens.map(t =>
                    t.id === action.id
                        ? { ...t, remainingSpeed: t.speed || 30 }
                        : t
                )
            };
        }

        case 'OVERLAY_SET':
            // Used for Loading: merges into Public Overlay (as per user request "Import")
            // Actually currently it REPLACES.
            // User said "Import", maybe better to APPEND?
            // "Charger" usually implies "Load this scene". But if they use it to "Reveal", append is safer.
            // Let's stick to SET (Replace) for now, as existing logic.
            // OR: Change behavior to Append if we want "Import".
            // Let's make OVERLAY_SET replace everything (Load scene).
            return { ...state, overlayTiles: action.tiles };

        case 'OVERLAY_MERGE': // New action for "Import" (Add to existing)
            // Filter out duplicates? Or just overwrite.
            const existingMap = new Map(state.overlayTiles.map(t => [`${t.q},${t.r}`, t]));
            action.tiles.forEach(t => existingMap.set(`${t.q},${t.r}`, t));
            return { ...state, overlayTiles: Array.from(existingMap.values()) };

        case 'OVERLAY_ADD': {
            const newTile = action.payload;
            const exists = state.overlayTiles.some(t => t.q === newTile.q && t.r === newTile.r);
            if (exists) {
                return {
                    ...state,
                    overlayTiles: state.overlayTiles.map(t => (t.q === newTile.q && t.r === newTile.r) ? newTile : t)
                };
            }
            return { ...state, overlayTiles: [...state.overlayTiles, newTile] };
        }
        case 'OVERLAY_REMOVE': {
            return {
                ...state,
                overlayTiles: state.overlayTiles.filter(t => t.q !== action.payload.q || t.r !== action.payload.r)
            };
        }

        // --- DRAFT ACTIONS ---
        case 'OVERLAY_REMOVE_BATCH': {
            // payload: array of {q,r}
            if (!action.payload || !Array.isArray(action.payload)) return state;
            const toRemove = new Set(action.payload.map(t => `${t.q},${t.r}`));
            return {
                ...state,
                overlayTiles: state.overlayTiles.filter(t => !toRemove.has(`${t.q},${t.r}`))
            };
        }

        case 'DRAFT_ADD_BATCH': {
            // payload: array of tiles
            const newTiles = action.payload;
            const draftMap = new Map(state.draftOverlayTiles.map(t => [`${t.q},${t.r}`, t]));
            newTiles.forEach(t => draftMap.set(`${t.q},${t.r}`, t));
            return { ...state, draftOverlayTiles: Array.from(draftMap.values()) };
        }
        case 'DRAFT_REMOVE_BATCH': {
            if (!action.payload || !Array.isArray(action.payload)) return state;
            const toRemove = new Set(action.payload.map(t => `${t.q},${t.r}`));
            const currentDraft = state.draftOverlayTiles || [];
            return {
                ...state,
                draftOverlayTiles: currentDraft.filter(t => !toRemove.has(`${t.q},${t.r}`))
            };
        }
        case 'DRAFT_CLEAR':
            return { ...state, draftOverlayTiles: [] };

        case 'ADD_DRAWING':
            return {
                ...state,
                drawings: [...state.drawings, {
                    id: Date.now().toString(),
                    name: action.payload.name,
                    tiles: action.payload.tiles,
                    createdAt: Date.now()
                }]
            };
        case 'DELETE_DRAWING':
            return {
                ...state,
                drawings: state.drawings.filter(d => d.id !== action.id)
            };
        case 'SYNC_FROM_CAST':
            // ⚡ LIGHTWEIGHT PING: Do not touch state, just acknowledged
            if (action.payload?.type === 'PING') {
                return state;
            }

            return {
                ...state,
                // ✅ Only update if payload has the field (preserve existing state otherwise)
                tokens: action.payload.tokens !== undefined ? action.payload.tokens : state.tokens,
                overlayTiles: action.payload.overlayTiles !== undefined ? action.payload.overlayTiles : state.overlayTiles,
                drawings: action.payload.drawings !== undefined ? action.payload.drawings : state.drawings,
                pencilStrokes: action.payload.pencilStrokes !== undefined ? action.payload.pencilStrokes : state.pencilStrokes,
                currentPencilStroke: action.payload.currentPencilStroke !== undefined ? action.payload.currentPencilStroke : state.currentPencilStroke,
                currentMapUrl: action.payload.currentMapUrl !== undefined ? action.payload.currentMapUrl : state.currentMapUrl,
                camera: action.payload.camera !== undefined ? action.payload.camera : state.camera,
                ui: {
                    ...state.ui,
                    combatMode: action.payload.combatMode !== undefined ? action.payload.combatMode : state.ui.combatMode,
                    activeTokenId: action.payload.activeId !== undefined ? action.payload.activeId : state.ui.activeTokenId
                },
                // Clear local draft in Viewer to prevent ghosting
                draftOverlayTiles: []
            };
        default:
            return state;
    }
}

export function StateProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    // Initial Load from File System
    useEffect(() => {
        const load = async () => {
            if (window.api && window.api.loadAppState) {
                console.log("Loading App State from File...");
                const result = await window.api.loadAppState();
                if (result.success && result.content) {
                    try {
                        const loaded = JSON.parse(result.content);
                        console.log("State loaded:", loaded);
                        dispatch({ type: 'LOAD_STATE', payload: loaded });
                    } catch (e) {
                        console.error("JSON Parse Error:", e);
                    }
                } else {
                    console.warn("Load App State failed or empty:", result);
                }
            } else {
                // Fallback to localStorage (Web mode fallback)
                try {
                    const saved = localStorage.getItem('jdr_hex_state');
                    if (saved) dispatch({ type: 'LOAD_STATE', payload: JSON.parse(saved) });
                } catch (e) { }
            }
        };
        load();
    }, []);

    // Persist state on change (Debounced)
    useEffect(() => {
        const timeout = setTimeout(() => {
            const content = JSON.stringify(state);
            console.log("Auto-saving state (Debounced)...");
            if (window.api && window.api.saveAppState) {
                window.api.saveAppState(content).then(res => {
                    if (res.success) console.log("State saved to disk.");
                    else console.error("Failed to save state:", res.error);
                });
            } else {
                localStorage.setItem('jdr_hex_state', content);
            }
        }, 1000); // 1s debounce to avoid too many writes
        return () => clearTimeout(timeout);
    }, [state]);

    // Expose API for file loading
    useEffect(() => {
        window.api_loadState = (data) => dispatch({ type: 'LOAD_STATE', payload: data });
    }, []);

    return (
        <StateContext.Provider value={state}>
            <DispatchContext.Provider value={dispatch}>
                {children}
            </DispatchContext.Provider>
        </StateContext.Provider>
    );
}

export function useAppState() {
    return useContext(StateContext);
}

export function useAppDispatch() {
    return useContext(DispatchContext);
}
