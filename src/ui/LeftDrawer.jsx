/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/ui/LeftDrawer.jsx - VERSION OPTIMISÉE TABLETTE
import React, { useMemo, useState, useEffect } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import Modal from "./Modal";
import CastBridge from "./CastBridge";

/* ---------- Layout TABLETTE (boutons plus gros) ---------- */
const LAYOUT = {
    drawerW: 380, // 🔧 plus large pour tablette
    rowH: "1.2cm", // 🔧 plus haut pour touch
    col: {
        avatar: 36, // 🔧 avatar plus gros
        label: 28,
        initInput: 32, // 🔧 inputs plus larges
        speedInput: 32,
        button: 36 // 🔧 bouton déployer plus gros
    },
    gap: 22,
    padX: 10,
    nameMin: 60,
    nameMax: 80,
};

/* Races PNJ + images par défaut */
const RACES = [
    "demi-elfe", "demi-orc", "drakeide", "elfe", "gnome",
    "halfelin", "humain", "nain", "tieffelin", "dragon",
];
const raceBase = (race) => `/PNJ/${race}`;
const MONSTER_BASE = "/PNJ/monstre";
const MONSTER_DEFAULT_IMG = `${MONSTER_BASE}.png`;

/* Grille de la liste */
const FIXED_PX =
    LAYOUT.col.avatar + LAYOUT.col.label + LAYOUT.col.initInput +
    LAYOUT.col.label + LAYOUT.col.speedInput + LAYOUT.col.button +
    LAYOUT.gap * 6 + LAYOUT.padX * 2;

