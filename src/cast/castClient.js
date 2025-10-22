// src/cast/castClient.js - WATCHDOG OPTIMISÉ
import { useSyncExternalStore } from "react";

/* ---------- Store réactif ---------- */
const listeners = new Set();
function emit() { for (const l of [...listeners]) { try { l(); } catch { } } }

const initial = {
    tokens: [],
    activeId: null,
    combatMode: false,
    remainingSpeedById: {},
    overlayTiles: [],
    currentMapUrl: null,
    preview: { byId: {} },
    viewport: null,
    camera: null,
};

let state = { ...initial };
function setState(patch) {
    state = { ...state, ...patch };
    emit();
}

/* ---------- API publique ---------- */
export function getCastState() { return state; }
export function subscribeCast(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function useCastStore() {
    return useSyncExternalStore(subscribeCast, () => state, () => state);
}

/* ---------- RX debug/watchdog ---------- */
let lastRxAt = 0;
function noteRx() { lastRxAt = Date.now(); }

/* ---------- Application des messages ---------- */
export function applyCastMessage(msg) {
    if (!msg || !msg.type) return;
    const { type, payload } = msg;

    switch (type) {
        case "SNAPSHOT": {
            console.log('[castClient] SNAPSHOT received:', {
                tokens: payload?.tokens?.length || 0,
                viewport: payload?.viewport,
                camera: payload?.camera,
            });

            setState({
                tokens: Array.isArray(payload?.tokens) ? payload.tokens : [],
                activeId: payload?.activeId ?? null,
                combatMode: !!payload?.combatMode,
                remainingSpeedById: payload?.remainingSpeedById || {},
                overlayTiles: Array.isArray(payload?.overlayTiles) ? payload.overlayTiles : [],
                currentMapUrl: payload?.currentMapUrl || null,
                viewport: payload?.viewport || state.viewport,
                camera: payload?.camera || state.camera,
                preview: { byId: {} },
            });
            noteRx();
            return;
        }

        case "OVERLAY_SET": {
            const tiles = Array.isArray(payload?.tiles) ? payload.tiles : [];
            setState({ overlayTiles: tiles });
            noteRx();
            return;
        }

        case "SET_CURRENT_MAP":
        case "MAP_SET": {
            setState({ currentMapUrl: payload?.url || null });
            noteRx();
            return;
        }

        case "COMBAT_STATE": {
            setState({
                combatMode: !!payload?.combatMode,
                activeId: payload?.activeId ?? state.activeId,
            });
            noteRx();
            return;
        }

        case "PREVIEW": {
            const id = payload?.id;
            const q = +payload?.q, r = +payload?.r;
            if (id != null && Number.isFinite(q) && Number.isFinite(r)) {
                const byId = { ...(state.preview?.byId || {}) };
                byId[id] = { q, r, at: (typeof performance !== "undefined" ? performance.now() : Date.now()) };
                setState({ preview: { byId } });
            }
            noteRx();
            return;
        }

        case "VIEWPORT": {
            const w = +payload?.w, h = +payload?.h;
            if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
                console.log(`[castClient] VIEWPORT received: ${w}×${h}`);
                setState({ viewport: { w, h } });
            }
            noteRx();
            return;
        }

        case "HELLO":
        case "REQUEST_SNAPSHOT":
        case "PING":
        case "PONG":
            noteRx();
            return;

        default: return;
    }
}

/* ---------- Transports ---------- */
let bc = null;
try {
    if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("jdr_cast_v3");
        bc.onmessage = (e) => { const data = e?.data; if (data && data.type) applyCastMessage(data); };
    }
} catch { }

let ws = null;
let wsUrl = null;
let wantReconnect = false;
let wsStatus = "idle";
let backoff = 1000;
const MAX_BACKOFF = 10000;

function setWsStatus(s) { wsStatus = s; }

async function decodeWsData(evData) {
    try {
        let raw = evData;
        if (raw instanceof Blob) raw = await raw.text();
        if (raw instanceof ArrayBuffer) raw = new TextDecoder().decode(new Uint8Array(raw));
        if (typeof raw === "string") {
            const parsed = JSON.parse(raw);
            if (parsed?.type) return parsed;
            if (parsed?.data?.type) return parsed.data;
            if (parsed?.payload?.type) return parsed.payload;
            if (parsed?.message?.type) return parsed.message;
            return parsed;
        }
        return raw;
    } catch {
        try { return JSON.parse(String(evData)); } catch { }
        return null;
    }
}

