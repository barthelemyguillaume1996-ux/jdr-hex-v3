/* eslint-disable no-empty */
// src/ui/RightDrawer.jsx - AVEC UPLOAD DE MAPS
import React, { useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import Modal from "./Modal";

export default function RightDrawer() {
    const {
        drawings, maps, currentMapUrl,
        tokens, activeId, combatMode, remainingSpeedById, overlayTiles
    } = useAppState();
    const dispatch = useAppDispatch();
    const [open, setOpen] = useState(true);

    // --- Modal fallback copie ---
    const [copyOpen, setCopyOpen] = useState(false);
    const [copyB64, setCopyB64] = useState("");
    const [copyJson, setCopyJson] = useState("");
    const taRef = useRef(null);

    // 🆕 Upload de maps (stockage en mémoire via data URLs)
    const [uploadedMaps, setUploadedMaps] = useState([]);
    const fileInputRef = useRef(null);

    const list = useMemo(
        () => (Array.isArray(drawings) ? drawings.slice().sort((a, b) => b.createdAt - a.createdAt) : []),
        [drawings]
    );

    // Combine maps statiques + uploadées
    const mapsList = useMemo(() => {
        const staticMaps = Array.isArray(maps) ? maps.map(m => {
            if (typeof m === "string") return { file: m, name: m.replace(/\.(webp|png|jpg|jpeg)$/i, ""), type: "static" };
            return { file: m.file, name: m.name || m.file, type: "static" };
        }) : [];

        return [...uploadedMaps, ...staticMaps];
    }, [maps, uploadedMaps]);

    const castOverlay = (tiles) => {
        try {
            window.__castSend?.({ type: "OVERLAY_SET", payload: { tiles } });
            window.__castSend?.({ type: "SNAPSHOT", payload: { overlayTiles: Array.isArray(tiles) ? tiles : [] } });
            window.__castSnapshot?.();
        } catch { }
    };

    const castMap = (url) => {
        try {
            window.__castSend?.({ type: "SET_CURRENT_MAP", payload: { url } });
            window.__castSend?.({ type: "SNAPSHOT", payload: { currentMapUrl: url || null } });
            window.__castSnapshot?.();
        } catch { }
    };

    const onLoadDrawingToMap = (d) => {
        if (!d || !Array.isArray(d.tiles)) return;
        dispatch({ type: "OVERLAY_SET", tiles: d.tiles });
        castOverlay(d.tiles);
    };

    const onDeleteDrawing = (id) => {
        if (!id) return;
        if (!confirm("Supprimer ce dessin définitivement ?")) return;
        dispatch({ type: "DELETE_DRAWING", id });
        try { window.__castSnapshot?.(); } catch { }
    };

    const onLoadMap = (mapItem) => {
        const url = mapItem.type === "static" ? `/Maps/${mapItem.file}` : mapItem.file;
        dispatch({ type: "SET_CURRENT_MAP", url });
        castMap(url);
    };

    const onUnloadMap = () => {
        dispatch({ type: "SET_CURRENT_MAP", url: null });
        castMap(null);
    };

    // 🆕 Gestion upload
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Vérif type
        if (!file.type.startsWith("image/")) {
            alert("Le fichier doit être une image (PNG, JPG, WebP, etc.)");
            return;
        }

        // Lecture en data URL
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result || "");
            const newMap = {
                file: dataUrl,
                name: file.name.replace(/\.(webp|png|jpg|jpeg)$/i, ""),
                type: "uploaded",
                uploadedAt: Date.now(),
            };
            setUploadedMaps(prev => [newMap, ...prev]);
        };
        reader.readAsDataURL(file);

        // Reset input pour permettre le même fichier 2x
        e.target.value = "";
    };

    const deleteUploadedMap = (mapItem) => {
        if (!confirm(`Supprimer la map "${mapItem.name}" ?`)) return;
        setUploadedMaps(prev => prev.filter(m => m !== mapItem));
        // Si c'est la map active, on la décharge
        if (currentMapUrl === mapItem.file) {
            onUnloadMap();
        }
    };

    // ---- SYNC export/import ----
    const buildFull = () =>
        (window.__exportState?.()) ?? ({
            tokens, drawings, overlayTiles, currentMapUrl, activeId, combatMode, remainingSpeedById,
            __version: 1, __when: Date.now(),
        });

    const tryClipboardModern = async (text) => {
        await navigator.clipboard.writeText(text);
    };

    const tryClipboardLegacy = (text) => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        ta.style.pointerEvents = "none";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand(copy) failed");
    };

    const exportAll = async () => {
        try {
            const full = buildFull();
            const json = JSON.stringify(full);
            const b64 = btoa(unescape(encodeURIComponent(json)));

            try {
                await tryClipboardModern(b64);
                alert("État copié dans le presse-papier ✅\nColle le code sur l'autre appareil (Importer).");
                return;
            } catch { }

            try {
                tryClipboardLegacy(b64);
                alert("État copié dans le presse-papier ✅ (mode compatibilité)\nColle le code sur l'autre appareil (Importer).");
                return;
            } catch { }

            setCopyB64(b64);
            setCopyJson(json);
            setCopyOpen(true);
        } catch (e) {
            console.error(e);
            alert("Export impossible (erreur inconnue).");
        }
    };

    const importAll = async () => {
        const raw = prompt("Colle ici le code d'état exporté depuis l'autre appareil :");
        if (!raw) return;
        try {
            const text = raw.trim();
            const jsonStr = text.startsWith("{") ? text : decodeURIComponent(escape(atob(text)));
            const data = JSON.parse(jsonStr);
            dispatch({ type: "IMPORT_FULL_STATE", payload: data });
            try { window.__castSnapshot?.(); } catch { }
            alert("État importé ✔︎");
        } catch (e) {
            console.error(e);
            alert("Code invalide. Vérifie que tu as bien collé l'état complet.");
        }
    };

    const selectAndCopyInModal = () => {
        try {
            const el = taRef.current;
            if (!el) return;
            el.focus();
            el.select();
            const ok = document.execCommand("copy");
            if (ok) alert("Copié ✔︎");
        } catch { }
    };

    const downloadJson = () => {
        try {
            const blob = new Blob([copyJson || "{}"], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const date = new Date().toISOString().replace(/[:.]/g, "-");
            a.download = `jdr-state-${date}.jdr.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert("Téléchargement impossible.");
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    position: "fixed",
                    right: open ? 380 : 12,
                    top: 12,
                    zIndex: 10001,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #333",
                    background: "#1e1e1e",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "18px",
                    touchAction: "manipulation",
                    minHeight: "44px",
                }}
                aria-label={open ? "Fermer le panneau" : "Ouvrir le panneau"}
            >
                {open ? "⇥" : "≡"}
            </button>

            <aside
                style={{
                    position: "fixed",
                    right: 0, top: 0, bottom: 0,
                    width: open ? 380 : 0,
                    background: "#0f0f0f",
                    color: "#fff",
                    borderLeft: "1px solid #242424",
                    transition: "width 0.2s ease",
                    overflow: "hidden",
                    zIndex: 10000,
                    display: "grid",
                    gridTemplateRows: "auto 1fr"
                }}
            >
                <div style={{
                    padding: 10, borderBottom: "1px solid #242424", fontWeight: 700,
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8
                }}>
                    <span style={{ fontSize: 15 }}>📦 Dessins & Cartes</span>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={exportAll} style={miniBtn} title="Copier l'état pour l'autre appareil">
                            📤 Exporter
                        </button>
                        <button onClick={importAll} style={miniBtn} title="Importer l'état depuis l'autre appareil">
                            📥 Importer
                        </button>
                    </div>
                </div>

                <div style={{ overflow: "auto", padding: 10, display: "grid", gap: 16 }}>
                    {/* ====== DESSINS ====== */}
                    <section>
                        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8, fontWeight: 600 }}>
                            🎨 Dessins enregistrés ({list.length})
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr", rowGap: "6px" }}>
                            {list.map((d) => (
                                <div
                                    key={d.id}
                                    style={{
                                        border: "1px solid #222",
                                        background: "#141414",
                                        borderRadius: 10,
                                        padding: 8,
                                        display: "grid",
                                        gridTemplateColumns: "110px 1fr auto",
                                        alignItems: "center",
                                        columnGap: 10
                                    }}
                                >
                                    <div
                                        style={{
                                            height: 60,
                                            borderRadius: 8,
                                            background:
                                                "linear-gradient(45deg, rgba(255,255,255,0.07) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.07) 75%)," +
                                                "linear-gradient(45deg, rgba(255,255,255,0.07) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.07) 75%)",
                                            backgroundSize: "10px 10px, 10px 10px",
                                            backgroundPosition: "0 0, 5px 5px",
                                            border: "1px solid #222"
                                        }}
                                        title={`${Array.isArray(d.tiles) ? d.tiles.length : 0} hex peints`}
                                    />

                                    <div style={{ minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis"
                                            }}
                                            title={d.name || "(sans titre)"}
                                        >
                                            {d.name || "(sans titre)"}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                                            {new Date(d.createdAt || Date.now()).toLocaleString()} —{" "}
                                            {Array.isArray(d.tiles) ? d.tiles.length : 0} cases
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <button onClick={() => onLoadDrawingToMap(d)} style={btn} title="Charger ce dessin sur la carte">
                                            📍 Charger
                                        </button>
                                        <button onClick={() => onDeleteDrawing(d.id)} style={dangerBtn} title="Supprimer ce dessin">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {list.length === 0 && (
                                <div style={{ fontSize: 12, color: "#aaa", padding: 10, textAlign: "center" }}>
                                    Aucun dessin enregistré.
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 10 }}>
                            <button
                                onClick={() => { dispatch({ type: "OVERLAY_SET", tiles: [] }); castOverlay([]); }}
                                style={secBtn}
                                title="Retirer les dessins chargés"
                            >
                                🧹 Décharger les dessins
                            </button>
                        </div>
                    </section>

                    {/* ====== CARTES ====== */}
                    <section>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 600 }}>
                                🗺️ Cartes ({mapsList.length})
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={handleUploadClick} style={uploadBtn} title="Uploader une nouvelle carte">
                                    ➕ Upload
                                </button>
                                <button onClick={onUnloadMap} style={secBtn} title="Décharger la carte">
                                    🧹 Décharger
                                </button>
                            </div>
                        </div>

                        {/* Input caché pour upload */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                        />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr", rowGap: "6px" }}>
                            {mapsList.map((m, idx) => (
                                <div
                                    key={m.file + idx}
                                    style={{
                                        border: "1px solid #222",
                                        background: currentMapUrl === (m.type === "static" ? `/Maps/${m.file}` : m.file) ? "#1a2618" : "#141414",
                                        borderRadius: 10,
                                        padding: 8,
                                        display: "grid",
                                        gridTemplateColumns: "110px 1fr auto",
                                        alignItems: "center",
                                        columnGap: 10
                                    }}
                                >
                                    <div style={{ height: 60, borderRadius: 8, overflow: "hidden", border: "1px solid #222", background: "#000" }}>
                                        <img
                                            src={m.type === "static" ? `/Maps/${m.file}` : m.file}
                                            alt={m.name || "Carte"}
                                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                        />
                                    </div>

                                    <div style={{ minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis"
                                            }}
                                            title={m.name || m.file}
                                        >
                                            {m.type === "uploaded" && "📤 "}
                                            {m.name || m.file}
                                        </div>
                                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                                            {currentMapUrl === (m.type === "static" ? `/Maps/${m.file}` : m.file) ? "✅ Chargée" : "\u00A0"}
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <button onClick={() => onLoadMap(m)} style={btn} title="Charger cette carte">
                                            📍 Charger
                                        </button>
                                        {m.type === "uploaded" && (
                                            <button onClick={() => deleteUploadedMap(m)} style={dangerBtn} title="Supprimer cette carte uploadée">
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {mapsList.length === 0 && (
                                <div style={{ fontSize: 12, color: "#aaa", padding: 10, textAlign: "center" }}>
                                    Aucune carte disponible.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </aside>

            {/* ---- Modal fallback copie ---- */}
            <Modal
                open={copyOpen}
                onClose={() => setCopyOpen(false)}
                title="Copie manuelle de l'état"
                footer={
                    <>
                        <button onClick={() => setCopyOpen(false)} style={secBtn}>Fermer</button>
                        <button onClick={selectAndCopyInModal} style={btn}>Sélectionner & Copier</button>
                        <button onClick={downloadJson} style={btn}>Télécharger (.jdr.json)</button>
                    </>
                }
            >
                <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                    Ton navigateur a bloqué l'accès au presse-papier. Copie ce code puis importe-le sur l'autre appareil
                    (ou utilise le bouton "Télécharger").
                </p>
                <textarea
                    ref={taRef}
                    readOnly
                    value={copyB64}
                    style={{
                        width: "100%",
                        height: 180,
                        resize: "vertical",
                        borderRadius: 10,
                        border: "1px solid #2a2a2a",
                        background: "#121212",
                        color: "#ddd",
                        padding: 10,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                        fontSize: 12,
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                />
            </Modal>
        </>
    );
}

const miniBtn = {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #2a2a2a",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
    touchAction: "manipulation",
    minHeight: "40px",
};

const btn = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #2a2a2a",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
    touchAction: "manipulation",
    minHeight: "40px",
};

const secBtn = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #333",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
    touchAction: "manipulation",
    minHeight: "40px",
};

const uploadBtn = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #2c4",
    background: "#18ff9b",
    color: "#000",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
    touchAction: "manipulation",
    minHeight: "40px",
};

const dangerBtn = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #703",
    background: "#a02",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
    touchAction: "manipulation",
    minHeight: "36px",
};