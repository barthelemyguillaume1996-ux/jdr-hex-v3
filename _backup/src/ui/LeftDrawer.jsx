/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/ui/LeftDrawer.jsx - VERSION OPTIMISÉE TABLETTE
import React, { useMemo, useState, useEffect } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import Modal from "./Modal";
import { pixelToAxialRounded } from "../core/hexMath";
import { BASE_HEX_RADIUS, HEX_SCALE } from "../core/boardConfig";
import CastBridge from "./CastBridge";

const HEX_RADIUS = BASE_HEX_RADIUS * HEX_SCALE;

/* ---------- Layout TABLETTE (boutons plus gros) ---------- */
const LAYOUT = {
    drawerW: 380,
    rowH: "1.2cm",
    col: { avatar: 36, label: 28, initInput: 28, speedInput: 28, button: 32 },
    gap: 18,
    nameMax: 60,
};

const FIXED_PX =
    LAYOUT.col.avatar +
    LAYOUT.col.label +
    LAYOUT.col.initInput +
    LAYOUT.col.label +
    LAYOUT.col.speedInput +
    LAYOUT.col.button +
    LAYOUT.gap * 5 +
    8 * 2;

const GRID_TEMPLATE =
    `8px ${LAYOUT.col.avatar}px clamp(50px, calc(100% - ${FIXED_PX}px), ${LAYOUT.nameMax}px) ` +
    `${LAYOUT.col.label}px ${LAYOUT.col.initInput}px ` +
    `${LAYOUT.col.label}px ${LAYOUT.col.speedInput}px ${LAYOUT.col.button}px`;

/* ---------- Styles partagés (scope module) ---------- */
const tabletBtn = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #333",
    background: "#1b1b1b",
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
};
const createBtn = { ...tabletBtn, fontWeight: 600, background: "#1f2937", borderColor: "#2c3e50" };
const dangerBtn = { ...tabletBtn, background: "#3b1e1e", borderColor: "#5b2b2b", color: "#ffbaba" };
const secBtn = { ...tabletBtn };
const priBtn = { ...tabletBtn, background: "#224a3a", borderColor: "#2b6b50" };
const label = { color: "#aaa", fontSize: 13, marginTop: 10, marginBottom: 6 };
const input = {
    appearance: "none",
    background: "#161616",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: 10,
    height: 36,
    padding: "0 10px",
    outline: "none",
    width: "100%",
};

