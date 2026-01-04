// src/core/boardConfig.js
// Valeurs uniques utilisées partout pour garder une taille d'hex cohérente
export const BASE_HEX_RADIUS = 40; // rayon "monde" d'un hex (avant scale)
export const HEX_SCALE = 0.18;     // échelle appliquée au rayon
export const CAMERA_SCALE = 1;     // zoom fixe (1 = 100%)

// ⚙️ Contrôle du "zoom" des textures (taille d'une tuile, en pixels écran)
export const TEXTURE_TILE_PX = 48; // ↓ mets 32 pour plus petit, 96/128 pour plus grand
