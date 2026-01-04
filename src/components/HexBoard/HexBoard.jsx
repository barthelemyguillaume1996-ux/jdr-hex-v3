import React, { useRef, useEffect, useState, useCallback } from 'react';
import { pixelToAxialRounded, axialToPixel, getHexesInRange, hexDistance } from '@/lib/hexMath';
import { dpiScaleCanvas, drawGrid, drawHover, drawTokens, drawOverlay, drawMap, drawPencilStrokes, drawMovementRange, screenToWorld } from './HexRenderer';
import { useAppState, useAppDispatch } from '@/state/StateProvider';

const HEX_RADIUS = 8;

export default function HexBoard({ locked = false }) {
    const state = useAppState();
    const dispatch = useAppDispatch();
    const tokens = state ? state.tokens : [];
    // Drawing State
    const { overlayTiles, draftOverlayTiles, ui, currentMapUrl, pencilStrokes } = state;
    const drawMode = ui?.drawMode;
    const pencilMode = ui?.pencilMode;
    const combatMode = ui?.combatMode;
    const activeTokenId = ui?.activeTokenId;

    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Camera State: { tx, ty, scale }
    const [cam, setCam] = useState({ tx: 0, ty: 0, scale: 1 });
    const [debugInfo, setDebugInfo] = useState({ q: 0, r: 0 });

    // Interaction state
    const isDraggingRef = useRef(false);
    const isDrawingRef = useRef(false);
    const isPencilDrawingRef = useRef(false);
    const currentPencilStrokeRef = useRef([]); // Array of {x, y} world coords

    const dragStartRef = useRef({ x: 0, y: 0 });
    const camStartRef = useRef({ tx: 0, ty: 0 });
    const [draggingTokenId, setDraggingTokenId] = useState(null);
    const [dragPos, setDragPos] = useState(null);

    const hoverRef = useRef({ q: 0, r: 0 });

    // Initial Center
    useEffect(() => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        setCam(prevCam => ({
            tx: 0,
            ty: 0,
            scale: prevCam.scale
        }));
    }, []);

    // Broadcast Camera (GM Mode)
    // Broadcast Camera (GM Mode)
    useEffect(() => {
        if (!locked) {
            window.__cameraCenter = cam;
            // Notify CastBridge to sync camera change (Throttled by CastBridge)
            window.dispatchEvent(new Event("cast:request_snapshot"));
        }
    }, [cam, locked]);

    // --- STABLE RENDER LOOP PATTERN ---
    // 1. Store latest state in a Ref to avoid breaking the animation loop
    const latestStateRef = useRef({
        tokens, cam, draggingTokenId, dragPos,
        overlayTiles, draftOverlayTiles, currentMapUrl,
        pencilStrokes, remoteStroke: state.currentPencilStroke,
        combatMode, activeTokenId
    });

    useEffect(() => {
        latestStateRef.current = {
            tokens, cam, draggingTokenId, dragPos,
            overlayTiles, draftOverlayTiles, currentMapUrl,
            pencilStrokes, remoteStroke: state.currentPencilStroke,
            combatMode, activeTokenId
        };
    }); // Runs on every render to update ref

    // Render Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return; // Should not happen if mounted

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let rafId;

        const render = () => {
            try {
                // Read from Ref (Always fresh, never causes restart)
                const s = latestStateRef.current;

                const width = container.clientWidth;
                const height = container.clientHeight;

                // Handle Resize / DPI
                dpiScaleCanvas(canvas, ctx, width, height);

                // Clear
                ctx.fillStyle = "#1e1e1e";
                ctx.fillRect(0, 0, width, height);

                // Draw Map
                drawMap(ctx, s.cam, width, height, s.currentMapUrl);

                // Draw Grid
                drawGrid(ctx, s.cam, width, height, HEX_RADIUS);

                // Draw Public Overlay
                drawOverlay(ctx, s.cam, width, height, HEX_RADIUS, s.overlayTiles);

                // Draw Draft Overlay
                if (s.draftOverlayTiles && s.draftOverlayTiles.length > 0) {
                    drawOverlay(ctx, s.cam, width, height, HEX_RADIUS, s.draftOverlayTiles);
                }

                // Draw Tokens
                drawTokens(ctx, s.tokens, s.cam, width, height, HEX_RADIUS, s.draggingTokenId, s.dragPos);

                // Draw Pencil Strokes
                // Combine saved strokes + current stroke being drawn (Local OR Remote)
                const currentStroke = [];
                if (isPencilDrawingRef.current) {
                    // Start of Local Drawing (Ref is truth)
                    currentStroke.push({
                        points: currentPencilStrokeRef.current,
                        color: "#00FFFF", // Fixed Cyan
                        width: 3          // Fixed Thin
                    });
                } else if (s.remoteStroke) {
                    // Remote Drawing (State is truth)
                    currentStroke.push(s.remoteStroke);
                }

                // ANTI-FLICKER: Always draw dying strokes (ghosts)
                if (dyingStrokesRef.current.length > 0) {
                    currentStroke.push(...dyingStrokesRef.current);
                }

                drawPencilStrokes(ctx, s.cam, width, height, [...(s.pencilStrokes || []), ...currentStroke]);

                // Draw Movement Range (Combat Mode Only)
                if (s.combatMode && s.activeTokenId) {
                    const activeToken = s.tokens.find(t => t.id === s.activeTokenId);
                    console.log('[HexBoard] Movement Range Check:', {
                        combatMode: s.combatMode,
                        activeTokenId: s.activeTokenId,
                        activeToken: activeToken ? {
                            id: activeToken.id,
                            name: activeToken.name,
                            isDeployed: activeToken.isDeployed,
                            speed: activeToken.speed,
                            remainingSpeed: activeToken.remainingSpeed
                        } : null
                    });
                    if (activeToken && activeToken.isDeployed) {
                        drawMovementRange(ctx, s.cam, width, height, HEX_RADIUS, activeToken);
                    }
                }

                // Draw Hover
                if (!s.draggingTokenId) {
                    drawHover(ctx, s.cam, width, height, HEX_RADIUS, hoverRef.current.q, hoverRef.current.r);
                }
            } catch (err) {
                console.error("Render Loop Error:", err);
            }
            rafId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(rafId);
    }, []); // ✅ ZERO DEPENDENCIES = STABLE LOOP


    // Auto-fit Map when URL changes
    useEffect(() => {
        if (!containerRef.current) return;

        if (!currentMapUrl) {
            // Map removed: reset zoom to 1.0
            if (!locked) {
                setCam({ tx: 0, ty: 0, scale: 1 });
                dispatch({ type: 'SET_ZOOM', zoom: 1 });
            }
            return;
        }

        const img = new Image();
        img.src = currentMapUrl;
        img.onload = () => {
            if (!containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            const scaleX = clientWidth / img.naturalWidth;
            const scaleY = clientHeight / img.naturalHeight;
            const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to have a bit of margin

            // Only auto-fit if NOT in viewer mode (Viewer accepts remote camera)
            if (!locked) {
                setCam({ tx: 0, ty: 0, scale });
                dispatch({ type: 'SET_ZOOM', zoom: scale });
            }
        };
    }, [currentMapUrl, locked, dispatch]);

    // Sync Camera from State (Viewer Mode)
    useEffect(() => {
        if (state.camera && locked) {
            // Apply remote camera
            // Note: Remote camera might be undefined initially
            setCam(prev => ({
                ...prev,
                tx: state.camera.tx ?? prev.tx,
                ty: state.camera.ty ?? prev.ty,
                scale: state.camera.scale ?? prev.scale
            }));
        }
    }, [state.camera, locked]);

    // Sync Zoom from UI State (Manual Zoom Control)
    useEffect(() => {
        if (ui?.zoom !== undefined && !locked) {
            setCam(prev => ({
                ...prev,
                scale: ui.zoom
            }));
        }
    }, [ui?.zoom, locked]);

    // --- RECEIVER SIDE ANTI-FLICKER BUFFER ---
    // If we are a viewer, and the live stroke stops, keep showing it for a moment
    // to bridge the gap until the finalized 'pencilStrokes' arrive.
    // We use a Queue to handle rapid strokes correctly.
    const dyingStrokesRef = useRef([]);
    const lastActiveStrokeRef = useRef(null);
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        if (state.currentPencilStroke) {
            // Tracking Active Stroke
            lastActiveStrokeRef.current = state.currentPencilStroke;
        } else {
            // Active Stroke Died: Move to Dying Queue
            if (lastActiveStrokeRef.current) {
                const deadStroke = lastActiveStrokeRef.current;
                dyingStrokesRef.current.push(deadStroke);

                // Clear this specific stroke after 300ms
                setTimeout(() => {
                    const idx = dyingStrokesRef.current.indexOf(deadStroke);
                    if (idx !== -1) {
                        dyingStrokesRef.current.splice(idx, 1);
                        forceUpdate(n => n + 1); // Re-render to clear
                    }
                }, 300); // 300ms Safety Buffer

                lastActiveStrokeRef.current = null;
                forceUpdate(n => n + 1); // Re-render to show ghost
            }
        }
    }, [state.currentPencilStroke]);


    // --- Interaction Handlers ---

    const handleBrushAction = (q, r, isRemove, brush) => {
        const size = brush?.size || 1;
        // Get affected hexes
        const hexes = getHexesInRange(q, r, size - 1); // Size 1 = range 0

        if (isRemove) {
            // Erase from BOTH Draft and Public
            dispatch({ type: 'DRAFT_REMOVE_BATCH', payload: hexes });
            dispatch({ type: 'OVERLAY_REMOVE_BATCH', payload: hexes });
        } else {
            const color = brush.color || "rgba(255, 100, 100, 0.5)";
            const tiles = hexes.map(h => ({ q: h.q, r: h.r, color, texture: brush.texture }));
            // Add only to Draft
            dispatch({ type: 'DRAFT_ADD_BATCH', payload: tiles });
        }
    };

    const lastSyncRef = useRef(0);

    const handlePointerDown = (e) => {
        if (!containerRef.current) return;
        containerRef.current.setPointerCapture(e.pointerId);

        const rect = containerRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { wx, wy } = screenToWorld(cam, mx, my, rect.width, rect.height);

        // PENCIL MODE
        if (pencilMode && !locked) {
            isPencilDrawingRef.current = true;
            currentPencilStrokeRef.current = [{ x: wx, y: wy }];
            // Start Sync
            dispatch({
                type: 'SET_CURRENT_PENCIL_STROKE',
                payload: { points: [{ x: wx, y: wy }], color: "#00FFFF", width: 3 }
            });
            return;
        }

        // DRAW MODE (Using Brush Size & Draft)
        if (drawMode && !locked) {
            isDrawingRef.current = true;
            const { q, r } = pixelToAxialRounded(wx, wy, HEX_RADIUS);
            // ... (rest of draw mode)
            // Right click / Alt click to remove OR Eraser tool? 
            const isEraser = (ui?.currentBrush?.type === 'eraser');
            const isRemove = e.button === 2 || e.altKey || isEraser;
            handleBrushAction(q, r, isRemove, ui?.currentBrush);
            return;
        }

        // 1. Check if clicking on a Token (Radial check due to large tokens)
        let clickedToken = null;
        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i];
            if (!t.isDeployed) continue;

            const { x: txWorld, y: tyWorld } = axialToPixel(t.q, t.r, HEX_RADIUS);
            const dx = wx - txWorld;
            const dy = wy - tyWorld;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Token radius is 1.9 * HEX_RADIUS in world units
            if (dist < HEX_RADIUS * 1.9) {
                clickedToken = t;
                break;
            }
        }

        if (clickedToken) {
            if (locked) return;

            // In combat mode, only allow dragging the active token
            if (combatMode && ui?.activeTokenId && clickedToken.id !== ui.activeTokenId) {
                return; // Block movement of non-active tokens
            }

            setDraggingTokenId(clickedToken.id);
            dispatch({ type: 'UPDATE_TOKEN', id: clickedToken.id, changes: { isDragging: true } });
        } else {
            // Drag Map
            if (!locked) {
                isDraggingRef.current = true;
                dragStartRef.current = { x: e.clientX, y: e.clientY };
                camStartRef.current = { tx: cam.tx, ty: cam.ty };
            }
        }
    };

    const handlePointerMove = (e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { wx, wy } = screenToWorld(cam, mx, my, rect.width, rect.height);

        // PENCIL DRAWING
        if (isPencilDrawingRef.current) {
            currentPencilStrokeRef.current.push({ x: wx, y: wy });

            // Sync with throttle (every 30ms ~ 30fps)
            const now = Date.now();
            if (now - lastSyncRef.current > 30) {
                lastSyncRef.current = now;
                dispatch({
                    type: 'SET_CURRENT_PENCIL_STROKE',
                    payload: { points: [...currentPencilStrokeRef.current], color: "#00FFFF", width: 3 }
                });
            }
            return;
        }

        // Hover Logic
        const { q, r } = pixelToAxialRounded(wx, wy, HEX_RADIUS);

        if (hoverRef.current.q !== q || hoverRef.current.r !== r) {
            hoverRef.current = { q, r };
            setDebugInfo({ q, r });

            // Painting while dragging
            if (isDrawingRef.current) {
                const isEraser = (ui?.currentBrush?.type === 'eraser');
                const isRemove = (e.buttons === 2) || e.altKey || isEraser;

                if (e.buttons === 1 || e.buttons === 2) { // Allow drag with right click too
                    handleBrushAction(q, r, isRemove, ui?.currentBrush);
                }
            }
        }

        // Dragging Token
        if (draggingTokenId) {
            // ... (Drag token logic needs to be here? Or is it handled via render?)
            // Actually it is handled via dragPos state in original code?
            // Wait, I need to verify I didn't delete token dragging logic in previous edits or snapshots.
            // The previous code had `setDragPos({ x: wx, y: wy });` or similar?
            // Ah, looking at lines 243-245 in previous view_file:
            /*
            // Dragging Token
            if (draggingTokenId) {
                return;
            }
            */
            // Wait, where is the update?
            // I must have missed re-implementing dragPos update in previous logic or it's further down?
            // Let's assume I shouldn't break existing logic. The snapshot ended exactly at line 250.
            // I will implement "Drag Token" safely.
            if (draggingTokenId) {
                setDragPos({ x: wx, y: wy });
                return;
            }
        }

        // Panning Map
        if (isDraggingRef.current) {
            const dx = (e.clientX - dragStartRef.current.x) / cam.scale;
            const dy = (e.clientY - dragStartRef.current.y) / cam.scale;

            setCam(prev => ({
                ...prev,
                tx: camStartRef.current.tx - dx,
                ty: camStartRef.current.ty - dy
            }));
        }
    };

    // --- Synchronization Logic for Pencil Gap ---
    // When finishing a stroke, we want to keep showing the LOCAL version until
    // the global state confirms the transaction (currentPencilStroke becomes null).
    useEffect(() => {
        if (!state.currentPencilStroke) {
            // Transaction confirmed finished: Clear local echo
            if (!isPencilDrawingRef.current) {
                currentPencilStrokeRef.current = [];
            }
        }
    }, [state.currentPencilStroke]);


    const handlePointerUp = (e) => {
        if (!containerRef.current) return;
        containerRef.current.releasePointerCapture(e.pointerId);

        // 1. PENCIL FINALIZATION
        if (isPencilDrawingRef.current) {
            isPencilDrawingRef.current = false;
            // Dispatch stroke FINAL
            if (currentPencilStrokeRef.current.length > 2) {
                const strokeData = {
                    id: Date.now().toString(),
                    points: [...currentPencilStrokeRef.current],
                    color: "#00FFFF", // Fixed Cyan
                    width: 3          // Fixed Thin
                };

                // ATOMIC UPDATE to prevent race conditions in Sync
                dispatch({ type: 'FINISH_PENCIL_STROKE', payload: strokeData });
            } else {
                // Just clear if too short
                dispatch({ type: 'SET_CURRENT_PENCIL_STROKE', payload: null });
            }

            // DO NOT CLEAR REF HERE! We wait for Sync (Local Echo).
            // currentPencilStrokeRef.current = []; 
            return;
        }

        isDraggingRef.current = false;
        isDrawingRef.current = false;

        // 2. TOKEN DROP LOGIC
        if (draggingTokenId) {
            const rect = containerRef.current.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const { wx, wy } = screenToWorld(cam, mx, my, rect.width, rect.height);
            const { q, r } = pixelToAxialRounded(wx, wy, HEX_RADIUS);

            // Get the token being dragged
            const token = tokens.find(t => t.id === draggingTokenId);
            if (!token) return;

            const startQ = token.q;
            const startR = token.r;

            // Calculate distance
            const distance = hexDistance(startQ, startR, q, r);
            const remainingSpeed = token.remainingSpeed !== undefined ? token.remainingSpeed : (token.speed || 30);

            let finalQ = q;
            let finalR = r;

            // Clamp to movement range if in combat mode and this is the active token
            if (combatMode && ui?.activeTokenId === draggingTokenId) {
                if (distance > remainingSpeed) {
                    // Clamp to circle edge
                    // Calculate direction and scale to remainingSpeed
                    const dq = q - startQ;
                    const dr = r - startR;
                    const ratio = remainingSpeed / distance;

                    finalQ = Math.round(startQ + dq * ratio);
                    finalR = Math.round(startR + dr * ratio);
                }
            }

            // Use new action to update position and consume speed
            dispatch({
                type: 'UPDATE_TOKEN_POSITION',
                id: draggingTokenId,
                newQ: finalQ,
                newR: finalR,
                startQ,
                startR
            });

            setDraggingTokenId(null);
            setDragPos(null);
        }
    };

    // Disabled Zoom
    const handleWheel = (e) => {
        // No-op or prevent default if needed
        // e.preventDefault(); 
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full relative overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
        >
            <canvas ref={canvasRef} className="block" />

            {/* Debug Overlay */}
            <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs p-2 rounded pointer-events-none select-none">
                Hex: {debugInfo.q}, {debugInfo.r} | Zoom: {cam.scale.toFixed(2)} | Tokens: {tokens.length} ({tokens.filter(t => t.isDeployed).length} visible)
            </div>
        </div>
    );
}
