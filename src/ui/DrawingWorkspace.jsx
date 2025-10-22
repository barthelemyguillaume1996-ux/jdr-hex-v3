/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/ui/DrawingWorkspace.jsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import { createCamera } from "../core/camera";
import { dpiScaleCanvas, drawGrid, fillHex, hexDisk } from "./hexboard-utils";
import { BASE_HEX_RADIUS, HEX_SCALE, CAMERA_SCALE } from "../core/boardConfig";
import { pixelToAxialRounded } from "../core/hexMath";

const HEX_RADIUS = BASE_HEX_RADIUS * HEX_SCALE;

const TOOL_TEXTURE = "texture";
const TOOL_ERASER = "eraser";
const TOOL_PENCIL = "pencil";
const TEXTURES = ["herbe", "pierre", "sable", "eau", "neige"];

export default function DrawingWorkspace() {
    const dispatch = useAppDispatch();
    const { currentMapUrl } = useAppState();

    const [baseSize, setBaseSize] = useState(() => {
        const w = window.innerWidth || 1080;
        const h = window.innerHeight || 724;
        console.log('[DrawingWorkspace] Using REAL device size:', w, h);
        return { w, h };
    });

    const [outerSize, setOuterSize] = useState({ w: 300, h: 150 });

    useEffect(() => {
        const prev = {
            touchAction: document.body.style.touchAction,
            overscroll: document.body.style.overscrollBehavior,
        };
        document.body.style.touchAction = "none";
        document.body.style.overscrollBehavior = "none";
        return () => {
            document.body.style.touchAction = prev.touchAction;
            document.body.style.overscrollBehavior = prev.overscroll;
        };
    }, []);

    const cam = useMemo(() => {
        const c = createCamera();
        c.scale = CAMERA_SCALE;
        return c;
    }, []);

    const outerRef = useRef(null);
    const stageRef = useRef(null);
    const canvasRef = useRef(null);
    const rafRef = useRef(0);

    const tilesRef = useRef(new Map());
    const strokesRef = useRef([]);
    const drawingRef = useRef(null);
    const dragging = useRef(false);

    const [tool, setTool] = useState(TOOL_TEXTURE);
    const [selectedTex, setSelectedTex] = useState(TEXTURES[0]);
    const [brushRadius, setBrushRadius] = useState(1);
    const [pencilColor, setPencilColor] = useState("#18ff9b");
    const [pencilWidth, setPencilWidth] = useState(4);

    // ✅ Observer la taille de l'outer container (écran Player)
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

    const scale = useMemo(() => {
        const bw = Math.max(1, baseSize.w);
        const bh = Math.max(1, baseSize.h);
        const ow = Math.max(1, outerSize.w);
        const oh = Math.max(1, outerSize.h);
        const s = Math.min(ow / bw, oh / bh);
        return Math.min(s, 1.0);
    }, [baseSize, outerSize]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        dpiScaleCanvas(canvas, ctx, baseSize.w, baseSize.h);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGrid(ctx, cam, baseSize.w, baseSize.h, HEX_RADIUS);

        ctx.save();
        for (const rec of tilesRef.current.values()) {
            fillHex(ctx, cam, baseSize.w, baseSize.h, HEX_RADIUS, rec.q, rec.r, rec.texId);
        }
        ctx.restore();

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const drawStroke = (s) => {
            if (!s || !s.points || s.points.length < 2) return;
            ctx.beginPath();
            for (let i = 0; i < s.points.length; i++) {
                const { x, y } = s.points[i];
                const sx = (x - cam.tx) * cam.scale + baseSize.w / 2;
                const sy = (y - cam.ty) * cam.scale + baseSize.h / 2;
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.strokeStyle = s.color;
            ctx.lineWidth = s.width;
            ctx.stroke();
        };

        for (const s of strokesRef.current) drawStroke(s);
        if (drawingRef.current) drawStroke(drawingRef.current);

        ctx.restore();
    }, [baseSize.w, baseSize.h, cam]);

    const scheduleDraw = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
    }, [draw]);

    useEffect(() => {
        scheduleDraw();
        return () => cancelAnimationFrame(rafRef.current);
    }, [scheduleDraw]);

    useEffect(() => { scheduleDraw(); }, [tool, selectedTex, brushRadius, pencilColor, pencilWidth, currentMapUrl, baseSize]);

    const pointerToBase = useCallback((ev) => {
        const st = stageRef.current;
        if (!st) return { x: 0, y: 0 };
        const r = st.getBoundingClientRect();
        const localX = ev.clientX - r.left;
        const localY = ev.clientY - r.top;
        return { x: localX / scale, y: localY / scale };
    }, [scale]);

    const baseToWorld = useCallback((x, y) => {
        return {
            x: (x - baseSize.w / 2) / cam.scale + cam.tx,
            y: (y - baseSize.h / 2) / cam.scale + cam.ty,
        };
    }, [baseSize.w, baseSize.h, cam]);

    const onPointerDown = useCallback((ev) => {
        ev.preventDefault();
        dragging.current = true;

        try { (ev.target)?.setPointerCapture?.(ev.pointerId); } catch { }

        const { x, y } = pointerToBase(ev);
        const { x: wx, y: wy } = baseToWorld(x, y);

        if (tool === TOOL_PENCIL) {
            drawingRef.current = { color: pencilColor, width: Math.max(1, Math.floor(pencilWidth)), points: [{ x: wx, y: wy }] };
            scheduleDraw();
            return;
        }

        const { q, r } = pixelToAxialRounded(wx, wy, HEX_RADIUS);
        const cells = hexDisk(q, r, Math.max(0, brushRadius - 1));
        if (tool === TOOL_ERASER) {
            for (const c of cells) tilesRef.current.delete(`${c.q},${c.r}`);
        } else {
            for (const c of cells) tilesRef.current.set(`${c.q},${c.r}`, { q: c.q, r: c.r, texId: selectedTex });
        }
        scheduleDraw();
    }, [pointerToBase, baseToWorld, tool, brushRadius, selectedTex, pencilColor, pencilWidth, scheduleDraw]);

    const onPointerMove = useCallback((ev) => {
        if (!dragging.current) return;
        ev.preventDefault();

        const { x, y } = pointerToBase(ev);
        const { x: wx, y: wy } = baseToWorld(x, y);

        if (tool === TOOL_PENCIL) {
            const s = drawingRef.current;
            if (s) {
                const last = s.points[s.points.length - 1];
                if (!last || (wx - last.x) ** 2 + (wy - last.y) ** 2 > 0.25) {
                    s.points.push({ x: wx, y: wy });
                    scheduleDraw();
                }
            }
            return;
        }

        const { q, r } = pixelToAxialRounded(wx, wy, HEX_RADIUS);
        const cells = hexDisk(q, r, Math.max(0, brushRadius - 1));
        if (tool === TOOL_ERASER) {
            for (const c of cells) tilesRef.current.delete(`${c.q},${c.r}`);
        } else {
            for (const c of cells) tilesRef.current.set(`${c.q},${c.r}`, { q: c.q, r: c.r, texId: selectedTex });
        }
        scheduleDraw();
    }, [pointerToBase, baseToWorld, tool, brushRadius, selectedTex, scheduleDraw]);

    const onPointerUp = useCallback((ev) => {
        if (!dragging.current) return;
        dragging.current = false;
        ev.preventDefault();
        try { (ev.target)?.releasePointerCapture?.(ev.pointerId); } catch { }

        if (tool === TOOL_PENCIL && drawingRef.current) {
            const s = drawingRef.current;
            drawingRef.current = null;
            if (s.points.length > 1) strokesRef.current = [...strokesRef.current, s];
            scheduleDraw();
        }
    }, [tool, scheduleDraw]);

    const onSave = useCallback(() => {
        const tiles = Array.from(tilesRef.current.values()).map(t => ({ q: t.q, r: t.r, texId: t.texId }));
        const strokes = [...strokesRef.current];
        const name = prompt("Nom du dessin ?", "Dessin") || "Dessin";

        console.log(`[DrawingWorkspace] Saving ${tiles.length} tiles, viewport: ${baseSize.w}×${baseSize.h}`);

        try {
            dispatch({ type: "ADD_DRAWING", payload: { name, tiles, strokes, createdAt: Date.now() } });
            window.__castSnapshot?.();
            alert("Dessin enregistré !");
        } catch { }
    }, [dispatch, baseSize]);

    const onQuit = useCallback(() => {
        try { dispatch({ type: "SET_DRAW_MODE", value: false }); } catch { }
    }, [dispatch]);

    useEffect(() => {
        console.log('[DrawingWorkspace] MOUNTED with baseSize:', baseSize);
    }, []);

    return (
        <div
            ref={outerRef}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 999999,
                background: "rgba(11, 11, 11, 0.95)",
                display: "flex",
                flexDirection: "column",
                touchAction: "none",
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div
                style={{
                    position: "relative",
                    zIndex: 1000000,
                    background: "#ff0000",
                    color: "#fff",
                    padding: "20px",
                    fontSize: "24px",
                    fontWeight: 900,
                    textAlign: "center",
                    borderBottom: "5px solid #ffff00",
                    boxShadow: "0 5px 20px rgba(255,0,0,0.8)",
                }}
            >
                <div>✏️ MODE DESSIN ACTIF ✏️</div>
                <div style={{ fontSize: 16, marginTop: 10, background: "#000", padding: 10, borderRadius: 8 }}>
                    📐 Viewport: {baseSize.w} × {baseSize.h}
                </div>
                <div style={{ marginTop: 15, display: "flex", gap: 10, justifyContent: "center" }}>
                    <button onClick={onSave} style={{ ...btnBig, background: "#0f0", color: "#000" }}>
                        💾 ENREGISTRER
                    </button>
                    <button onClick={onQuit} style={{ ...btnBig, background: "#f00", color: "#fff" }}>
                        ❌ QUITTER
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <div
                    ref={stageRef}
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: `${baseSize.w}px`,
                        height: `${baseSize.h}px`,
                        transform: `translate(-50%, -50%) scale(${scale})`,
                        transformOrigin: "center center",
                        backgroundColor: "#111",
                        backgroundImage: currentMapUrl ? `url(${currentMapUrl})` : "none",
                        backgroundPosition: "center center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "contain",
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                >
                    <canvas
                        ref={canvasRef}
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                            pointerEvents: "none",
                        }}
                    />
                </div>
            </div>

            <div style={{
                position: "fixed",
                left: 16,
                bottom: 16,
                display: "grid",
                gap: 8,
                padding: 10,
                width: 260,
                background: "#121212",
                border: "2px solid #0f0",
                borderRadius: 12,
                zIndex: 1000001,
            }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                    <ToolBtn active={tool === TOOL_TEXTURE} onClick={() => setTool(TOOL_TEXTURE)}>Texture</ToolBtn>
                    <ToolBtn active={tool === TOOL_ERASER} onClick={() => setTool(TOOL_ERASER)}>Gomme</ToolBtn>
                    <ToolBtn active={tool === TOOL_PENCIL} onClick={() => setTool(TOOL_PENCIL)}>Crayon</ToolBtn>
                </div>

                {tool === TOOL_TEXTURE && (
                    <>
                        <div style={{ fontSize: 12, opacity: .8, color: "#fff" }}>Textures</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                            {TEXTURES.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setSelectedTex(t)}
                                    style={{
                                        height: 34,
                                        borderRadius: 8,
                                        border: selectedTex === t ? "2px solid #18ff9b" : "1px solid #2a2a2a",
                                        backgroundImage: `url(/textures/${t}.png)`,
                                        backgroundSize: "cover",
                                        cursor: "pointer",
                                    }}
                                />
                            ))}
                        </div>
                        <input type="range" min={1} max={15} value={brushRadius} onChange={(e) => setBrushRadius(+e.target.value)} />
                    </>
                )}

                {tool === TOOL_PENCIL && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input type="color" value={pencilColor} onChange={(e) => setPencilColor(e.target.value)} style={{ width: "100%" }} />
                        <input type="range" min={1} max={16} value={pencilWidth} onChange={(e) => setPencilWidth(+e.target.value)} />
                    </div>
                )}
            </div>
        </div>
    );
}

function ToolBtn({ active, onClick, children }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "8px",
                borderRadius: 8,
                border: active ? "2px solid #0f0" : "1px solid #555",
                background: active ? "#0f0" : "#333",
                color: active ? "#000" : "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11,
            }}
        >
            {children}
        </button>
    );
}

const btnBig = {
    padding: "15px 25px",
    borderRadius: 12,
    border: "3px solid #fff",
    fontWeight: 900,
    fontSize: 18,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
};