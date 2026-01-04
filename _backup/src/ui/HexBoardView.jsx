// src/ui/HexBoardView.jsx - PLAYER VIEW (PC Viewer) — sans HUD vert
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCastStore } from "../cast/castClient";
import { createCamera } from "../core/camera";
import { dpiScaleCanvas, drawGrid, drawTokens, drawMoveRange, fillHex } from "./hexboard-utils";
import { BASE_HEX_RADIUS, HEX_SCALE, CAMERA_SCALE } from "../core/boardConfig";

const HEX_RADIUS = BASE_HEX_RADIUS * HEX_SCALE;

function drawImageCover(ctx, img, W, H) {
    const iw = img.bitmapWidth || img.width || 1;
    const ih = img.bitmapHeight || img.height || 1;
    if (iw <= 0 || ih <= 0) return;
    const s = Math.max(W / iw, H / ih); // ✅ CORRECTION: Max (Cover) pour matcher le GM
    const dw = iw * s;
    const dh = ih * s;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
}

export default function HexBoardView({ fullscreen = true, zoom = 1 }) {
    const {
        tokens, activeId, combatMode, remainingSpeedById,
        overlayTiles, currentMapUrl, camera, viewport
    } = useCastStore();

    const outerRef = useRef(null);
    const stageRef = useRef(null);
    const canvasRef = useRef(null);
    const mapBitmapRef = useRef(null);

    const rafRef = useRef(0);
    const drawRef = useRef(() => { });
    const scheduleDrawRef = useRef(() => { });

    const [baseSize, setBaseSize] = useState({ w: 1920, h: 753 });
    const [outerSize, setOuterSize] = useState({ w: 300, h: 150 });

    // facteur de zoom viewer (0.5 => dézoom)
    const viewerZoom = useMemo(() => {
        const z = Number(zoom);
        return Number.isFinite(z) ? Math.max(0.1, z) : 1;
    }, [zoom]);

    // Caméra = caméra GM * adapt contain * viewerZoom
    const cam = useMemo(() => {
        const c = camera || { tx: 0, ty: 0, scale: CAMERA_SCALE };

        // Note: On ne doit PAS multiplier par le ratio d'écran (zoomScale) ici
        // car le canvas a déjà la taille "logique" (baseSize = GM viewport)
        // et il est ensuite redimensionné par CSS (stageScale).
        // Si on multiplie ici, on applique l'échelle deux fois.

        return {
            ...createCamera(),
            tx: Number.isFinite(+c.tx) ? +c.tx : 0,
            ty: Number.isFinite(+c.ty) ? +c.ty : 0,
            // On garde le scale du GM * viewerZoom (optionnel utilisateur)
            scale: (Number.isFinite(+c.scale) ? +c.scale : CAMERA_SCALE) * viewerZoom,
        };
    }, [camera, viewerZoom]);

    // Échelle CSS de la scène (cover)
    const stageScale = useMemo(() => {
        const bw = Math.max(1, baseSize.w);
        const bh = Math.max(1, baseSize.h);
        const ow = Math.max(1, outerSize.w);
        const oh = Math.max(1, outerSize.h);
        return Math.max(ow / bw, oh / bh);
    }, [baseSize, outerSize]);

    // viewport logique envoyé par le GM
    useEffect(() => {
        const w = +viewport?.w, h = +viewport?.h;
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
            setBaseSize({ w, h });
        }
    }, [viewport]);

    // observer la taille réelle écran
    useEffect(() => {
        const el = outerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            for (const e of entries) {
                const r = e.contentRect;
                setOuterSize({
                    w: Math.max(1, Math.round(r.width)),
                    h: Math.max(1, Math.round(r.height)),
                });
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // charger la map si présente
    useEffect(() => {
        let alive = true;
        mapBitmapRef.current = null;
        if (!currentMapUrl) { scheduleDrawRef.current?.(); return; }

        (async () => {
            try {
                const res = await fetch(currentMapUrl, { cache: "force-cache" });
                const blob = await res.blob();
                const bmp = await (window.createImageBitmap
                    ? createImageBitmap(blob)
                    : new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => resolve(img);
                        img.src = URL.createObjectURL(blob);
                    }));
                if (!alive) return;
                mapBitmapRef.current = bmp;
                scheduleDrawRef.current?.();
            } catch {
                mapBitmapRef.current = null;
                scheduleDrawRef.current?.();
            }
        })();

        return () => { alive = false; };
    }, [currentMapUrl]);

    const requestRedraw = useCallback(() => scheduleDrawRef.current?.(), []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const W = baseSize.w, H = baseSize.h;
        dpiScaleCanvas(canvas, ctx, W, H);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const mapBmp = mapBitmapRef.current;
        if (mapBmp) drawImageCover(ctx, mapBmp, W, H);

        drawGrid(ctx, cam, W, H, HEX_RADIUS);

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
    }, [baseSize, tokens, activeId, combatMode, remainingSpeedById, overlayTiles, cam, requestRedraw]);

    drawRef.current = draw;

    const scheduleDraw = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawRef.current());
    }, []);
    scheduleDrawRef.current = scheduleDraw;

    useEffect(() => {
        scheduleDraw();
        return () => cancelAnimationFrame(rafRef.current);
    }, [scheduleDraw]);

    useEffect(() => { scheduleDraw(); }, [baseSize, tokens, activeId, combatMode, remainingSpeedById, overlayTiles, cam]);

    return (
        <div
            ref={outerRef}
            style={{
                width: fullscreen ? "100vw" : "100%",
                height: fullscreen ? "100vh" : "100%",
                position: "relative",
                background: "#111",
                overflow: "hidden",
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
            }}
        >
            <div
                ref={stageRef}
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) scale(${stageScale})`,
                    transformOrigin: "center center",
                    width: baseSize.w,
                    height: baseSize.h,
                    overflow: "hidden",
                }}
            >
                <canvas
                    ref={canvasRef}
                    width={baseSize.w}
                    height={baseSize.h}
                    style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        imageRendering: "high-quality",
                    }}
                />
            </div>
        </div>
    );
}
