export function fixHost(url) {
    return url || "";
}

// Stub pour plus tard (pas de backend pour l’instant)
export async function apiUpdateEntity(id, patch) {
    return { ok: true, id, patch };
}