export default function LeftDrawer() {
    const { tokens, combatMode, drawMode } = useAppState();
    const dispatch = useAppDispatch();

    const [open, setOpen] = useState(true);
    const [showChar, setShowChar] = useState(false);
    const [showPNJ, setShowPNJ] = useState(false);
    const [showMonster, setShowMonster] = useState(false);
    const [showEdit, setShowEdit] = useState(false);

    const sorted = useMemo(() => {
        return [...tokens].sort((a, b) => {
            const A = (a.name || "").toLowerCase();
            const B = (b.name || "").toLowerCase();
            return A < B ? -1 : A > B ? 1 : 0;
        });
    }, [tokens]);

    useEffect(() => {
        try {
            if (!open) return;
            const key = (e) => { if (e.key === "Escape") setOpen(false); };
            window.addEventListener("keydown", key);
            return () => window.removeEventListener("keydown", key);
        } catch { }
    }, [open]);

    const onClose = () => setOpen(false);

    useEffect(() => {
        setOpen(window.innerWidth >= 700);
        const fn = () => setOpen(window.innerWidth >= 700);
        window.addEventListener("resize", fn);
        return () => window.removeEventListener("resize", fn);
    }, []);

    function castNow() { try { window.__castSnapshot?.(); } catch { } }

    return (
        <>
            {/* Bridge de diffusion cast — invisible mais toujours monté */}
            <CastBridge />

            {/* Poignée */}
            <button
                onClick={() => setOpen((o) => !o)}
                style={{
                    position: "fixed",
                    left: open ? LAYOUT.drawerW : 12,
                    top: 12,
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: "1px solid #333",
                    color: "#fff",
                    background: "#1b1b1b",
                    zIndex: 50,
                }}
                title={open ? "Fermer" : "Ouvrir le tiroir"}
            >
                {open ? "«" : "»"}
            </button>

            <div
                style={{
                    position: "fixed",
                    left: 0, top: 0, bottom: 0,
                    width: open ? LAYOUT.drawerW : 0,
                    transition: "width .15s ease",
                    overflow: "hidden",
                    background: "#0f0f0f",
                    borderRight: "1px solid #171717",
                    zIndex: 40,
                }}
            >
                {/* Header */}
                <div style={{ padding: 10, borderBottom: "1px solid #242424" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={() => {
                                dispatch({ type: "SET_COMBAT_MODE", value: !combatMode });
                                try { window.__castSnapshot?.(); } catch { }
                            }}
                            style={{
                                ...tabletBtn,
                                border: combatMode ? "2px solid #2c4" : "1px solid #333",
                                background: combatMode ? "#18ff9b" : "#1b1b1b",
                                color: combatMode ? "#000" : "#fff",
                                fontWeight: combatMode ? 700 : 500,
                            }}
                            title="Activer/Désactiver le mode combat"
                        >
                            ⚔️ Combat {combatMode ? "ON" : "OFF"}
                        </button>

                        <button
                            onClick={() => {
                                dispatch({ type: "SET_DRAW_MODE", value: !drawMode });
                                try { window.__castSnapshot?.(); } catch { }
                            }}
                            style={{
                                ...tabletBtn,
                                border: drawMode ? "2px solid #2c4" : "1px solid #333",
                                background: drawMode ? "#18ff9b" : "#1b1b1b",
                                color: drawMode ? "#000" : "#fff",
                                fontWeight: drawMode ? 700 : 500,
                            }}
                            title="Activer/Désactiver le mode dessin (workspace)"
                        >
                            ✏️ Dessin {drawMode ? "ON" : "OFF"}
                        </button>
                    </div>

                    <div style={{ marginTop: 8 }}>
                        <button
                            onClick={() => {
                                const url = window.location.origin + window.location.pathname + "?viewer";
                                window.open(url, "_blank");
                            }}
                            style={{
                                ...tabletBtn,
                                width: "100%",
                                background: "#4a4a4a",
                            }}
                            title="Ouvrir la vue joueur dans un nouvel onglet"
                        >
                            👁️ Ouvrir Vue Joueur
                        </button>
                    </div>
                </div>

                {/* Boutons création */}
                <div style={{ padding: 10, display: "grid", gap: 8, borderBottom: "1px solid #242424" }}>
                    <button style={createBtn} onClick={() => setShowChar(true)}>👤 Créer un personnage</button>
                    <button style={createBtn} onClick={() => setShowPNJ(true)}>🧙 Créer un PNJ</button>
                    <button style={createBtn} onClick={() => setShowMonster(true)}>👹 Créer un monstre</button>
                    <button style={{ ...createBtn, background: "#1d2733", borderColor: "#2c3e50" }} onClick={() => setShowEdit(true)}>
                        ✏️ Modifier / Supprimer
                    </button>
                </div>

                {/* Liste */}
                <EntityList tokens={sorted} />
            </div>

            {/* Modaux */}
            <CreateCharModal open={showChar} onClose={() => setShowChar(false)} />
            <CreatePNJModal open={showPNJ} onClose={() => setShowPNJ(false)} />
            <CreateMonsterModal open={showMonster} onClose={() => setShowMonster(false)} />
            <EditModal open={showEdit} onClose={() => setShowEdit(false)} />
        </>
    );
}

/* -------------------- Sous-composants -------------------- */

function EntityList({ tokens }) {
    const dispatch = useAppDispatch();

    const Row = ({ t }) => {
        const deployBtn = {
            width: LAYOUT.col.button,
            height: LAYOUT.rowH,
            borderRadius: 12,
            background: "#1b1b1b",
            border: "1px solid #333",
            color: "#fff",
            cursor: "pointer",
        };

        return (
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: GRID_TEMPLATE,
                    alignItems: "center",
                    gap: LAYOUT.gap,
                    height: LAYOUT.rowH,
                    padding: "0 8px",
                    borderBottom: "1px solid #161616",
                }}
            >
                <Avatar src={t.img} size={LAYOUT.col.avatar} />
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#eee", fontSize: 15 }} title={t.name || ""}>
                    {t.name || ""}
                </div>

                <span style={{ color: "#aaa", textAlign: "right" }}>Init</span>
                <input
                    type="number"
                    style={{ ...input, width: LAYOUT.col.initInput }}
                    value={t.initiative || 0}
                    onChange={(e) => {
                        dispatch({ type: "PATCH_TOKEN", id: t.id, patch: { initiative: +e.target.value || 0 } });
                        try { window.__castSnapshot?.(); } catch { }
                    }}
                />

                <span style={{ color: "#aaa", textAlign: "right" }}>Vitesse</span>
                <input
                    type="text"
                    style={{ ...input, width: LAYOUT.col.speedInput }}
                    value={t.speed || ""}
                    onChange={(e) => {
                        dispatch({ type: "PATCH_TOKEN", id: t.id, patch: { speed: e.target.value } });
                        try { window.__castSnapshot?.(); } catch { }
                    }}
                    placeholder=""
                />

                <button
                    onClick={() => {
                        const deploy = !t.isDeployed;
                        const patch = { isDeployed: deploy };
                        if (deploy) {
                            try {
                                const c = window.__cameraCenter;
                                if (c && Number.isFinite(+c.tx) && Number.isFinite(+c.ty)) {
                                    const { q: cq, r: cr } = pixelToAxialRounded(c.tx, c.ty, HEX_RADIUS);
                                    patch.q = cq; patch.r = cr; // ✅ centre écran
                                } else { patch.q = 0; patch.r = 0; }
                            } catch { patch.q = 0; patch.r = 0; }
                        }
                        dispatch({ type: "PATCH_TOKEN", id: t.id, patch });
                        try { window.__castSnapshot?.(); } catch { }
                    }}
                    aria-label={t.isDeployed ? "Retirer de la carte" : "Déployer sur la carte"}
                    title={t.isDeployed ? "Retirer de la carte" : "Déployer sur la carte"}
                    style={deployBtn}
                >
                    <ArrowIcon direction={t.isDeployed ? "up" : "down"} />
                </button>
            </div>
        );
    };

    return (
        <div style={{ overflowY: "auto", height: "calc(100% - 180px)" }}>
            {tokens.map((t) => (<Row key={t.id} t={t} />))}
        </div>
    );
}

