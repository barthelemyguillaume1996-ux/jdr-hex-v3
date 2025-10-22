// src/ui/HexBoard.jsx - VERSION SIMPLE
/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import { createCamera } from "../core/camera";
import { pixelToAxialRounded, axialToPixel } from "../core/hexMath";
import {
    dpiScaleCanvas,
    drawGrid,
    drawTokens,
    drawSingleToken,
    hitTestToken,
    drawMoveRange,
    fillHex,
} from "./hexboard-utils";
import { BASE_HEX_RADIUS, HEX_SCALE, CAMERA_SCALE } from "../core/boardConfig";

const HEX_RADIUS = BASE_HEX_RADIUS * HEX_SCALE;

function hexDistance(q1, r1, q2, r2) {
    const dq = q2 - q1, dr = r2 - r1, ds = -(q2 + r2) + (q1 + r1);
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

function drawImageCover(ctx, img, W, H) {
    const iw = img.bitmapWidth || img.width || 1;
    const ih = img.bitmapHeight || img.height || 1;
    if (iw <= 0 || ih <= 0) return;
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
}

export default function HexBoard({ fullscreen = true }) {
    const {
        tokens, activeId, combatMode, remainingSpeedById,
        overlayTiles, currentMapUrl
    } = useAppState();
    const dispatch = useAppDispatch();

    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const rafRef = useRef(0);
    const drawRef = useRef(() => { });
    const scheduleDrawRef = useRef(() => { });
    const lastMovedTokenRef = useRef(null);

    const [size, setSize] = useState(() => {
        const w = window.innerWidth || 1080;
        const h = window.innerHeight || 724;
        console.log('[HexBoard] INIT with device size:', w, h);
        return { w, h };
    });

    const [cam] = useState(() => {
        // Initialiser la caméra au démarrage
        // Si des tokens existent, centrer sur le premier
        const deployed = tokens.filter(t => t.isDeployed);
        if (deployed.length > 0) {
            const firstToken = deployed[0];
            const { x, y } = axialToPixel(firstToken.q, firstToken.r, HEX_RADIUS);
            return { tx: x, ty: y, scale: CAMERA_SCALE };
        }
        return { ...createCamera(), scale: CAMERA_SCALE };
    });

    const drag = useRef({ id: null, startQ: 0, startR: 0, overQ: 0, overR: 0, active: false });

    const gridBitmapRef = useRef(null);
    const mapBitmapRef = useRef(null);

    const getCssSize = () => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
            return { w: Math.round(rect.width), h: Math.round(rect.height) };
        }
        return { w: size.w, h: size.h };
    };

    const emitViewport = useCallback(() => {
        try {
            const el = containerRef.current;
            if (!el) return;

            const w = window.innerWidth || 1080;
            const h = window.innerHeight || 724;

            if (typeof window !== "undefined") {
                window.__lastViewport = { w, h };
                window.dispatchEvent(new CustomEvent("cast:viewport", { detail: { w, h } }));
            }

            const payload = { w, h };

            try {
                window.__castSend?.({ type: "VIEWPORT", payload });
            } catch { }

            try {
                const params = new URLSearchParams(window.location.search);
                const room = params.get("room") || "default";
                const proto = window.location.protocol === "https:" ? "https:" : "http:";
                const host = window.location.hostname || "localhost";
                const url = `${proto}//${host}:8080/viewport?room=${encodeURIComponent(room)}`;

                fetch(url, {
                    method: "POST",
                    mode: "cors",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ w, h }),
                }).catch(() => { });
            } catch { }

            console.log(`[HexBoard GM] Viewport emitted: ${w}×${h}`);
        } catch (e) {
            console.error('[HexBoard] emitViewport error:', e);
        }
    }, []);

    useEffect(() => {
        window.__emitViewport = emitViewport;
        emitViewport();
        const timer1 = setTimeout(emitViewport, 100);
        const timer2 = setTimeout(emitViewport, 500);

        return () => {
            delete window.__emitViewport;
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [emitViewport]);

    const rebuildGrid = useCallback(() => {
        const dpr = window.devicePixelRatio || 1;
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.floor(size.w * dpr));
        off.height = Math.max(1, Math.floor(size.h * dpr));
        const octx = off.getContext("2d");
        if (!octx) return;
        octx.scale(dpr, dpr);
        drawGrid(octx, cam, size.w, size.h, HEX_RADIUS);
        if (window.createImageBitmap) {
            createImageBitmap(off)
                .then((bmp) => { gridBitmapRef.current = bmp; scheduleDrawRef.current(); })
                .catch(() => { gridBitmapRef.current = off; scheduleDrawRef.current(); });
        } else {
            gridBitmapRef.current = off; scheduleDrawRef.current();
        }
    }, [cam, size.w, size.h]);

    useEffect(() => {
        let alive = true;
        mapBitmapRef.current = null;
        if (!currentMapUrl) { scheduleDrawRef.current(); return; }

        (async () => {
            try {
                const res = await fetch(currentMapUrl, { cache: "force-cache" });
                const blob = await res.blob();
                const bmp = await (window.createImageBitmap ? createImageBitmap(blob) : new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.src = URL.createObjectURL(blob);
                }));
                if (!alive) return;
                mapBitmapRef.current = bmp;
                scheduleDrawRef.current();
            } catch {
                mapBitmapRef.current = null;
                scheduleDrawRef.current();
            }
        })();

        return () => { alive = false; };
    }, [currentMapUrl]);

    const requestRedraw = useCallback(() => scheduleDrawRef.current(), []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const W = size.w, H = size.h;
        dpiScaleCanvas(canvas, ctx, W, H);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const mapBmp = mapBitmapRef.current;
        if (mapBmp) drawImageCover(ctx, mapBmp, W, H);

        const gridBmp = gridBitmapRef.current;
        if (gridBmp) ctx.drawImage(gridBmp, 0, 0, canvas.width, canvas.height);
        else drawGrid(ctx, cam, W, H, HEX_RADIUS);

        if (Array.isArray(overlayTiles) && overlayTiles.length) {
            ctx.save();
            for (const t of overlayTiles) {
                if (t && Number.isFinite(+t.q) && Number.isFinite(+t.r) && typeof t.texId === "string" && t.texId) {
                    fillHex(ctx, cam, W, H, HEX_RADIUS, t.q, t.r, t.texId);
                }
            }
            ctx.restore();
        }

        if (combatMode && activeId) {
            const left = Number(remainingSpeedById?.[activeId]);
            const active = tokens.find((t) => t.id === activeId);
            if (active && Number.isFinite(left) && left > 0) {
                drawMoveRange(ctx, cam, W, H, HEX_RADIUS, active.q, active.r, left);
            }
        }

        drawTokens(ctx, tokens, activeId, cam, W, H, HEX_RADIUS, requestRedraw);

        if (drag.current.active) {
            const t = tokens.find((tt) => tt.id === drag.current.id);
            if (t) {
                drawSingleToken(
                    ctx, t,
                    drag.current.overQ, drag.current.overR,
                    t.id === activeId,
                    cam, W, H, HEX_RADIUS,
                    requestRedraw, 0.85
                );
            }
        }
    }, [cam, size.w, size.h, tokens, activeId, requestRedraw, combatMode, remainingSpeedById, overlayTiles]);

    drawRef.current = draw;

    const scheduleDraw = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawRef.current());
    }, []);
    scheduleDrawRef.current = scheduleDraw;

    const sx2wxNow = (sx) => {
        const { w } = getCssSize();
        return (sx - w / 2) / cam.scale + cam.tx;
    };
    const sy2wyNow = (sy) => {
        const { h } = getCssSize();
        return (sy - h / 2) / cam.scale + cam.ty;
    };

    const onPointerDown = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        const { w, h } = getCssSize();
        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i];
            if (!t.isDeployed) continue;
            if (hitTestToken(sx, sy, t, cam, w, h, HEX_RADIUS)) {
                canvas.setPointerCapture?.(e.pointerId);
                drag.current = { id: t.id, startQ: t.q, startR: t.r, overQ: t.q, overR: t.r, active: true };
                scheduleDraw();
                return;
            }
        }
    }, [tokens, cam, scheduleDraw]);

    const onPointerMove = useCallback((e) => {
        if (!drag.current.active) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        const worldX = sx2wxNow(sx);
        const worldY = sy2wyNow(sy);
        const { q, r } = pixelToAxialRounded(worldX, worldY, HEX_RADIUS);

        if (combatMode && drag.current.id === activeId) {
            const left = Number(remainingSpeedById?.[activeId]);
            if (Number.isFinite(left)) {
                const d = hexDistance(drag.current.startQ, drag.current.startR, q, r);
                if (d > left) return;
            }
        }

        if (q !== drag.current.overQ || r !== drag.current.overR) {
            drag.current.overQ = q;
            drag.current.overR = r;
            scheduleDraw();
            window.__castSend?.({ type: "PREVIEW", payload: { id: drag.current.id, q, r } });
        }
    }, [scheduleDraw, combatMode, activeId, remainingSpeedById]);

    const onPointerUp = useCallback((e) => {
        if (!drag.current.active) return;
        const canvas = canvasRef.current;
        e.preventDefault();

        const { id, overQ, overR, startQ, startR } = drag.current;
        drag.current.active = false;
        scheduleDraw();
        canvas?.releasePointerCapture?.(e.pointerId);

        if (overQ !== startQ || overR !== startR) {
            lastMovedTokenRef.current = { id, q: overQ, r: overR };
            window.__lastMovedToken = { id, q: overQ, r: overR };

            dispatch({ type: "MOVE_TOKEN", id, q: overQ, r: overR });
            try { window.__castSnapshot?.(); } catch { }
        }
    }, [dispatch, scheduleDraw]);

    useEffect(() => { rebuildGrid(); }, [rebuildGrid]);
    useEffect(() => {
        scheduleDraw();
        return () => cancelAnimationFrame(rafRef.current);
    }, [scheduleDraw]);
    useEffect(() => { scheduleDraw(); }, [tokens, activeId, combatMode, remainingSpeedById, overlayTiles]);

    return (
        <div
            ref={containerRef}
            style={{
                width: fullscreen ? "100vw" : "100%",
                height: fullscreen ? "100vh" : "100%",
                position: "relative",
                backgroundColor: "#111",
                overflow: "hidden",
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
            }}
        >
            <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{ width: size.w, height: size.h, display: "block", cursor: drag.current.active ? "grabbing" : "grab" }}
            />
        </div>
    );
}