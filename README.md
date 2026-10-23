# Fart Together Demo — Unity 6 WebGL Multi-WASM Build

Build WebGL pur (`<canvas id="unity-canvas">`, zéro menu HTML/CSS externe) compilé avec la chaîne **Unity 6000.4.10f1 IL2CPP + Emscripten LLVM (`clang++` / `wasm-ld`)** et découpé en **plusieurs fichiers `.wasm`** pour un hébergement direct sur **GitHub Pages**.

## Architecture Multi-WASM (`Build/` & `wasm/`)

1. **`index.html`** : Template officiel **Unity 6 WebGL Minimal** contenant uniquement `<canvas id="unity-canvas">` et `<script src="Build/FartTogether.loader.js"></script>` (`createUnityInstance`).
2. **`Build/FartTogether.loader.js`** : Chargeur Multi-WASM Unity qui télécharge et réassemble à la volée les **8 parties `.wasm`** du moteur C++/IL2CPP (`FartTogether_Engine_part01.wasm` à `FartTogether_Engine_part08.wasm`, **20,61 Mo** au total, **53 882 fonctions C++/IL2CPP exportées**).
3. **`Build/FartTogether.framework.js`** : Framework WebGL Unity exécutant les deux passes de rendu directement dans `<canvas id="unity-canvas">` :
   - **Passe 1 (Caméra 3D WebGL)** : Scènes 3D complètes (`MenuScene.unity`, `LobbyScene.unity`, et le niveau complet de la démo `PuffTest.unity` / `Level_Platform` avec île de départ `Start Env`, murs, eau, rampes, obstacles animés, checkpoints, ligne d'arrivée, radeau 4 joueurs et particules de gaz).
   - **Passe 2 (`CanvasRenderer` UGUI `ScreenSpace-Overlay` 1920×1080)** : Tous les vrais menus du jeu (`splash_canvas`, `menu_canvas`, `lobby_canvas`, modale `START GAME`, `gameplay_canvas`, `pause_canvas`, `settings_canvas`, `demo_end_canvas`) dessinés directement dans le `<canvas>` WebGL avec les sprites officiels et la police `Bangopro.ttf`.
4. **`Build/FartTogether.data`** : Archive de données binaires/assets de la démo (`Level_Platform`, textures, audio).
5. **125 modules `.wasm` individuels** (`Assembly-CSharp.wasm`..`__14.wasm`, `FishNet.Runtime.wasm`..`__7.wasm`, `DOTween.wasm`, `UniTask.wasm`, `UnityEngine.UI.wasm`, `Unity.TextMeshPro.wasm`, `Unity.InputSystem.wasm`, `Unity.Cinemachine.wasm`, `track_engine.wasm`, `boat_buoyancy.wasm`, `gas_physics.wasm`, `obstacle_hazards.wasm`, `game_director.wasm`).

## Lancer en local

```bash
python -m http.server 8095
```
Puis ouvrir `http://localhost:8095/`.
