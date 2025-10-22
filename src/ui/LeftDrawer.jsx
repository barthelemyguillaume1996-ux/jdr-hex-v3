import React, { useMemo, useState, useEffect } from "react";
import { useAppDispatch, useAppState } from "../state/StateProvider";
import Modal from "./Modal";

/* ---------- Layout ---------- */
const LAYOUT = {
    drawerW: 340,
    rowH: "1cm",
    col: { avatar: 30, label: 24, initInput: 26, speedInput: 26, button: 28 },
    gap: 20, padX: 8, nameMin: 50, nameMax: 50
};

/* Races PNJ + images par défaut */
const RACES = ["demi-elfe", "demi-orc", "drakeide", "elfe", "gnome", "halfelin", "humain", "nain", "tieffelin", "dragon"];
const raceBase = (race) => `/PNJ/${race}`;
const MONSTER_BASE = "/PNJ/monstre";
const MONSTER_DEFAULT_IMG = `${MONSTER_BASE}.png`; // 👈 on force .png pour les monstres

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
    const { tokens, combatMode } = useAppState();
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

    return (
        <>
            {/* Poignée */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    position: "fixed",
                    left: open ? LAYOUT.drawerW : 12,
                    top: 12,
                    zIndex: 40,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #333",
                    background: "#1e1e1e",
                    color: "#fff",
                    cursor: "pointer"
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
                    background: "#0f0f0f", color: "#fff",
                    borderRight: "1px solid #242424",
                    transition: "width 0.2s ease",
                    overflow: "hidden",
                    zIndex: 30,
                    display: "grid",
                    gridTemplateRows: "auto auto auto 1fr"
                }}
            >
                {/* Titre + Vue joueurs + Combat */}
                <div
                    style={{
                        padding: 8,
                        borderBottom: "1px solid #242424",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8
                    }}
                >
                    <span>LeftDrawer</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                            onClick={() => {
                                const base = window.location.href.split("#")[0].split("?")[0];
                                window.open(`${base}?viewer=1`, "jdr-viewer", "noopener,noreferrer,width=1280,height=800");
                            }}
                            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #333", background: "#1b1b1b", color: "#fff", cursor: "pointer", fontSize: 12 }}
                            title="Ouvrir la vue joueurs"
                        >
                            Vue joueurs
                        </button>
                        <button
                            onClick={() => dispatch({ type: "SET_COMBAT_MODE", value: !combatMode })}
                            style={{
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: combatMode ? "1px solid #2c4" : "1px solid #333",
                                background: combatMode ? "#18ff9b" : "#1b1b1b",
                                color: combatMode ? "#000" : "#fff",
                                cursor: "pointer",
                                fontSize: 12
                            }}
                            title="Activer/Désactiver le mode combat"
                        >
                            {combatMode ? "Combat : ON" : "Combat : OFF"}
                        </button>
                    </div>
                </div>

                {/* Boutons création */}
                <div style={{ padding: 8, display: "grid", gap: 6, borderBottom: "1px solid #242424" }}>
                    <button style={btn} onClick={() => setShowChar(true)}>Créer un personnage</button>
                    <button style={btn} onClick={() => setShowPNJ(true)}>Créer un PNJ</button>
                    <button style={btn} onClick={() => setShowMonster(true)}>Créer un monstre</button>
                    <button style={{ ...btn, background: "#1d2733", borderColor: "#2c3e50" }} onClick={() => setShowEdit(true)}>
                        Modifier / Supprimer
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

    return (
        <div style={{ overflow: "auto", padding: 0, display: "grid", gap: 0 }}>
            <div style={{ opacity: 0.7, fontSize: 10, padding: "4px 8px" }}>
                Tri : <b>Initiative ↓</b> — édition <b>initiative</b> et <b>vitesse</b>
            </div>

            {tokens.map(t => (
                <div key={t.id} style={row1cm}>
                    <Avatar token={t} />
                    <div style={nameOneLine} title={t.name || ""}>{t.name || "Sans nom"}</div>

                    <div style={miniLabel}>Init</div>
                    <input
                        type="number"
                        inputMode="numeric"
                        style={colInputInit}
                        value={Number.isFinite(t.initiative) ? t.initiative : 0}
                        onChange={(e) => dispatch({
                            type: "PATCH_TOKEN",
                            id: t.id,
                            patch: { initiative: Number.isNaN(+e.target.value) ? 0 : +e.target.value }
                        })}
                    />

                    <div style={miniLabel}>Vit.</div>
                    <input
                        style={colInputSpeed}
                        value={t.speed ?? ""}
                        onChange={(e) => dispatch({ type: "PATCH_TOKEN", id: t.id, patch: { speed: e.target.value } })}
                        placeholder=""
                    />

                    <button
                        onClick={() => dispatch({ type: "PATCH_TOKEN", id: t.id, patch: { isDeployed: !t.isDeployed } })}
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

/* ==== Avatar avec fallback d’extensions ==== */
function Avatar({ token }) {
    const size = LAYOUT.col.avatar;
    const src = token.img || "";
    const hasExt = /\.\w{3,4}$/.test(src);
    const isUrl = /^(blob:|data:|https?:)/.test(src);

    const box = { ...avatarBox(size), objectFit: "cover" };

    if (!src) return <div style={{ ...avatarBox(size), background: "#222", border: "1px solid #333" }} />;

    if (isUrl || hasExt) {
        return <img src={src} alt="" style={box} onError={(e) => (e.currentTarget.style.display = "none")} />;
    }

    // Base sans extension -> webp -> png -> jpg -> jpeg
    return (
        <picture>
            <source srcSet={`${src}.webp`} type="image/webp" />
            <source srcSet={`${src}.png`} type="image/png" />
            <source srcSet={`${src}.jpg`} type="image/jpeg" />
            <img
                src={`${src}.jpeg`}
                alt=""
                style={box}
                onError={(e) => (e.currentTarget.style.display = "none")}
            />
        </picture>
    );
}

function ArrowIcon({ direction = "down" }) {
    const rot = direction === "up" ? 180 : 0;
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/* -------------------- Modal édition / suppression -------------------- */
function EditEntityModal({ open, onClose }) {
    const { tokens } = useAppState();
    const dispatch = useAppDispatch();

    const [selectedId, setSelectedId] = useState("");
    const [name, setName] = useState("");

    useEffect(() => {
        if (!open) return;
        const first = tokens[0];
        if (first) {
            setSelectedId(first.id);
            setName(first.name || "");
        } else {
            setSelectedId("");
            setName("");
        }
    }, [open, tokens]);

    useEffect(() => {
        const t = tokens.find(tt => tt.id === selectedId);
        setName(t?.name || "");
    }, [selectedId, tokens]);

    const canUpdate = selectedId && name.trim().length > 0;
    const onSave = () => {
        if (!canUpdate) return;
        dispatch({ type: "PATCH_TOKEN", id: selectedId, patch: { name: name.trim() } });
        onClose?.();
    };
    const onDelete = () => {
        if (!selectedId) return;
        if (!confirm("Supprimer définitivement ce personnage ?")) return;
        dispatch({ type: "DELETE_TOKEN", id: selectedId });
        onClose?.();
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
                    <button onClick={onDelete} style={dangerBtn}>Supprimer</button>
                    <button onClick={onClose} style={secBtn}>Fermer</button>
                    <button onClick={onSave} disabled={!canUpdate} style={{ ...priBtn, opacity: canUpdate ? 1 : 0.5 }}>
                        Enregistrer
                    </button>
                </>
            }
        >
            <label style={label}>Choisir un personnage</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={input}>
                {options.map(o => (
                    <option key={o.id} value={o.id}>{o.name || "(Sans nom)"} — {o.type}</option>
                ))}
            </select>

            <label style={label}>Nouveau nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" style={input} />
        </Modal>
    );
}

/* -------------------- Modale création Personnage -------------------- */
function CreateCharacterModal({ open, onClose }) {
    const dispatch = useAppDispatch();
    const [name, setName] = useState(""); // ← si tu as une erreur ici, supprime ce mot
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
                name: name.trim(), type: "pc", img: preview, cellRadius: 1,
                initiative: 0, speed: "", q: 0, r: 0, isDeployed: true
            }
        });
        onClose?.();
        setName(""); setPreview("");
    };

    return (
        <Modal open={open} onClose={onClose} title="Créer un personnage" footer={
            <>
                <button onClick={onClose} style={secBtn}>Annuler</button>
                <button onClick={create} disabled={!canCreate} style={{ ...priBtn, opacity: canCreate ? 1 : 0.5 }}>Créer</button>
            </>
        }>
            <label style={label}>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du personnage" style={input} />
            <label style={label}>Image</label>
            <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} />
            <div style={previewBox}>
                {preview ? <img src={preview} alt="Aperçu" style={avatarImg} /> : <div style={{ color: "#777" }}>Aperçu (aucune image)</div>}
            </div>
        </Modal>
    );
}

