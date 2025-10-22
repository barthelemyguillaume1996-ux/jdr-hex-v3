/* eslint-disable no-unused-vars */
// src/ui/hexboard-utils.js
import { axialToPixel } from "../core/hexMath";
import { TEXTURE_TILE_PX } from "../core/boardConfig";

/* ===== Taille globale des pions ===== */
export const TOKEN_RADIUS_FACTOR = 1.5;

/* ===== Canvas utils ===== */
export function dpiScaleCanvas(canvas, ctx, cssW, cssH) {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pw = Math.max(1, Math.floor(cssW * dpr));
    const ph = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw; canvas.height = ph;
    }
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function toScreen(cam, wx, wy, width, height) {
    const sx = (wx - cam.tx) * cam.scale + width / 2;
    const sy = (wy - cam.ty) * cam.scale + height / 2;
    return { sx, sy };
}
function screenToWorld(cam, sx, sy, width, height) {
    const wx = (sx - width / 2) / cam.scale + cam.tx;
    const wy = (sy - height / 2) / cam.scale + cam.ty;
    return { wx, wy };
}

/* ===== Grille ===== */
export function drawGrid(ctx, cam, width, height, hexRadius, calibration = null) {
    const tl = screenToWorld(cam, 0, 0, width, height);
    const br = screenToWorld(cam, width, height, width, height);

    const sqrt3 = Math.sqrt(3);
    const colW = sqrt3 * hexRadius;
    const rowH = 1.5 * hexRadius;

    const rMin = Math.floor(tl.wy / rowH) - 3;
    const rMax = Math.ceil(br.wy / rowH) + 3;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(120,120,120,0.15)";

    for (let r = rMin; r <= rMax; r++) {
        const qMin = Math.floor(tl.wx / colW - r / 2) - 3;
        const qMax = Math.ceil(br.wx / colW - r / 2) + 3;
        for (let q = qMin; q <= qMax; q++) {
            const { x, y } = axialToPixel(q, r, hexRadius, calibration);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const ang = (Math.PI / 180) * (60 * i - 30);
                const px = x + hexRadius * Math.cos(ang);
                const py = y + hexRadius * Math.sin(ang);
                const { sx, sy } = toScreen(cam, px, py, width, height);
                if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.stroke();
        }
    }
    ctx.restore();
}

/* ===== Token images (avec fallback d'extension) ===== */
const IMG_CACHE = new Map();

function resolveCandidates(src) {
    if (!src) return [];
    if (/^(data:|blob:|https?:)/.test(src) || /\.\w{3,4}$/.test(src)) return [src];
    return [`${src}.webp`, `${src}.png`, `${src}.jpg`, `${src}.jpeg`];
}
function getCachedImage(src, onLoad) {
    const candidates = resolveCandidates(src);
    if (candidates.length === 0) return null;

    let rec = IMG_CACHE.get(src);
    if (rec && rec.status === "loaded") return rec;

    if (!rec) {
        const img = new Image();
        let idx = 0;
        rec = { img, status: "loading", tried: candidates };
        IMG_CACHE.set(src, rec);
        img.crossOrigin = "anonymous";
        img.onload = () => { rec.status = "loaded"; onLoad && onLoad(); };
        img.onerror = () => {
            idx += 1;
            if (idx < candidates.length) img.src = candidates[idx];
            else rec.status = "error";
        };
        img.src = candidates[idx];
    }
    return rec;
}

/* ===== Token draw ===== */
function colorFromName(name = "") {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const hue = h % 360; return `hsl(${hue} 50% 45%)`;
}
function drawCircleImage(ctx, img, sx, sy, r) {
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    ctx.drawImage(img, sx - r, sy - r, 2 * r, 2 * r); ctx.restore();
}

