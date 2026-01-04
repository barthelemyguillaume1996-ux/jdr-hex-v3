# Configuration Git pour JdrHex

## Étape 1 : Créer un compte GitHub (si vous n'en avez pas)
1. Allez sur https://github.com
2. Cliquez sur "Sign up"
3. Suivez les instructions

## Étape 2 : Créer un nouveau repository
1. Connectez-vous sur GitHub
2. Cliquez sur le bouton "+" en haut à droite → "New repository"
3. Nom du repository : `jdr-hex-v3`
4. Description : "Application de bureau pour cartes hexagonales JDR"
5. Choisissez "Private" si vous voulez que ce soit privé
6. **NE PAS** cocher "Initialize this repository with a README"
7. Cliquez sur "Create repository"

## Étape 3 : Initialiser Git sur Windows

Ouvrez PowerShell dans le dossier du projet et exécutez :

```powershell
cd "c:\ReactProjects\app Jdr\jdr-hex-v3"

# Initialiser Git
git init

# Ajouter tous les fichiers
git add .

# Créer le premier commit
git commit -m "Initial commit - JdrHex Desktop App"

# Ajouter le repository distant (remplacez YOUR_USERNAME par votre nom d'utilisateur GitHub)
git remote add origin https://github.com/YOUR_USERNAME/jdr-hex-v3.git

# Pousser le code vers GitHub
git branch -M main
git push -u origin main
```

**Note :** GitHub vous demandera vos identifiants. Si vous avez l'authentification à deux facteurs, vous devrez créer un "Personal Access Token" :
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → Cochez "repo" → Generate
3. Copiez le token et utilisez-le comme mot de passe

## Étape 4 : Cloner sur Linux

Sur votre machine Linux :

```bash
# Installer Git si nécessaire
sudo apt update
sudo apt install git

# Cloner le repository
cd ~
git clone https://github.com/YOUR_USERNAME/jdr-hex-v3.git
cd jdr-hex-v3

# Installer les dépendances
npm install

# Builder l'application
npm run dist
```

## Workflow quotidien

### Sur Windows (après avoir fait des modifications) :
```powershell
git add .
git commit -m "Description de vos modifications"
git push
```

### Sur Linux (pour récupérer les modifications) :
```bash
cd ~/jdr-hex-v3
git pull
npm install  # Seulement si package.json a changé
npm run dist
```

## Commandes Git utiles

```bash
# Voir l'état des fichiers
git status

# Voir l'historique
git log --oneline

# Annuler les modifications locales
git checkout -- fichier.js

# Créer une branche pour tester
git checkout -b ma-nouvelle-fonctionnalite

# Revenir à la branche principale
git checkout main
```

## Dépannage

### Erreur "fatal: remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/jdr-hex-v3.git
```

### Erreur de conflit lors du pull
```bash
# Sauvegarder vos modifications locales
git stash

# Récupérer les modifications distantes
git pull

# Réappliquer vos modifications
git stash pop
```

### Oublié d'ajouter un fichier au .gitignore
```bash
# Supprimer du tracking Git sans supprimer le fichier
git rm --cached nom_du_fichier
git commit -m "Remove tracked file"
```
