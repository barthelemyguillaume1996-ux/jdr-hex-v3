// Math hex "pointes en haut" (pointy-top)
const SQRT3 = Math.sqrt(3);

export function axialToPixel(q, r, radius) {
    const x = radius * SQRT3 * (q + r / 2);
    const y = radius * 1.5 * r;
    return { x, y };
}

function cubeRound(x, y, z) {
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return { x: rx, y: ry, z: rz };
}

export function pixelToAxialRounded(x, y, radius) {
    const qf = (SQRT3 / 3 * x - 1 / 3 * y) / radius;
    const rf = (2 / 3 * y) / radius;
    const xf = qf, zf = rf, yf = -xf - zf;
    const { x: xr, z: zr } = cubeRound(xf, yf, zf);
    return { q: xr, r: zr };
}

export function hexCorners(cx, cy, d) {
    const out = [];
    for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 180) * (60 * i - 30);
        out.push({ x: cx + d * Math.cos(ang), y: cy + d * Math.sin(ang) });
    }
    return out;
}