import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../state/StateProvider';

export default function InitiativeModal({ tokens, onClose }) {
    const dispatch = useAppDispatch();
    const [initiatives, setInitiatives] = useState({});

    // Initialize with current values ONLY ONCE on mount
    useEffect(() => {
        const init = {};
        tokens.forEach(t => {
            init[t.id] = t.initiative !== undefined && t.initiative !== 0 ? t.initiative : '';
        });
        setInitiatives(init);
    }, []); // Empty dependency array - only run once on mount

    const handleSubmit = () => {
        // Update all tokens with new initiatives (convert empty to 0)
        Object.entries(initiatives).forEach(([tokenId, initiative]) => {
            const initValue = initiative === '' ? 0 : Number(initiative);
            dispatch({ type: 'UPDATE_TOKEN', id: tokenId, changes: { initiative: initValue } });
        });

        // Enable combat mode
        dispatch({ type: 'SET_MODE', mode: 'combatMode', value: true });

        // Set first token as active (highest initiative)
        const sortedTokens = tokens.sort((a, b) => {
            const aInit = initiatives[a.id] === '' ? 0 : Number(initiatives[a.id]);
            const bInit = initiatives[b.id] === '' ? 0 : Number(initiatives[b.id]);
            return bInit - aInit;
        });
        if (sortedTokens.length > 0) {
            dispatch({ type: 'SET_MODE', mode: 'activeTokenId', value: sortedTokens[0].id });
        }

        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-surface border border-white/20 rounded-xl p-6 w-96 max-h-[80vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-white mb-4">
                    ⚔️ Initiatives de Combat
                </h3>

                <div className="space-y-3 mb-6">
                    {tokens.map(t => (
                        <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                            <div
                                className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden flex-shrink-0"
                                style={{ borderColor: t.color, backgroundColor: t.color }}
                            >
                                {t.img ? (
                                    <img src={t.img} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white font-bold opacity-50">
                                        {t.name[0]}
                                    </div>
                                )}
                            </div>
                            <span className="flex-1 text-white text-sm font-medium">{t.name}</span>
                            <input
                                type="number"
                                value={initiatives[t.id] === '' ? '' : initiatives[t.id]}
                                onChange={e => {
                                    const val = e.target.value;
                                    setInitiatives({ ...initiatives, [t.id]: val === '' ? '' : Number(val) });
                                }}
                                className="w-20 bg-black/20 border border-white/10 rounded p-2 text-white text-center focus:border-primary/50 outline-none"
                                placeholder="0"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-white/10 rounded text-white/70 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-primary hover:bg-primary-400 text-white rounded font-medium transition-colors"
                    >
                        Démarrer le Combat
                    </button>
                </div>
            </div>
        </div>
    );
}
