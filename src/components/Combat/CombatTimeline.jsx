import React, { useMemo } from 'react';
import { useAppState, useAppDispatch } from '../../state/StateProvider';

export default function CombatTimeline() {
    const { tokens, ui } = useAppState();
    const dispatch = useAppDispatch();
    const combatMode = ui?.combatMode;
    const activeTokenId = ui?.activeTokenId;

    const sortedTokens = useMemo(() => {
        return tokens
            .filter(t => t.isDeployed)
            .sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
    }, [tokens]);

    const handleTokenClick = (tokenId) => {
        dispatch({ type: 'SET_MODE', mode: 'activeTokenId', value: tokenId });
        dispatch({ type: 'RESET_TOKEN_SPEED', id: tokenId });
    };

    const handleNextTurn = () => {
        if (sortedTokens.length === 0) return;

        const currentIndex = sortedTokens.findIndex(t => t.id === activeTokenId);
        const nextIndex = (currentIndex + 1) % sortedTokens.length;
        const nextToken = sortedTokens[nextIndex];

        // Reset speed for the new active token
        dispatch({ type: 'RESET_TOKEN_SPEED', id: nextToken.id });

        // Set as active
        dispatch({ type: 'SET_MODE', mode: 'activeTokenId', value: nextToken.id });
    };

    const isViewer = new URLSearchParams(window.location.search).has("viewer");

    if (!combatMode) return null;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 h-24 bg-surface/90 border border-white/20 rounded-xl shadow-2xl backdrop-blur-md px-4 flex items-center gap-3 z-50 animate-in slide-in-from-top-10 duration-300">
            {sortedTokens.length === 0 && (
                <span className="text-white/40 text-sm">Zone de combat vide</span>
            )}

            {sortedTokens.map((t, index) => (
                <div
                    key={t.id}
                    onClick={() => !isViewer && handleTokenClick(t.id)}
                    className={`relative flex flex-col items-center group cursor-pointer transition-transform hover:scale-110 ${t.id === activeTokenId ? 'scale-110' : ''
                        } ${isViewer ? 'pointer-events-none' : ''}`}
                >
                    {/* Turn Order Badge */}
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-black border border-white/20 text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10 shadow-lg">
                        {t.initiative || 0}
                    </div>

                    {/* Avatar */}
                    <div
                        className={`w-12 h-12 rounded-full border-2 overflow-hidden shadow-md transition-all ${t.id === activeTokenId
                            ? 'border-yellow-400 ring-2 ring-yellow-400/50 shadow-yellow-400/50'
                            : 'border-white/20'
                            }`}
                        style={{
                            borderColor: t.id === activeTokenId ? '#facc15' : t.color,
                            backgroundColor: t.color
                        }}
                    >
                        {t.img ? (
                            <img src={t.img} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold opacity-50 text-lg">
                                {t.name[0]}
                            </div>
                        )}
                    </div>

                    {/* Speed indicator */}
                    <div className="text-[10px] text-white/60 mt-1 font-mono">
                        {t.remainingSpeed !== undefined ? t.remainingSpeed : (t.speed || 30)}/{t.speed || 30}m
                    </div>
                </div>
            ))}

            {/* Next Turn Button - Hidden for players */}
            {!isViewer && sortedTokens.length > 0 && (
                <button
                    onClick={handleNextTurn}
                    className="ml-4 px-4 py-2 bg-primary hover:bg-primary-400 text-white rounded-lg text-sm font-medium transition-colors shadow-lg hover:shadow-xl"
                    title="Passer au tour suivant"
                >
                    ▶ Suivant
                </button>
            )}
        </div>
    );
}
