// src/ui/HexBoard.jsx — Source de vérité = serveur + support zoom (ex: zoom={0.5} côté joueur)
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import { pixelToAxialRounded as _pixelToAxialRounded, axialToPixel as _axialToPixel } from "../core/hexMath";
import {
    drawGrid as _drawGrid,
    drawTokens as _drawTokens,
    drawSingleToken as _drawSingleToken,
    hitTestToken as _hitTestToken,
    drawMoveRange as _drawMoveRange,
    fillHex as _fillHex,
    drawTilesBatched as _drawTilesBatched,
} from "./hexboard-utils";
import { BASE_HEX_RADIUS as _BASE, HEX_SCALE as _SCALE, CAMERA_SCALE as _CAM } from "../core/boardConfig";

/* --- Constantes / fallbacks --- */
const BASE_HEX_RADIUS = (typeof _BASE === "number" ? _BASE : 50);
const HEX_SCALE = (typeof _SCALE === "number" ? _SCALE : 1);
const CAMERA_SCALE = (typeof _CAM === "number" ? _CAM : 1);
const HEX_RADIUS = BASE_HEX_RADIUS * HEX_SCALE;

// Drag précis
const DRAG_START_PX_TOUCH = 12;
const DRAG_START_PX_MOUSE = 4;
const HYSTERESIS_PX = 14;

/* --- Safe wrappers --- */
const isFn = (f) => typeof f === "function";
const drawGrid = isFn(_drawGrid) ? _drawGrid : () => { };
const drawTokens = isFn(_drawTokens) ? _drawTokens : () => { };
const drawSingleToken = isFn(_drawSingleToken) ? _drawSingleToken : () => { };
const hitTestToken = isFn(_hitTestToken) ? _hitTestToken : () => false;
const drawMoveRange = isFn(_drawMoveRange) ? _drawMoveRange : () => { };
const fillHex = isFn(_fillHex) ? _fillHex : () => { };
const drawTilesBatched = isFn(_drawTilesBatched) ? _drawTilesBatched : () => { };

// ✅ FIX: Fallback doit être Pointy-Topped comme hexMath.js
function pixelToAxialRounded(x, y, R) {
    try { if (isFn(_pixelToAxialRounded)) return _pixelToAxialRounded(x, y, R); } catch { }
    // Fallback Pointy
    const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / R;
    const r = (2 / 3 * y) / R;
    return { q: Math.round(q), r: Math.round(r) }; // Simplifié pour fallback
}
function axialToPixel(q, r, R) {
    try { if (isFn(_axialToPixel)) return _axialToPixel(q, r, R); } catch { }
    // Fallback Pointy
    const x = R * Math.sqrt(3) * (q + r / 2);
    const y = R * 1.5 * r;
    return { x, y };
}
// distance entière
function hexStepsInt(q1, r1, q2, r2) {
    q1 = Math.round(q1); r1 = Math.round(r1);
    q2 = Math.round(q2); r2 = Math.round(r2);
    const s1 = -q1 - r1, s2 = -q2 - r2;
    return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
}

/* --- Helpers ligne (clamp & snap) --- */
function axialToCube(q, r) { return { x: q, z: r, y: -q - r }; }
function cubeLerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }; }
function cubeRound(c) {
    let rx = Math.round(c.x), ry = Math.round(c.y), rz = Math.round(c.z);
    const x_diff = Math.abs(rx - c.x), y_diff = Math.abs(ry - c.y), z_diff = Math.abs(rz - c.z);
    if (x_diff > y_diff && x_diff > z_diff) rx = -ry - rz;
    else if (y_diff > z_diff) ry = -rx - rz;
    else rz = -rx - ry;
    return { x: rx, y: ry, z: rz };
}
function clampToReachableOnLine(q1, r1, q2, r2, maxSteps, onScreenCheck) {
    maxSteps = Math.max(0, Math.floor(maxSteps));
    const total = hexStepsInt(q1, r1, q2, r2);
    if (maxSteps === 0 || total === 0) return { q: q1, r: r1, steps: 0 };
    const a = axialToCube(q1, r1), b = axialToCube(q2, r2);
    const N = Math.min(total, maxSteps);
    let last = { q: q1, r: r1 };
    for (let i = 1; i <= N; i++) {
        const t = total > 0 ? i / total : 1;
        const c = cubeRound(cubeLerp(a, b, t));
        const cell = { q: c.x, r: c.z };
        if (onScreenCheck && !onScreenCheck(cell.q, cell.r)) {
            return { q: last.q, r: last.r, steps: i - 1 };
        }
        last = cell;
    }
    return { q: last.q, r: last.r, steps: N };
}

