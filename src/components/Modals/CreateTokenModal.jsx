import React, { useState } from 'react';
import { useAppDispatch } from '../../state/StateProvider';

export default function CreateTokenModal({ type, initialToken = null, onClose }) {
    const dispatch = useAppDispatch();
    const isEditing = !!initialToken;

    const [name, setName] = useState(initialToken?.name || "");
    const [color, setColor] = useState(initialToken?.color || (type === 'monster' ? '#ef4444' : (type === 'pnj' ? '#10b981' : '#3b82f6')));
    const [initiative, setInitiative] = useState(initialToken?.initiative || 0);
    const [speed, setSpeed] = useState(initialToken?.speed || 30);
    const [imagePreview, setImagePreview] = useState(initialToken?.img || null);
    const [quantity, setQuantity] = useState(1);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        if (!name.trim()) return;

        if (isEditing) {
            dispatch({
                type: 'UPDATE_TOKEN',
                id: initialToken.id,
                changes: {
                    name,
                    color,
                    img: imagePreview,
                    initiative: Number(initiative),
                    speed: Number(speed),
                    // type is immutable usually, or we can allow changing it? Let's keep it simple.
                }
            });
        } else {
            // Create multiple tokens if quantity > 1
            for (let i = 0; i < quantity; i++) {
                const tokenName = quantity > 1 ? `${name} ${i + 1}` : name;
                const newToken = {
                    id: crypto.randomUUID(),
                    name: tokenName,
                    color,
                    img: imagePreview,
                    initiative: Number(initiative),
                    speed: Number(speed),
                    type,
                    x: 0,
                    y: 0,
                    q: 0,
                    r: 0,
                    isDeployed: true,
                };
                dispatch({ type: 'ADD_TOKEN', payload: newToken });
            }
        }
        onClose();
    };

    const getTitle = () => {
        const action = isEditing ? 'Modification' : 'Nouveau';
        // Use type from prop or initialToken if editing
        const targetType = isEditing ? initialToken.type : type;

        switch (targetType) {
            case 'monster': return `👹 ${action} Monstre`;
            case 'pnj': return `🧙 ${action} PNJ`;
            default: return `👤 ${action} Personnage`;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-surface border border-white/20 rounded-xl p-6 w-96 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-white mb-4">
                    {getTitle()}
                </h3>

                <div className="space-y-4">
                    {/* Image Upload */}
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-20 h-20 rounded-xl border border-white/20 bg-black/40 overflow-hidden flex items-center justify-center relative group cursor-pointer" style={{ backgroundColor: imagePreview ? 'transparent' : color }}>
                            {imagePreview ? (
                                <img src={imagePreview} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-2xl opacity-50 font-bold">{name[0] || "?"}</span>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                title="Changer l'image"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                                <span className="text-xs text-white">📷</span>
                            </div>
                        </div>
                        <span className="text-xs text-white/40">Clique pour ajouter une image</span>
                    </div>

                    <div>
                        <label className="block text-xs text-white/50 mb-1 uppercase">Nom</label>
                        <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded p-2 text-white focus:border-primary/50 outline-none"
                            placeholder="Ex: Héro"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-white/50 mb-1 uppercase">Couleur</label>
                            <input
                                type="color"
                                value={color}
                                onChange={e => setColor(e.target.value)}
                                className="w-full h-10 bg-transparent border-0 rounded cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1 uppercase">Initiative</label>
                            <input
                                type="number"
                                value={initiative}
                                onChange={e => setInitiative(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded p-2 text-white outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-white/50 mb-1 uppercase">Vitesse (m)</label>
                        <input
                            type="number"
                            value={speed}
                            onChange={e => setSpeed(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded p-2 text-white outline-none"
                            placeholder="30"
                        />
                    </div>

                    {/* Quantity - Only for new monsters/PNJs */}
                    {!isEditing && (type === 'monster' || type === 'pnj') && (
                        <div>
                            <label className="block text-xs text-white/50 mb-1 uppercase">Quantité</label>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={quantity}
                                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-black/20 border border-white/10 rounded p-2 text-white outline-none"
                                placeholder="1"
                            />
                            <span className="text-xs text-white/30 mt-1 block">Créer plusieurs {type === 'monster' ? 'monstres' : 'PNJs'} identiques</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 hover:bg-white/10 rounded text-white/70">Annuler</button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="px-4 py-2 bg-primary hover:bg-primary-400 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                        {isEditing ? 'Sauvegarder' : 'Créer'}
                    </button>
                </div>
            </div>
        </div>
    );
}
