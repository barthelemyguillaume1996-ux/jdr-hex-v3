/* eslint-disable no-empty */
// src/ui/CastBridge.jsx
// SEUL responsable de l'envoi des snapshots
import React, { useEffect, useRef } from "react";
import { useAppState } from "../state/StateProvider";
import { axialToPixel } from "../core/hexMath";
import { BASE_HEX_RADIUS, HEX_SCALE } from "../core/boardConfig";

const HEX_RADIUS = BASE_HEX_RADIUS * HEX_SCALE;

export default function CastBridge() {
    const {
        tokens,
        activeId,
        combatMode,
        remainingSpeedById,
        overlayTiles,
        currentMapUrl,
    } = useAppState();

    const buildSnapshot = () => {
        // ✅ Récupérer le dernier token bougé si dispo
        let cameraToSend = { tx: 0, ty: 0, scale: 1 };

        if (window.__lastMovedToken) {
            const { q, r } = window.__lastMovedToken;
            // Convertir coordonnées hex en world
            const { x, y } = axialToPixel(q, r, HEX_RADIUS);
            cameraToSend = { tx: x, ty: y, scale: 1 };
        }

        return {
            tokens: Array.isArray(tokens)
                ? tokens.map((t) => ({
                    id: t.id,
                    name: t.name,
                    img: t.img,
                    type: t.type,
                    q: t.q,
                    r: t.r,
                    isDeployed: !!t.isDeployed,
                    initiative: t.initiative,
                    speed: t.speed,
                    cellRadius: t.cellRadius,
                }))
                : [],
            activeId: activeId ?? null,
            combatMode: !!combatMode,
            remainingSpeedById: remainingSpeedById || {},
            overlayTiles: Array.isArray(overlayTiles) ? overlayTiles : [],
            currentMapUrl: currentMapUrl || null,
            camera: cameraToSend,
            __ts: Date.now(),
        };
    };

    const stateUrlRef = useRef("");
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const room = params.get("room") || "default";
            const proto = window.location.protocol === "https:" ? "https:" : "http:";
            const host = window.location.hostname || "localhost";
            stateUrlRef.current = `${proto}//${host}:8080/state?room=${encodeURIComponent(room)}`;
        } catch { }
    }, []);

    async function postHTTP(snap) {
        const url = stateUrlRef.current;
        if (!url) return;
        try {
            await fetch(url, {
                method: "POST",
                mode: "cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload: snap }),
                keepalive: true,
            });
        } catch { }
    }

    const lastSnapshotRef = useRef(null);
    const rafRef = useRef(0);
    const timerRef = useRef(0);

    const pushSnapshot = () => {
        const snap = buildSnapshot();
        const snapStr = JSON.stringify(snap);

        if (snapStr === lastSnapshotRef.current) {
            return;
        }

        lastSnapshotRef.current = snapStr;

        try {
            window.__castSend?.({ type: "SNAPSHOT", payload: snap });
        } catch { }
        postHTTP(snap);
    };

    useEffect(() => {
        cancelAnimationFrame(rafRef.current);
        clearTimeout(timerRef.current);

        rafRef.current = requestAnimationFrame(() => {
            timerRef.current = setTimeout(pushSnapshot, 0);
        });
    }, [tokens, activeId, combatMode, remainingSpeedById, overlayTiles, currentMapUrl]);

    useEffect(() => {
        const id = setInterval(() => {
            postHTTP(buildSnapshot());
        }, 3000);
        return () => clearInterval(id);
    }, []);

    return null;
}