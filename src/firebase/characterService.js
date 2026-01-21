import { collection, getDocs, onSnapshot } from 'firebase/firestore';
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

    // Calculate speed
    // Try explicit speed field first, then calc from modifier (base 9m)
    let speed = 9;
    if (character.speed !== undefined) speed = Number(character.speed);
    else if (character.vitesse !== undefined) speed = Number(character.vitesse);
    else if (character.speedModifier !== undefined) speed = 9 + Number(character.speedModifier);

    // HP Fallbacks
    const currentHp = character.hp !== undefined ? character.hp
        : character.currentHp !== undefined ? character.currentHp
            : character.PV !== undefined ? character.PV
                : 0;

    const maxHp = character.maxHp !== undefined ? character.maxHp
        : character.maxPV !== undefined ? character.maxPV
            : 0;

    // Conditions/States normalization
    let rawConditions = character.conditions || character.states || character.etats || [];
    const activeConditions = [];

    // Map Firebase keys (normalized) to Renderer expected strings
    const conditionMapping = {
        'aterre': 'À terre',
        'assourdi': 'Assourdi',
        'aveugle': 'Aveuglé',
        'charme': 'Charmé',
        'effraye': 'Effrayé',
        'empoigne': 'Agrippé',
        'empoisonne': 'Empoisonné',
        'entrave': 'Entravé',
        'etourdi': 'Étourdi',
        'incapacite': 'Neutralisé',
        'invisible': 'Invisible',
        'paralyse': 'Paralysé',
        'petrifie': 'Pétrifié',
        'inconscient': 'Inconscient'
    };

    if (Array.isArray(rawConditions)) {
        // Handle array format (legacy or other sources)
        rawConditions.forEach(c => {
            if (typeof c === 'string') activeConditions.push(c);
            else if (typeof c === 'object' && c) activeConditions.push(c.name || c.label || "Inconnu");
        });
    } else if (typeof rawConditions === 'object' && rawConditions !== null) {
        // Handle Map format (Firebase: { aveugle: true, ... })
        Object.entries(rawConditions).forEach(([key, value]) => {
            if (value === true) {
                // Normalize key (lowercase, remove specific chars if needed) and map
                const lowerKey = key.toLowerCase();
                const mappedName = conditionMapping[lowerKey] || key; // Fallback to key if not in map
                activeConditions.push(mappedName);
            }
        });
    }

    return {
        id: crypto.randomUUID(), // Generate new ID for the app
        name: character.name || "Sans nom",
        type: 'character',
        color: '#3b82f6', // Blue for characters (can be changed in app)
        img: null, // No avatar from Firebase, will be added in app

        // Stats
        initiative: dexModifier,
        speed: Number(speed),
        hp: Number(currentHp),
        maxHp: Number(maxHp),

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
        remainingSpeed: Number(speed),
        conditions: activeConditions,

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

/**
 * Subscribe to real-time character updates from all users
 * @param {Function} onUpdate - Callback function recieving array of token objects
 * @returns {Function} Unsubscribe function
 */
export function subscribeToAllCharacters(onUpdate) {
    try {
        const db = getDb();
        const usersRef = collection(db, 'users');

        console.log("📡 Starting Live Sync listener...");

        // onSnapshot returns an unsubscribe function
        const unsubscribe = onSnapshot(usersRef, (querySnapshot) => {
            const allCharacters = [];

            // Helper to process snapshot (similar to fetchCharacters)
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData.characters && Array.isArray(userData.characters)) {
                    userData.characters.forEach((character, index) => {
                        // DEBUG: Print raw character data for the first character found to verify fields
                        if (allCharacters.length === 0) {
                            console.log("🐛 [DEBUG] Raw Character Data from Firebase:", JSON.stringify(character, null, 2));
                        }
                        allCharacters.push({
                            ...character,
                            userId: doc.id,
                            characterIndex: index
                        });
                    });
                }
            });

            // Convert raw firebase data to app tokens
            const tokens = allCharacters.map(convertToToken);

            console.log(`📡 Live Sync Received: ${tokens.length} characters`);
            onUpdate(tokens);

        }, (error) => {
            console.error("❌ Live Sync Error:", error);
        });

        return unsubscribe;

    } catch (error) {
        console.error("❌ Error setting up subscription:", error);
        return () => { }; // Return no-op if failed
    }
}
