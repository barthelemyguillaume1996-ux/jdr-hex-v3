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
        viewport, // ✅ Récupéré du store global
    } = useAppState();

    const buildSnapshot = () => {
        // ✅ Viewport vient du state (plus besoin de window.__lastViewport)
        const vp = viewport || { w: 1920, h: 1080 };

        let cameraToSend = { tx: 0, ty: 0, scale: 1 };
        try { if (window.__cameraCenter) cameraToSend = window.__cameraCenter; } catch { }

        // Surcharge temporaire si on veut suivre le dernier token (optionnel, comportement existant conservé)
        /* 
        if (window.__lastMovedToken) {
           // ... logic existante si on voulait forcer le suivi du token, 
           // mais attention ça écrase le pan manuel du GM si il existe
        } 
        */

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
            viewport: vp,
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
        // On retire __ts pour la comparaison (sinon ça change tout le temps)
        const { __ts, ...contentOnly } = snap;
        const snapStr = JSON.stringify(contentOnly);

        if (snapStr === lastSnapshotRef.current) {
            return;
        }

        lastSnapshotRef.current = snapStr;

        let sentViaWs = false;
        try {
            // On tente d'envoyer via WS (si dispo)
            window.__castSend?.({ type: "SNAPSHOT", payload: snap });

            // On vérifie le statut du WS pour savoir si on doit fallback en HTTP
            const status = window.__castGetTransport?.()?.wsStatus;
            sentViaWs = (status === "open");
        } catch { }

        // Fallback HTTP uniquement si WS pas connecté
        if (!sentViaWs) {
            postHTTP(snap);
        }
    };

    useEffect(() => {
        cancelAnimationFrame(rafRef.current);
        clearTimeout(timerRef.current);

        rafRef.current = requestAnimationFrame(() => {
            timerRef.current = setTimeout(pushSnapshot, 0);
        });
    }, [tokens, activeId, combatMode, remainingSpeedById, overlayTiles, currentMapUrl, viewport]);

    // ✅ Écouter les demandes de snapshot (ex: nouveau viewer connecté en local)
    useEffect(() => {
        const onRequest = () => {
            console.log("Received SNAPSHOT REQUEST via BC -> pushing state...");
            pushSnapshot();
        };
        window.addEventListener("cast:request_snapshot", onRequest);
        return () => window.removeEventListener("cast:request_snapshot", onRequest);
    }, [tokens, activeId, combatMode, remainingSpeedById, overlayTiles, currentMapUrl, viewport]);

    return null;
}