const GRID_TEMPLATE =
    `${LAYOUT.col.avatar}px ` +
    `clamp(${LAYOUT.nameMin}px, calc(100% - ${FIXED_PX}px), ${LAYOUT.nameMax}px) ` +
    `${LAYOUT.col.label}px ${LAYOUT.col.initInput}px ` +
    `${LAYOUT.col.label}px ${LAYOUT.col.speedInput}px ${LAYOUT.col.button}px`;

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
            const ia = Number.isFinite(a.initiative) ? a.initiative : 0;
            const ib = Number.isFinite(b.initiative) ? b.initiative : 0;
            if (ib !== ia) return ib - ia;
            return (a.name || "").localeCompare(b.name || "");
        });
    }, [tokens]);

    const openViewer = () => {
        try {
            const base = window.location.href.split("#")[0].split("?")[0];
            const url = `${base}?viewer=1`;
            const w = window.open(url, "jdr-viewer", "noopener,noreferrer,width=1280,height=800");
            if (w) {
                // ✅ Attendre que la fenêtre soit chargée puis envoyer le snapshot
                setTimeout(() => {
                    try { window.__castSnapshot?.(); } catch { }
                }, 500);
            }
        } catch (e) {
            console.error("Erreur ouverture viewer:", e);
            alert("Impossible d'ouvrir la vue joueurs. Vérifie les popups.");
        }
    };

    return (
        <>
            {/* Bridge de diffusion cast — invisible mais toujours monté */}
            <CastBridge />

            {/* Poignée - PLUS GROSSE pour tablette */}
            <button
                onClick={() => setOpen((o) => !o)}
                style={{
                    position: "fixed",
                    left: open ? LAYOUT.drawerW : 12,
                    top: 12,
                    zIndex: 10001,
                    padding: "12px 14px", // 🔧 plus gros
                    borderRadius: 12,
                    border: "1px solid #333",
                    background: "#1e1e1e",
                    color: "#fff",
                    cursor: "pointer",
                    pointerEvents: "auto",
                    fontSize: "18px", // 🔧 icône plus visible
                    touchAction: "manipulation", // 🔧 meilleure réponse tactile
                }}
                aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            >
                {open ? "⇤" : "≡"}
            </button>

            {/* Drawer */}
            <aside
                style={{
                    position: "fixed",
                    left: 0, top: 0, bottom: 0,
                    width: open ? LAYOUT.drawerW : 0,
                    background: "#0f0f0f",
                    color: "#fff",
                    borderRight: "1px solid #242424",
                    transition: "width 0.2s ease",
                    overflow: "hidden",
                    zIndex: 10000,
                    display: "grid",
                    gridTemplateRows: "auto auto auto 1fr",
                    pointerEvents: "auto",
                }}
            >
                {/* En-tête compact - BOUTONS TABLETTE */}
                <div
                    style={{
                        padding: 10,
                        borderBottom: "1px solid #242424",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 8,
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button
                            onClick={openViewer}
                            style={tabletBtn}
                            title="Ouvrir la vue joueurs"
                        >
                            🖥️ Vue joueurs
                        </button>

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
                </div>

                {/* Boutons création - TABLETTE */}
                <div
                    style={{ padding: 10, display: "grid", gap: 8, borderBottom: "1px solid #242424" }}
                >
                    <button style={createBtn} onClick={() => setShowChar(true)}>
                        👤 Créer un personnage
                    </button>
                    <button style={createBtn} onClick={() => setShowPNJ(true)}>
                        🧙 Créer un PNJ
                    </button>
                    <button style={createBtn} onClick={() => setShowMonster(true)}>
                        👹 Créer un monstre
                    </button>
                    <button
                        style={{ ...createBtn, background: "#1d2733", borderColor: "#2c3e50" }}
                        onClick={() => setShowEdit(true)}
                    >
                        ✏️ Modifier / Supprimer
                    </button>
                </div>

                {/* Liste */}
                <EntityList tokens={sorted} />
            </aside>

            {/* Modales */}
            <CreateCharacterModal open={showChar} onClose={() => setShowChar(false)} />
            <CreatePNJModal open={showPNJ} onClose={() => setShowPNJ(false)} />
            <CreateMonsterModal open={showMonster} onClose={() => setShowMonster(false)} />
            <EditEntityModal open={showEdit} onClose={() => setShowEdit(false)} />
        </>
    );
}

/* ===== Liste ===== */
function EntityList({ tokens }) {
    const dispatch = useAppDispatch();
    const castNow = () => { try { window.__castSnapshot?.(); } catch { } };

    return (
        <div style={{ overflow: "auto", padding: 0, display: "grid", gap: 0 }}>
            <div style={{ opacity: 0.7, fontSize: 11, padding: "6px 10px", background: "#0a0a0a" }}>
                📊 Tri : <b>Initiative ↓</b> — édition rapide
            </div>

            {tokens.map((t) => (
                <div key={t.id} style={row1cm}>
                    <Avatar token={t} />
                    <div style={nameOneLine} title={t.name || ""}>{t.name || "Sans nom"}</div>

                    <div style={miniLabel}>Init</div>
                    <input
                        type="number"
                        inputMode="numeric"
                        style={colInputInit}
                        value={Number.isFinite(t.initiative) ? t.initiative : 0}
                        onChange={(e) => {
                            const value = Number.isNaN(+e.target.value) ? 0 : +e.target.value;
                            dispatch({ type: "PATCH_TOKEN", id: t.id, patch: { initiative: value } });
                            castNow();
                        }}
                    />

                    <div style={miniLabel}>Vit.</div>
                    <input
                        style={colInputSpeed}
                        value={t.speed ?? ""}
                        onChange={(e) => {
                            dispatch({ type: "PATCH_TOKEN", id: t.id, patch: { speed: e.target.value } });
                            castNow();
                        }}
                        placeholder=""
                    />

                    <button
                        onClick={() => {
                            dispatch({ type: "PATCH_TOKEN", id: t.id, patch: { isDeployed: !t.isDeployed } });
                            castNow();
                        }}
                        aria-label={t.isDeployed ? "Retirer de la carte" : "Déployer sur la carte"}
                        title={t.isDeployed ? "Retirer de la carte" : "Déployer sur la carte"}
                        style={deployBtn}
                    >
                        <ArrowIcon direction={t.isDeployed ? "up" : "down"} />
                    </button>
                </div>
            ))}
        </div>
    );
}

/* ==== Avatar ==== */
function Avatar({ token }) {
    const size = LAYOUT.col.avatar;
    const src = token.img || "";
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
            <img src={`${src}.jpeg`} alt="" style={box} onError={(e) => (e.currentTarget.style.display = "none")} />
        </picture>
    );
}

