import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import { createCamera } from "../core/camera";
import { pixelToAxialRounded, axialToPixel } from "../core/hexMath";
import {
    dpiScaleCanvas, drawGrid, drawTokens,
    drawSingleToken, hitTestToken, drawMoveRange
} from "./hexboard-utils";

const HEX_SCALE = 0.12;
const BASE_HEX_RADIUS = 40;
const CAMERA_SCALE = 1.2;

export default function HexBoard({ fullscreen = true }) {
    const { tokens, activeId, combatMode } = useAppState();
    const dispatch = useAppDispatch();

    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const rafRef = useRef(0);
    const drawRef = useRef(() => { });
    const scheduleDrawRef = useRef(() => { });
    const [size, setSize] = useState({ w: 300, h: 150 });
    const [cam] = useState(() => ({ ...createCamera(), scale: CAMERA_SCALE }));

    const hexRadius = BASE_HEX_RADIUS * HEX_SCALE;

    const drag = useRef({ id: null, startQ: 0, startR: 0, overQ: 0, overR: 0, active: false });

    const normTokens = useMemo(() => tokens.map(t => ({
        ...t,
        cellRadius: Number.isFinite(t?.cellRadius) ? t.cellRadius : 1
    })), [tokens]);

    const activeToken = useMemo(
        () => normTokens.find((t) => t.id === activeId) || null,
        [normTokens, activeId]
    );

    const parseSpeed = (t) => {
        if (!t) return 0;
        const n = Number(t.speed);
        return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    };
    const moveAllowance = (t) => {
        if (!t) return 0;
        const full = parseSpeed(t);
        return Number.isFinite(t.pmLeft) ? t.pmLeft : full;
    };

    // hex distance & clamp vers la limite autorisée
    const hexDistance = (q1, r1, q2, r2) => {
        const dq = q2 - q1;
        const dr = r2 - r1;
        const ds = -(q2 + r2) - (-(q1 + r1));
        return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
    };
    const axialToCube = (q, r) => ({ x: q, z: r, y: -q - r });
    const cubeToAxial = ({ x, z }) => ({ q: x, r: z });
    const cubeLerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    const cubeRound = (f) => {
        let rx = Math.round(f.x), ry = Math.round(f.y), rz = Math.round(f.z);
        const dx = Math.abs(rx - f.x), dy = Math.abs(ry - f.y), dz = Math.abs(rz - f.z);
        if (dx > dy && dx > dz) rx = -ry - rz;
        else if (dy > dz) ry = -rx - rz;
        else rz = -rx - ry;
        return { x: rx, y: ry, z: rz };
    };
    const clampToSteps = (q1, r1, q2, r2, steps) => {
        const N = hexDistance(q1, r1, q2, r2);
        if (N <= steps) return { q: q2, r: r2 };
        const a = axialToCube(q1, r1), b = axialToCube(q2, r2);
        const t = steps / N;
        const fr = cubeLerp(a, b, t);
        const cr = cubeRound(fr);
        return cubeToAxial(cr);
    };

    // ------- cast -------
    const castSendSnapshot = useCallback((overrideId = null, overrideQ = 0, overrideR = 0) => {
        const minimal = normTokens.map(t => {
            const base = {
                id: t.id, name: t.name, img: t.img, type: t.type,
                q: t.q, r: t.r, isDeployed: !!t.isDeployed,
                cellRadius: t.cellRadius,
                initiative: Number.isFinite(t.initiative) ? t.initiative : 0,
                speed: t.speed ?? "",
                pmLeft: Number.isFinite(t.pmLeft) ? t.pmLeft : undefined
            };
            if (overrideId && t.id === overrideId) {
                return { ...base, q: overrideQ, r: overrideR };
            }
            return base;
        });
        if (typeof window !== "undefined" && typeof window.__castSend === "function") {
            window.__castSend({ type: "SNAPSHOT", payload: { tokens: minimal, activeId: activeId || null, combatMode: !!combatMode } });
        }
    }, [normTokens, activeId, combatMode]);

    // ------- draw -------
    const requestRedraw = useCallback(() => scheduleDrawRef.current(), []);
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        dpiScaleCanvas(canvas, ctx, size.w, size.h);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGrid(ctx, cam, size.w, size.h, hexRadius);

        // Cercle portée (PM restants si définis, sinon vitesse)
        if (combatMode && activeToken) {
            const allow = moveAllowance(activeToken);
            drawMoveRange(ctx, cam, size.w, size.h, hexRadius, activeToken.q, activeToken.r, allow);
        }

        const draggingId = drag.current.active ? drag.current.id : null;
        const toDraw = normTokens.filter((t) => t.isDeployed && (!draggingId || t.id !== draggingId));
        drawTokens(ctx, toDraw, activeId, cam, size.w, size.h, hexRadius, requestRedraw);

        // Aperçu drag (vert si dans l'allocation, rouge sinon)
        if (drag.current.active) {
            const t = normTokens.find((tt) => tt.id === drag.current.id);
            if (t) {
                const { x, y } = axialToPixel(drag.current.overQ, drag.current.overR, hexRadius);

                const allowedSteps = combatMode && t.id === activeId ? moveAllowance(t) : Infinity;
                const dist = hexDistance(drag.current.startQ, drag.current.startR, drag.current.overQ, drag.current.overR);
                const allowed = dist <= allowedSteps;

                // contour de l'hex destination
                const corners = Array.from({ length: 6 }, (_, i) => {
                    const ang = (Math.PI / 180) * (60 * i - 30);
                    return { px: x + hexRadius * Math.cos(ang), py: y + hexRadius * Math.sin(ang) };
                });
                const { sx: sx0, sy: sy0 } = toScreen(cam, corners[0].px, corners[0].py, size.w, size.h);
                const ctx2 = ctx;
                ctx2.save();
                ctx2.beginPath();
                ctx2.moveTo(sx0, sy0);
                for (let i = 1; i < 6; i++) {
                    const { sx, sy } = toScreen(cam, corners[i].px, corners[i].py, size.w, size.h);
                    ctx2.lineTo(sx, sy);
                }
                ctx2.closePath();
                ctx2.lineWidth = 2;
                ctx2.strokeStyle = allowed ? "rgba(80,220,170,0.9)" : "rgba(220,80,80,0.95)";
                ctx2.stroke();

                drawSingleToken(ctx, t, drag.current.overQ, drag.current.overR, t.id === activeId, cam, size.w, size.h, hexRadius, requestRedraw, 0.85);
                ctx2.restore();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cam, size.w, size.h, hexRadius, normTokens, activeId, requestRedraw, combatMode, activeToken]);

    drawRef.current = draw;

    const scheduleDraw = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawRef.current());
    }, []);
    scheduleDrawRef.current = scheduleDraw;

    // ------- DnD -------
    const onPointerDown = useCallback((e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        for (let i = normTokens.length - 1; i >= 0; i--) {
            const t = normTokens[i];
            if (!t.isDeployed) continue;
            if (hitTestToken(sx, sy, t, cam, size.w, size.h, hexRadius)) {
                canvas.setPointerCapture?.(e.pointerId);
                const { q, r } = pixelToAxialRounded(
                    (sx - size.w / 2) / cam.scale + cam.tx,
                    (sy - size.h / 2) / cam.scale + cam.ty,
                    hexRadius
                );
                drag.current = { id: t.id, startQ: t.q, startR: t.r, overQ: q, overR: r, active: true };
                scheduleDraw();
                castSendSnapshot(t.id, q, r);
                return;
            }
        }
    }, [normTokens, cam, size.w, size.h, hexRadius, scheduleDraw, castSendSnapshot]);

    const onPointerMove = useCallback((e) => {
        if (!drag.current.active) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        const worldX = (sx - size.w / 2) / cam.scale + cam.tx;
        const worldY = (sy - size.h / 2) / cam.scale + cam.ty;
        const { q, r } = pixelToAxialRounded(worldX, worldY, hexRadius);

        if (q !== drag.current.overQ || r !== drag.current.overR) {
            drag.current.overQ = q; drag.current.overR = r;
            scheduleDraw();
            castSendSnapshot(drag.current.id, q, r);
        }
    }, [cam, size.w, size.h, hexRadius, scheduleDraw, castSendSnapshot]);

    const finishDrag = useCallback((pointerId) => {
        const canvas = canvasRef.current;
        if (!drag.current.active) return;

        const { id, overQ, overR, startQ, startR } = drag.current;

        let dropQ = overQ, dropR = overR;

        const t = normTokens.find(tt => tt.id === id);
        const isActive = id === activeId;
        if (combatMode && isActive && t) {
            const allowance = moveAllowance(t); // PM restants
            const dist = hexDistance(startQ, startR, overQ, overR);
            if (dist > allowance) {
                // Clamp à la limite
                const clamped = clampToSteps(startQ, startR, overQ, overR, allowance);
                dropQ = clamped.q; dropR = clamped.r;
            }
        }

        // Snapshot override puis commit (le reducer déduira les PM restants)
        castSendSnapshot(id, dropQ, dropR);
        dispatch({ type: "MOVE_TOKEN", id, q: dropQ, r: dropR });

        drag.current.active = false;
        scheduleDraw();
        canvas?.releasePointerCapture?.(pointerId);

        requestAnimationFrame(() => {
            if (typeof window !== "undefined" && typeof window.__castSnapshot === "function") {
                window.__castSnapshot();
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, scheduleDraw, castSendSnapshot, combatMode, activeId, normTokens]);

    const onPointerUp = useCallback((e) => finishDrag(e.pointerId), [finishDrag]);

    // ------- Resize & draws init -------
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
    }, [activeToken, scheduleDraw, normTokens, combatMode]);

    return (
        <div
            ref={containerRef}
            onContextMenu={(e) => e.preventDefault()}
            style={{
                width: fullscreen ? "100vw" : "100%",
                height: fullscreen ? "100vh" : "100%",
                position: "relative",
                background: "#111",
                overflow: "hidden",
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none"
            }}
        >
            <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerLeave={(e) => drag.current.active && onPointerUp(e)}
                style={{ width: size.w, height: size.h, display: "block", cursor: drag.current.active ? "grabbing" : "grab" }}
            />
        </div>
    );
}

function toScreen(cam, wx, wy, width, height) {
    const sx = (wx - cam.tx) * cam.scale + width / 2;
    const sy = (wy - cam.ty) * cam.scale + height / 2;
    return { sx, sy };
}
