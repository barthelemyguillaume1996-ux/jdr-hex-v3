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
        console.log("[DrawingWorkspace] Using REAL device size:", w, h);
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
    const cacheCanvasRef = useRef(null); // ✅ Offscreen canvas
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

    // --- CACHE LOGIC ---

    // Initialise / Resize le cache
    useEffect(() => {
        const cache = document.createElement("canvas");
        cacheCanvasRef.current = cache;
        const ctx = cache.getContext("2d", { contentIndex: "track" });
        if (ctx) dpiScaleCanvas(cache, ctx, baseSize.w, baseSize.h);

        // Force full redraw après création
        requestAnimationFrame(fullRedrawCache);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseSize.w, baseSize.h]); // Re-crée si la taille change

    // Redessine TOUTES les tuiles dans le cache (pan/zoom/init)
    const fullRedrawCache = useCallback(() => {
        const cache = cacheCanvasRef.current;
        if (!cache) return;
        const ctx = cache.getContext("2d");
        if (!ctx) return;

        // Clear
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform pixel
        ctx.clearRect(0, 0, cache.width, cache.height);
        ctx.restore();

        // Restore DPI scale & draw
        dpiScaleCanvas(cache, ctx, baseSize.w, baseSize.h);
        for (const rec of tilesRef.current.values()) {
            fillHex(ctx, cam, baseSize.w, baseSize.h, HEX_RADIUS, rec.q, rec.r, rec.texId);
        }
    }, [baseSize.w, baseSize.h, cam]);

    // Dessine UNE SEULE tuile dans le cache (incremental)
    const drawTileToCache = useCallback((q, r, texId) => {
        const cache = cacheCanvasRef.current;
        if (!cache) return;
        const ctx = cache.getContext("2d");

        // On assume que ctx est déjà configuré (DPI) car on ne le reset pas à chaque fois
        // MAIS dpiScaleCanvas reset la transform. 
        // Pour être sûr, on save/restore ou on refait le transform simple.
        // Ici on va juste utiliser fillHex qui utilise les coords screen, donc on doit être en coordonnées logiques (CSS px)
        // SI dpiScaleCanvas a été fait, le scale est appliqué.

        // SAUF QUE: le context offscreen peut perdre son state. 
        // Le plus sûr :
        ctx.save();
        // fillHex dessine
        fillHex(ctx, cam, baseSize.w, baseSize.h, HEX_RADIUS, q, r, texId);
        ctx.restore();
    }, [baseSize.w, baseSize.h, cam]);

    // Gomme dans le cache = redessiner "rien" ? Non, "clear" la zone ? 
    // Impossible de clear une tuile précise facilement sans composite 'destination-out'.
    // SOLUTION: Si on gomme, on doit full redraw le cache (tant pis, c'est moins fréquent que peindre).
    // OU: utiliser 'destination-out' avec la forme de l'hexagone.

    const eraseTileFromCache = useCallback((q, r) => {
        const cache = cacheCanvasRef.current;
        if (!cache) return;
        const ctx = cache.getContext("2d");
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        fillHex(ctx, cam, baseSize.w, baseSize.h, HEX_RADIUS, q, r, null); // null tex pour juste la forme? 
        // Ah, fillHex a besoin d'une texture ou couleur. On va tricher.
        // On va modifier fillHex ou copier sa logique ici pour "remplir" en mode effacement.
        // Pour l'instant, faisons simple : Full redraw sur gomme (optimisation texture = priorité).
        ctx.restore();

        // Fallback: full redraw plus sûr pour l'instant
        fullRedrawCache();
    }, [fullRedrawCache]);


    // Refaire le cache si la caméra change
    useEffect(() => {
        fullRedrawCache();
    }, [cam, fullRedrawCache]);


    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        dpiScaleCanvas(canvas, ctx, baseSize.w, baseSize.h);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGrid(ctx, cam, baseSize.w, baseSize.h, HEX_RADIUS);

        // ✅ Dessiner le cache (très rapide)
        if (cacheCanvasRef.current) {
            // drawImage prend des pixels CSS si le context est scale
            // Mais cacheCanvasRef a une taille physique * DPR.
            // On doit dessiner l'image entière sur le canvas entier.
            const cache = cacheCanvasRef.current;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // On dessine pixel pour pixel
            ctx.drawImage(cache, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

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
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
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

    useEffect(() => {
        scheduleDraw();
    }, [tool, selectedTex, brushRadius, pencilColor, pencilWidth, currentMapUrl, baseSize]);

    const pointerToBase = useCallback(
        (ev) => {
            const st = stageRef.current;
            if (!st) return { x: 0, y: 0 };
            const r = st.getBoundingClientRect();
            const localX = ev.clientX - r.left;
            const localY = ev.clientY - r.top;
            return { x: localX / scale, y: localY / scale };
        },
        [scale]
    );

    const baseToWorld = useCallback(
        (x, y) => {
            return {
                x: (x - baseSize.w / 2) / cam.scale + cam.tx,
                y: (y - baseSize.h / 2) / cam.scale + cam.ty,
            };
        },
        [baseSize.w, baseSize.h, cam]
    );

    const onPointerDown = useCallback(
        (ev) => {
            ev.preventDefault();
            dragging.current = true;

            try {
                ev.target?.setPointerCapture?.(ev.pointerId);
            } catch { }

            const { x, y } = pointerToBase(ev);
            const { x: wx, y: wy } = baseToWorld(x, y);

            if (tool === TOOL_PENCIL) {
                drawingRef.current = {
                    color: pencilColor,
                    width: Math.max(1, Math.floor(pencilWidth)),
                    points: [{ x: wx, y: wy }],
                };
                scheduleDraw();
                return;
            }

            const { q, r } = pixelToAxialRounded(wx, wy, HEX_RADIUS);
            const cells = hexDisk(q, r, Math.max(0, brushRadius - 1));

            // Optimisation : calculer les changements réels pour minimiser les appels
            // Cependant, drawTileToCache est rapide.

            if (tool === TOOL_ERASER) {
                let changed = false;
                for (const c of cells) {
                    const key = `${c.q},${c.r}`;
                    if (tilesRef.current.has(key)) {
                        tilesRef.current.delete(key);
                        changed = true;
                    }
                }
                if (changed) eraseTileFromCache(); // Full redraw car gomme complexe
            } else {
                for (const c of cells) {
                    const key = `${c.q},${c.r}`;
                    const prev = tilesRef.current.get(key);
                    // On ne redessine que si la texture change ou c'est nouveau
                    if (!prev || prev.texId !== selectedTex) {
                        tilesRef.current.set(key, { q: c.q, r: c.r, texId: selectedTex });
                        drawTileToCache(c.q, c.r, selectedTex); // ✅ Incremental !
                    }
                }
            }
            scheduleDraw();
        },
        [pointerToBase, baseToWorld, tool, brushRadius, selectedTex, scheduleDraw, drawTileToCache, eraseTileFromCache]
    );

    const onPointerMove = useCallback(
        (ev) => {
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
                let changed = false;
                for (const c of cells) {
                    const key = `${c.q},${c.r}`;
                    if (tilesRef.current.has(key)) {
                        tilesRef.current.delete(key);
                        changed = true;
                    }
                }
                if (changed) eraseTileFromCache();
            } else {
                for (const c of cells) {
                    const key = `${c.q},${c.r}`;
                    const prev = tilesRef.current.get(key);
                    if (!prev || prev.texId !== selectedTex) {
                        tilesRef.current.set(key, { q: c.q, r: c.r, texId: selectedTex });
                        drawTileToCache(c.q, c.r, selectedTex); // ✅ Incremental !
                    }
                }
            }
            scheduleDraw();
        },
        [pointerToBase, baseToWorld, tool, brushRadius, selectedTex, scheduleDraw, drawTileToCache, eraseTileFromCache]
    );

    const onPointerUp = useCallback(
        (ev) => {
            if (!dragging.current) return;
            dragging.current = false;
            ev.preventDefault();
            try {
                ev.target?.releasePointerCapture?.(ev.pointerId);
            } catch { }

            if (tool === TOOL_PENCIL && drawingRef.current) {
                const s = drawingRef.current;
                drawingRef.current = null;
                if (s.points.length > 1) strokesRef.current = [...strokesRef.current, s];
                scheduleDraw();
            }
        },
        [tool, scheduleDraw]
    );

    const onSave = useCallback(() => {
        const tiles = Array.from(tilesRef.current.values()).map((t) => ({
            q: t.q,
            r: t.r,
            texId: t.texId,
        }));
        const strokes = [...strokesRef.current];
        const name = prompt("Nom du dessin ?", "Dessin") || "Dessin";

        console.log(
            `[DrawingWorkspace] Saving ${tiles.length} tiles, viewport: ${baseSize.w}×${baseSize.h}`
        );

        try {
            dispatch({
                type: "ADD_DRAWING",
                payload: { name, tiles, strokes, createdAt: Date.now() },
            });
            window.__castSnapshot?.();
            alert("Dessin enregistré !");
        } catch { }
    }, [dispatch, baseSize]);

    const onQuit = useCallback(() => {
        try {
            dispatch({ type: "SET_DRAW_MODE", value: false });
        } catch { }
    }, [dispatch]);

    useEffect(() => {
        console.log("[DrawingWorkspace] MOUNTED with baseSize:", baseSize);
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
            {/* === plus de barre rouge en haut === */}

            {/* Zone centrale */}
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

            {/* Panneau flottant outils + (déplacé) Enregistrer / Quitter */}
            <div
                style={{
                    position: "fixed",
                    left: 16,
                    bottom: 16,
                    display: "grid",
                    gap: 8,
                    padding: 10,
                    width: 280,
                    background: "#121212",
                    border: "1px solid #2a2a2a",
                    borderRadius: 12,
                    zIndex: 1000001,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
                }}
            >
                {/* Ligne actions principales */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                        onClick={onSave}
                        style={{
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #0f0",
                            background: "linear-gradient(#18ff9b,#0ad76f)",
                            color: "#002b16",
                            fontWeight: 800,
                            cursor: "pointer",
                        }}
                    >
                        💾 Enregistrer
                    </button>
                    <button
                        onClick={onQuit}
                        style={{
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #f55",
                            background: "linear-gradient(#ff5858,#c81d1d)",
                            color: "#fff",
                            fontWeight: 800,
                            cursor: "pointer",
                        }}
                    >
                        ❌ Quitter
                    </button>
                </div>

                {/* Infos compactes */}
                <div style={{ fontSize: 12, opacity: 0.8, color: "#cfcfcf", textAlign: "center" }}>
                    📐 {baseSize.w} × {baseSize.h}
                </div>

                {/* Outils */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                    <ToolBtn active={tool === TOOL_TEXTURE} onClick={() => setTool(TOOL_TEXTURE)}>
                        Texture
                    </ToolBtn>
                    <ToolBtn active={tool === TOOL_ERASER} onClick={() => setTool(TOOL_ERASER)}>
                        Gomme
                    </ToolBtn>
                    <ToolBtn active={tool === TOOL_PENCIL} onClick={() => setTool(TOOL_PENCIL)}>
                        Crayon
                    </ToolBtn>
                </div>

                {tool === TOOL_TEXTURE && (
                    <>
                        <div style={{ fontSize: 12, opacity: 0.8, color: "#fff" }}>Textures</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                            {TEXTURES.map((t) => (
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
                        <input
                            type="range"
                            min={1}
                            max={15}
                            value={brushRadius}
                            onChange={(e) => setBrushRadius(+e.target.value)}
                        />
                    </>
                )}

                {tool === TOOL_PENCIL && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input
                            type="color"
                            value={pencilColor}
                            onChange={(e) => setPencilColor(e.target.value)}
                            style={{ width: "100%" }}
                        />
                        <input
                            type="range"
                            min={1}
                            max={16}
                            value={pencilWidth}
                            onChange={(e) => setPencilWidth(+e.target.value)}
                        />
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

// (Optionnel) ancien style des gros boutons si besoin ailleurs
const btnBig = {
    padding: "15px 25px",
    borderRadius: 12,
    border: "3px solid #fff",
    fontWeight: 900,
    fontSize: 18,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
};