function ArrowIcon({ direction = "down" }) {
    const rot = direction === "up" ? 180 : 0;
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/* -------------------- Modales (identiques mais avec inputs plus gros) -------------------- */
function EditEntityModal({ open, onClose }) {
    const { tokens } = useAppState();
    const dispatch = useAppDispatch();

    const [selectedId, setSelectedId] = useState("");
    const [name, setName] = useState("");

    useEffect(() => {
        if (!open) return;
        const first = tokens[0];
        if (first) { setSelectedId(first.id); setName(first.name || ""); }
        else { setSelectedId(""); setName(""); }
    }, [open, tokens]);

    useEffect(() => {
        const t = tokens.find((tt) => tt.id === selectedId);
        setName(t?.name || "");
    }, [selectedId, tokens]);

    const canUpdate = selectedId && name.trim().length > 0;
    const onSave = () => {
        if (!canUpdate) return;
        dispatch({ type: "PATCH_TOKEN", id: selectedId, patch: { name: name.trim() } });
        onClose?.(); try { window.__castSnapshot?.(); } catch { }
    };
    const onDelete = () => {
        if (!selectedId) return;
        if (!confirm("Supprimer définitivement ce personnage ?")) return;
        dispatch({ type: "DELETE_TOKEN", id: selectedId });
        onClose?.(); try { window.__castSnapshot?.(); } catch { }
    };

    const options = useMemo(
        () => [...tokens].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
        [tokens]
    );

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
        </Modal>
    );
}

function CreateCharacterModal({ open, onClose }) {
    const dispatch = useAppDispatch();
    const [name, setName] = useState("");
    const [preview, setPreview] = useState("");

    const onFile = (f) => {
        if (!f) return setPreview("");
        const reader = new FileReader();
        reader.onload = () => setPreview(String(reader.result || ""));
        reader.readAsDataURL(f);
    };

    const canCreate = name.trim().length > 0;

    const create = () => {
        if (!canCreate) return;
        dispatch({
            type: "ADD_TOKEN",
            payload: {
                name: name.trim(),
                type: "pc",
                img: preview,
                cellRadius: 1,
                initiative: 0,
                speed: "",
                q: 0, r: 0,
                isDeployed: true,
            },
        });
        onClose?.();
        setName(""); setPreview("");
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
            <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} style={fileInput} />
            <div style={previewBox}>
                {preview ? (<img src={preview} alt="Aperçu" style={avatarImg} />) : (<div style={{ color: "#777" }}>Aperçu (aucune image)</div>)}
            </div>
        </Modal>
    );
}

