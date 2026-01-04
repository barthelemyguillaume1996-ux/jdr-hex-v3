// src/core/mapCalibration.js
// Système de calibration des maps pour synchroniser hex et pixels

export function loadCalibrations() {
    try {
        const data = localStorage.getItem('mapCalibrations');
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

export function saveCalibrations(calibrations) {
    try {
        localStorage.setItem('mapCalibrations', JSON.stringify(calibrations));
    } catch { }
}

export function getMapCalibration(mapUrl) {
    const calibrations = loadCalibrations();
    return calibrations[mapUrl] || null;
}

export function setMapCalibration(mapUrl, calibration) {
    const calibrations = loadCalibrations();
    calibrations[mapUrl] = calibration;
    saveCalibrations(calibrations);
}

/**
 * Calcule une transformation affine à partir de 4 points
 * Points = [{ q, r, pixelX, pixelY }, ...]
 */
function buildAffineTransform(points) {
    if (!points || points.length < 4) return null;

    const p = points;

    // Matrice pour convertir (q, r) → (pixelX, pixelY)
    // pixelX = a*q + b*r + c
    // pixelY = d*q + e*r + f

    // Utiliser 3 points pour résoudre le système
    // Point 0: pixelX0 = a*q0 + b*r0 + c
    // Point 1: pixelX1 = a*q1 + b*r1 + c
    // Point 2: pixelX2 = a*q2 + b*r2 + c

    const q = [p[0].q, p[1].q, p[2].q];
    const r = [p[0].r, p[1].r, p[2].r];
    const px = [p[0].pixelX, p[1].pixelX, p[2].pixelX];
    const py = [p[0].pixelY, p[1].pixelY, p[2].pixelY];

    // Résoudre pour pixelX = a*q + b*r + c
    const detX = q[0] * (r[1] - r[2]) - q[1] * (r[0] - r[2]) + q[2] * (r[0] - r[1]);
    if (Math.abs(detX) < 0.0001) return null;

    const a = ((px[0] * (r[1] - r[2]) - px[1] * (r[0] - r[2]) + px[2] * (r[0] - r[1])) / detX);
    const b = ((px[0] * (q[2] - q[1]) - px[1] * (q[2] - q[0]) + px[2] * (q[1] - q[0])) / detX);
    const c = px[0] - a * q[0] - b * r[0];

    // Résoudre pour pixelY = d*q + e*r + f
    const d = ((py[0] * (r[1] - r[2]) - py[1] * (r[0] - r[2]) + py[2] * (r[0] - r[1])) / detX);
    const e = ((py[0] * (q[2] - q[1]) - py[1] * (q[2] - q[0]) + py[2] * (q[1] - q[0])) / detX);
    const f = py[0] - d * q[0] - e * r[0];

    return { a, b, c, d, e, f };
}

/**
 * Inverse d'une transformation affine
 */
function invertAffineTransform(transform) {
    const { a, b, c, d, e, f } = transform;
    const det = a * e - b * d;
    if (Math.abs(det) < 0.0001) return null;

    return {
        a: e / det,
        b: -b / det,
        c: (b * f - c * e) / det,
        d: -d / det,
        e: a / det,
        f: (c * d - a * f) / det,
    };
}

/**
 * Convertit des coordonnées hexagonales en pixels basé sur la calibration
 */
export function hexToPixel(q, r, calibration, hexRadius) {
    if (!calibration || !calibration.points || calibration.points.length < 4) {
        // Pas de calibration, utiliser les formules standards
        const SQRT3 = Math.sqrt(3);
        const x = hexRadius * SQRT3 * (q + r / 2);
        const y = hexRadius * 1.5 * r;
        return { x, y };
    }

    // Construire la transformation affine
    const transform = buildAffineTransform(calibration.points);
    if (!transform) {
        // Fallback si la transformation ne peut pas être calculée
        const SQRT3 = Math.sqrt(3);
        const x = hexRadius * SQRT3 * (q + r / 2);
        const y = hexRadius * 1.5 * r;
        return { x, y };
    }

    // Appliquer la transformation
    const x = transform.a * q + transform.b * r + transform.c;
    const y = transform.d * q + transform.e * r + transform.f;

    return { x, y };
}

/**
 * Convertit des pixels en coordonnées hexagonales basé sur la calibration
 */
export function pixelToHex(pixelX, pixelY, calibration, hexRadius) {
    if (!calibration || !calibration.points || calibration.points.length < 4) {
        // Pas de calibration, utiliser les formules standards
        const SQRT3 = Math.sqrt(3);
        const q = (2 / 3 * pixelX) / hexRadius;
        const r = (-1 / 3 * pixelX + Math.sqrt(3) / 3 * pixelY) / hexRadius;
        return { q: Math.round(q), r: Math.round(r) };
    }

    // Construire la transformation directe
    const transform = buildAffineTransform(calibration.points);
    if (!transform) {
        // Fallback
        const SQRT3 = Math.sqrt(3);
        const q = (2 / 3 * pixelX) / hexRadius;
        const r = (-1 / 3 * pixelX + Math.sqrt(3) / 3 * pixelY) / hexRadius;
        return { q: Math.round(q), r: Math.round(r) };
    }

    // Inverser pour obtenir q, r à partir de pixelX, pixelY
    const invTransform = invertAffineTransform(transform);
    if (!invTransform) {
        const SQRT3 = Math.sqrt(3);
        const q = (2 / 3 * pixelX) / hexRadius;
        const r = (-1 / 3 * pixelX + Math.sqrt(3) / 3 * pixelY) / hexRadius;
        return { q: Math.round(q), r: Math.round(r) };
    }

    const q = invTransform.a * pixelX + invTransform.b * pixelY + invTransform.c;
    const r = invTransform.d * pixelX + invTransform.e * pixelY + invTransform.f;

    return { q: Math.round(q), r: Math.round(r) };
}