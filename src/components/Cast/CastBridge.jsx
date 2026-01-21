/* eslint-disable no-empty */
// src/components/Cast/CastBridge.jsx
// SEUL responsable de l'envoi des snapshots
import React, { useEffect, useRef } from "react";
import { useAppState } from "../../state/StateProvider";

export default function CastBridge() {
    const {
        tokens,
        ui,
        overlayTiles,
        currentMapUrl,
        currentPencilStroke,
        pencilStrokes // ✅ ADDED
    } = useAppState();

    const combatMode = ui?.combatMode;
    const activeTokenId = ui?.activeTokenId;

    // --- SOLUTION CRITIQUE: REF POUR ÉVITER LE STALE CLOSURE ---
    // On stocke TOUT l'état dans une ref qui est mise à jour à chaque render.
    // L'intervalle lira cette ref, donc il verra toujours la "dernière version".
    const latestStateRef = useRef(null);

    useEffect(() => {
        latestStateRef.current = {
            tokens,
            activeTokenId,
            combatMode,
            overlayTiles,
            currentMapUrl,
            currentPencilStroke,
            pencilStrokes // ✅ ADDED
        };
    }, [tokens, activeTokenId, combatMode, overlayTiles, currentMapUrl, currentPencilStroke, pencilStrokes]);


    const buildSnapshot = () => {
        const s = latestStateRef.current; // LIRE LA REF, PAS LE SCOPE !
        if (!s) return null;

        // DEBUG: Verify strokes are present
        if (s.pencilStrokes && s.pencilStrokes.length > 0) {
            // console.log("Building Snapshot with " + s.pencilStrokes.length + " strokes");
        }

        const vp = { w: 1920, h: 1080 };
        let cameraToSend = { tx: 0, ty: 0, scale: 1 };
        try { if (window.__cameraCenter) cameraToSend = window.__cameraCenter; } catch { }

        return {
            tokens: Array.isArray(s.tokens)
                ? s.tokens.map((t) => ({
                    id: t.id,
                    name: t.name,
                    img: t.img,
                    type: t.type,
                    q: t.q,
                    r: t.r,
                    isDeployed: t.isDeployed ?? true,
                    initiative: t.initiative,
                    speed: t.speed,
                    remainingSpeed: t.remainingSpeed,
                    cellRadius: t.cellRadius,
                    hp: t.hp, // ✅ Added HP sync
                    maxHp: t.maxHp, // ✅ Added MaxHP sync
                    conditions: t.conditions || [], // ✅ Added conditions sync
                }))
                : [],
            activeId: s.activeTokenId ?? null,
            combatMode: !!s.combatMode,
            remainingSpeedById: {},
            overlayTiles: Array.isArray(s.overlayTiles) ? s.overlayTiles : [],
            currentPencilStroke: s.currentPencilStroke || null,
            pencilStrokes: s.pencilStrokes || [], // ✅ ADDED
            currentMapUrl: s.currentMapUrl || null,
            camera: cameraToSend,
            viewport: vp,
            __ts: Date.now(),
        };

        // Debug: Log combat state being sent
        console.log('[CastBridge] Sending snapshot:', {
            combatMode: snap.combatMode,
            activeId: snap.activeId,
            tokensCount: snap.tokens.length
        });

        return snap;
    };

    // --- NATIVE SYNC ---
    const lastSerializedStateRef = useRef(""); // To prevent sending identical logic frames

    const pushSnapshot = (force = false) => {
        try {
            const snap = buildSnapshot();
            if (!snap) return;

            // DEDUPLICATION: Don't resend if state hasn't effectively changed
            // UNLESS 'force' is true (Heartbeat)
            // This is critical for performance if we have many spurious triggers (e.g. ref updates)
            // We exclude __ts from comparison because it always changes
            const { __ts, ...content } = snap;
            const serialized = JSON.stringify(content);

            if (!force && serialized === lastSerializedStateRef.current) {
                // Skip update - nothing changed and not forced
                return;
            }

            // HEARTBEAT OPTIMIZATION:
            // If forced (Heartbeat) BUT content is identical, send a Lightweight PING
            // instead of the full heavy payload (which blocks UI thread during serialization).
            if (force && serialized === lastSerializedStateRef.current) {
                if (window.api && window.api.broadcastState) {
                    // Send minimal PING packet
                    window.api.broadcastState(JSON.stringify({ type: 'PING', __ts: Date.now() }));
                }
                return;
            }

            lastSerializedStateRef.current = serialized;

            // Use Native IPC if available
            if (window.api && window.api.broadcastState) {
                const payloadStr = JSON.stringify(snap); // Re-include timestamp for receiver
                window.api.broadcastState(payloadStr);
            } else {
                // Fallback BC
                try {
                    const bc = new BroadcastChannel("jdr_cast_v3");
                    bc.postMessage(snap);
                    bc.close();
                } catch (e) { }
            }
        } catch (globalErr) {
            console.error("Critical Cast Error:", globalErr);
        }
    };

    // ✅ UNIFIED SYNC TRIGGER (Pencil + Global State)
    const lastPushRef = useRef(0);
    const timeoutRef = useRef(null);

    useEffect(() => {
        const now = Date.now();
        const timeSinceLast = now - lastPushRef.current;
        const THROTTLE_MS = 30;

        // Clear trailing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        const isStopDrawing = (!currentPencilStroke);

        if (isStopDrawing) {
            // Stop Drawing -> Immediate Push to clear state
            pushSnapshot();
            lastPushRef.current = now;
        } else {
            // Active Drawing -> Throttled
            if (timeSinceLast > THROTTLE_MS) {
                pushSnapshot();
                lastPushRef.current = now;
            } else {
                timeoutRef.current = setTimeout(() => {
                    pushSnapshot();
                    lastPushRef.current = Date.now();
                }, THROTTLE_MS - timeSinceLast + 5);
            }
        }
    }, [currentPencilStroke, tokens, activeTokenId, combatMode, overlayTiles, currentMapUrl, pencilStrokes]);

    // Cleanup timeouts on unmount
    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    // ✅ Écouter les demandes de snapshot
    useEffect(() => {
        const onRequest = () => {
            pushSnapshot();
        };
        window.addEventListener("cast:request_snapshot", onRequest);

        // Keep a slow heartbeat just in case events are missed AND to keep connection alive
        const heartbeat = window.setInterval(() => {
            // Force a push every 2s to keep "Connected" status green (App has 4s timeout)
            // Even if data hasn't changed.
            pushSnapshot(true);
        }, 2000);

        return () => {
            window.removeEventListener("cast:request_snapshot", onRequest);
            clearInterval(heartbeat);
        };
    }, []);

    // Invisible component
    return null;
}
