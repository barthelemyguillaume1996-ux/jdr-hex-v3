import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TODO: Remplacez ces valeurs par votre configuration Firebase
// Vous pouvez les trouver dans Firebase Console > Project Settings > General
const firebaseConfig = {
  apiKey: "AIzaSyD4AeeFpJbs2jrjPigoStHL0bPIYMr7Wdk",
  authDomain: "jeu-de-role-f752f.firebaseapp.com",
  projectId: "jeu-de-role-f752f",
  storageBucket: "jeu-de-role-f752f.firebasestorage.app",
  messagingSenderId: "1002074971868",
  appId: "1:1002074971868:web:f7b53d6856529d070b9e19",
  measurementId: "G-H8S232TBCY"
};

// Initialize Firebase
let app = null;
let db = null;

export function initializeFirebase(config = null) {
    try {
        const configToUse = config || firebaseConfig;

        // Check if already initialized
        if (!app) {
            app = initializeApp(configToUse);
            db = getFirestore(app);
            console.log("✅ Firebase initialized successfully");
        }

        return { app, db };
    } catch (error) {
        console.error("❌ Firebase initialization error:", error);
        throw error;
    }
}

export function getDb() {
    if (!db) {
        initializeFirebase();
    }
    return db;
}

export { db };
