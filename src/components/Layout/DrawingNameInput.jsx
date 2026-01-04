import React, { useState } from 'react';

function DrawingNameInput({ onSave }) {
    const [name, setName] = useState('');

    const handleSave = () => {
        if (name.trim()) {
            onSave(name.trim());
            setName('');
        } else {
            alert("Entrez un nom pour sauvegarder.");
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    };

    return (
        <div className="flex gap-2 relative z-50">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nom du dessin..."
                className="flex-1 bg-white/10 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            />
            <button
                onClick={handleSave}
                className="px-2 py-1 bg-primary/20 hover:bg-primary/40 text-primary-200 rounded text-xs border border-primary/30"
                title="Sauvegarder"
            >
                💾
            </button>
        </div>
    );
}

// Prevent re-renders from parent
export default React.memo(DrawingNameInput);
