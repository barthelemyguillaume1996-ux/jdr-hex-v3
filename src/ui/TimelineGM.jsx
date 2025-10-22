/* eslint-disable no-empty */
// src/ui/TimelineGM.jsx
import React, { useMemo } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";

export default function TimelineGM() {
    const { tokens, activeId, combatMode, remainingSpeedById } = useAppState();
    const dispatch = useAppDispatch();

    const order = useMemo(() => {
        const arr = (Array.isArray(tokens) ? tokens : []).filter(t => t.isDeployed);
        return arr.slice().sort((a, b) => {
            const ia = Number.isFinite(+a.initiative) ? +a.initiative : 0;
            const ib = Number.isFinite(+b.initiative) ? +b.initiative : 0;
            if (ib !== ia) return ib - ia;
            return (a.name || "").localeCompare(b.name || "");
        });
    }, [tokens]);

    const activeSpeed = useMemo(() => {
        if (!activeId) return null;
        const rem = remainingSpeedById?.[activeId];
        if (Number.isFinite(+rem)) return +rem;
        const t = (Array.isArray(tokens) ? tokens : []).find(x => x.id === activeId);
        return Number.isFinite(+t?.speed) ? +t.speed : null;
    }, [remainingSpeedById, activeId, tokens]);

    const onNextTurn = () => {
        dispatch({ type: "NEXT_TURN" });
        try { window.__castSnapshot?.(); } catch { }
    };

    return (
        <div style={wrap}>
            <div style={strip}>
                <div style={list}>
                    {order.map(t => <Badge key={t.id} token={t} active={t.id === activeId} />)}
                </div>

                {/* Vitesse actuelle de l’actif */}
                <div style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: combatMode ? "#182018" : "#0d0d0d",
                    color: combatMode ? "#b7ffcf" : "#777",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    marginRight: 8
                }}>
                    {combatMode && activeId ? (`Vit. restante: ${Number.isFinite(+activeSpeed) ? +activeSpeed : "-"}`) : "Combat OFF"}
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

function Badge({ token, active }) {
    const size = 32;
    const src = token.img || "";
    const hasExt = /\.\w{3,4}$/.test(src);
    const isUrl = /^(blob:|data:|https?:)/.test(src);

    const imgStyle = {
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", display: "block",
        border: active ? "2px solid #18ff9b" : "2px solid #2a2a2a",
        boxShadow: active ? "0 0 0 3px rgba(24,255,155,0.25)" : "none",
    };

    return (
        <div style={badge}>
            {src ? (
                isUrl || hasExt ? (
                    <img src={src} alt="" style={imgStyle} />
                ) : (
                    <picture>
                        <source srcSet={`${src}.webp`} type="image/webp" />
                        <source srcSet={`${src}.png`} type="image/png" />
                        <source srcSet={`${src}.jpg`} type="image/jpeg" />
                        <img src={`${src}.jpeg`} alt="" style={imgStyle} />
                    </picture>
                )
            ) : (
                <div style={{ ...imgStyle, background: "#222" }} />
            )}

            <div style={name} title={token.name || ""}>{token.name || "Sans nom"}</div>
            <div style={init}>{Number.isFinite(+token.initiative) ? +token.initiative : 0}</div>
        </div>
    );
}

/* styles */
const wrap = { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 32, pointerEvents: "none" };
const strip = { margin: "0 auto 10px auto", maxWidth: 980, background: "rgba(10,10,10,0.92)", border: "1px solid #242424", borderRadius: 12, padding: 8, display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" };
const list = { display: "flex", alignItems: "center", gap: 10, overflowX: "auto", paddingBottom: 4, flex: 1 };
const badge = { display: "grid", gridTemplateColumns: "auto auto auto", alignItems: "center", gap: 8, background: "#141414", border: "1px solid #202020", borderRadius: 10, padding: "6px 8px" };
const name = { maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, color: "#fff", opacity: 0.95 };
const init = { fontSize: 11, color: "#aaa", padding: "0 6px", borderLeft: "1px solid #222" };