function CreatePNJModal({ open, onClose }) {
    const dispatch = useAppDispatch();
    const [name, setName] = useState("");
    const [race, setRace] = useState(RACES[0]);

    const imgBase = useMemo(() => raceBase(race), [race]);
    const canCreate = name.trim().length > 0;

    const create = () => {
        if (!canCreate) return;
        dispatch({
            type: "ADD_TOKEN",
            payload: {
                name: name.trim(),
                type: "npc",
                img: imgBase,
                cellRadius: 1,
                initiative: 0,
                speed: "",
                q: 0, r: 0,
                isDeployed: true,
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
            <label style={label}>Race</label>
            <select value={race} onChange={(e) => setRace(e.target.value)} style={input}>
                {RACES.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
            <div style={previewBox}>
                <picture>
                    <source srcSet={`${imgBase}.webp`} type="image/webp" />
                    <source srcSet={`${imgBase}.png`} type="image/png" />
                    <source srcSet={`${imgBase}.jpg`} type="image/jpeg" />
                    <img src={`${imgBase}.jpeg`} alt={"Aperçu " + race} style={avatarImg} />
                </picture>
            </div>
        </Modal>
    );
}

function CreateMonsterModal({ open, onClose }) {
    const dispatch = useAppDispatch();
    const [name, setName] = useState("");

    const canCreate = name.trim().length > 0;

    const create = () => {
        if (!canCreate) return;
        dispatch({
            type: "ADD_TOKEN",
            payload: {
                name: name.trim(),
                type: "monster",
                img: MONSTER_DEFAULT_IMG,
                cellRadius: 1,
                initiative: 0,
                speed: "",
                q: 0, r: 0,
                isDeployed: true,
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
            title="Créer un monstre"
            footer={
                <>
                    <button onClick={onClose} style={secBtn}>Annuler</button>
                    <button onClick={create} disabled={!canCreate} style={{ ...priBtn, opacity: canCreate ? 1 : 0.5 }}>✅ Créer</button>
                </>
            }
        >
            <div style={previewBox}>
                <picture>
                    <source srcSet={`${MONSTER_BASE}.png`} type="image/png" />
                    <source srcSet={`${MONSTER_BASE}.webp`} type="image/webp" />
                    <source srcSet={`${MONSTER_BASE}.jpg`} type="image/jpeg" />
                    <img src={`${MONSTER_BASE}.jpeg`} alt="Aperçu monstre (défaut)" style={avatarImg} />
                </picture>
            </div>
            <label style={label}>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du monstre" style={input} />
        </Modal>
    );
}

/* ---------- styles TABLETTE (touch-friendly) ---------- */
const tabletBtn = {
    padding: "10px 14px", // 🔧 plus gros
    borderRadius: 8,
    border: "1px solid #333",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13, // 🔧 texte plus lisible
    fontWeight: 500,
    pointerEvents: "auto",
    touchAction: "manipulation",
    minHeight: "44px", // 🔧 zone tactile Apple recommandée
};

const createBtn = {
    padding: "12px 14px", // 🔧 plus gros
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 14,
    fontWeight: 500,
    touchAction: "manipulation",
    minHeight: "48px",
};

const row1cm = {
    display: "grid",
    gridTemplateColumns: GRID_TEMPLATE,
    alignItems: "center",
    columnGap: LAYOUT.gap,
    rowGap: 0,
    padding: `0 ${LAYOUT.padX}px`,
    background: "#141414",
    borderBottom: "1px solid #202020",
    height: LAYOUT.rowH,
    boxSizing: "border-box",
    overflow: "hidden",
};

const nameOneLine = {
    fontSize: 13, // 🔧 plus gros
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    opacity: 0.95
};

const miniLabel = { fontSize: 11, opacity: 0.7, textAlign: "right" };

const baseInput = {
    height: 32, // 🔧 plus haut
    padding: "4px 8px",
    borderRadius: 8,
    border: "1px solid #2a2a2a",
    background: "#181818",
    color: "#fff",
    fontSize: 14, // 🔧 texte plus gros
    touchAction: "manipulation",
};

const colInputInit = { ...baseInput, width: LAYOUT.col.initInput };
const colInputSpeed = { ...baseInput, width: LAYOUT.col.speedInput };

const deployBtn = {
    width: LAYOUT.col.button,
    height: 32,
    borderRadius: 8,
    padding: 0,
    background: "#1b1b1b",
    color: "#fff",
    border: "1px solid #2a2a2a",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    touchAction: "manipulation",
};

const label = { fontSize: 14, opacity: 0.9, fontWeight: 500 };

const input = {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#121212",
    color: "#fff",
    outline: "none",
    fontSize: 15,
    minHeight: "48px",
    touchAction: "manipulation",
};

const fileInput = {
    padding: "10px",
    borderRadius: 10,
    border: "1px solid #2a2a2a",
    background: "#121212",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
    touchAction: "manipulation",
};

const priBtn = {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #2c4",
    background: "#1f3",
    color: "#000",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    minHeight: "48px",
    touchAction: "manipulation",
};

const secBtn = {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #333",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    minHeight: "48px",
    touchAction: "manipulation",
};

const dangerBtn = {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #703",
    background: "#a02",
    color: "#fff",
    cursor: "pointer",
    marginRight: "auto",
    fontSize: 14,
    fontWeight: 600,
    minHeight: "48px",
    touchAction: "manipulation",
};

const previewBox = {
    display: "grid",
    placeItems: "center",
    height: 180,
    background: "#111",
    borderRadius: 12,
    border: "1px solid #2a2a2a"
};

const avatarImg = {
    width: 150,
    height: 150,
    borderRadius: "50%",
    objectFit: "cover"
};

function avatarBox(sz) {
    return {
        width: sz,
        height: sz,
        borderRadius: "50%",
        background: "#222",
        display: "block",
        border: "2px solid #2a2a2a",
    };
}