/* -------------------- Modale création PNJ -------------------- */
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
                // ⬇️ tu peux mettre `${imgBase}.png` si tu veux forcer une extension
                name: name.trim(), type: "npc", img: imgBase, cellRadius: 1,
                initiative: 0, speed: "", q: 0, r: 0, isDeployed: true
            }
        });
        onClose?.(); setName("");
    };

    return (
        <Modal open={open} onClose={onClose} title="Créer un PNJ" footer={
            <>
                <button onClick={onClose} style={secBtn}>Annuler</button>
                <button onClick={create} disabled={!canCreate} style={{ ...priBtn, opacity: canCreate ? 1 : 0.5 }}>Créer</button>
            </>
        }>
            <label style={label}>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du PNJ" style={input} />
            <label style={label}>Race</label>
            <select value={race} onChange={(e) => setRace(e.target.value)} style={input}>
                {RACES.map(r => <option key={r} value={r}>{r}</option>)}
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

/* -------------------- Modale création Monstre -------------------- */
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
                img: MONSTER_DEFAULT_IMG,   // 👈 image avec extension
                cellRadius: 1,
                initiative: 0,
                speed: "",
                q: 0, r: 0,
                isDeployed: true
            }
        });
        onClose?.(); setName("");
    };

    return (
        <Modal open={open} onClose={onClose} title="Créer un monstre" footer={
            <>
                <button onClick={onClose} style={secBtn}>Annuler</button>
                <button onClick={create} disabled={!canCreate} style={{ ...priBtn, opacity: canCreate ? 1 : 0.5 }}>Créer</button>
            </>
        }>
            <div style={previewBox}>
                <picture>
                    {/* on met .png en priorité pour matcher MONSTER_DEFAULT_IMG */}
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


/* ---------- styles ---------- */
const btn = { padding: "8px 10px", borderRadius: 8, border: "1px solid #2a2a2a", background: "#1b1b1b", color: "#fff", cursor: "pointer", textAlign: "left", fontSize: 13 };

const row1cm = { display: "grid", gridTemplateColumns: GRID_TEMPLATE, alignItems: "center", columnGap: LAYOUT.gap, rowGap: 0, padding: `0 ${LAYOUT.padX}px`, background: "#141414", borderBottom: "1px solid #202020", height: LAYOUT.rowH, boxSizing: "border-box", overflow: "hidden" };

const nameOneLine = { fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: 0.95 };

const miniLabel = { fontSize: 10, opacity: 0.7, textAlign: "right" };

const baseInput = { height: 26, padding: "2px 6px", borderRadius: 6, border: "1px solid #2a2a2a", background: "#181818", color: "#fff", fontSize: 12 };
const colInputInit = { ...baseInput, width: LAYOUT.col.initInput };
const colInputSpeed = { ...baseInput, width: LAYOUT.col.speedInput };

const deployBtn = { width: LAYOUT.col.button, height: 26, borderRadius: 6, padding: 0, background: "#1b1b1b", color: "#fff", border: "1px solid #2a2a2a", cursor: "pointer", display: "grid", placeItems: "center" };

const label = { fontSize: 13, opacity: 0.9 };
const input = { padding: "10px 12px", borderRadius: 10, border: "1px solid #2a2a2a", background: "#121212", color: "#fff", outline: "none" };
const priBtn = { padding: "8px 12px", borderRadius: 8, border: "1px solid #2c4", background: "#1f3", color: "#000", fontWeight: 700, cursor: "pointer" };
const secBtn = { padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "#1b1b1b", color: "#fff", cursor: "pointer" };
const dangerBtn = { padding: "8px 12px", borderRadius: 8, border: "1px solid #703", background: "#a02", color: "#fff", cursor: "pointer", marginRight: "auto" };

const previewBox = { display: "grid", placeItems: "center", height: 168, background: "#111", borderRadius: 12, border: "1px solid #2a2a2a" };
const avatarImg = { width: 140, height: 140, borderRadius: "50%", objectFit: "cover" };

function avatarBox(sz) { return { width: sz, height: sz, borderRadius: "50%", background: "#222", display: "block" }; }
