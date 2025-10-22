/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dpiScaleCanvas, drawGrid, drawTokens, drawMoveRange } from "./hexboard-utils";
import { createCamera } from "../core/camera";

const HEX_SCALE = 0.12;
const BASE_HEX_RADIUS = 40;
const CAMERA_SCALE = 1.2;

export default function HexBoardView({ tokens = [], activeId = null, combatMode = false, fullscreen = true }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const rafRef = useRef(0);
    const [size, setSize] = useState({ w: 300, h: 150 });
    const [cam] = useState(() => ({ ...createCamera(), scale: CAMERA_SCALE }));

    const hexRadius = BASE_HEX_RADIUS * HEX_SCALE;

    const normalized = useMemo(() => tokens.map(t => ({
        ...t,
        cellRadius: Number.isFinite(t?.cellRadius) ? t.cellRadius : 1
    })), [tokens]);

    const activeToken = useMemo(() => normalized.find(t => t.id === activeId) || null, [normalized, activeId]);

    const parseSpeed = (t) => {
        if (!t) return 0;
        const n = Number(t.speed);
        return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    };
    const moveAllowance = (t) => {
        if (!t) return 0;
        const full = parseSpeed(t);
        return Number.isFinite(t.pmLeft) ? t.pmLeft : full;
        // pmLeft est envoyé par le MJ via snapshot
    };

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        dpiScaleCanvas(canvas, ctx, size.w, size.h);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGrid(ctx, cam, size.w, size.h, hexRadius);

        if (combatMode && activeToken) {
            const allow = moveAllowance(activeToken);
            drawMoveRange(ctx, cam, size.w, size.h, hexRadius, activeToken.q, activeToken.r, allow);
        }

        const toDraw = normalized.filter(t => t.isDeployed);
        drawTokens(ctx, toDraw, activeId, cam, size.w, size.h, hexRadius, () => { });
    }, [cam, size.w, size.h, hexRadius, normalized, activeId, combatMode, activeToken]);

    const scheduleDraw = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => draw());
    }, [draw]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const cr = entry.contentRect;
                setSize({ w: Math.max(1, cr.width), h: Math.max(1, cr.height) });
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        scheduleDraw();
        return () => cancelAnimationFrame(rafRef.current);
    }, [hexRadius, scheduleDraw]);

    useEffect(() => {
        scheduleDraw();
    }, [normalized, activeId, scheduleDraw, combatMode]);

    return (
        <div
            ref={containerRef}
            style={{
                width: fullscreen ? "100vw" : "100%",
                height: fullscreen ? "100vh" : "100%",
                position: "relative",
                background: "#111",
                overflow: "hidden"
            }}
        >
            <canvas ref={canvasRef} style={{ width: size.w, height: size.h, display: "block" }} />
        </div>
    );
}
