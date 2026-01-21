import { axialToPixel, getHexesInRange } from '@/lib/hexMath';

const HEX_COLOR_DEFAULT = "rgba(120,120,120,0.2)";
const HEX_COLOR_HOVER = "rgba(255,255,255,0.4)";

export function dpiScaleCanvas(canvas, ctx, width, height) {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function toScreen(cam, wx, wy, width, height) {
    const sx = (wx - cam.tx) * cam.scale + width / 2;
    const sy = (wy - cam.ty) * cam.scale + height / 2;
    return { sx, sy };
}

export function screenToWorld(cam, sx, sy, width, height) {
    const wx = (sx - width / 2) / cam.scale + cam.tx;
    const wy = (sy - height / 2) / cam.scale + cam.ty;
    return { wx, wy };
}

export function drawGrid(ctx, cam, width, height, hexRadius) {
    const screenHexRadius = hexRadius * cam.scale;

    // LOD: Don't draw grid if hexagons are too small
    if (screenHexRadius < 3) return;

    // LOD: Reduce grid density when zoomed out
    let gridSpacing = 1;
    if (screenHexRadius < 8) {
        gridSpacing = 4; // Draw every 4th hex
    } else if (screenHexRadius < 15) {
        gridSpacing = 2; // Draw every 2nd hex
    }

    const tl = screenToWorld(cam, 0, 0, width, height);
    const br = screenToWorld(cam, width, height, width, height);

    // Bounds calculation
    const colW = Math.sqrt(3) * hexRadius;
    const rowH = 1.5 * hexRadius;

    const rMin = Math.floor(tl.wy / rowH) - 1;
    const rMax = Math.ceil(br.wy / rowH) + 1;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = HEX_COLOR_DEFAULT;
    ctx.beginPath();

    for (let r = rMin; r <= rMax; r += gridSpacing) {
        const qMin = Math.floor(tl.wx / colW - r / 2) - 1;
        const qMax = Math.ceil(br.wx / colW - r / 2) + 1;

        for (let q = qMin; q <= qMax; q += gridSpacing) {
            const { x, y } = axialToPixel(q, r, hexRadius);

            // Draw Hexagon
            for (let i = 0; i < 6; i++) {
                const ang = (Math.PI / 180) * (60 * i - 30);
                const px = x + hexRadius * Math.cos(ang);
                const py = y + hexRadius * Math.sin(ang);
                const { sx, sy } = toScreen(cam, px, py, width, height);
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
        }
    }
    ctx.stroke();
    ctx.restore();
}

const mapImageCache = new Map();
const mapCanvasCache = new Map();

export function drawMap(ctx, cam, width, height, currentMapUrl) {
    if (!currentMapUrl) return;

    // Check canvas cache first
    let cachedCanvas = mapCanvasCache.get(currentMapUrl);

    if (!cachedCanvas) {
        let img = mapImageCache.get(currentMapUrl);
        if (!img) {
            img = new Image();
            img.src = currentMapUrl;
            mapImageCache.set(currentMapUrl, img);
        }

        if (img.complete && img.naturalWidth > 0) {
            // Create offscreen canvas for better performance
            const offscreen = document.createElement('canvas');
            offscreen.width = img.naturalWidth;
            offscreen.height = img.naturalHeight;
            const offCtx = offscreen.getContext('2d');
            offCtx.drawImage(img, 0, 0);

            mapCanvasCache.set(currentMapUrl, offscreen);
            cachedCanvas = offscreen;
        }
    }

    if (cachedCanvas) {
        ctx.save();
        const w = cachedCanvas.width;
        const h = cachedCanvas.height;

        // World coordinates of top-left if centered at 0,0
        const wx = -w / 2;
        const wy = -h / 2;

        const { sx, sy } = toScreen(cam, wx, wy, width, height);
        const sw = w * cam.scale;
        const sh = h * cam.scale;

        // Optimization: Don't draw if off-screen
        const visibleInfo = { x: sx, y: sy, w: sw, h: sh };
        if (visibleInfo.x + visibleInfo.w > 0 && visibleInfo.x < width &&
            visibleInfo.y + visibleInfo.h > 0 && visibleInfo.y < height) {
            ctx.drawImage(cachedCanvas, sx, sy, sw, sh);
        }

        ctx.restore();
    }
}

export function drawHover(ctx, cam, width, height, hexRadius, q, r) {
    const { x, y } = axialToPixel(q, r, hexRadius);
    const { sx, sy } = toScreen(cam, x, y, width, height);

    ctx.save();
    ctx.fillStyle = HEX_COLOR_HOVER;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 180) * (60 * i - 30);
        const px = x + hexRadius * Math.cos(ang);
        const py = y + hexRadius * Math.sin(ang);
        const { sx: pxS, sy: pyS } = toScreen(cam, px, py, width, height);
        if (i === 0) ctx.moveTo(pxS, pyS); else ctx.lineTo(pxS, pyS);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

const textureCache = new Map();

function getTexturePattern(ctx, texture) {
    if (!texture) return null;
    let pat = textureCache.get(texture);
    if (!pat) {
        const img = new Image();
        img.src = `./textures/${texture}.png?v=6`; // Force v6
        // We can't really wait for load inside render loop.  
        // Strategy: trigger load, return null. Once loaded, next frame will pick it up.
        // Or store the image in cache and check connection.

        // Better: Store object { pattern, img, loaded }
        const cacheEntry = { pattern: null, img, loaded: false };
        textureCache.set(texture, cacheEntry);

        img.onload = () => {
            cacheEntry.loaded = true;
            // Pattern creation needs context? Yes.
            // But we can create it on the fly if loaded.
        };
        return null;
    }

    if (pat.pattern) return pat.pattern;
    if (pat.loaded && pat.img.complete) {
        // CHROMA KEY FILTER
        // Use an offscreen canvas to process the image data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = pat.img.width;
        tempCanvas.height = pat.img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(pat.img, 0, 0);

        try {
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data;
            let foundBackground = false;

            // Target color: Magenta (approx R>240, G<20, B>240)
            // Or use Top-Left pixel as key? 
            // Let's use strict Magenta check first as we generated it so.
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Detection for Magenta #FF00FF
                // Relaxed Threshold to catch fringes/anti-aliasing
                // We ensure high Red and Blue, lower Green, and that Red and Blue are balanced (purple/magenta)
                if (r > 160 && b > 160 && g < 140 && Math.abs(r - b) < 60) {
                    data[i + 3] = 0; // Alpha 0
                    foundBackground = true;
                }
            }

            if (foundBackground) {
                tempCtx.putImageData(imageData, 0, 0);

                // Save filtered image for drawImage calls
                const filteredImg = new Image();
                filteredImg.src = tempCanvas.toDataURL();
                pat.processedImg = filteredImg; // Store it!

                // Create pattern from PROCESSED canvas
                pat.pattern = ctx.createPattern(tempCanvas, 'repeat');
                return pat.pattern;
            }
        } catch (e) {
            console.warn("Could not process texture transparency:", e);
        }

        // Fallback or No background found
        pat.pattern = ctx.createPattern(pat.img, 'repeat');
        return pat.pattern;
    }
    return null;
}

const overlayRenderCache = new WeakMap();

export function drawOverlay(ctx, cam, width, height, hexRadius, tiles = []) {
    if (!tiles || !tiles.length) return;

    // MEMOIZATION START
    let renderData = overlayRenderCache.get(tiles);
    if (!renderData) {
        // --- EXPENSIVE COMPUTATION START ---

        // Z-SORTING: Critical for 2.5D overlap
        // Sort by 'r' (vertical position) then 'q'
        // 1. Sort ALL tiles by depth first (standard painter's algo)
        const everythingSorted = [...tiles].sort((a, b) => (a.r - b.r) || (a.q - b.q));

        const groundTiles = [];
        const objectTiles = [];

        const is3D = (t) => ['mur', 'mur_bois', 'coffre', 'arbre', 'rocher', 'table', 'tonneau'].includes(t.texture);

        // 0. Detect Dominant Ground Texture (Chameleon Logic)
        // To fill "black holes" under walls, we guess the ground texture based on the map's majority.
        const groundCounts = {};
        let maxCount = 0;
        let dominantTexture = 'herbe'; // Default fallback

        everythingSorted.forEach(t => {
            if (!is3D(t) && t.texture) {
                groundCounts[t.texture] = (groundCounts[t.texture] || 0) + 1;
                if (groundCounts[t.texture] > maxCount) {
                    maxCount = groundCounts[t.texture];
                    dominantTexture = t.texture;
                }
            }
        });

        everythingSorted.forEach(t => {
            if (is3D(t)) {
                objectTiles.push(t);
                // SYNTHETIC UNDERLAY: Fill the void with dominant ground
                // checks if we are not creating a duplicate (rare strictly speaking as it replaces)
                groundTiles.push({
                    ...t,
                    texture: dominantTexture,
                    color: undefined, // ensure we use texture
                    isFiller: false // it's a real base
                });
            }
            else {
                groundTiles.push(t);
            }
        });

        // INTERPOLATION STEP: Add "Filler" walls between neighbors
        // This makes walls look continuous instead of cubic blocks
        // INTERPOLATION STEP: Add "Filler" walls between neighbors
        // This makes walls look continuous instead of cubic blocks
        const fillers = [];
        // We iterate over each wall type to ensure ONLY same-type walls connect
        const wallTypes = ['mur', 'mur_bois'];

        wallTypes.forEach(wallType => {
            const wallSet = new Set(objectTiles.filter(t => t.texture === wallType).map(t => `${t.q},${t.r}`));

            // 1. Calculate Rotation for Main Tiles (for wooden walls)
            if (wallType === 'mur_bois') {
                objectTiles.forEach(t => {
                    if (t.texture !== wallType) return;

                    // Check neighbors to determine orientation
                    const neighbors = getHexesInRange(t, 1).filter(n => wallSet.has(`${n.q},${n.r}`));

                    if (neighbors.length > 0) {
                        // Simple heuristic: Align with first neighbor
                        const n = neighbors[0];
                        const dq = n.q - t.q;
                        const dr = n.r - t.r;

                        if ((dq === 1 && dr === 0) || (dq === -1 && dr === 0)) t.rotation = 0; // Horizontal
                        else if ((dq === 0 && dr === 1) || (dq === 0 && dr === -1)) t.rotation = Math.PI / 3; // 60 deg
                        else if ((dq === -1 && dr === 1) || (dq === 1 && dr === -1)) t.rotation = 2 * Math.PI / 3; // 120 deg
                    }
                });
            }

            // 2. Create Fillers
            // For 'mur_bois', the sprite is wide enough to overlap neighbors if rotated.
            // So we SKIP filler generation to avoid clutter/Z-fighting.
            if (wallType === 'mur_bois') return;

            objectTiles.forEach(t => {
                if (t.texture !== wallType) return;

                // Check 3 specific neighbors (Right, Bottom-Right, Bottom-Left) 
                const neighborsCoords = [
                    { dq: 1, dr: 0 },   // Right
                    { dq: 0, dr: 1 },   // Bottom-Right
                    { dq: -1, dr: 1 }   // Bottom-Left
                ];

                neighborsCoords.forEach(({ dq, dr }) => {
                    const nq = t.q + dq;
                    const nr = t.r + dr;
                    if (wallSet.has(`${nq},${nr}`)) {
                        // Found a neighbor! Create a filler at midpoint.
                        const p1 = axialToPixel(t.q, t.r, hexRadius);
                        const p2 = axialToPixel(nq, nr, hexRadius);

                        const offX1 = (t.xOffset || 0) * cam.scale;
                        const offY1 = (t.yOffset || 0) * cam.scale;

                        const neighbor = objectTiles.find(ot => ot.q === nq && ot.r === nr && ot.texture === wallType);
                        const offX2 = (neighbor?.xOffset || 0) * cam.scale;
                        const offY2 = (neighbor?.yOffset || 0) * cam.scale;

                        const midX = ((p1.x + offX1 / cam.scale) + (p2.x + offX2 / cam.scale)) / 2;
                        const midY = ((p1.y + offY1 / cam.scale) + (p2.y + offY2 / cam.scale)) / 2;

                        let rotation = 0;
                        if (wallType === 'mur_bois') {
                            if (dq === 1 && dr === 0) rotation = 0;
                            if (dq === 0 && dr === 1) rotation = Math.PI / 3;
                            if (dq === -1 && dr === 1) rotation = 2 * Math.PI / 3;
                        }

                        fillers.push({
                            q: t.q, r: t.r,
                            customX: midX,
                            customY: midY,
                            texture: wallType,
                            isFiller: true,
                            rotation: rotation
                        });
                    }
                });
            });
        });



        // Add fillers and re-sort objects by Y for correct occlusion
        objectTiles.push(...fillers);
        objectTiles.sort((a, b) => {
            // Use custom Y if filler, else calculate base Y
            // We calculate base Y here to sort meaningfully against fillers
            // We can't rely on 'r' alone because fillers are between hexes
            const ay = a.customY ?? axialToPixel(a.q, a.r, hexRadius).y;
            const by = b.customY ?? axialToPixel(b.q, b.r, hexRadius).y;
            return ay - by;
        });

        renderData = { groundTiles, objectTiles };
        overlayRenderCache.set(tiles, renderData);
        // --- EXPENSIVE COMPUTATION END ---
    }

    const { groundTiles, objectTiles } = renderData;

    // Helper to draw a single tile
    const drawTile = (t) => {
        // Support explicit pixel coords (for fillers) OR axial
        let x, y;
        if (t.customX !== undefined && t.customY !== undefined) {
            x = t.customX;
            y = t.customY;
        } else {
            if (t.q === undefined || t.r === undefined) return;
            // Calculate base position
            const p = axialToPixel(t.q, t.r, hexRadius);
            x = p.x;
            y = p.y;
        }

        const { sx, sy } = toScreen(cam, x, y, width, height);

        // Pre-calculate path for shadows/base
        ctx.beginPath();
        if (!t.isFiller) {
            for (let i = 0; i < 6; i++) {
                const ang = (Math.PI / 180) * (60 * i - 30);
                const px = sx + (hexRadius * cam.scale) * Math.cos(ang); // Full hex size
                const py = sy + (hexRadius * cam.scale) * Math.sin(ang);
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        const hexPath = new Path2D(ctx); // Save path if supported/needed, or just use current path

        // Texture or Color?
        if (t.texture) {
            // Trigger Load if not cached
            getTexturePattern(ctx, t.texture);

            const imgEntry = textureCache.get(t.texture);
            if (imgEntry && imgEntry.loaded) {
                const is3D = ['mur', 'mur_bois', 'coffre', 'arbre', 'rocher', 'table', 'tonneau'].includes(t.texture);
                const size = hexRadius * 2 * cam.scale; // Base size

                // Use processed image if transparency filter ran
                const sourceImg = imgEntry.processedImg || imgEntry.img;

                if (is3D) {
                    // 3D EFFECT: Draw outside of clip
                    const offset = (hexRadius * 0.6) * cam.scale; // Lift higher

                    // 1. Draw Organic Drop Shadow (Oval) - No Hex Base/Foundation
                    if (!t.isFiller) {
                        ctx.save();
                        ctx.translate(0, offset * 0.3);
                        ctx.globalAlpha = 0.2; // Lower alpha since no blur
                        // ctx.filter = 'blur(5px)'; // REMOVED FOR PERFORMANCE
                        ctx.fillStyle = "black";

                        // Draw oval instead of hex
                        ctx.beginPath();
                        // Ellipse: center (sx, sy), radii (hexRadius*0.8, hexRadius*0.5), rotation 0
                        ctx.ellipse(sx, sy, hexRadius * 0.8 * cam.scale, hexRadius * 0.5 * cam.scale, 0, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.restore();
                    }

                    // 2. Draw Object Lifted & Larger
                    // Scale up to ensure overlap
                    let scaleW = 1.4;
                    let scaleH = 1.4;
                    let yShift = 0;

                    if (t.texture === 'mur' || t.texture === 'mur_bois') {
                        scaleW = 1.35;
                        scaleH = 1.75;
                        yShift = size * 0.15;
                    } else if (t.texture === 'coffre') {
                        scaleW = 1.3;
                        scaleH = 1.3;
                    } else if (t.texture === 'arbre') {
                        scaleW = 3.5;
                        scaleH = 3.5;
                        yShift = -size * 0.5;
                    } else if (t.texture === 'rocher') {
                        scaleW = 1.8;
                        scaleH = 1.6;
                        yShift = size * 0.1;
                    } else if (t.texture === 'table') {
                        scaleW = 5.4; // 3x Larger
                        scaleH = 4.5;
                        yShift = size * 0.1;
                    } else if (t.texture === 'tonneau') {
                        scaleW = 1.0;
                        scaleH = 1.2;
                        yShift = size * 0.1;
                    }

                    const h = size * scaleH;
                    const w = size * scaleW;

                    // FREE PLACEMENT OFFSET
                    let freeOffsetX = 0;
                    let freeOffsetY = 0;
                    if (t.xOffset !== undefined) freeOffsetX = t.xOffset * cam.scale;
                    if (t.yOffset !== undefined) freeOffsetY = t.yOffset * cam.scale;

                    // Draw image centered horizontally, but lifted vertically
                    // We render at: center X, center Y
                    const drawX = (sx + freeOffsetX);
                    const drawY = (sy + freeOffsetY - offset + yShift);

                    if (t.rotation) {
                        ctx.save();
                        ctx.translate(drawX, drawY);
                        ctx.rotate(t.rotation);
                        // Draw centered at (0,0) after translation
                        ctx.drawImage(sourceImg, -w / 2, -h / 2, w, h);
                        ctx.restore();
                    } else {
                        // Standard drawing
                        ctx.drawImage(sourceImg, drawX - w / 2, drawY - h / 2, w, h);
                    }
                } else {
                    // Standard Flat Tile (e.g. Grass, Water) -> Clip to Hex
                    ctx.save();
                    ctx.clip();
                    ctx.drawImage(sourceImg, sx - size / 2, sy - size / 2, size, size);
                    ctx.restore();
                }
            } else {
                // Fallback while loading
                ctx.fillStyle = t.color || "rgba(200, 200, 200, 0.5)";
                if (['mur', 'mur_bois', 'coffre'].includes(t.texture)) {
                    // Fallback 3d (color block)
                    ctx.save();
                    ctx.translate(0, -10 * cam.scale);
                    ctx.fill();
                    ctx.restore();
                } else {
                    ctx.fill();
                }
            }
        } else {
            // No texture, just color
            ctx.fillStyle = t.color || "rgba(200, 200, 200, 0.5)";
            ctx.fill();
        }
    };

    // PASS 1: GROUND
    groundTiles.forEach(drawTile);

    // PASS 2: OBJECTS
    objectTiles.forEach(drawTile);
}

export function drawPencilStrokes(ctx, cam, width, height, strokes = []) {
    if (!strokes || !strokes.length) return;

    ctx.save();
    try {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const stroke of strokes) {
            // Validate stroke structure
            if (!stroke || !stroke.points || stroke.points.length < 2) continue;

            // Validate start point
            const startC = stroke.points[0];
            if (!startC || startC.x === undefined || startC.y === undefined) continue;

            ctx.beginPath();
            const start = toScreen(cam, startC.x, startC.y, width, height);
            ctx.moveTo(start.sx, start.sy);

            for (let i = 1; i < stroke.points.length; i++) {
                const pt = stroke.points[i];
                // Validate segment points
                if (!pt || pt.x === undefined || pt.y === undefined) continue;

                const p = toScreen(cam, pt.x, pt.y, width, height);
                ctx.lineTo(p.sx, p.sy);
            }

            ctx.strokeStyle = stroke.color || "#00FFFF";
            ctx.lineWidth = (stroke.width || 3) * cam.scale;

            // Glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = stroke.color || "#00FFFF";

            ctx.stroke();
        }
    } catch (e) {
        console.error("Pencil Draw Error:", e);
    } finally {
        ctx.restore();
    }
}

const imageCache = new Map();

export function drawTokens(ctx, tokens, cam, width, height, hexRadius, draggingId = null, dragPos = null) {
    if (!tokens || !tokens.length) return;

    ctx.save();
    for (const t of tokens) {
        if (!t.isDeployed) continue;
        if (!t.q && t.q !== 0) continue;

        let x, y;
        // Override position if being dragged
        if (draggingId === t.id && dragPos) {
            x = dragPos.x;
            y = dragPos.y;
        } else {
            const p = axialToPixel(t.q, t.r, hexRadius);
            x = p.x;
            y = p.y;
        }

        const { sx, sy } = toScreen(cam, x, y, width, height);

        // Token covers 7 hexes (1 center + 6 neighbors) -> Radius approx 2 * hexRadius
        const r = (hexRadius * 1.9) * cam.scale;

        ctx.beginPath();

        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = t.color || "#3b82f6";
        ctx.fill();

        // Image Handling
        if (t.img) {
            let img = imageCache.get(t.img);
            if (!img) {
                img = new Image();
                img.src = t.img;
                imageCache.set(t.img, img);
            }

            if (img.complete && img.naturalWidth > 0) {
                ctx.save();
                ctx.clip(); // Clip to the circle
                ctx.drawImage(img, sx - r, sy - r, r * 2, r * 2);
                ctx.restore();
            }
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = "white";
        ctx.stroke();

        // Highligh dragging
        if (draggingId === t.id) {
            ctx.strokeStyle = "#FFFF00";
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Name
        if (t.name) {
            ctx.fillStyle = "white";
            ctx.font = `${Math.max(10, 12 * cam.scale)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText(t.name, sx, sy + r + (15 * cam.scale));
        }

        // Status Effects (Conditions) - Text Display
        if (t.conditions && t.conditions.length > 0) {
            let conditionY = sy + r + (25 * cam.scale); // Start below the name

            t.conditions.forEach((condition) => {
                ctx.save();
                ctx.font = `bold ${Math.max(8, 10 * cam.scale)}px sans-serif`;
                ctx.textAlign = "center";

                // Color coding
                if (condition.toLowerCase().includes('aveuglé') || condition.toLowerCase().includes('blinded')) ctx.fillStyle = '#9ca3af'; // Light Gray for visibility on dark
                else if (condition.toLowerCase().includes('charmé') || condition.toLowerCase().includes('charmed')) ctx.fillStyle = '#f472b6'; // Pink
                else if (condition.toLowerCase().includes('assourdi') || condition.toLowerCase().includes('deafened')) ctx.fillStyle = '#9ca3af';
                else if (condition.toLowerCase().includes('effrayé') || condition.toLowerCase().includes('frightened')) ctx.fillStyle = '#a78bfa'; // Purple
                else if (condition.toLowerCase().includes('agrippé') || condition.toLowerCase().includes('grappled')) ctx.fillStyle = '#fb923c'; // Orange
                else if (condition.toLowerCase().includes('neutralisé') || condition.toLowerCase().includes('incapacitated')) ctx.fillStyle = '#f87171'; // Red
                else if (condition.toLowerCase().includes('invisible')) ctx.fillStyle = '#e5e7eb'; // White
                else if (condition.toLowerCase().includes('paralysé') || condition.toLowerCase().includes('paralyzed')) ctx.fillStyle = '#facc15'; // Yellow
                else if (condition.toLowerCase().includes('pétrifié') || condition.toLowerCase().includes('petrified')) ctx.fillStyle = '#a8a29e'; // Stone
                else if (condition.toLowerCase().includes('empoisonné') || condition.toLowerCase().includes('poisoned')) ctx.fillStyle = '#34d399'; // Green
                else if (condition.toLowerCase().includes('à terre') || condition.toLowerCase().includes('prone')) ctx.fillStyle = '#a16207'; // Brown
                else if (condition.toLowerCase().includes('entravé') || condition.toLowerCase().includes('restrained')) ctx.fillStyle = '#e11d48'; // Dark Red
                else if (condition.toLowerCase().includes('étourdi') || condition.toLowerCase().includes('stunned')) ctx.fillStyle = '#fbbf24'; // Amber
                else if (condition.toLowerCase().includes('inconscient') || condition.toLowerCase().includes('unconscious')) ctx.fillStyle = '#ef4444'; // Red
                else ctx.fillStyle = '#60a5fa'; // Default Blue

                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.strokeText(condition, sx, conditionY);
                ctx.fillText(condition, sx, conditionY);
                ctx.restore();

                conditionY += (12 * cam.scale); // Move down for next condition
            });
        }
    }
    ctx.restore();
}

export function drawMovementRange(ctx, cam, width, height, hexRadius, token) {
    if (!token) return;

    // Use remainingSpeed if available, fallback to speed, fallback to 30 default
    const currentSpeed = token.remainingSpeed !== undefined ? token.remainingSpeed : (token.speed || 30);
    if (currentSpeed <= 0) return; // No movement left

    const range = currentSpeed; // Remaining hexes

    // Convert hex range to pixel radius
    // Each hex has a "radius" in world space
    // Using sqrt(3) * hexRadius as the distance between hex centers
    const pixelRadius = range * hexRadius * Math.sqrt(3);

    // Get token center in world coords
    const { x: tokenX, y: tokenY } = axialToPixel(token.q, token.r, hexRadius);

    // Convert to screen coords
    const { sx, sy } = toScreen(cam, tokenX, tokenY, width, height);

    ctx.save();

    // Draw circle outline - NEON GREEN
    ctx.beginPath();
    ctx.arc(sx, sy, pixelRadius * cam.scale, 0, Math.PI * 2);

    // Neon green stroke with glow
    ctx.strokeStyle = '#00ff00'; // Bright neon green
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff00'; // Glow effect
    ctx.stroke();

    ctx.restore();
}