/* --- Viewport Event (cast) --- */
function dispatchViewportEvent(detail) {
    try {
        if (typeof window.CustomEvent === "function") {
            const ev = new CustomEvent("cast:viewport", { detail });
            window.dispatchEvent(ev);
            return;
        }
    } catch { }
    try {
        const ev2 = document.createEvent("CustomEvent");
        ev2.initCustomEvent("cast:viewport", false, false, detail);
        window.dispatchEvent(ev2);
    } catch { }
}

/* --- Composant --- */
export default function HexBoard({ fullscreen = true, zoom = 1 }) {
    // état global protégé
    let st; try { st = useAppState(); } catch { st = {}; }
    const tokens = Array.isArray(st && st.tokens) ? st.tokens : [];
    const activeId = (st && st.activeId != null) ? st.activeId : null;
    const combatMode = !!(st && st.combatMode);
    const remainingSpeedById = (st && st.remainingSpeedById) ? st.remainingSpeedById : {};
    const overlayTiles = Array.isArray(st && st.overlayTiles) ? st.overlayTiles : [];
    const currentMapUrl = (st && st.currentMapUrl) ? st.currentMapUrl : null;

    let _dispatch = () => { }; try { _dispatch = useAppDispatch(); } catch { }
    const dispatch = _dispatch;

    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const rafRef = useRef(0);
    const drawRef = useRef(() => { });
    const scheduleDrawRef = useRef(() => { });
    const mapBitmapRef = useRef(null);

    // état du drag
    const drag = useRef({
        id: null,
        startQ: 0, startR: 0,
        overQ: 0, overR: 0,
        // ✅ NOUVEAU: Coords flottantes pour ghost fluide
        dragQ: 0, dragR: 0,

        hoverQ: 0, hoverR: 0,
        active: false,
        moved: false,
        startSX: 0, startSY: 0,
        offsetWX: 0, offsetWY: 0,
    });

    // ✅ NOUVEAU: Buffer local pour le dessin fluide (évite dispatch délirant)
    const currentStroke = useRef([]);

    // lecture simple de la vitesse restante SERVEUR
    const getServerSpeedLeft = useCallback((id) => {
        const v = remainingSpeedById && remainingSpeedById[id];
        if (v == null || isNaN(Number(v))) return null; // inconnu (pas de cap côté client)
        return Math.max(0, Math.floor(Number(v)));
    }, [remainingSpeedById]);

    // taille exacte du conteneur plein écran
    const [size, setSize] = useState({ w: 1280, h: 800 });

    useEffect(() => {
        function measure() {
            const el = containerRef.current;
            if (!el || !el.getBoundingClientRect) return;
            const r = el.getBoundingClientRect();
            const w = Math.max(320, Math.round(r.width || 0));
            const h = Math.max(240, Math.round(r.height || 0));
            setSize((o) => (o.w !== w || o.h !== h ? { w, h } : o));
        }
        measure();
        const a = requestAnimationFrame(measure);
        const b = requestAnimationFrame(measure);
        let ro = null;
        if (typeof ResizeObserver !== "undefined") {
            try { ro = new ResizeObserver(measure); if (containerRef.current) ro.observe(containerRef.current); } catch { }
        }
        window.addEventListener("resize", measure);
        window.addEventListener("orientationchange", measure);
        const iv = setInterval(measure, 500);
        return () => {
            try { ro && ro.disconnect && ro.disconnect(); } catch { }
            window.removeEventListener("resize", measure);
            window.removeEventListener("orientationchange", measure);
            cancelAnimationFrame(a); cancelAnimationFrame(b);
            clearInterval(iv);
        };
    }, []);

    // 🔒 Caméra FIXE (+ zoom externe)
    const [cam] = useState(() => ({ tx: 0, ty: 0, scale: CAMERA_SCALE * (zoom || 1) }));
    useEffect(() => { try { window.__cameraCenter = { tx: cam.tx, ty: cam.ty, scale: cam.scale }; } catch { } }, []);
    useEffect(() => {
        cam.scale = Math.max(0.1, CAMERA_SCALE * (zoom || 1));
        try { window.__cameraCenter = { tx: cam.tx, ty: cam.ty, scale: cam.scale }; } catch { }
        if (scheduleDrawRef.current) scheduleDrawRef.current();
    }, [zoom]); // redraw quand le zoom change
    // eslint-disable-line react-hooks/exhaustive-deps

    // Viewport cast
    const emitViewport = useCallback(() => {
        try {
            const w = size.w, h = size.h;
            dispatch({ type: "SET_VIEWPORT", payload: { w, h } });
            dispatchViewportEvent({ w, h });
            try { if (window.__castSend) window.__castSend({ type: "VIEWPORT", payload: { w, h } }); } catch { }
        } catch { }
    }, [size.w, size.h, dispatch]);
    useEffect(() => {
        emitViewport();
        const t1 = setTimeout(emitViewport, 100);
        const t2 = setTimeout(emitViewport, 500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [emitViewport]);

    // Map (optionnelle)
    useEffect(() => {
        let alive = true;
        mapBitmapRef.current = null;
        if (!currentMapUrl) { if (scheduleDrawRef.current) scheduleDrawRef.current(); return; }
        try {
            fetch(currentMapUrl, { cache: "no-store" })
                .then((res) => res.blob())
                .then((blob) => {
                    if (!alive) return;
                    if (typeof window.createImageBitmap === "function") {
                        window.createImageBitmap(blob)
                            .then((bmp) => { if (!alive) return; mapBitmapRef.current = bmp; if (scheduleDrawRef.current) scheduleDrawRef.current(); })
                            .catch(() => {
                                if (!alive) return;
                                const img = new Image();
                                img.onload = () => { if (!alive) return; mapBitmapRef.current = img; if (scheduleDrawRef.current) scheduleDrawRef.current(); };
                                img.src = URL.createObjectURL(blob);
                            });
                    } else {
                        const img = new Image();
                        img.onload = () => { if (!alive) return; mapBitmapRef.current = img; if (scheduleDrawRef.current) scheduleDrawRef.current(); };
                        img.src = URL.createObjectURL(blob);
                    }
                })
                .catch(() => { mapBitmapRef.current = null; if (scheduleDrawRef.current) scheduleDrawRef.current(); });
        } catch {
            mapBitmapRef.current = null; if (scheduleDrawRef.current) scheduleDrawRef.current();
        }
        return () => { alive = false; };
    }, [currentMapUrl]);

    // canvas = EXACTEMENT size
    useEffect(() => {
        const cv = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;
        function resize() {
            try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch { }
            cv.width = Math.max(1, size.w);
            cv.height = Math.max(1, size.h);
            if (scheduleDrawRef.current) scheduleDrawRef.current();
        }
        try { resize(); } catch { }
    }, [size.w, size.h]);

    // helpers coord
    const sx2wxNow = (sx) => (sx - size.w / 2) / cam.scale + cam.tx;
    const sy2wyNow = (sy) => (sy - size.h / 2) / cam.scale + cam.ty;

    // test écran
    function isCellOnScreen(q, r) {
        q = Math.round(q); r = Math.round(r);
        const p = axialToPixel(q, r, HEX_RADIUS);
        const sx = (p.x - cam.tx) * cam.scale + size.w / 2;
        const sy = (p.y - cam.ty) * cam.scale + size.h / 2;
        const margin = HEX_RADIUS;
        return sx >= margin && sy >= margin && sx <= (size.w - margin) && sy <= (size.h - margin);
    }

    // redraw
    // redraw flag
    const isDirty = useRef(true);
    function requestRedraw() { isDirty.current = true; }
    scheduleDrawRef.current = requestRedraw;

    // BOUCLE DE RENDU PRINCIPALE (RAF LOOP)
    useEffect(() => {
        let rafId;
        function loop() {
            if (isDirty.current) {
                isDirty.current = false;
                try { drawRef.current(); } catch { }
            }
            rafId = requestAnimationFrame(loop);
        }
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    /* ===================== POINTEURS ===================== */
    const onPointerDown = useCallback((e) => {
        const cv = canvasRef.current; if (!cv) return;
        try { e.preventDefault(); } catch { }
        const rect = (cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0 }) || { left: 0, top: 0 };
        const sx = e.clientX - (rect.left || 0);
        const sy = e.clientY - (rect.top || 0);

        // --- MODE DESSIN (Fluidité MAX) ---
        const drawMode = !!(st && st.drawMode);
        if (drawMode) {
            try { if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); } catch { }

            const pointerWX = sx2wxNow(sx);
            const pointerWY = sy2wyNow(sy);
            const p = pixelToAxialRounded(pointerWX, pointerWY, HEX_RADIUS);
            const q = Math.round(p.q), r = Math.round(p.r);

            // Init stroke
            drag.current.active = true;
            drag.current.isDrawing = true;
            drag.current.lastDrawQ = q;
            drag.current.lastDrawR = r;

            const tex = (st && st.selectedTexture) || "herbe";
            currentStroke.current = [{ q, r, texId: tex }];
            requestRedraw();
            return;
        }

        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i];
            if (!t || !t.isDeployed) continue;
            try {
                if (hitTestToken(sx, sy, t, cam, size.w, size.h, HEX_RADIUS)) {
                    try { if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); } catch { }
                    const c = axialToPixel(t.q || 0, t.r || 0, HEX_RADIUS);
                    const pointerWX = sx2wxNow(sx);
                    const pointerWY = sy2wyNow(sy);
                    drag.current = {
                        id: t.id,
                        startQ: t.q, startR: t.r,
                        overQ: t.q, overR: t.r,
                        dragQ: t.q, dragR: t.r, // Init ghost
                        hoverQ: t.q, hoverR: t.r,
                        active: false,
                        moved: false,
                        startSX: sx, startSY: sy,
                        offsetWX: pointerWX - c.x,
                        offsetWY: pointerWY - c.y,
                        isDrawing: false,
                    };
                    return;
                }
            } catch { }
        }

        drag.current = {
            id: null, startQ: 0, startR: 0, overQ: 0, overR: 0,
            dragQ: 0, dragR: 0,
            hoverQ: 0, hoverR: 0, active: false, moved: false, startSX: 0, startSY: 0, offsetWX: 0, offsetWY: 0,
            isDrawing: false
        };
    }, [tokens, cam, size.w, size.h, st]);

    const onPointerMove = useCallback((e) => {
        const cv = canvasRef.current; if (!cv) return;

        // --- MODE DESSIN (Fluidité MAX) ---
        if (drag.current.isDrawing) {
            try { e.preventDefault(); } catch { }
            const rect = (cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0 }) || { left: 0, top: 0 };
            const sx = e.clientX - (rect.left || 0);
            const sy = e.clientY - (rect.top || 0);

            const pointerWX = sx2wxNow(sx);
            const pointerWY = sy2wyNow(sy);
            const p = pixelToAxialRounded(pointerWX, pointerWY, HEX_RADIUS);
            const q = Math.round(p.q), r = Math.round(p.r);

            const lastQ = drag.current.lastDrawQ;
            const lastR = drag.current.lastDrawR;

            if (q !== lastQ || r !== lastR) {
                // Interpolation correcte (Cube Lerp) pour éviter les trous
                const dist = hexStepsInt(lastQ, lastR, q, r);
                const tex = (st && st.selectedTexture) || "herbe";

                if (dist > 0) {
                    const startCube = axialToCube(lastQ, lastR);
                    const endCube = axialToCube(q, r);

                    for (let i = 1; i <= dist; i++) {
                        const t = i / dist;
                        const c = cubeRound(cubeLerp(startCube, endCube, t));

                        // Buffer local
                        currentStroke.current.push({ q: c.x, r: c.z, texId: tex });
                    }
                }
                drag.current.lastDrawQ = q;
                drag.current.lastDrawR = r;
                requestRedraw();
            }
            return;
        }

        if (!drag.current.id) return;

        try { e.preventDefault(); } catch { }
        const rect = (cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0 }) || { left: 0, top: 0 };
        const sx = e.clientX - (rect.left || 0);
        const sy = e.clientY - (rect.top || 0);

        const dx0 = sx - drag.current.startSX;
        const dy0 = sy - drag.current.startSY;
        const d2 = dx0 * dx0 + dy0 * dy0;
        const dragStartPx = (e.pointerType === "mouse") ? DRAG_START_PX_MOUSE : DRAG_START_PX_TOUCH;

        if (!drag.current.moved) {
            if (d2 < dragStartPx * dragStartPx) return;
            drag.current.moved = true;
            drag.current.active = true;
        }

        const targetWX = sx2wxNow(sx) - drag.current.offsetWX;
        const targetWY = sy2wyNow(sy) - drag.current.offsetWY;

        // ✅ Ghost FLOTTANT (non arrondi) pour fluidité
        // On doit inverser axialToPixel EXACT pour avoir q/r flottants
        // pixelToAxialRounded arrondit, donc on utilise la version "Pointy" manuelle NON-arrondie :
        const rawQ = (Math.sqrt(3) / 3 * targetWX - 1 / 3 * targetWY) / HEX_RADIUS;
        const rawR = (2 / 3 * targetWY) / HEX_RADIUS;

        // Par défaut, le ghost suit la souris
        drag.current.dragQ = rawQ;
        drag.current.dragR = rawR;

        // Snapping pour la logique "Over" (destination finale)
        let pos = pixelToAxialRounded(targetWX, targetWY, HEX_RADIUS);
        let qCand = Math.round(pos.q), rCand = Math.round(pos.r);

        if (!isCellOnScreen(qCand, rCand)) return;

        // Hysteresis simple
        const curCenter = axialToPixel(drag.current.hoverQ, drag.current.hoverR, HEX_RADIUS);
        const curSX = (curCenter.x - cam.tx) * cam.scale + size.w / 2;
        const curSY = (curCenter.y - cam.ty) * cam.scale + size.h / 2;
        const dHX = sx - curSX, dHY = sy - curSY;
        if ((dHX * dHX + dHY * dHY) < (HYSTERESIS_PX * HYSTERESIS_PX)) {
            qCand = drag.current.hoverQ; rCand = drag.current.hoverR;
        } else {
            drag.current.hoverQ = qCand; drag.current.hoverR = rCand;
        }

        // CLAMP combat: limite à la portée SERVEUR + snap max
        let q = qCand, r = rCand;
        if (combatMode && drag.current.id != null) {
            const serverLeft = getServerSpeedLeft(drag.current.id); // null => pas de cap client
            if (serverLeft != null) {
                // 1) Logic clamp (integer) for DROP
                const clamped = clampToReachableOnLine(
                    Math.round(drag.current.startQ),
                    Math.round(drag.current.startR),
                    qCand, rCand,
                    serverLeft,
                    null
                );
                q = clamped.q; r = clamped.r;

                // 2) Visual clamp (float) for GHOST FLUIDITY
                // Calcul vectoriel pour bloquer le ghost au cercle sans le snapper
                try {
                    const startP = axialToPixel(drag.current.startQ, drag.current.startR, HEX_RADIUS);
                    const curP = axialToPixel(rawQ, rawR, HEX_RADIUS); // mouse RAW world
                    const dx = curP.x - startP.x;
                    const dy = curP.y - startP.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const maxDist = serverLeft * Math.sqrt(3) * HEX_RADIUS; // Rayon approx du cercle de move

                    if (dist > maxDist + 1) { // +1 hysteresis
                        const scale = maxDist / dist;
                        const clampedX = startP.x + dx * scale;
                        const clampedY = startP.y + dy * scale;
                        // On reconvertit en axial float
                        const fQ = (Math.sqrt(3) / 3 * clampedX - 1 / 3 * clampedY) / HEX_RADIUS;
                        const fR = (2 / 3 * clampedY) / HEX_RADIUS;
                        drag.current.dragQ = fQ;
                        drag.current.dragR = fR;
                    }
                } catch { }
            }
        }

        drag.current.overQ = q;
        drag.current.overR = r;
        requestRedraw();
    }, [combatMode, getServerSpeedLeft, cam, size.w, size.h, st]);

    const onPointerUp = useCallback((e) => {
        // Fin mode dessin
        if (drag.current.isDrawing) {
            try { const cv = canvasRef.current; if (cv && cv.releasePointerCapture) cv.releasePointerCapture(e.pointerId); } catch { }
            drag.current.isDrawing = false;
            drag.current.active = false;

            // Commit final
            if (currentStroke.current.length > 0) {
                const newTiles = [...(st.overlayTiles || [])];

                // Merge intelligent (map key "q,r")
                const map = new Map();
                for (const t of newTiles) map.set(`${t.q},${t.r}`, t);
                for (const t of currentStroke.current) map.set(`${t.q},${t.r}`, t); // overwrite

                dispatch({ type: "OVERLAY_SET", tiles: Array.from(map.values()) });
                try { if (window.__castSend) window.__castSend({ type: "OVERLAY_SET", payload: { tiles: Array.from(map.values()) } }); } catch { }
            }
            currentStroke.current = [];
            requestRedraw();
            return;
        }

        const hadId = !!drag.current.id;
        const wasMoved = !!drag.current.moved;
        if (hadId) { try { e.preventDefault(); } catch { } }

        try { const cv = canvasRef.current; if (cv && cv.releasePointerCapture) cv.releasePointerCapture(e.pointerId); } catch { }

        if (hadId && wasMoved && drag.current.active) {
            const id = drag.current.id;
            const startQ = Math.round(drag.current.startQ);
            const startR = Math.round(drag.current.startR);
            let overQ = Math.round(drag.current.overQ);
            let overR = Math.round(drag.current.overR);

            if (isCellOnScreen(overQ, overR) && (overQ !== startQ || overR !== startR)) {
                if (combatMode) {
                    const serverLeft = getServerSpeedLeft(id); // null => autorise (pas de cap local)
                    if (serverLeft != null) {
                        const clamped = clampToReachableOnLine(startQ, startR, overQ, overR, serverLeft, null);
                        overQ = clamped.q; overR = clamped.r;
                        const steps = hexStepsInt(startQ, startR, overQ, overR);
                        if (steps <= 0) return; // rien à faire
                    }
                    try { dispatch({ type: "MOVE_TOKEN", id, q: overQ, r: overR }); } catch { }
                    try { if (window.__castSend) window.__castSend({ type: "MOVE_TOKEN", payload: { id, q: overQ, r: overR } }); } catch { }
                    try { if (window.__castSnapshot) window.__castSnapshot(); } catch { }
                } else {
                    try { dispatch({ type: "MOVE_TOKEN", id, q: overQ, r: overR }); } catch { }
                    try { if (window.__castSend) window.__castSend({ type: "MOVE_TOKEN", payload: { id, q: overQ, r: overR } }); } catch { }
                    try { if (window.__castSnapshot) window.__castSnapshot(); } catch { }
                }
            }
            requestRedraw();
        }

        drag.current = {
            id: null, startQ: 0, startR: 0, overQ: 0, overR: 0,
            dragQ: 0, dragR: 0,
            hoverQ: 0, hoverR: 0, active: false, moved: false, startSX: 0, startSY: 0, offsetWX: 0, offsetWY: 0,
            isDrawing: false
        };
    }, [dispatch, combatMode, getServerSpeedLeft, st]);

    // ✅ BAKING: Cache pour les tuiles statiques (énorme gain perf)
    const overlayCacheRef = useRef(null);

    useEffect(() => {
        if (!overlayTiles || !overlayTiles.length) {
            overlayCacheRef.current = null;
            requestRedraw();
            return;
        }

        // 1. Calcul des bounds du monde
        let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
        for (const t of overlayTiles) {
            if (t.q < minQ) minQ = t.q; if (t.q > maxQ) maxQ = t.q;
            if (t.r < minR) minR = t.r; if (t.r > maxR) maxR = t.r;
        }

        // Marge de sûreté (1 hex)
        minQ -= 1; maxQ += 1; minR -= 1; maxR += 1;

        // 2. Conversion en pixels (pour la taille du canvas)
        // On utilise axiaToPixel pour trouver les extremums
        const p1 = axialToPixel(minQ, minR, HEX_RADIUS); // TL approx
        const p2 = axialToPixel(maxQ, minR, HEX_RADIUS); // TR approx
        const p3 = axialToPixel(minQ, maxR, HEX_RADIUS); // BL approx
        const p4 = axialToPixel(maxQ, maxR, HEX_RADIUS); // BR approx

        const minX = Math.min(p1.x, p2.x, p3.x, p4.x) - HEX_RADIUS;
        const maxX = Math.max(p1.x, p2.x, p3.x, p4.x) + HEX_RADIUS;
        const minY = Math.min(p1.y, p2.y, p3.y, p4.y) - HEX_RADIUS;
        const maxY = Math.max(p1.y, p2.y, p3.y, p4.y) + HEX_RADIUS;

        const width = Math.ceil(maxX - minX);
        const height = Math.ceil(maxY - minY);

        if (width <= 0 || height <= 0 || width > 16000 || height > 16000) {
            // Protection crash canvas trop grand
            overlayCacheRef.current = null;
            return;
        }

        // 3. Création du canvas offscreen
        const cv = document.createElement("canvas");
        cv.width = width;
        cv.height = height;
        const ctx = cv.getContext("2d");

        // 4. Dessin (Camera locale: on déplace le monde pour que (minX, minY) soit à (0,0))
        // scale = 1 (résolution native)
        const localCam = { tx: -minX, ty: -minY, scale: 1 };

        // On utilise la fonction batchée existante qui dessine sur ce ctx offscreen !
        drawTilesBatched(ctx, overlayTiles, localCam, width, height, HEX_RADIUS);

        // 5. Stockage
        overlayCacheRef.current = {
            img: cv,
            x: minX, // Position monde du coin haut-gauche de l'image
            y: minY
        };
        requestRedraw();

    }, [overlayTiles]); // Se lance uniquement quand on ajoute/modifie des tuiles

    /* ===================== RENDU ===================== */
    useEffect(() => {
        const cv = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;

        function draw() {
            const W = size.w, H = size.h;

            try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch { }
            try { ctx.clearRect(0, 0, W, H); } catch { }

            // Grille
            try { drawGrid(ctx, cam, W, H, HEX_RADIUS); } catch { }

            // Map (Image de fond)
            try {
                if (mapBitmapRef.current) {
                    const img = mapBitmapRef.current;
                    const iw = img.bitmapWidth || img.width || 1;
                    const ih = img.bitmapHeight || img.height || 1;
                    if (iw > 0 && ih > 0) {
                        const s = Math.max(W / iw, H / ih);
                        const dw = iw * s, dh = ih * s;
                        const dx = (W - dw) / 2, dy = (H - dh) / 2;
                        ctx.drawImage(img, dx, dy, dw, dh);
                    }
                }
            } catch { }

            // Overlay (CACHE BITMAP)
            try {
                // 1. Dessin du cache statique (rapide !)
                if (overlayCacheRef.current) {
                    const { img, x, y } = overlayCacheRef.current;
                    // Projection: Monde (x,y) -> Ecran
                    // formula: (wx - cam.tx) * cam.scale + W/2
                    const sx = (x - cam.tx) * cam.scale + W / 2;
                    const sy = (y - cam.ty) * cam.scale + H / 2;
                    const sw = img.width * cam.scale;
                    const sh = img.height * cam.scale;

                    ctx.drawImage(img, sx, sy, sw, sh);
                } else if (overlayTiles && overlayTiles.length) {
                    // Fallback si pas de cache (ex: trop grand)
                    drawTilesBatched(ctx, overlayTiles, cam, W, H, HEX_RADIUS);
                }

                // 2. Trait en cours (toujours dynamique)
                if (currentStroke.current && currentStroke.current.length) {
                    drawTilesBatched(ctx, currentStroke.current, cam, W, H, HEX_RADIUS);
                }
            } catch { }

            // Portée combat — **valeur serveur** uniquement (même affichage que le player)
            try {
                if (combatMode && activeId != null) {
                    const left = getServerSpeedLeft(activeId);
                    if (left != null && left > 0) {
                        let active = null;
                        for (let j = 0; j < tokens.length; j++) { const t = tokens[j]; if (t && t.id === activeId) { active = t; break; } }
                        if (active) {
                            try { drawMoveRange(ctx, cam, W, H, HEX_RADIUS, active.q, active.r, left); } catch { }
                        }
                    }
                }
            } catch { }

            // tokens
            try { drawTokens(ctx, tokens, activeId, cam, W, H, HEX_RADIUS, requestRedraw); } catch { }

            // ghost de drag
            try {
                if (drag.current.active) {
                    let tt = null;
                    for (let k = 0; k < tokens.length; k++) { const t = tokens[k]; if (t && t.id === drag.current.id) { tt = t; break; } }
                    if (tt) {
                        // ✅ DESSIN FLUIDE: on utilise dragQ/dragR flottants
                        try { drawSingleToken(ctx, tt, drag.current.dragQ, drag.current.dragR, tt.id === activeId, cam, W, H, HEX_RADIUS, requestRedraw, 0.85); } catch { }

                        // Optionnel: highlight de la cible snapée ("Over")
                        try {
                            // .. si on voulait dessiner un indicateur de case cible
                        } catch { }
                    }
                }
            } catch { }
        }

        drawRef.current = draw;
        if (scheduleDrawRef.current) scheduleDrawRef.current();
        return () => { try { cancelAnimationFrame(rafRef.current); } catch { } };
    }, [cam, size.w, size.h, tokens, activeId, combatMode, overlayTiles, getServerSpeedLeft]);

    useEffect(() => { if (scheduleDrawRef.current) scheduleDrawRef.current(); }, [tokens, activeId, combatMode, overlayTiles]);

    return (
        <div
            ref={containerRef}
            style={{
                position: "fixed", inset: 0,
                width: "100%", height: "100%",
                backgroundColor: "#111",
                overflow: "hidden",
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
                zIndex: 1,
            }}
        >
            <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{ width: "100%", height: "100%", display: "block", cursor: drag.current.active ? "grabbing" : "grab" }}
            />
        </div>
    );
}
