/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
/* eslint-disable no-empty */
// src/state/StateProvider.jsx
// NOTE: Gestion d'état UNIQUEMENT. Les snapshots sont gérés par CastBridge.jsx

import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import "../cast/castClient";
import { CAMERA_SCALE } from "../core/boardConfig";

// --- utils ---
function uid() { return Math.random().toString(36).slice(2, 10); }
function toNum(v, def = 0) { const n = +v; return Number.isFinite(n) ? n : def; }
function hexDistance(q1, r1, q2, r2) {
    const dq = q2 - q1, dr = q2 - q1, ds = -(q2 + r2) + (q1 + r1);
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}
function sortByInitiative(arr) {
    return arr.slice().sort((a, b) => {
        const ia = toNum(a.initiative, 0), ib = toNum(b.initiative, 0);
        if (ib !== ia) return ib - ia;
        return (a.name || "").localeCompare(b.name || "");
    });
}
function loadLS(key, fallback) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; } }

// --- LS keys ---
const LS_TOKENS = "tokensV3";
const LS_OVERLAY = "overlayTilesV3";
const LS_DRAWINGS = "drawingsV3";
const LS_CUR_MAP = "currentMapV3";

// --- état initial ---
const initialState = {
    tokens: loadLS(LS_TOKENS, []),
    activeId: null,
    combatMode: false,
    remainingSpeedById: {},
    overlayTiles: loadLS(LS_OVERLAY, []),
    drawings: loadLS(LS_DRAWINGS, []),
    maps: [],
    currentMapUrl: loadLS(LS_CUR_MAP, null),
    drawMode: false,
};

// --- contexts ---
const CtxState = createContext(null);
const CtxDispatch = createContext(() => { });

// --- reducer ---
function reducer(state, action) {
    switch (action.type) {
        case "ADD_TOKEN": {
            const t = { id: uid(), q: 0, r: 0, isDeployed: true, initiative: 0, speed: "", cellRadius: 1, ...action.payload };
            return { ...state, tokens: [...state.tokens, t] };
        }
        case "PATCH_TOKEN": {
            return { ...state, tokens: state.tokens.map(t => t.id === action.id ? { ...t, ...action.patch } : t) };
        }
        case "DELETE_TOKEN": {
            const tokens = state.tokens.filter(t => t.id !== action.id);
            const remainingSpeedById = { ...state.remainingSpeedById }; delete remainingSpeedById[action.id];
            const activeId = state.activeId === action.id ? null : state.activeId;
            return { ...state, tokens, remainingSpeedById, activeId };
        }

        case "SET_COMBAT_MODE": {
            const combatMode = !!action.value;
            let next = { ...state, combatMode };
            if (combatMode) {
                if (!state.activeId) {
                    const order = sortByInitiative(state.tokens.filter(t => t.isDeployed));
                    if (order.length) {
                        const first = order[0];
                        next.activeId = first.id;
                        next.remainingSpeedById = { ...state.remainingSpeedById, [first.id]: toNum(first.speed, 0) };
                    }
                } else {
                    const cur = state.tokens.find(t => t.id === state.activeId);
                    if (cur && !Number.isFinite(state.remainingSpeedById[cur.id])) {
                        next.remainingSpeedById = { ...state.remainingSpeedById, [cur.id]: toNum(cur.speed, 0) };
                    }
                }
            }
            return next;
        }

        case "NEXT_TURN": {
            if (!state.combatMode) return state;
            const order = sortByInitiative(state.tokens.filter(t => t.isDeployed));
            if (!order.length) return state;
            let idx = state.activeId ? order.findIndex(t => t.id === state.activeId) : -1;
            if (idx < 0) idx = 0;
            const nextTok = order[(idx + 1) % order.length];
            return {
                ...state,
                activeId: nextTok.id,
                remainingSpeedById: { ...state.remainingSpeedById, [nextTok.id]: toNum(nextTok.speed, 0) },
            };
        }

        case "MOVE_TOKEN": {
            const { id, q, r } = action;
            const t = state.tokens.find(x => x.id === id);
            if (!t) return state;
            if (state.combatMode && id === state.activeId) {
                const cost = hexDistance(t.q, t.r, q, r);
                const left = toNum(state.remainingSpeedById[id], toNum(t.speed, 0));
                if (cost <= 0 || cost > left) return state;
                return {
                    ...state,
                    tokens: state.tokens.map(x => x.id === id ? { ...x, q, r } : x),
                    remainingSpeedById: { ...state.remainingSpeedById, [id]: left - cost }
                };
            }
            return { ...state, tokens: state.tokens.map(x => x.id === id ? { ...x, q, r } : x) };
        }

        case "OVERLAY_SET": {
            return { ...state, overlayTiles: Array.isArray(action.tiles) ? action.tiles : [] };
        }
        case "ADD_DRAWING": {
            const p = action.payload;
            if (p && Array.isArray(p.tiles)) {
                const d = {
                    id: p.id || Math.random().toString(36).slice(2, 10),
                    name: p.name || "(sans titre)",
                    tiles: p.tiles,
                    strokes: Array.isArray(p.strokes) ? p.strokes : [],
                    createdAt: p.createdAt || Date.now(),
                };
                return { ...state, drawings: [...state.drawings, d] };
            } else {
                const d = {
                    id: Math.random().toString(36).slice(2, 10),
                    name: action.name || "(sans titre)",
                    tiles: Array.isArray(action.tiles) ? action.tiles : [],
                    strokes: [],
                    createdAt: Date.now(),
                };
                return { ...state, drawings: [...state.drawings, d] };
            }
        }
        case "DELETE_DRAWING": {
            return { ...state, drawings: state.drawings.filter(d => d.id !== action.id) };
        }

        case "SET_MAPS": {
            let arr = action.maps;
            if (arr && !Array.isArray(arr) && Array.isArray(arr.maps)) arr = arr.maps;
            return { ...state, maps: Array.isArray(arr) ? arr : [] };
        }
        case "SET_CURRENT_MAP": {
            return { ...state, currentMapUrl: action.url || null };
        }

        case "SET_DRAW_MODE": {
            return { ...state, drawMode: !!action.value };
        }
        case "IMPORT_FULL_STATE": {
            const p = action.payload;
            if (!p || typeof p !== "object") return state;
            return {
                ...state,
                tokens: Array.isArray(p.tokens) ? p.tokens : state.tokens,
                activeId: p.activeId ?? state.activeId,
                combatMode: typeof p.combatMode === "boolean" ? p.combatMode : state.combatMode,
                remainingSpeedById: (p.remainingSpeedById && typeof p.remainingSpeedById === "object")
                    ? p.remainingSpeedById
                    : state.remainingSpeedById,
                overlayTiles: Array.isArray(p.overlayTiles) ? p.overlayTiles : state.overlayTiles,
                drawings: Array.isArray(p.drawings) ? p.drawings : state.drawings,
                currentMapUrl: typeof p.currentMapUrl === "string" ? p.currentMapUrl : state.currentMapUrl,
            };
        }

        default: return state;
    }
}

