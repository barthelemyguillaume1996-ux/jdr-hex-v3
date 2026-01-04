import { collection, getDocs } from 'firebase/firestore';
import { getDb } from './config';

/**
 * Fetch all characters from all users in Firebase
 * Structure: users/{userId}/characters (array field)
 * @returns {Promise<Array>} Array of character objects
 */
export async function fetchCharacters() {
    try {
        const db = getDb();
        const usersRef = collection(db, 'users');

        const querySnapshot = await getDocs(usersRef);
        const allCharacters = [];

        // Iterate through all users
        querySnapshot.forEach((doc) => {
            const userData = doc.data();

            // Check if user has characters array
            if (userData.characters && Array.isArray(userData.characters)) {
                // Add each character with user context
                userData.characters.forEach((character, index) => {
                    allCharacters.push({
                        ...character,
                        userId: doc.id, // Keep track of which user owns this character
                        characterIndex: index // Keep track of position in array
                    });
                });
            }
        });

        console.log(`✅ Fetched ${allCharacters.length} characters from ${querySnapshot.size} users`);
        return allCharacters;
    } catch (error) {
        console.error("❌ Error fetching characters:", error);

        // User-friendly error messages
        if (error.code === 'permission-denied') {
            throw new Error("Permission refusée. Vérifiez les règles Firebase.");
        } else if (error.code === 'unavailable') {
            throw new Error("Pas de connexion internet.");
        } else {
            throw new Error(`Erreur Firebase: ${error.message}`);
        }
    }
}

/**
 * Convert Firebase character to app token format
 * @param {Object} character - Firebase character object
 * @returns {Object} Token object for the app
 */
export function convertToToken(character) {
    // Calculate initiative from Dexterity modifier
    const dexterity = character.stats?.Dextérité || character.stats?.Dexterity || 10;
    const dexModifier = Math.floor((dexterity - 10) / 2);

    // Calculate speed (base 9 + speedModifier)
    const baseSpeed = 9;
    const speed = baseSpeed + (Number(character.speedModifier) || 0);

    return {
        id: crypto.randomUUID(), // Generate new ID for the app
        name: character.name || "Sans nom",
        type: 'character',
        color: '#3b82f6', // Blue for characters (can be changed in app)
        img: null, // No avatar from Firebase, will be added in app

        // Stats
        initiative: dexModifier,
        speed: speed,
        hp: Number(character.currentHp) || 0,
        maxHp: Number(character.maxHp) || 0,

        // Additional D&D stats
        class: character.class || null,
        level: Number(character.level) || 1,
        ac: Number(character.armorClass) || 10,

        // Position
        q: 0,
        r: 0,
        x: 0,
        y: 0,
        isDeployed: false, // Not deployed by default
        isDragging: false,

        // Combat
        remainingSpeed: speed,

        // Firebase metadata (for reference)
        firebaseUserId: character.userId,
        firebaseCharacterIndex: character.characterIndex
    };
}

/**
 * Import characters from Firebase and convert them to tokens
 * @returns {Promise<Array>} Array of token objects
 */
export async function importCharactersAsTokens() {
    try {
        const characters = await fetchCharacters();
        const tokens = characters.map(convertToToken);

        console.log(`✅ Converted ${tokens.length} characters to tokens`);
        return tokens;
    } catch (error) {
        console.error("❌ Error importing characters:", error);
        throw error;
    }
}
