# 💨 Fart Together - WebAssembly Edition

Portage WebAssembly modulaire du jeu de course d'obstacles **Fart Together** (Steam), prêt à être hébergé gratuitement sur **GitHub Pages**.

---

## 🎮 Fonctionnalités du Jeu

* **Moteur 100% WebAssembly (5 modules .wasm)** :
  * `track_engine.wasm` : Génération procédurale des virages de rivière, gestion des parcours et détection ordonnée des **Checkpoints**.
  * `gas_physics.wasm` : Gestion du réservoir d'énergie de gaz, impulsion explosive de fart, délai de recharge et physique de jiggle.
  * `boat_buoyancy.wasm` : Dynamique hydrodynamique, flottaison de la bouée sur les vagues, gouvernail et résistance de l'eau.
  * `obstacle_hazards.wasm` : Pales rotatives (`JointRotor`), rochers de rivière et accélérateurs (`BoostPad`).
  * `game_director.wasm` : Chronomètre au dixième de seconde, calcul des scores et progression des niveaux.
* **3 Niveaux de Course complets** :
  * **Niveau 1 : Initiation** (Rivière calme, 2 checkpoints, initiation aux trajectoires).
  * **Niveau 2 : Rapides Périlleux** (Parcours plus long, moulins à eau rotatifs et tremplins).
  * **Niveau 3 : Canyon Extrême** (Courbes serrées, obstacles multiples et vitesse maximale).
* **Assets Officiels Extraits** :
  * Modèle 3D de la bouée principale et bouée collective (`.obj`).
  * Texture palette officielle du jeu et skins vert, bleu, orange.
  * Effets sonores officiels de farts, passages de checkpoints (`checkpoint.wav`) et impacts d'eau.

---

## 🚀 Comment l'héberger sur GitHub Pages (En 3 étapes)

### Étape 1 : Initialiser le dépôt Git
Ouvrez un terminal PowerShell dans ce dossier :
```bash
git init
git add .
git commit -m "Initial commit - Fart Together WebAssembly"
```

### Étape 2 : Lier votre dépôt GitHub
Créez un nouveau dépôt public sur votre compte GitHub (ex: `fart-together-wasm`), puis liez-le :
```bash
git branch -M main
git remote add origin https://github.com/<VOTRE-PSEUDO-GITHUB>/fart-together-wasm.git
git push -u origin main
```

### Étape 3 : Activer GitHub Pages
1. Sur GitHub, rendez-vous dans les **Settings** de votre dépôt.
2. Cliquez sur l'onglet **Pages** (dans le menu de gauche).
3. Sous **Branch**, sélectionnez **`main`** et dossier **`/(root)`**, puis cliquez sur **Save**.
4. En 1 minute, votre jeu sera jouable en ligne sur :  
   `https://<VOTRE-PSEUDO-GITHUB>.github.io/fart-together-wasm/`

---

## 🕹️ Commandes de Jeu

* **Flèches Gauche / Droite** ou **Q / D** : Braquer la bouée.
* **Flèches Haut / Bas** ou **Z / S** : Accélérer / reculer sur l'eau.
* **Espace** (ou bouton à l'écran) : **Déclencher le boost au gaz (Fart)**.
* **Souris** : Contrôle libre de la caméra 3D.
