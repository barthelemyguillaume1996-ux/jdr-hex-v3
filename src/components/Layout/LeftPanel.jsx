import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '../../state/StateProvider';
import InitiativeModal from '../Modals/InitiativeModal';
import DrawingNameInput from './DrawingNameInput';

export default function LeftPanel() {
    const { ui, maps, currentMapUrl, drawings, overlayTiles, draftOverlayTiles, tokens } = useAppState();
    const dispatch = useAppDispatch();
    const isOpen = ui?.leftPanelOpen;

    const fileInputRef = useRef(null);
    const saveInputRef = useRef(null);
    const [uploadedMaps, setUploadedMaps] = useState([]);
    const [showInitiativeModal, setShowInitiativeModal] = useState(false);

    // --- Computed Data ---
    const mapsList = useMemo(() => {
        const staticMaps = Array.isArray(maps) ? maps.map(m => {
            if (typeof m === "string") return { file: m, name: m.replace(/\.(webp|png|jpg|jpeg)$/i, ""), type: "static" };
            return { file: m.file, name: m.name || m.file, type: "static" };
        }) : [];
        return [...uploadedMaps, ...staticMaps];
    }, [maps, uploadedMaps]);

    const sortedDrawings = useMemo(
        () => (Array.isArray(drawings) ? drawings.slice().sort((a, b) => b.createdAt - a.createdAt) : []),
        [drawings]
    );

    // --- Actions ---
    const handleMapImport = () => fileInputRef.current?.click();
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setUploadedMaps(prev => [{
                file: reader.result,
                name: file.name.replace(/\.[^.]+$/, ""),
                type: "uploaded"
            }, ...prev]);
        };
        reader.readAsDataURL(file);
    };

    const onLoadDrawingToMap = (d) => {
        if (!d || !Array.isArray(d.tiles)) return;
        dispatch({ type: "OVERLAY_SET", tiles: d.tiles });
    };

    const onDeleteDrawing = (id) => {
        if (!id) return;
        if (!confirm("Supprimer ce dessin définitivement ?")) return;
        dispatch({ type: "DELETE_DRAWING", id });
    };

    // Memoized callback to prevent DrawingNameInput re-renders
    const handleDrawingSave = useCallback((name) => {
        const tilesToSave = (draftOverlayTiles && draftOverlayTiles.length > 0) ? draftOverlayTiles : overlayTiles;
        dispatch({ type: "ADD_DRAWING", payload: { name, tiles: tilesToSave } });
        setTimeout(() => alert(`Dessin "${name}" sauvegardé !`), 100);
    }, [draftOverlayTiles, overlayTiles, dispatch]);

    const handleCombatToggle = () => {
        if (!ui.combatMode) {
            // Entering combat mode: show initiative modal
            const deployedTokens = tokens.filter(t => t.isDeployed);
            if (deployedTokens.length > 0) {
                setShowInitiativeModal(true);
            } else {
                // No tokens, just enable combat
                dispatch({ type: 'SET_MODE', mode: 'combatMode', value: true });
            }
        } else {
            // Exiting combat mode
            dispatch({ type: 'SET_MODE', mode: 'combatMode', value: false });
            dispatch({ type: 'SET_MODE', mode: 'activeTokenId', value: null });
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => dispatch({ type: 'TOGGLE_UI_PANEL', panel: 'leftPanelOpen' })}
                className="fixed left-4 top-14 p-2 bg-surface border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors z-50">
                »
            </button>
        );
    }

    return (
        <aside className="fixed left-0 top-10 bottom-0 w-80 bg-surface border-r border-white/10 flex flex-col z-40 shadow-2xl animate-in slide-in-from-left-20 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                <h2 className="font-bold text-lg text-white/90">Outils</h2>
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_UI_PANEL', panel: 'leftPanelOpen' })}
                    className="p-1 hover:bg-white/10 rounded text-white/60">
                    «
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* 1. Modes */}
                <section className="space-y-2">
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Modes</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleCombatToggle}
                            className={`p-3 rounded-lg text-sm font-medium transition-all border ${ui.combatMode
                                ? 'bg-red-500/20 border-red-500/50 text-red-200'
                                : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            ⚔️ Combat {ui.combatMode ? 'ON' : 'OFF'}
                        </button>
                        <button
                            onClick={() => dispatch({ type: 'SET_MODE', mode: 'drawMode', value: !ui.drawMode })}
                            className={`p-3 rounded-lg text-sm font-medium transition-all border ${ui.drawMode
                                ? 'bg-primary/20 border-primary/50 text-blue-200'
                                : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                                }`}>
                            ✏️ Dessin {ui.drawMode ? 'ON' : 'OFF'}
                        </button>
                        <div className="flex gap-1 col-span-1">
                            <button
                                onClick={() => dispatch({ type: 'SET_MODE', mode: 'pencilMode', value: !ui.pencilMode })}
                                className={`flex-1 p-3 rounded-lg text-sm font-medium transition-all border ${ui.pencilMode
                                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-200 shadow-[0_0_10px_rgba(255,0,255,0.3)]'
                                    : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                                    }`}>
                                🖍️ Crayon {ui.pencilMode ? 'ON' : 'OFF'}
                            </button>
                            {/* Always visible Clear Pencil Button if Pencil Mode is active */}
                            {ui.pencilMode && (
                                <button
                                    onClick={() => {
                                        if (confirm("Effacer tous les croquis (crayon) ?")) {
                                            dispatch({ type: 'CLEAR_PENCIL' });
                                        }
                                    }}
                                    className="p-3 w-12 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-all flex items-center justify-center"
                                    title="Effacer les croquis">
                                    🗑️
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => window.api.openPlayerView()}
                            className="col-span-2 p-3 rounded-lg text-sm font-medium transition-all border bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white">
                            📺 Ouvrir Vue Joueur
                        </button>
                    </div>

                    {/* Palette for Drawing Mode */}
                    {/* Palette for Drawing Mode */}
                    {ui.drawMode && (
                        <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">

                            {/* SECTION: SOLS */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] uppercase text-white/40 font-bold tracking-widest">Sols & Terrains</h4>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: "herbe", name: "Herbe", color: "#4ade80" },
                                        { id: "terre", name: "Terre", color: "#78350f" },
                                        { id: "pierre", name: "Pierre", color: "#9ca3af" },
                                        { id: "pave", name: "Pavé", color: "#4b5563" },
                                        { id: "eau", name: "Eau", color: "#3b82f6" },
                                        { id: "sable", name: "Sable", color: "#fcd34d" },
                                        { id: "bois", name: "Bois", color: "#92400e" },
                                        { id: "neige", name: "Neige", color: "#f3f4f6" },
                                        { id: "lave", name: "Lave", color: "#ef4444" },
                                        { id: "route", name: "Route", color: "#4b5563" },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => dispatch({ type: 'SET_BRUSH', payload: { type: 'tile', texture: t.id, color: t.color } })}
                                            className={`group relative aspect-square rounded-lg border-2 transition-all overflow-hidden ${ui.currentBrush?.texture === t.id ? 'border-primary ring-2 ring-primary/50' : 'border-white/10 hover:border-white/40'
                                                }`}
                                            title={t.name}
                                        >
                                            <div
                                                className="absolute inset-0 bg-cover bg-center"
                                                style={{ backgroundImage: `url('./textures/${t.id}.png')`, backgroundColor: t.color }} // Uses uploaded assets
                                            />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* SECTION: OBJETS */}
                            <div className="space-y-2">
                                <h4 className="text-[10px] uppercase text-white/40 font-bold tracking-widest">Objets 3D</h4>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: "mur", name: "Mur", color: "#57534e" },
                                        { id: "mur_bois", name: "Mur Bois", color: "#78350f" },
                                        { id: "coffre", name: "Coffre", color: "#b45309" },
                                        { id: "arbre", name: "Arbre", color: "#166534" },
                                        { id: "rocher", name: "Rocher", color: "#57534e" },
                                        { id: "table", name: "Table", color: "#78350f" },
                                        { id: "tonneau", name: "Tonneau", color: "#92400e" },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => dispatch({ type: 'SET_BRUSH', payload: { type: 'tile', texture: t.id, color: t.color } })}
                                            className={`group relative aspect-square rounded-lg border-2 transition-all overflow-hidden ${ui.currentBrush?.texture === t.id ? 'border-primary ring-2 ring-primary/50' : 'border-white/10 hover:border-white/40'
                                                }`}
                                            title={t.name}
                                        >
                                            <div
                                                className="absolute inset-0 bg-cover bg-center"
                                                style={{ backgroundImage: `url('./textures/${t.id}.png')`, backgroundColor: t.color }}
                                            />
                                            {/* Icon Overlay for Objects */}
                                            <div className="absolute bottom-1 right-1 text-[10px] bg-black/50 rounded px-1 text-white/80">3D</div>
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2 border-t border-white/10 mt-2">
                                {/* Brush Size */}
                                <div className="flex items-center gap-2 text-xs text-white/60">
                                    <span>Taille:</span>
                                    <input
                                        type="range"
                                        min="1" max="4" step="1"
                                        value={ui.currentBrush?.size || 1}
                                        onChange={(e) => dispatch({ type: 'SET_BRUSH_SIZE', size: parseInt(e.target.value) })}
                                        className="w-full accent-primary h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="w-4 text-center">{ui.currentBrush?.size || 1}</span>
                                </div>

                                {/* Tools: Eraser, Clear Draft, Publish */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => dispatch({ type: 'SET_BRUSH', payload: { type: 'eraser' } })}
                                        className={`p-2 rounded border text-xs flex items-center justify-center gap-1 ${ui.currentBrush?.type === 'eraser'
                                            ? 'bg-red-500/20 border-red-500 text-red-200'
                                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                            }`}
                                    >
                                        🧼 Gomme
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (confirm("Vider le brouillon (votre vue) ?")) {
                                                dispatch({ type: "DRAFT_CLEAR" });
                                            }
                                        }}
                                        className="p-2 rounded border border-white/10 bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-400 text-xs"
                                        title="Vider mon brouillon"
                                    >
                                        🗑️ Brouillon
                                    </button>
                                </div>

                                <button
                                    onClick={() => {
                                        // Move Draft to Public
                                        // We need access to draftOverlayTiles here.
                                        // Since we can't get it easily via dispatch, we rely on the component having it.
                                        // We added draftOverlayTiles to useAppState in LeftPanel? We need to checking.
                                        // Assuming we have it.
                                        // Dispatch OVERLAY_MERGE with draft tiles, then CLEAR DRAFT.
                                        if (!draftOverlayTiles || draftOverlayTiles.length === 0) return;
                                        if (confirm("Publier votre dessin aux joueurs ?")) {
                                            dispatch({ type: "OVERLAY_MERGE", tiles: draftOverlayTiles });
                                            dispatch({ type: "DRAFT_CLEAR" });
                                        }
                                    }}
                                    disabled={!draftOverlayTiles || draftOverlayTiles.length === 0}
                                    className="w-full p-2 bg-primary/20 hover:bg-primary/40 border border-primary/50 text-blue-200 rounded text-xs font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    🌍 Publier
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* 1.5. Zoom Control */}
                <section className="space-y-2 pt-4 border-t border-white/5">
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Zoom</h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0.1"
                                max="3"
                                step="0.1"
                                value={ui.zoom || 1}
                                onChange={(e) => {
                                    const zoom = parseFloat(e.target.value);
                                    dispatch({ type: 'SET_ZOOM', zoom });
                                }}
                                className="flex-1 accent-primary h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-white/60 w-12 text-right">
                                {Math.round((ui.zoom || 1) * 100)}%
                            </span>
                        </div>
                        <button
                            onClick={() => dispatch({ type: 'SET_ZOOM', zoom: 1 })}
                            className="w-full p-2 rounded-lg text-xs font-medium transition-all border bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                        >
                            🔄 Réinitialiser (100%)
                        </button>
                    </div>
                </section>

                {/* 2. Maps Section */}
                <section className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center text-xs font-semibold text-white/40 uppercase tracking-wider">
                        <span>Cartes ({mapsList.length})</span>
                        <div className="flex gap-2">
                            <button onClick={handleMapImport} className="text-primary hover:text-primary-300 transition-colors" title="Ajouter une carte">➕</button>
                            <button onClick={() => dispatch({ type: 'SET_CURRENT_MAP', url: null })} className="text-white/30 hover:text-white transition-colors" title="Retirer la carte">🧹</button>
                        </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

                    <div className="grid grid-cols-2 gap-2">
                        {mapsList.map((m, idx) => {
                            const url = m.type === "static" ? `/Maps/${m.file}` : m.file;
                            const isActive = currentMapUrl === url;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => dispatch({ type: 'SET_CURRENT_MAP', url })}
                                    className={`group relative aspect-video rounded-lg overflow-hidden border cursor-pointer transition-all ${isActive ? 'border-primary ring-1 ring-primary' : 'border-white/10 hover:border-white/30'}`}
                                >
                                    <img src={url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[10px] text-white truncate px-2 backdrop-blur-sm">
                                        {m.name}
                                    </div>
                                    {m.type === 'uploaded' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('Supprimer cette carte ?')) setUploadedMaps(p => p.filter(x => x !== m));
                                            }}
                                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-red-500 rounded text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 3. Drawings Section */}
                <section className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center text-xs font-semibold text-white/40 uppercase tracking-wider">
                        <span>Dessins ({sortedDrawings.length})</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (confirm("Tout effacer (Carte Publique) ?")) {
                                        dispatch({ type: "OVERLAY_SET", tiles: [] });
                                    }
                                }}
                                className="text-white/30 hover:text-red-400 transition-colors"
                                title="Tout effacer (Public)"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>

                    <DrawingNameInput onSave={handleDrawingSave} />

                    <div className="space-y-2">
                        {sortedDrawings.length === 0 && <div className="text-white/20 text-xs italic text-center">Aucun dessin</div>}
                        {sortedDrawings.map((d) => (
                            <div key={d.id} className="group p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between">
                                <div className="text-sm text-white/80 truncate w-full" title={d.name}>{d.name || "Sans titre"}</div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            if (confirm("Charger ce dessin (Fusionner avec la carte) ?")) {
                                                dispatch({ type: "OVERLAY_MERGE", tiles: d.tiles });
                                            }
                                        }}
                                        className="p-1 hover:bg-white/20 rounded"
                                        title="Charger (Fusionner)"
                                    >📍</button>
                                    <button onClick={() => onDeleteDrawing(d.id)} className="p-1 hover:bg-red-500/20 text-red-400 rounded" title="Supprimer">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* DEBUG FOOTER */}
            <div className="absolute bottom-1 left-2 text-[10px] text-white/20 select-none flex gap-2">
                <span>v3.0.1</span>
            </div>

            {/* Initiative Modal */}
            {showInitiativeModal && (
                <InitiativeModal
                    tokens={tokens.filter(t => t.isDeployed)}
                    onClose={() => setShowInitiativeModal(false)}
                />
            )}
        </aside>
    );
}