function Avatar({ src, size = 32 }) {
    const hasExt = /\.\w{3,4}$/.test(src);
    const isUrl = /^(blob:|data:|https?:)/.test(src);
    const box = { ...avatarBox(size), objectFit: "cover" };

    if (!src) return (<div style={{ ...avatarBox(size), background: "#222", border: "1px solid #333" }} />);

    if (isUrl || hasExt) {
        return <img src={src} alt="" style={box} onError={(e) => (e.currentTarget.style.display = "none")} />;
    }

    return (
        <picture>
            <source srcSet={`${src}.webp`} type="image/webp" />
            <source srcSet={`${src}.png`} type="image/png" />
            <source srcSet={`${src}.jpg`} type="image/jpeg" />
            <img src={`${src}.png`} alt="" style={box} />
        </picture>
    );
}

function avatarBox(size) {
    return { width: size, height: size, borderRadius: 10, border: "1px solid #333", background: "#111" };
}

/* -------------------- Modaux -------------------- */

function CreateCharModal({ open, onClose }) {
    const dispatch = useAppDispatch();

    const [name, setName] = useState("");
    const [preview, setPreview] = useState("");

    const onFile = (file) => {
        try {
            if (!file) { setPreview(""); return; }
            const r = new FileReader();
            r.onload = () => setPreview(r.result + "");
            r.readAsDataURL(file);
        } catch { }
    };

    const canCreate = name.trim().length > 0;

    const create = () => {
        if (!canCreate) return;
        dispatch({
            type: "ADD_TOKEN",
            payload: {
                name: name.trim(),
                img: preview || "",
                isDeployed: true,
                q: 0, r: 0,
                initiative: 0,
                speed: "",
                cellRadius: 1,
            },
        });
        onClose?.();
        setName("");
        try { window.__castSnapshot?.(); } catch { }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Créer un personnage"
            footer={
                <>
                    <button onClick={onClose} style={secBtn}>Annuler</button>
                    <button onClick={create} disabled={!canCreate} style={{ ...priBtn, opacity: canCreate ? 1 : 0.5 }}>✅ Créer</button>
                </>
            }
        >
            <label style={label}>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du personnage" style={input} />
            <label style={label}>Image</label>
            <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} style={input} />
            <div style={{ marginTop: 8 }}>
                {preview ? (
                    <img src={preview} alt="Aperçu" style={{ width: "100%", maxHeight: 200, objectFit: "contain", border: "1px solid #333", borderRadius: 8 }} />
                ) : (
                    <div style={{ border: "1px dashed #333", borderRadius: 8, padding: 12, color: "#777", textAlign: "center" }}>Aucune image</div>
                )}
            </div>
        </Modal>
    );
}

