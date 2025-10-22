/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";

const WS_PORT = 8080;
const WS_PROTO = window.location.protocol === "https:" ? "wss" : "ws";
const ROOM = "table-1";
const WS_URL = `${WS_PROTO}://${window.location.hostname}:${WS_PORT}/?room=${encodeURIComponent(ROOM)}`;

function ensureClientId() {
    try {
        const key = "jdr-hex-v3/clientId";
        let id = sessionStorage.getItem(key);
        if (!id) {
            id = "client_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
            sessionStorage.setItem(key, id);
        }
        return id;
    } catch {
        return "client_" + Math.random().toString(36).slice(2);
    }
}

export default function CastControls({ showUI = false }) {
    const { tokens, activeId, updatedAt, combatMode, drawingsGM, visibleOverlays } = useAppState();
    const dispatch = useAppDispatch();

    const wsRef = useRef(null);
    const clientIdRef = useRef(ensureClientId());

    const [ready, setReady] = useState(false);
    const [viewers, setViewers] = useState(0);

    const publicSnapshot = useMemo(() => {
        const minimalTokens = tokens.map(t => ({
            id: t.id, name: t.name, type: t.type, img: t.img,
            q: t.q, r: t.r, isDeployed: !!t.isDeployed,
            initiative: Number.isFinite(t.initiative) ? t.initiative : 0,
            speed: t.speed ?? "", cellRadius: Number.isFinite(t.cellRadius) ? t.cellRadius : 1,
            pmLeft: Number.isFinite(t.pmLeft) ? t.pmLeft : undefined
        }));

        const overlaysPublic = visibleOverlays
            .map(id => drawingsGM.find(d => d.id === id))
            .filter(Boolean)
            .map(d => ({ id: d.id, name: d.name, tiles: d.tiles })); // seulement ce qui est visible

        return {
            tokens: minimalTokens,
            activeId: activeId || null,
            combatMode: !!combatMode,
            overlaysPublic, // 👈 public
            updatedAt: updatedAt || Date.now(),
        };
    }, [tokens, activeId, combatMode, drawingsGM, visibleOverlays, updatedAt]);

    const gmSnapshot = useMemo(() => ({
        drawingsGM,
        visibleOverlays
    }), [drawingsGM, visibleOverlays]);

    const send = (msg) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === 1) {
            const wrapped = { ...msg, source: clientIdRef.current };
            ws.send(JSON.stringify(wrapped));
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.__castSend = (msg) => send(msg);
            window.__castSnapshot = () => {
                send({ type: "SNAPSHOT", payload: publicSnapshot });
                send({ type: "GM_SNAPSHOT", payload: gmSnapshot });
            };
        }
        return () => {
            if (typeof window !== "undefined") {
                delete window.__castSend;
                delete window.__castSnapshot;
            }
        };
    }, [publicSnapshot, gmSnapshot]);

    useEffect(() => {
        let stopped = false;
        const connect = () => {
            if (stopped) return;
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                setReady(true);
                ws.send(JSON.stringify({ type: "GM_HELLO", source: clientIdRef.current }));
                send({ type: "REQUEST_SNAPSHOT" });
                setTimeout(() => {
                    send({ type: "SNAPSHOT", payload: publicSnapshot });
                    send({ type: "GM_SNAPSHOT", payload: gmSnapshot });
                }, 200);
            };

            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    const from = msg.source;

                    if (msg.type === "REQUEST_SNAPSHOT") {
                        send({ type: "SNAPSHOT", payload: publicSnapshot });
                        send({ type: "GM_SNAPSHOT", payload: gmSnapshot });
                    } else if (msg.type === "SNAPSHOT" && msg.payload) {
                        if (from && from === clientIdRef.current) return;
                        const remote = msg.payload;
                        const remoteUpdated = Number.isFinite(remote.updatedAt) ? remote.updatedAt : 0;
                        const localUpdated = Number.isFinite(updatedAt) ? updatedAt : 0;
                        if (remoteUpdated > localUpdated) {
                            dispatch({ type: "APPLY_SNAPSHOT", payload: remote });
                        }
                    } else if (msg.type === "GM_SNAPSHOT" && msg.payload) {
                        if (from && from === clientIdRef.current) return;
                        dispatch({ type: "APPLY_GM_SNAPSHOT", payload: msg.payload });
                    } else if (msg.type === "VIEWER_HELLO") {
                        setViewers(v => Math.min(99, v + 1));
                    } else if (msg.type === "VIEWER_BYE") {
                        setViewers(v => Math.max(0, v - 1));
                    }
                } catch (e2) { /* ignore parse */ }
            };

            ws.onclose = () => {
                setReady(false);
                wsRef.current = null;
                setTimeout(connect, 800);
            };
            ws.onerror = () => ws.close();
        };
        connect();
        return () => { stopped = true; wsRef.current?.close(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (ready) {
            send({ type: "SNAPSHOT", payload: publicSnapshot });
            send({ type: "GM_SNAPSHOT", payload: gmSnapshot });
        }
    }, [publicSnapshot, gmSnapshot, ready]);

    if (!showUI) return null;

    const wrap = {
        position: "fixed", right: 12, top: 12, zIndex: 50,
        display: "flex", gap: 8, alignItems: "center",
        background: "rgba(15,15,15,0.8)", padding: "6px 8px",
        border: "1px solid #2a2a2a", borderRadius: 10, backdropFilter: "blur(3px)"
    };
    const btn = { padding: "6px 10px", borderRadius: 8, border: "1px solid #2c4", background: "#18ff9b", color: "#000", fontWeight: 700, cursor: "pointer" };
    const btnGhost = { padding: "6px 8px", borderRadius: 8, border: "1px solid #333", background: "#1b1b1b", color: "#fff", cursor: "pointer" };

    const openViewer = () => {
        const base = window.location.href.split("#")[0].split("?")[0];
        window.open(`${base}?viewer=1`, "jdr-viewer", "noopener,noreferrer,width=1280,height=800`);
    };

    return (
        <div style={wrap}>
            <button style={btn} onClick={openViewer}>🎬 Ouvrir la vue Joueurs</button>
            <button style={btnGhost} onClick={() => { send({ type: "SNAPSHOT", payload: publicSnapshot }); send({ type: "GM_SNAPSHOT", payload: gmSnapshot }); }}>↻ Sync</button>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{ready ? "WS ok" : "WS…"} · viewers: {viewers}</span>
        </div>
    );
}
