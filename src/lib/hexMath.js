export const SQRT3 = Math.sqrt(3);

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
// Cube coordinates helpers
export function axialToCube(q, r) {
    return { x: q, y: -q - r, z: r };
}

export function cubeToAxial(x, y, z) {
    return { q: x, r: z };
}

export function cubeDistance(a, b) {
    return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}

export function getHexesInRange(centerQ, centerR, range) {
    const results = [];
    for (let q = -range; q <= range; q++) {
        for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
            const dq = q;
            const dr = r;
            results.push({ q: centerQ + dq, r: centerR + dr });
        }
    }
    return results;
}

export function hexDistance(q1, r1, q2, r2) {
    const cube1 = axialToCube(q1, r1);
    const cube2 = axialToCube(q2, r2);
    return cubeDistance(cube1, cube2);
}