function CreatePNJModal({ open, onClose }) {
    const dispatch = useAppDispatch();
    const [name, setName] = useState("");
    const [img, setImg] = useState("");

    const canCreate = name.trim().length > 0;

    const create = () => {
        if (!canCreate) return;
        dispatch({
            type: "ADD_TOKEN",
            payload: {
                name: name.trim(),
                img: img || "",
                isDeployed: true,
                q: 0, r: 0,
                initiative: 0,
                speed: "",
                cellRadius: 1,
            },
        });
        onClose?.();
        setName("");
        try { window.__castSnapshot?.(); } catch { }
    };

    const options = ["/PNJ/demi-elfe", "/PNJ/demi-orc", "/PNJ/elfe", "/PNJ/humaine", "/PNJ/nain", "/PNJ/orc", "/PNJ/tieffelin", "/PNJ/dragon"];

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Créer un PNJ"
            footer={
                <>
                    <button onClick={onClose} style={secBtn}>Annuler</button>
                    <button onClick={create} disabled={!canCreate} style={{ ...priBtn, opacity: canCreate ? 1 : 0.5 }}>✅ Créer</button>
                </>
            }
        >
            <label style={label}>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du PNJ" style={input} />

            <label style={label}>Image (bibliothèque)</label>
            <select value={img} onChange={(e) => setImg(e.target.value)} style={input}>
                <option value="">(aucune)</option>
                {options.map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>

            <div style={{ marginTop: 8 }}>
                {img ? (<Avatar src={img} size={96} />) : (
                    <div style={{ border: "1px dashed #333", borderRadius: 8, padding: 12, color: "#777", textAlign: "center" }}>Aucune image</div>
                )}
            </div>
        </Modal>
    );
}

