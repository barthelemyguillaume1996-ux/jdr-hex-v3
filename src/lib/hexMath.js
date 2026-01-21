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

// Get all 6 neighbors of a hex
export function getHexNeighbors(q, r) {
    const directions = [
        { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
        { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
    ];
    return directions.map(d => ({ q: q + d.q, r: r + d.r }));
}

// A* Pathfinding
export function findPath(start, end, blockedSet) {
    const startKey = `${start.q},${start.r}`;
    const endKey = `${end.q},${end.r}`;

    if (blockedSet.has(endKey)) return null; // Destination blocked

    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    gScore.set(startKey, 0);

    const fScore = new Map();
    fScore.set(startKey, hexDistance(start.q, start.r, end.q, end.r));

    while (openSet.length > 0) {
        // Sort by fScore (lowest first)
        openSet.sort((a, b) => {
            const fa = fScore.get(`${a.q},${a.r}`) ?? Infinity;
            const fb = fScore.get(`${b.q},${b.r}`) ?? Infinity;
            return fa - fb;
        });

        const current = openSet.shift(); // Pop lowest fScore
        const currentKey = `${current.q},${current.r}`;

        if (current.q === end.q && current.r === end.r) {
            // Reconstruct Path
            let path = []; // We want path length mainly
            let curr = current;
            while (cameFrom.has(`${curr.q},${curr.r}`)) {
                path.push(curr);
                curr = cameFrom.get(`${curr.q},${curr.r}`);
            }
            return path.length; // Return distance (steps)
        }

        const neighbors = getHexNeighbors(current.q, current.r);
        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.q},${neighbor.r}`;
            if (blockedSet.has(neighborKey)) continue; // Blocked

            const tentativeGScore = (gScore.get(currentKey) ?? Infinity) + 1;

            if (tentativeGScore < (gScore.get(neighborKey) ?? Infinity)) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + hexDistance(neighbor.q, neighbor.r, end.q, end.r));

                if (!openSet.some(n => n.q === neighbor.q && n.r === neighbor.r)) {
                    openSet.push(neighbor);
                }
            }
        }
    }

    return null; // No path found
}
