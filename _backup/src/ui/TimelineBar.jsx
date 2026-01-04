// src/ui/TimelineBar.jsx
/* eslint-disable no-empty */
import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import { subscribeCast, getCastState } from "../cast/castClient";

// Détermine si on est en vue Player
function useIsViewer() {
    try { return new URLSearchParams(window.location.search).has("viewer"); }
    catch { return false; }
}

export default function TimelineBar() {
    const isViewer = useIsViewer();
    return isViewer ? <TimelinePlayer /> : <TimelineGM />;
}

/* ================= GM ================= */
function TimelineGM() {
    const { tokens, combatMode, activeId, remainingSpeedById } = useAppState();
    const dispatch = useAppDispatch();

    const order = useMemo(() => {
        const arr = (Array.isArray(tokens) ? tokens : []).filter(t => t.isDeployed);
        return arr.slice().sort((a, b) => {
            const ia = num(a.initiative);
            const ib = num(b.initiative);
            if (ib !== ia) return ib - ia;
            return (a.name || "").localeCompare(b.name || "");
        });
    }, [tokens]);

    const onNextTurn = () => {
        dispatch({ type: "NEXT_TURN" });
        try { window.__castSnapshot?.(); } catch { }
    };

    if (!combatMode || order.length === 0) return null;

    return (
        <div style={wrap}>
            <div style={strip}>
                <div style={list}>
                    {order.map(t => (
                        <TokenBadge
                            key={t.id}
                            token={t}
                            active={t.id === activeId}
                            showSpeed={combatMode}
                            remaining={num(remainingSpeedById?.[t.id], null)}
                        />
                    ))}
                </div>

                <button
                    onClick={onNextTurn}
                    disabled={!combatMode || order.length === 0}
                    style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #333",
                        background: combatMode ? "#1b1b1b" : "#0d0d0d",
                        color: combatMode ? "#fff" : "#777",
                        cursor: combatMode && order.length ? "pointer" : "default",
                        fontSize: 12,
                        whiteSpace: "nowrap"
                    }}
                    title="Passer au prochain tour"
                >
                    ▶︎ Passer tour
                </button>
            </div>
        </div>
    );
}

/* ================= Player ================= */
function TimelinePlayer() {
    // Store “cast” côté player
    const snap = useSyncExternalStore(subscribeCast, getCastState);

    // Handshake pour récupérer l'état si on arrive après le GM
    useEffect(() => {
        try {
            window.__castSend?.({ type: "REQUEST_SNAPSHOT" });
            // petit HELLO de compatibilité (le GM peut répondre via __castOnHello)
            setTimeout(() => window.__castSend?.({ type: "HELLO" }), 50);
        } catch { }
    }, []);

    const order = useMemo(() => {
        const arr = (Array.isArray(snap.tokens) ? snap.tokens : []).filter(t => t.isDeployed);
        return arr.slice().sort((a, b) => {
            const ia = num(a.initiative);
            const ib = num(b.initiative);
            if (ib !== ia) return ib - ia;
            return (a.name || "").localeCompare(b.name || "");
        });
    }, [snap.tokens]);

    if (!snap.combatMode || order.length === 0) return null;

    return (
        <div style={wrap}>
            <div style={strip}>
                <div style={list}>
                    {order.map(t => (
                        <TokenBadge
                            key={t.id}
                            token={t}
                            active={t.id === snap.activeId}
                            showSpeed={!!snap.combatMode}
                            remaining={num(snap.remainingSpeedById?.[t.id], null)}
                        />
                    ))}
                </div>
                {/* Pas de bouton côté joueurs */}
            </div>
        </div>
    );
}

/* ================= Badge simple, inline ================= */
function TokenBadge({ token, active, showSpeed, remaining }) {
    const size = 32;
    const src = token?.img || "";
    const hasExt = /\.\w{3,4}$/.test(src);
    const isUrl = /^(blob:|data:|https?:)/.test(src);

    const frame = {
        display: "grid",
        gridTemplateColumns: "auto auto auto",
        alignItems: "center",
        gap: 8,
        background: "#141414",
        border: "1px solid #202020",
        borderRadius: 10,
        padding: "6px 8px",
        minWidth: 0,
    };

    const avatarStyle = {
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", display: "block",
        border: active ? "2px solid #18ff9b" : "2px solid #2a2a2a",
        boxShadow: active ? "0 0 0 3px rgba(24,255,155,0.25)" : "none",
    };

    return (
        <div style={frame}>
            {src ? (
                isUrl || hasExt ? (
                    <img src={src} alt="" style={avatarStyle} />
                ) : (
                    <picture>
                        <source srcSet={`${src}.webp`} type="image/webp" />
                        <source srcSet={`${src}.png`} type="image/png" />
                        <source srcSet={`${src}.jpg`} type="image/jpeg" />
                        <img src={`${src}.jpeg`} alt="" style={avatarStyle} />
                    </picture>
                )
            ) : (
                <div style={{ ...avatarStyle, background: "#222" }} />
            )}

            <div
                style={{
                    maxWidth: 180,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: 12,
                    color: "#fff",
                    opacity: 0.95
                }}
                title={token?.name || ""}
            >
                {token?.name || "Sans nom"}
            </div>

            <div style={{ fontSize: 11, color: "#aaa", padding: "0 6px", borderLeft: "1px solid #222" }}>
                {num(token?.initiative)}
                {showSpeed && active && Number.isFinite(remaining) ? ` • ⚡${remaining}` : ""}
            </div>
        </div>
    );
}

/* ================= utils & styles ================= */
function num(v, d = 0) { const n = +v; return Number.isFinite(n) ? n : d; }

const wrap = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 32,
    pointerEvents: "none",
};
const strip = {
    margin: "0 auto 10px auto",
    maxWidth: 980,
    background: "rgba(10,10,10,0.92)",
    border: "1px solid #242424",
    borderRadius: 12,
    padding: 8,
    display: "flex",
    alignItems: "center",
    gap: 10,
    pointerEvents: "auto",
};
const list = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 4,
    flex: 1,
};