export function StateProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    // miroir à jour du state
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);

    // persist LS
    useEffect(() => { try { localStorage.setItem(LS_TOKENS, JSON.stringify(state.tokens)); } catch { } }, [state.tokens]);
    useEffect(() => { try { localStorage.setItem(LS_OVERLAY, JSON.stringify(state.overlayTiles)); } catch { } }, [state.overlayTiles]);
    useEffect(() => { try { localStorage.setItem(LS_DRAWINGS, JSON.stringify(state.drawings)); } catch { } }, [state.drawings]);
    useEffect(() => { try { localStorage.setItem(LS_CUR_MAP, JSON.stringify(state.currentMapUrl)); } catch { } }, [state.currentMapUrl]);

    // charge /Maps/index.json
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch("/Maps/index.json", { cache: "no-store" });
                const json = await res.json();
                if (alive) dispatch({ type: "SET_MAPS", maps: json });
            } catch { }
        })();
        return () => { alive = false; };
    }, []);

    // Simple dispatch sans gestion de snapshots (CastBridge.jsx s'en charge)
    const dispatchCast = (action) => {
        dispatch(action);
    };

    const value = useMemo(() => state, [state]);
    return (
        <CtxState.Provider value={value}>
            <CtxDispatch.Provider value={dispatchCast}>{children}</CtxDispatch.Provider>
        </CtxState.Provider>
    );
}

export function useAppState() {
    const ctx = useContext(CtxState);
    if (ctx === null) throw new Error("useAppState must be used within <StateProvider>");
    return ctx;
}
export function useAppDispatch() {
    const ctx = useContext(CtxDispatch);
    if (ctx === null) throw new Error("useAppDispatch must be used within <StateProvider>");
    return ctx;
}