function openWs(url) {
    try { ws?.close?.(); } catch { }
    ws = null;
    wsUrl = url || null;

    if (!wsUrl) { setWsStatus("idle"); return; }

    setWsStatus("connecting");
    try { ws = new WebSocket(wsUrl); }
    catch { setWsStatus("error"); scheduleReconnect(); return; }

    ws.onopen = () => {
        setWsStatus("open");
        backoff = 1000;
        console.log('[castClient] WebSocket connected');
        send({ type: "REQUEST_SNAPSHOT" });
    };

    ws.onmessage = async (ev) => {
        const data = await decodeWsData(ev.data);
        if (!data) return;
        if (data?.type) applyCastMessage(data);
    };

    ws.onclose = () => {
        console.log('[castClient] WebSocket closed');
        setWsStatus("closed");
        scheduleReconnect();
    };

    ws.onerror = () => {
        console.error('[castClient] WebSocket error');
        setWsStatus("error");
        try { ws.close(); } catch { }
    };
}

function scheduleReconnect() {
    if (!wantReconnect || !wsUrl) return;
    const delay = backoff;
    backoff = Math.min(backoff * 1.7, MAX_BACKOFF);
    console.log(`[castClient] Reconnecting in ${delay}ms...`);
    setTimeout(() => openWs(wsUrl), delay);
}

function postLocal(msg) {
    if (bc) {
        try { bc.postMessage(msg); } catch { }
    } else {
        try { window.postMessage({ __CAST_BRIDGE__: true, msg }, "*"); } catch { }
        try { window.opener?.postMessage?.({ __CAST_BRIDGE__: true, msg }, "*"); } catch { }
    }
}

function send(msg) {
    if (!msg || !msg.type) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify(msg)); return; } catch { }
    }
    postLocal(msg);
}

/* ---------- API transport ---------- */
export function connectCast(url) {
    wantReconnect = !!url;
    try {
        if (url) localStorage.setItem("castWsUrl", url);
        else localStorage.removeItem("castWsUrl");
    } catch { }
    openWs(url || null);
}

/* ---------- Globals debug/interop + Watchdog côté Player ---------- */
if (typeof window !== "undefined") {
    window.__castSend = (m) => send(m);
    window.__castConnect = (url) => connectCast(url);
    window.__castGetTransport = () => ({ wsStatus, wsUrl, hasBC: !!bc });

    window.addEventListener("message", (e) => {
        const data = e?.data;
        if (data && data.__CAST_BRIDGE__ && data.msg && data.msg.type) applyCastMessage(data.msg);
    });

    // Auto-connect si URL mémorisée / globale
    try {
        const url =
            (typeof window.CAST_WS_URL === "string" && window.CAST_WS_URL) ||
            localStorage.getItem("castWsUrl") ||
            "";
        if (url) connectCast(url);
    } catch { }

    // ✅ Watchdog PULL côté Player - OPTIMISÉ (beaucoup moins agressif)
    let isViewer = false;
    try { isViewer = new URLSearchParams(window.location.search).has("viewer"); } catch { }

    if (isViewer) {
        console.log('[castClient] Player mode - watchdog DISABLED (using WS/HTTP push only)');

        // ❌ DÉSACTIVÉ: Pull WS toutes les 400ms était trop agressif
        // Le GM envoie les snapshots via WS/HTTP, pas besoin de pull en boucle

        // ✅ NOUVEAU: Pull HTTP initial seulement (au cas où WS est lent)
        const pullHTTP = async () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const room = params.get("room") || "default";
                const proto = window.location.protocol === "https:" ? "https:" : "http:";
                const host = window.location.hostname || "localhost";
                const url = `${proto}//${host}:8080/state?room=${encodeURIComponent(room)}`;

                const res = await fetch(url, { cache: "no-store" });
                const data = await res.json();

                if (data) {
                    console.log('[castClient] Initial HTTP pull successful');
                    applyCastMessage({ type: "SNAPSHOT", payload: data });
                }
            } catch (e) {
                console.error('[castClient] Initial HTTP pull failed:', e);
            }
        };

        // Pull HTTP UNE FOIS au démarrage (au cas où WS n'est pas prêt)
        setTimeout(pullHTTP, 100);

        // ✅ NOUVEAU: Pull de secours TRÈS occasionnel (toutes les 30s, pas 5s)
        // Seulement si on n'a rien reçu depuis longtemps
        setInterval(() => {
            const idleMs = Date.now() - lastRxAt;
            if (idleMs > 20000) {  // 20 secondes d'inactivité = fallback
                console.log('[castClient] Long idle detected, fallback HTTP pull');
                pullHTTP();
            }
        }, 10000);  // Check toutes les 10s, pas 400ms

        console.log('[castClient] Watchdog: WS push is primary, HTTP fallback every 30s if idle');
    }
}