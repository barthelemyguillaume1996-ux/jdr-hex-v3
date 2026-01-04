# Configuration Firebase pour JDR Hex

## 📋 Étapes de configuration

### 1. Obtenir vos identifiants Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet
3. Cliquez sur l'icône ⚙️ (Paramètres) → **Paramètres du projet**
4. Faites défiler jusqu'à **Vos applications** → **SDK Configuration**
5. Si vous n'avez pas d'app web, cliquez sur `</>` pour en créer une
6. Copiez l'objet `firebaseConfig`

### 2. Configurer l'application

Ouvrez le fichier `src/firebase/config.js` et remplacez les valeurs placeholder par vos vraies valeurs :

```javascript
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_PROJET.firebaseapp.com",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_PROJET.appspot.com",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId: "VOTRE_APP_ID"
};
```

### 3. Structure de données Firebase

L'application importe depuis la structure suivante :

```
users (collection)
  └── userId (document)
       └── characters: [ {...}, {...} ] (array field)
```

#### Champs utilisés pour l'import :

| Champ Firebase | → | App Token | Description |
|----------------|---|-----------|-------------|
| `name` | → | `name` | Nom du personnage |
| `currentHp` | → | `hp` | Points de vie actuels |
| `maxHp` | → | `maxHp` | Points de vie maximum |
| `speedModifier` | → | `speed` | Vitesse (30 + modifier) |
| `stats.Dextérité` | → | `initiative` | Initiative (mod DEX) |
| `class` | → | `class` | Classe |
| `level` | → | `level` | Niveau |
| `armorClass` | → | `ac` | Classe d'armure |

**Note** : L'avatar n'est pas importé depuis Firebase. Vous pourrez l'ajouter après import en modifiant le token dans l'app.

### 4. Règles de sécurité Firebase

Pour permettre la lecture depuis votre application Electron, configurez les règles Firestore :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lecture seule pour la collection users
    match /users/{userId} {
      allow read: if true;
      allow write: if false; // Ou ajoutez une authentification
    }
  }
}
```

> ⚠️ **Important** : Ces règles permettent la lecture publique. Pour une meilleure sécurité, ajoutez une authentification Firebase.

### 5. Calculs automatiques

L'application calcule automatiquement :

- **Initiative** : Modificateur de Dextérité = `floor((DEX - 10) / 2)`
- **Vitesse** : `30 + speedModifier`

## 🚀 Utilisation

1. **Configurez Firebase** : Ajoutez vos clés dans `src/firebase/config.js`
2. **Lancez l'application** : `npm run electron:dev`
3. **Ouvrez le panneau de droite**
4. **Cliquez sur "📥 Importer depuis Firebase"**
5. Tous les personnages de tous les utilisateurs seront importés !

## 🐛 Dépannage

### Erreur : "Permission refusée"
- Vérifiez vos règles de sécurité Firestore
- Assurez-vous que la lecture est autorisée sur `users/{userId}`

### Erreur : "Pas de connexion internet"
- Vérifiez votre connexion
- Firebase nécessite une connexion active

### Aucun personnage importé
- Vérifiez que vos documents `users` contiennent un champ `characters` (array)
- Ouvrez la console développeur (F12) pour voir les logs

### Les stats sont incorrectes
- Vérifiez que les champs existent : `currentHp`, `maxHp`, `speedModifier`
- L'initiative est calculée depuis `stats.Dextérité`

## 📝 Exemple de document Firebase

```json
{
  "email": "user@example.com",
  "characters": [
    {
      "name": "Kahir Claudius Corrin",
      "class": "Clerc",
      "level": 4,
      "currentHp": 43,
      "maxHp": 43,
      "armorClass": 10,
      "speedModifier": 0,
      "stats": {
        "Dextérité": 17,
        "Force": 15,
        "Constitution": 16,
        "Intelligence": 14,
        "Sagesse": 18,
        "Charisme": 12
      }
    }
  ]
}
```

## 💡 Après l'import

Une fois les personnages importés :
- Ils apparaissent dans le panneau de droite
- Vous pouvez les modifier (cliquer sur l'avatar)
- Ajouter une image
- Les déployer sur la carte
- Utiliser en combat

## 🔄 Synchronisation

**Actuellement** : Import ponctuel (bouton)
- Les personnages sont importés une seule fois
- Les modifications dans l'app ne sont pas renvoyées à Firebase
- Les modifications dans Firebase ne sont pas synchronisées automatiquement

**Future version** : Synchronisation temps réel possible si besoin

## 🛡️ Sécurité

**Recommandations** :
- Ne commitez pas `config.js` dans Git
- Ajoutez `src/firebase/config.js` au `.gitignore`
- Pour la production, utilisez Firebase Authentication
- Limitez les règles de lecture aux utilisateurs authentifiés