export function drawSingleToken(ctx, t, q, r, isActive, cam, width, height, hexRadius, requestRedraw, alpha = 1, calibration = null) {
    const { x, y } = axialToPixel(q, r, hexRadius, calibration);
    const { sx, sy } = toScreen(cam, x, y, width, height);

    const baseNeighborDist = Math.sqrt(3) * hexRadius;
    const cellR = Number.isFinite(t?.cellRadius) ? t.cellRadius : 1;
    const tokenRadiusWorld = baseNeighborDist * cellR * TOKEN_RADIUS_FACTOR;
    const tokenRadiusScreen = tokenRadiusWorld * cam.scale;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath(); ctx.arc(sx, sy, tokenRadiusScreen, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fill();

    let didImage = false;
    if (t.img) {
        const rec = getCachedImage(t.img, requestRedraw);
        if (rec?.status === "loaded" && rec.img?.width > 0) {
            drawCircleImage(ctx, rec.img, sx, sy, tokenRadiusScreen);
            didImage = true;
        }
    }
    if (!didImage) {
        ctx.beginPath(); ctx.arc(sx, sy, tokenRadiusScreen, 0, Math.PI * 2); ctx.closePath();
        ctx.fillStyle = colorFromName(t.name); ctx.fill();
    }

    ctx.lineWidth = isActive ? 4 : 2;
    ctx.strokeStyle = isActive ? "rgba(80,220,170,0.95)" : "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.arc(sx, sy, tokenRadiusScreen, 0, Math.PI * 2); ctx.closePath(); ctx.stroke();

    ctx.restore();
}

export function drawTokens(ctx, tokens, activeId, cam, width, height, hexRadius, requestRedraw, calibration = null) {
    if (!Array.isArray(tokens) || tokens.length === 0) return;
    const arr = tokens.filter(t => t.isDeployed).slice().sort((a, b) => (a.id === activeId) - (b.id === activeId));
    for (const t of arr) {
        const isActive = t.id === activeId;
        drawSingleToken(ctx, t, t.q, t.r, isActive, cam, width, height, hexRadius, requestRedraw, 1, calibration);
    }
}

/* ===== Move range (cercle d'aide) ===== */
export function drawMoveRange(ctx, cam, width, height, hexRadius, q, r, speedHex, calibration = null, colorFill = "rgba(80,220,170,0.15)", colorStroke = "rgba(80,220,170,0.9)") {
    const n = Number.isFinite(speedHex) ? speedHex : 0;
    if (n <= 0) return;
    const { x, y } = axialToPixel(q, r, hexRadius, calibration);
    const { sx, sy } = toScreen(cam, x, y, width, height);
    const radiusWorld = Math.sqrt(3) * hexRadius * n;
    const radiusScreen = radiusWorld * cam.scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, radiusScreen, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = colorFill; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = colorStroke; ctx.stroke();
    ctx.restore();
}

/* ===== Overlay (textures & hex fill) ===== */
const PATTERN_CACHE = new Map(); // key: `${texId}|px:${tilePx}|dpr:${dpr}` -> CanvasPattern | "loading" | "error"

export function preloadTexturePattern(texId) {
    getPattern(texId, null, TEXTURE_TILE_PX);
}

function getPattern(texId, onLoad, tilePx) {
    if (!texId) return null;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const px = Math.max(4, Number.isFinite(+tilePx) ? +tilePx : TEXTURE_TILE_PX);
    const key = `${texId}|px:${px}|dpr:${dpr}`;

    const cached = PATTERN_CACHE.get(key);
    if (cached && cached !== "loading" && cached !== "error") return cached;

    if (!cached) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        PATTERN_CACHE.set(key, "loading");
        img.onload = () => {
            try {
                // Pattern natif
                const pat = document.createElement("canvas").getContext("2d").createPattern(img, "repeat");

                // On scale pour que la tuile fasse `px` pixels écran
                if (pat && typeof pat.setTransform === "function") {
                    const scale = (px * dpr) / (img.width || px);
                    // DOMMatrix(a, b, c, d, e, f) -> scale sur X/Y
                    pat.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0]));
                }
                PATTERN_CACHE.set(key, pat);
                onLoad && onLoad();
            } catch (e) {
                PATTERN_CACHE.set(key, "error");
            }
        };
        img.onerror = () => PATTERN_CACHE.set(key, "error");
        img.src = `/textures/${texId}.png`;
    }
    return null;
}

// couleur fallback par texture
function fallbackColor(texId) {
    const map = {
        herbe: "#224c24",
        pierre: "#555a60",
        sable: "#9f915d",
        eau: "#1e4f7a",
        neige: "#cfd7e6",
    };
    return map[texId] || "#2a2a2a";
}

export function fillHex(ctx, cam, width, height, hexRadius, q, r, texId, calibration = null) {
    const { x, y } = axialToPixel(q, r, hexRadius, calibration);
    const corners = Array.from({ length: 6 }, (_, i) => {
        const ang = (Math.PI / 180) * (60 * i - 30);
        const px = x + hexRadius * Math.cos(ang);
        const py = y + hexRadius * Math.sin(ang);
        const { sx, sy } = toScreen(cam, px, py, width, height);
        return [sx, sy];
    });

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 6; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();

    const pat = getPattern(texId, null, TEXTURE_TILE_PX);
    if (pat && pat !== "loading" && pat !== "error") {
        ctx.fillStyle = pat;
    } else {
        ctx.fillStyle = fallbackColor(texId);
    }
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();
    ctx.restore();
}

/* ===== Pinceau: disque d'hex rayon r ===== */
export function hexDisk(q0, r0, radius) {
    const res = [];
    for (let dq = -radius; dq <= radius; dq++) {
        for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
            const q = q0 + dq;
            const r = r0 + dr;
            res.push({ q, r });
        }
    }
    return res;
}

/* ===== Hit-test tokens ===== */
export function hitTestToken(sx, sy, t, cam, width, height, hexRadius, calibration = null) {
    const { x, y } = axialToPixel(t.q, t.r, hexRadius, calibration);
    const toScreenX = (x - cam.tx) * cam.scale + width / 2;
    const toScreenY = (y - cam.ty) * cam.scale + height / 2;

    const baseNeighborDist = Math.sqrt(3) * hexRadius;
    const cellR = Number.isFinite(t?.cellRadius) ? t.cellRadius : 1;
    const tokenRadiusWorld = baseNeighborDist * cellR * TOKEN_RADIUS_FACTOR;
    const tokenRadiusScreen = tokenRadiusWorld * cam.scale;

    const dx = sx - toScreenX;
    const dy = sy - toScreenY;
    return dx * dx + dy * dy <= tokenRadiusScreen * tokenRadiusScreen;
}