function CreateMonsterModal({ open, onClose }) {
    const dispatch = useAppDispatch();

    const [name, setName] = useState("");
    const [preview, setPreview] = useState("");
    const [radius, setRadius] = useState(1);

    const onFile = (file) => {
        try {
            if (!file) { setPreview(""); return; }
            const r = new FileReader();
            r.onload = () => setPreview(r.result + "");
            r.readAsDataURL(file);
        } catch { }
    };

    const canCreate = name.trim().length > 0;

    const create = () => {
        if (!canCreate) return;
        const cellRadius = Math.max(1, Math.min(5, +radius || 1));
        dispatch({
            type: "ADD_TOKEN",
            payload: {
                name: name.trim(),
                img: preview || "",
                isDeployed: true,
                q: 0, r: 0,
                initiative: 0,
                speed: "",
                cellRadius,
            },
        });
        onClose?.();
        setName(""); setPreview(""); setRadius(1);
        try { window.__castSnapshot?.(); } catch { }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Créer un monstre"
            footer={
                <>
                    <button onClick={onClose} style={secBtn}>Annuler</button>
                    <button onClick={create} disabled={!canCreate} style={{ ...priBtn, opacity: canCreate ? 1 : 0.5 }}>✅ Créer</button>
                </>
            }
        >
            <label style={label}>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du monstre" style={input} />

            <label style={label}>Image</label>
            <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} style={input} />

            <label style={label}>Taille (rayon en hex)</label>
            <input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} style={input} />

            <div style={{ marginTop: 8 }}>
                {preview ? (
                    <img src={preview} alt="Aperçu" style={{ width: "100%", maxHeight: 200, objectFit: "contain", border: "1px solid #333", borderRadius: 8 }} />
                ) : (
                    <div style={{ border: "1px dashed #333", borderRadius: 8, padding: 12, color: "#777", textAlign: "center" }}>Aucune image</div>
                )}
            </div>
        </Modal>
    );
}

function EditModal({ open, onClose }) {
    const dispatch = useAppDispatch();
    const { tokens } = useAppState();

    const [selectedId, setSelectedId] = useState("");
    const [name, setName] = useState("");
    const [speed, setSpeed] = useState("");
    const [initiative, setInitiative] = useState(0);

    useEffect(() => {
        if (!selectedId) return;
        const t = tokens.find(tt => tt.id === selectedId);
        if (t) {
            setName(t.name || "");
            setSpeed(t.speed || "");
            setInitiative(t.initiative || 0);
        }
    }, [selectedId, tokens]);

    const options = [{ id: "", name: "(choisir)", type: "" }, ...tokens.map(t => ({ id: t.id, name: t.name || "(Sans nom)", type: t.isDeployed ? "déployé" : "retiré" }))];
    const canUpdate = !!selectedId;

    const onDelete = () => {
        if (!selectedId) return;
        if (!confirm("Supprimer ce token ?")) return;
        dispatch({ type: "DELETE_TOKEN", id: selectedId });
        try { window.__castSnapshot?.(); } catch { }
        onClose?.();
    };
    const onSave = () => {
        if (!selectedId) return;
        dispatch({
            type: "PATCH_TOKEN", id: selectedId, patch: {
                name: name.trim(),
                speed: speed || "",
                initiative: +initiative || 0
            }
        });
        try { window.__castSnapshot?.(); } catch { }
        onClose?.();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Modifier / Supprimer"
            footer={
                <>
                    <button onClick={onDelete} style={dangerBtn}>🗑️ Supprimer</button>
                    <button onClick={onClose} style={secBtn}>Fermer</button>
                    <button onClick={onSave} disabled={!canUpdate} style={{ ...priBtn, opacity: canUpdate ? 1 : 0.5 }}>💾 Enregistrer</button>
                </>
            }
        >
            <label style={label}>Choisir un personnage</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={input}>
                {options.map((o) => (<option key={o.id} value={o.id}>{o.name || "(Sans nom)"} — {o.type}</option>))}
            </select>

            <label style={label}>Nouveau nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" style={input} />

            <label style={label}>Vitesse</label>
            <input value={speed} onChange={(e) => setSpeed(e.target.value)} placeholder="ex: 6" style={input} />

            <label style={label}>Initiative</label>
            <input type="number" value={initiative} onChange={(e) => setInitiative(e.target.value)} style={input} />
        </Modal>
    );
}

/* ---------- Icône flèche ---------- */
function ArrowIcon({ direction = "down" }) {
    const rot = direction === "up" ? "rotate(180deg)" : "none";
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ transform: rot }}>
            <path fill="currentColor" d="M12 16l-6-6h12z" />
        </svg>
    );
}
