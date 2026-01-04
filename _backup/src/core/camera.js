export function createCamera() {
    return { tx: 0, ty: 0, scale: 1 };
}

export function toScreen(cam, wx, wy, width, height) {
    const sx = (wx - cam.tx) * cam.scale + width / 2;
    const sy = (wy - cam.ty) * cam.scale + height / 2;
    return { sx, sy };
}

export function toWorld(cam, sx, sy, width, height) {
    const x = (sx - width / 2) / cam.scale + cam.tx;
    const y = (sy - height / 2) / cam.scale + cam.ty;
    return { x, y };
}
