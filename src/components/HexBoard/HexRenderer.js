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
    if (screenHexRadius < 1) return; // LOD: Don't draw if too small

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

    for (let r = rMin; r <= rMax; r++) {
        const qMin = Math.floor(tl.wx / colW - r / 2) - 1;
        const qMax = Math.ceil(br.wx / colW - r / 2) + 1;

        for (let q = qMin; q <= qMax; q++) {
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
        img.src = `./textures/${texture}.png`; // Relative path works in both dev and production
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
        pat.pattern = ctx.createPattern(pat.img, 'repeat');
        return pat.pattern;
    }
    return null;
}

export function drawOverlay(ctx, cam, width, height, hexRadius, tiles = []) {
    if (!tiles || !tiles.length) return;

    // Sort or Group by texture/color to minimize state changes? 
    // Not strictly necessary for 2D Canvas unless huge count.

    for (const t of tiles) {
        if (t.q === undefined || t.r === undefined) continue;
        const { x, y } = axialToPixel(t.q, t.r, hexRadius);
        const { sx, sy } = toScreen(cam, x, y, width, height);

        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const ang = (Math.PI / 180) * (60 * i - 30);
            const px = x + hexRadius * Math.cos(ang);
            const py = y + hexRadius * Math.sin(ang);
            const { sx: pxS, sy: pyS } = toScreen(cam, px, py, width, height);
            if (i === 0) ctx.moveTo(pxS, pyS); else ctx.lineTo(pxS, pyS);
        }
        ctx.closePath();

        // Texture or Color?
        if (t.texture) {
            const pat = getTexturePattern(ctx, t.texture);
            if (pat) {
                // To make pattern stick to world, we might need setTransform?
                // Canvas patterns are screen-space by default unless transformed.
                // Simple approach: stick to screen (paralyx effect invalid for map).
                // Proper approach: translate pattern to match world offset.
                // But createPattern 'repeat' repeats from 0,0.
                // context.translate(sx_center, sy_center) might work if we fill relative?

                // Let's try simple fill first. 
                // To align pattern with hex, we can translate ctx to hex origin
                // ctx.translate(sx, sy); // This moves the pattern origin
                // But we need to account for cam scale if we want texture to zoom?
                // Canvas patterns don't scale automatically. 

                // If we want zoomable textures, it's harder with createPattern.
                // Alternative: Clip and drawImage.
                // Given "Texture" usually implies detail, let's use Clip + DrawImage

                const imgEntry = textureCache.get(t.texture);
                if (imgEntry && imgEntry.loaded) {
                    ctx.clip();
                    // Draw image centered or tiled? 
                    // Let's draw it cover-style or tiled.
                    // If tile is small (hex), maybe just 1 texture image per hex?
                    // Previous backup code suggested 48px tile.

                    // Simple logic: Draw image to fill the hex (cover)
                    // Or maintain world-scale.

                    // Let's assume texture images look good at 100% scale = 1 unit?
                    // Let's try drawing the image covering the hex rect.
                    const size = hexRadius * 2 * cam.scale;
                    ctx.drawImage(imgEntry.img, sx - size / 2, sy - size / 2, size, size);
                } else {
                    // Fallback while loading
                    ctx.fillStyle = t.color || "rgba(200, 200, 200, 0.5)";
                    ctx.fill();
                }
            } else {
                ctx.fillStyle = "rgba(100, 100, 100, 0.2)"; // loading
                ctx.fill();
            }
        } else {
            ctx.fillStyle = t.color || "rgba(255, 100, 100, 0.5)";
            ctx.fill();
        }

        ctx.restore();
    }
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
