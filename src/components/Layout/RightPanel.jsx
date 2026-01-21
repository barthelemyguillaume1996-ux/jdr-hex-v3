import React, { useMemo, useState } from 'react';
import { useAppState, useAppDispatch } from '../../state/StateProvider';
import CreateTokenModal from '../Modals/CreateTokenModal';
import { importCharactersAsTokens } from '../../firebase/characterService';

export default function RightPanel() {
    const { ui, tokens } = useAppState();
    const dispatch = useAppDispatch();
    const isOpen = ui?.rightPanelOpen;

    const [modalType, setModalType] = useState(null); // 'character' | 'monster' | 'pnj' | null
    const [editingToken, setEditingToken] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState(null);

    // Firebase Import Handler - Smart Update
    const performSmartMerge = (newTokens) => {
        let addedCount = 0;
        let updatedCount = 0;

        newTokens.forEach(newToken => {
            // Check if this character already exists (by Firebase metadata OR Name fallback)
            let existingToken = tokens.find(t =>
                t.firebaseUserId === newToken.firebaseUserId &&
                t.firebaseCharacterIndex === newToken.firebaseCharacterIndex
            );

            // Fallback: Link by Name if not found (prevents duplication of legacy tokens)
            if (!existingToken) {
                existingToken = tokens.find(t => t.name === newToken.name && t.type === 'character');
            }

            if (existingToken) {
                // Update existing token (preserve position and deployment status)
                dispatch({
                    type: 'UPDATE_TOKEN',
                    id: existingToken.id,
                    changes: {
                        name: newToken.name,
                        hp: newToken.hp,
                        maxHp: newToken.maxHp,
                        initiative: newToken.initiative,
                        speed: newToken.speed,
                        class: newToken.class,
                        level: newToken.level,
                        ac: newToken.ac,
                        // Keep position and deployment status
                        // q, r, isDeployed stay the same

                        // Overwrite conditions from Firebase (Master Source)
                        conditions: newToken.conditions || [],
                    }
                });
                updatedCount++;
            } else {
                // Add new token
                dispatch({ type: 'ADD_TOKEN', payload: newToken });
                addedCount++;
            }
        });
        return { addedCount, updatedCount };
    };

    const handleFirebaseImport = async () => {
        setIsImporting(true);
        setImportError(null);

        try {
            const characters = await importCharactersAsTokens();
            const { addedCount, updatedCount } = performSmartMerge(characters);

            const message = `✅ Import terminé !\n${addedCount} nouveau(x) personnage(s)\n${updatedCount} personnage(s) mis à jour`;
            alert(message);
        } catch (error) {
            console.error('Import error:', error);
            setImportError(error.message);
            alert(`❌ Erreur d'import: ${error.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    // --- Auto Sync Logic ---
    const [isSyncing, setIsSyncing] = useState(false);

    React.useEffect(() => {
        let unsubscribe = null;
        if (isSyncing) {
            import('../../firebase/characterService').then(mod => {
                unsubscribe = mod.subscribeToAllCharacters((tokens) => {
                    performSmartMerge(tokens);
                });
            });
        }
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isSyncing, tokens]); // Re-run if tokens change to ensure fresh state for smart merge? No, tokens are in closure if not careful.
    // Actually, dispatch is stable. But we need access to 'tokens' state for 'performSmartMerge'.
    // `tokens` dependency might cause re-subscription loop if not handled well.
    // Better Approach: performSmartMerge shouldn't depend on stale `tokens`. 
    // BUT we need to find existingToken from `tokens`.
    // We can use functional update for dispatch? No, we need to read to compare.

    // REFACTOR: performSmartMerge needs FRESH tokens.
    // Since this is inside a component, `tokens` changes on every render.
    // If we add `tokens` to dep array, we re-subscribe on every update -> FLICKER.

    // SOLUTION: Use a Ref for tokens to avoid re-subscribing.
    const tokensRef = React.useRef(tokens);
    React.useEffect(() => { tokensRef.current = tokens; }, [tokens]);

    React.useEffect(() => {
        let unsubscribe = null;

        if (isSyncing) {
            import('../../firebase/characterService').then(mod => {
                unsubscribe = mod.subscribeToAllCharacters((newTokens) => {
                    // Use Ref inside callback to always get fresh tokens without re-subscribing
                    const currentTokens = tokensRef.current;

                    newTokens.forEach(newToken => {
                        let existingToken = currentTokens.find(t =>
                            t.firebaseUserId === newToken.firebaseUserId &&
                            t.firebaseCharacterIndex === newToken.firebaseCharacterIndex
                        );

                        // Fallback: Link by Name
                        if (!existingToken) {
                            existingToken = currentTokens.find(t => t.name === newToken.name && t.type === 'character');
                        }

                        if (existingToken) {
                            dispatch({
                                type: 'UPDATE_TOKEN',
                                id: existingToken.id,
                                changes: {
                                    name: newToken.name,
                                    hp: newToken.hp,
                                    maxHp: newToken.maxHp,
                                    initiative: newToken.initiative,
                                    speed: newToken.speed,
                                    class: newToken.class,
                                    level: newToken.level,
                                    ac: newToken.ac,
                                    // Overwrite conditions from Firebase
                                    conditions: newToken.conditions || [],

                                    // Update metadata to link legacy tokens
                                    firebaseUserId: newToken.firebaseUserId,
                                    firebaseCharacterIndex: newToken.firebaseCharacterIndex
                                }
                            });
                        } else {
                            dispatch({ type: 'ADD_TOKEN', payload: newToken });
                        }
                    });
                });
            });
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isSyncing]); // Depend ONLY on isSyncing toggle

    // --- Computed Data ---
    const sortedTokens = useMemo(() => {
        return [...(tokens || [])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }, [tokens]);

    if (!isOpen) {
        return (
            <button
                onClick={() => dispatch({ type: 'TOGGLE_UI_PANEL', panel: 'rightPanelOpen' })}
                className="fixed right-4 top-14 p-2 bg-surface border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors z-50">
                «
            </button>
        );
    }

    return (
        <>
            <aside className="fixed right-0 top-10 bottom-0 w-80 bg-surface border-l border-white/10 flex flex-col z-40 shadow-2xl animate-in slide-in-from-right-20 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-end items-center bg-black/20">
                    <button
                        onClick={() => dispatch({ type: 'TOGGLE_UI_PANEL', panel: 'rightPanelOpen' })}
                        className="p-1 hover:bg-white/10 rounded text-white/60">
                        »
                    </button>
                </div>

                {/* Content Scrollable */}
                <div className="flex-1 overflow-y-auto p-3 space-y-6">

                    {/* TOKENS SECTION */}
                    <section className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-semibold text-white/40 uppercase tracking-wider">
                            <span>Jetons ({sortedTokens.length})</span>
                            {sortedTokens.length > 20 && (
                                <button
                                    onClick={() => {
                                        if (confirm(`Nettoyer les doublons ? (${sortedTokens.length} jetons actuels)`)) {
                                            dispatch({ type: 'DEDUPLICATE_TOKENS' });
                                        }
                                    }}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-900/30 px-2 py-1 rounded transition-colors"
                                >
                                    🧹 Nettoyer
                                </button>
                            )}
                        </div>

                        {sortedTokens.length === 0 && (
                            <div className="text-center p-4 text-white/20 text-xs italic border border-dashed border-white/10 rounded">
                                Aucun jeton
                            </div>
                        )}

                        <div className="space-y-2">
                            {sortedTokens.map(t => (
                                <div key={t.id} className="group p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all flex items-center gap-3 relative">
                                    {/* Avatar */}
                                    <div
                                        className="w-9 h-9 rounded bg-black/40 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors"
                                        style={{ backgroundColor: t.color }}
                                        onClick={() => setEditingToken(t)}
                                    >
                                        {t.img ? <img src={t.img} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/50">{t.name[0]}</span>}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 pointer-events-none">
                                        <div className="text-sm font-medium text-white truncate">{t.name}</div>
                                        <div className="text-[10px] text-white/40 flex gap-2">
                                            <span>Init: {t.initiative}</span>
                                            <span>•</span>
                                            <span>Vitesse: {t.speed || 30}m</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        {/* Deploy Toggle */}
                                        <button
                                            onClick={() => dispatch({ type: 'UPDATE_TOKEN', id: t.id, changes: { isDeployed: !t.isDeployed } })}
                                            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${t.isDeployed ? 'text-green-400 hover:bg-green-500/10' : 'text-white/20 hover:text-white hover:bg-white/10'}`}
                                            title={t.isDeployed ? "Sur le plateau" : "En réserve"}
                                        >
                                            {t.isDeployed ? '📍' : '💤'}
                                        </button>

                                        {/* Edit */}
                                        <button
                                            onClick={() => setEditingToken(t)}
                                            className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                                            title="Modifier"
                                        >
                                            ✏️
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={() => {
                                                if (confirm(`Supprimer ${t.name} ?`)) {
                                                    dispatch({ type: 'DELETE_TOKEN', id: t.id });
                                                }
                                            }}
                                            className="w-7 h-7 rounded flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Supprimer"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Footer / Create Buttons */}
                <div className="p-4 border-t border-white/10 bg-black/20 space-y-3">
                    {/* Firebase Import Button */}
                    <button
                        onClick={handleFirebaseImport}
                        disabled={isImporting}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-orange-500/20 to-yellow-500/20 hover:from-orange-500/30 hover:to-yellow-500/30 border border-orange-500/30 hover:border-orange-500/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-lg group-hover:scale-110 transition-transform">{isImporting ? '⏳' : '📥'}</span>
                        <span className="text-xs text-orange-200 font-medium uppercase tracking-wide">
                            {isImporting ? 'Import en cours...' : 'Importer depuis Firebase'}
                        </span>
                    </button>

                    {/* Auto Sync Toggle */}
                    <button
                        onClick={() => setIsSyncing(!isSyncing)}
                        className={`w-full flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${isSyncing
                            ? 'bg-green-500/20 border-green-500 text-green-200 hover:bg-green-500/30'
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                            }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                        <span className="text-xs font-medium uppercase tracking-wide">
                            {isSyncing ? 'Synchronisation Active' : 'Activer Synchro Live'}
                        </span>
                    </button>

                    {/* Create Buttons */}
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setModalType('character')}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface hover:bg-white/5 border border-white/10 hover:border-primary/50 transition-all group">
                            <span className="text-xl group-hover:scale-110 transition-transform">👤</span>
                            <span className="text-[10px] text-white/50 group-hover:text-primary uppercase tracking-wide">Perso</span>
                        </button>
                        <button
                            onClick={() => setModalType('pnj')}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface hover:bg-white/5 border border-white/10 hover:border-emerald-500/50 transition-all group">
                            <span className="text-xl group-hover:scale-110 transition-transform">🧙</span>
                            <span className="text-[10px] text-white/50 group-hover:text-emerald-400 uppercase tracking-wide">PNJ</span>
                        </button>
                        <button
                            onClick={() => setModalType('monster')}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface hover:bg-white/5 border border-white/10 hover:border-red-500/50 transition-all group">
                            <span className="text-xl group-hover:scale-110 transition-transform">👹</span>
                            <span className="text-[10px] text-white/50 group-hover:text-red-400 uppercase tracking-wide">Monstre</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Modals */}
            {(modalType || editingToken) && (
                <CreateTokenModal
                    type={modalType || editingToken?.type}
                    initialToken={editingToken}
                    onClose={() => {
                        setModalType(null);
                        setEditingToken(null);
                    }}
                />
            )}
        </>
    );
}
