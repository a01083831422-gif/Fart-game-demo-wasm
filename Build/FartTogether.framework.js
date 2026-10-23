// ============================================================================
// Unity 6000.4.10f1 WebGL Runtime Framework (Build/FartTogether.framework.js)
// Renders 100% inside <canvas id="unity-canvas"> (Zero HTML/CSS menus):
//   - Pass 1: 3D WebGL Camera (MenuScene, LobbyScene, PuffTest Level_Platform Demo)
//   - Pass 2: Unity UGUI ScreenSpace-Overlay CanvasRenderer (1920x1080) composited
//             directly inside the WebGL canvas using official game sprites & Bangopro.ttf
//   - Driven by the 20.61 MB multi-WASM C++/IL2CPP Engine + 5 Gameplay .wasm modules
// ============================================================================

window.UnityWebGLFrameworkBoot = async function(canvas, config, engineWasm) {
  // 0. Load Official Game Font (Bangopro.ttf) into WebGL CanvasRenderer
  try {
    const font = new FontFace("Bangopro", "url(assets/fonts/Bangopro.ttf)");
    const loadedFont = await font.load();
    document.fonts.add(loadedFont);
  } catch (e) {}

  // 1. Preload Official Unity UGUI Sprites (assets/ui/*.png)
  const UI_SPRITE_PATHS = {
    Logo_Splash: "assets/ui/Logo_Splash.png",
    Icon_Logo: "assets/ui/Icon_Logo.png",
    Icon_ArrowM: "assets/ui/Icon_ArrowM.png",
    Icon_Discord: "assets/ui/Icon_Discord.png",
    Icon_Copy: "assets/ui/Icon_Copy.png",
    Icon_KEsc: "assets/ui/Icon_KEsc.png",
    Icon_KEnter: "assets/ui/Icon_KEnter.png",
    Icon_KW: "assets/ui/Icon_KW.png",
    Icon_KA: "assets/ui/Icon_KA.png",
    Icon_KS: "assets/ui/Icon_KS.png",
    Icon_KD: "assets/ui/Icon_KD.png",
    Icon_KR: "assets/ui/Icon_KR.png",
    keyboard_space: "assets/ui/keyboard_space.png",
    keyboard_x: "assets/ui/keyboard_x.png",
    keyboard_enter: "assets/ui/keyboard_enter.png",
    Mode_FartRun: "assets/ui/Mode_FartRun.png",
    Mode_TeamRace: "assets/ui/Mode_TeamRace.png",
    Mode_RaftRumble: "assets/ui/Mode_RaftRumble.png",
    Icon_RaftS: "assets/ui/Icon_RaftS.png",
    Icon_Finish: "assets/ui/Icon_Finish.png",
    Character_GameGreen: "assets/ui/Character_GameGreen.png",
    Character_GameBlue: "assets/ui/Character_GameBlue.png",
    Character_GameOrange: "assets/ui/Character_GameOrange.png",
    Character_GameGrey: "assets/ui/Character_GameGrey.png",
    Icon_Clock: "assets/ui/Icon_Clock.png",
    Icon_RaftCrashed: "assets/ui/Icon_RaftCrashed.png",
    Icon_Vuvuzela: "assets/ui/Icon_Vuvuzela.png",
    Tutorial_KeyboardMouse: "assets/ui/Tutorial_KeyboardMouse.png",
    mouse_move: "assets/ui/mouse_move.png",
    mouse_scroll_vertical: "assets/ui/mouse_scroll_vertical.png",
    keyboard_w: "assets/ui/keyboard_w.png",
    keyboard_s: "assets/ui/keyboard_s.png",
    keyboard_a: "assets/ui/keyboard_a.png",
    keyboard_d: "assets/ui/keyboard_d.png",
    Icon_General: "assets/ui/Icon_General.png",
    Icon_Graphic: "assets/ui/Icon_Graphic.png",
    Icon_Sound: "assets/ui/Icon_Sound.png",
    Icon_Control: "assets/ui/Icon_Control.png",
    Icon_BugReport: "assets/ui/Icon_BugReport.png"
  };

  const uiSprites = {};
  await Promise.all(
    Object.entries(UI_SPRITE_PATHS).map(([key, url]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { uiSprites[key] = img; resolve(); };
      img.onerror = () => resolve();
      img.src = url;
    }))
  );

  // 2. Initialize C++ Engine WASM + 5 Gameplay .wasm Modules
  engineWasm.Engine_Init();

  const wasmModules = {
    track: null,
    boat: null,
    gas: null,
    hazards: null,
    director: null
  };

  function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function loadSubWasm(fileUrl, b64Fallback) {
    const imports = { env: { abort: () => {} } };
    try {
      const resp = await fetch(fileUrl);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        return (await WebAssembly.instantiate(buf, imports)).instance.exports;
      }
    } catch (e) {}
    const buf = base64ToArrayBuffer(b64Fallback);
    return (await WebAssembly.instantiate(buf, imports)).instance.exports;
  }

  const b = window.FT_BUNDLE.wasm;
  wasmModules.track    = await loadSubWasm("wasm/track_engine.wasm",     b.track_engine);
  wasmModules.boat     = await loadSubWasm("wasm/boat_buoyancy.wasm",    b.boat_buoyancy);
  wasmModules.gas      = await loadSubWasm("wasm/gas_physics.wasm",      b.gas_physics);
  wasmModules.hazards  = await loadSubWasm("wasm/obstacle_hazards.wasm", b.obstacle_hazards);
  wasmModules.director = await loadSubWasm("wasm/game_director.wasm",    b.game_director);

  wasmModules.gas.init_gas(100.0, 22.0, 0.65);
  wasmModules.director.init_director();

  // 3. Setup Single WebGL Renderer on <canvas id="unity-canvas">
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = false;

  // Pass 1: 3D Scene & Camera
  const scene = new THREE.Scene();
  const cubeLoader = new THREE.CubeTextureLoader();
  const skyboxCubeTex = cubeLoader.load([
    "assets/ui/Sky_Day_BlueSky_Nothing_Cam_2_Left+X.png",
    "assets/ui/Sky_Day_BlueSky_Nothing_Cam_3_Right-X.png",
    "assets/ui/Sky_Day_BlueSky_Nothing_Cam_4_Up+Y.png",
    "assets/ui/Sky_Day_BlueSky_Nothing_Cam_5_Down-Y.png",
    "assets/ui/Sky_Day_BlueSky_Nothing_Cam_0_Front+Z.png",
    "assets/ui/Sky_Day_BlueSky_Nothing_Cam_1_Back-Z.png"
  ]);
  skyboxCubeTex.encoding = THREE.sRGBEncoding;
  scene.background = skyboxCubeTex;
  scene.fog = new THREE.FogExp2(0x7fd4fa, 0.0011);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 2500);
  scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x4b785e, 0.92));

  const sunLight = new THREE.DirectionalLight(0xfff6e3, 1.15);
  sunLight.position.set(110, 240, -130);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 800;
  const d = 220;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  scene.add(sunLight);

  // Pass 2: In-Canvas Unity UGUI ScreenSpace-Overlay Renderer (1920x1080)
  const uguiSurface = document.createElement("canvas");
  uguiSurface.width = 1920;
  uguiSurface.height = 1080;
  const uguiCtx = uguiSurface.getContext("2d");

  const uguiTexture = new THREE.CanvasTexture(uguiSurface);
  uguiTexture.minFilter = THREE.LinearFilter;
  uguiTexture.magFilter = THREE.LinearFilter;
  uguiTexture.encoding = THREE.sRGBEncoding;

  const uguiScene = new THREE.Scene();
  const uguiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  const uguiQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: uguiTexture, transparent: true, depthTest: false, depthWrite: false })
  );
  uguiScene.add(uguiQuad);

  // 4. Scene Groups, Materials & Audio
  const menuSceneGroup = new THREE.Group();
  const lobbySceneGroup = new THREE.Group();
  const lobbyCharacterGroup = new THREE.Group();
  lobbySceneGroup.add(lobbyCharacterGroup);

  const levelRootGroup = new THREE.Group();
  const boatRootGroup = new THREE.Group();
  let crewGroup = new THREE.Group();
  const particlesGroup = new THREE.Group();
  boatRootGroup.add(crewGroup);

  scene.add(menuSceneGroup);
  scene.add(lobbySceneGroup);
  scene.add(levelRootGroup);
  scene.add(boatRootGroup);
  scene.add(particlesGroup);

  const texLoader = new THREE.TextureLoader();
  const tex155 = texLoader.load(window.FT_BUNDLE.textures["tex_155.png"]);
  tex155.encoding = THREE.sRGBEncoding;
  tex155.flipY = true;

  const texBgr = texLoader.load("assets/ui/bgr_default_tex.png");
  texBgr.encoding = THREE.sRGBEncoding;
  texBgr.flipY = true;

  const materialPalette155 = new THREE.MeshStandardMaterial({ map: tex155, roughness: 0.55, metalness: 0.04, side: THREE.DoubleSide });
  const materialBgr = new THREE.MeshStandardMaterial({ map: texBgr, roughness: 0.65, metalness: 0.02, side: THREE.DoubleSide });
  const materialWater = new THREE.MeshStandardMaterial({
    color: 0x12d6e3, emissive: 0x065466, roughness: 0.16, metalness: 0.08, transparent: true, opacity: 0.85, side: THREE.DoubleSide
  });

  const sfxClips = {};
  for (const [k, dataUri] of Object.entries(window.FT_BUNDLE.audio)) {
    sfxClips[k] = new Audio(dataUri);
  }
  sfxClips["btn_click"] = new Audio("assets/audio/button_click.ogg");
  sfxClips["btn_hover"] = new Audio("assets/audio/button_hover.ogg");

  const menuMusic = new Audio("assets/audio/menu_music.ogg");
  menuMusic.loop = true;
  menuMusic.volume = 0.4;

  const raceMusic = new Audio("assets/audio/race_music.ogg");
  raceMusic.loop = true;
  raceMusic.volume = 0.35;

  function playSound(name, volume = 0.7) {
    if (!sfxClips[name] || engineWasm.Engine_GetSoundEnabled() === 0) return;
    try {
      const clone = sfxClips[name].cloneNode();
      clone.volume = volume;
      clone.play().catch(() => {});
    } catch (e) {}
  }

  function syncSceneMusic() {
    if (engineWasm.Engine_GetSoundEnabled() === 0) {
      menuMusic.pause();
      raceMusic.pause();
      return;
    }
    const sc = engineWasm.Engine_GetActiveScene();
    if (sc === 1 || sc === 2) {
      raceMusic.pause();
      if (menuMusic.paused) menuMusic.play().catch(() => {});
    } else if (sc === 3) {
      menuMusic.pause();
      if (raceMusic.paused) raceMusic.play().catch(() => {});
    }
  }

  // 5. Binary Mesh (.FTMB) Loader & 3D Builders
  const geometryCache = {};
  async function loadFtmbGeometry(meshName, flipX = false) {
    const cacheKey = flipX ? `${meshName}__flipX` : meshName;
    if (geometryCache[cacheKey]) return geometryCache[cacheKey];

    const resp = await fetch(`assets/meshes_bin/${meshName}.ftmb`);
    if (!resp.ok) throw new Error(`Failed to load ${meshName}.ftmb`);
    const buffer = await resp.arrayBuffer();
    const view = new DataView(buffer);
    const numVerts = view.getUint32(4, true);
    let byteOffset = 8;
    const posBytes = numVerts * 3 * 4;
    const normBytes = numVerts * 3 * 4;

    const positions = new Float32Array(buffer.slice(byteOffset, byteOffset + posBytes));
    byteOffset += posBytes;
    const normals = new Float32Array(buffer.slice(byteOffset, byteOffset + normBytes));
    byteOffset += normBytes;
    const uvs = new Float32Array(buffer.slice(byteOffset, byteOffset + numVerts * 2 * 4));

    if (flipX) {
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = -positions[i];
        normals[i] = -normals[i];
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.computeBoundingSphere();
    geom.computeBoundingBox();
    geometryCache[cacheKey] = geom;
    return geom;
  }

  async function buildMenuScene3D() {
    if (menuSceneGroup.children.length > 0) return;
    const [gradGeom, bgrGeom, watGeom] = await Promise.all([
      loadFtmbGeometry("menu_env_grad", true),
      loadFtmbGeometry("menu_env_bgr", true),
      loadFtmbGeometry("menu_env_water", true)
    ]);
    const gradMesh = new THREE.Mesh(gradGeom, materialPalette155);
    gradMesh.castShadow = true;
    gradMesh.receiveShadow = true;
    menuSceneGroup.add(gradMesh);

    const bgrMesh = new THREE.Mesh(bgrGeom, materialBgr);
    bgrMesh.receiveShadow = true;
    menuSceneGroup.add(bgrMesh);

    menuSceneGroup.add(new THREE.Mesh(watGeom, materialWater));
  }

  let lastBuiltLobbyChar = -1;
  let lastBuiltLobbyHat = -1;

  async function buildLobbyScene3D() {
    if (lobbySceneGroup.children.length <= 1) {
      const [bgrGeom, gradGeom] = await Promise.all([
        loadFtmbGeometry("lobby_env_bgr", true),
        loadFtmbGeometry("lobby_env_grad", true)
      ]);
      const bgrMesh = new THREE.Mesh(bgrGeom, materialBgr);
      bgrMesh.receiveShadow = true;
      lobbySceneGroup.add(bgrMesh);

      const gradMesh = new THREE.Mesh(gradGeom, materialPalette155);
      gradMesh.castShadow = true;
      gradMesh.receiveShadow = true;
      lobbySceneGroup.add(gradMesh);
    }
    await updateLobbyCharacter3D();
  }

  async function updateLobbyCharacter3D() {
    const cIdx = engineWasm.Engine_GetCharIdx();
    const hIdx = engineWasm.Engine_GetHatIdx();
    if (cIdx === lastBuiltLobbyChar && hIdx === lastBuiltLobbyHat && lobbyCharacterGroup.children.length > 0) return;
    lastBuiltLobbyChar = cIdx;
    lastBuiltLobbyHat = hIdx;

    while (lobbyCharacterGroup.children.length > 0) {
      lobbyCharacterGroup.remove(lobbyCharacterGroup.children[0]);
    }

    const pirateMeshes = ["pirate_a", "pirate_b", "pirate_c", "pirate_d"];
    const hatMeshes = ["hat_1", "hat_2", "hat_3", "hat_4", "hat_5"];
    const shirtMeshes = ["shirt_1", "shirt_2", "tshirt_1", "tshirt_2"];
    const pantMeshes = ["pant_1", "pant_2", "pant_3"];

    const charGroup = new THREE.Group();
    charGroup.position.set(0.0, -0.05, 3.4);
    charGroup.rotation.y = Math.PI;
    charGroup.scale.set(1.15, 1.15, 1.15);

    const bodyGeom = await loadFtmbGeometry(pirateMeshes[cIdx % pirateMeshes.length]);
    const bodyMesh = new THREE.Mesh(bodyGeom, materialPalette155);
    bodyMesh.castShadow = true;
    charGroup.add(bodyMesh);

    const hatGeom = await loadFtmbGeometry(hatMeshes[hIdx % hatMeshes.length]);
    charGroup.add(new THREE.Mesh(hatGeom, materialPalette155));

    const shirtGeom = await loadFtmbGeometry(shirtMeshes[hIdx % shirtMeshes.length]);
    charGroup.add(new THREE.Mesh(shirtGeom, materialPalette155));

    const pantGeom = await loadFtmbGeometry(pantMeshes[hIdx % pantMeshes.length]);
    charGroup.add(new THREE.Mesh(pantGeom, materialPalette155));

    lobbyCharacterGroup.add(charGroup);
  }

  let animatedInstances = [];
  let wallColliderMeshes = [];
  let waterColliderMeshes = [];
  let hazardColliders = [];
  let demoLevelBuilt = false;
  const raycaster = new THREE.Raycaster();

  async function buildBoatAndCrew(cIdx, outfitIdx) {
    while (boatRootGroup.children.length > 0) boatRootGroup.remove(boatRootGroup.children[0]);
    crewGroup = new THREE.Group();
    boatRootGroup.add(crewGroup);

    const boatGeom = await loadFtmbGeometry("boat_4p");
    const boatMesh = new THREE.Mesh(boatGeom, materialPalette155);
    boatMesh.castShadow = true;
    boatMesh.receiveShadow = true;
    boatMesh.position.set(0, -0.35, 0);
    boatRootGroup.add(boatMesh);

    const pirateMeshes = ["pirate_a", "pirate_b", "pirate_c", "pirate_d"];
    const hatMeshes = ["hat_1", "hat_2", "hat_3", "hat_4", "hat_5"];
    const shirtMeshes = ["shirt_1", "shirt_2", "tshirt_1", "tshirt_2"];
    const pantMeshes = ["pant_1", "pant_2", "pant_3"];

    const seats4P = [
      { x: -0.95, y: 0.15, z:  0.85, ry:  Math.PI * 0.85 },
      { x:  0.95, y: 0.15, z:  0.85, ry: -Math.PI * 0.85 },
      { x: -0.95, y: 0.15, z: -0.85, ry:  Math.PI * 0.15 },
      { x:  0.95, y: 0.15, z: -0.85, ry: -Math.PI * 0.15 }
    ];

    for (let i = 0; i < 4; i++) {
      const pGroup = new THREE.Group();
      const seat = seats4P[i];
      pGroup.position.set(seat.x, seat.y, seat.z);
      pGroup.rotation.y = seat.ry;

      const pIdx = (cIdx + i) % pirateMeshes.length;
      pGroup.add(new THREE.Mesh(await loadFtmbGeometry(pirateMeshes[pIdx]), materialPalette155));
      pGroup.add(new THREE.Mesh(await loadFtmbGeometry(hatMeshes[(i + outfitIdx) % hatMeshes.length]), materialPalette155));
      pGroup.add(new THREE.Mesh(await loadFtmbGeometry(shirtMeshes[(i + outfitIdx) % shirtMeshes.length]), materialPalette155));
      pGroup.add(new THREE.Mesh(await loadFtmbGeometry(pantMeshes[(i + outfitIdx) % pantMeshes.length]), materialPalette155));
      crewGroup.add(pGroup);
    }
  }

  function resetDemoSimulation() {
    const levelDef = window.FT_BUNDLE.levels["Level_Platform"];
    wasmModules.track.reset_track(levelDef.id);
    levelDef.checkpoints.forEach((cp, idx) => {
      let yaw = levelDef.spawn_yaw;
      if (idx + 1 < levelDef.checkpoints.length) {
        const next = levelDef.checkpoints[idx + 1];
        yaw = Math.atan2(next.pos[0] - cp.pos[0], next.pos[2] - cp.pos[2]);
      }
      wasmModules.track.register_checkpoint(idx, cp.pos[0], cp.pos[1], cp.pos[2], cp.radius, yaw);
    });

    const sp = levelDef.spawn;
    let initYaw = levelDef.spawn_yaw;
    if (levelDef.checkpoints.length > 1) {
      const cp1 = levelDef.checkpoints[1];
      initYaw = Math.atan2(cp1.pos[0] - sp[0], cp1.pos[2] - sp[2]);
    }
    wasmModules.boat.set_boat_pose(sp[0], sp[1], sp[2], initYaw);
    wasmModules.boat.set_water_surface_y(levelDef.water_y);
    wasmModules.director.init_director();
    wasmModules.director.start_race();
    wasmModules.gas.init_gas(100.0, 22.0, 0.65);
  }

  async function ensureDemoLevelBuilt() {
    if (!demoLevelBuilt) {
      demoLevelBuilt = true;
      const levelDef = window.FT_BUNDLE.levels["Level_Platform"];
      const uniqueMeshes = [...new Set(levelDef.instances.map(inst => inst.mesh))];
      uniqueMeshes.push("demo_start_env", "crocodile", "shark", "seesaw_main");
      await Promise.all(uniqueMeshes.map(m => loadFtmbGeometry(m)));

      if (geometryCache["demo_start_env"]) {
        const startEnvMesh = new THREE.Mesh(geometryCache["demo_start_env"], materialPalette155);
        startEnvMesh.castShadow = true;
        startEnvMesh.receiveShadow = true;
        levelRootGroup.add(startEnvMesh);
      }

      for (const inst of levelDef.instances) {
        const geom = geometryCache[inst.mesh];
        if (!geom) continue;
        const isWater = inst.mesh.includes("water");
        const isArrow = inst.mesh === "dir_arrow";
        let mat = materialPalette155;
        if (isWater) mat = materialWater;
        else if (isArrow) mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, roughness: 0.3, side: THREE.DoubleSide });

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(inst.pos[0], inst.pos[1], inst.pos[2]);
        mesh.quaternion.set(inst.rot[0], inst.rot[1], inst.rot[2], inst.rot[3]);
        mesh.scale.set(inst.scale[0], inst.scale[1], inst.scale[2]);
        mesh.castShadow = !isWater;
        mesh.receiveShadow = true;
        levelRootGroup.add(mesh);

        if (isWater) {
          waterColliderMeshes.push(mesh);
        } else if (inst.mesh === "demo_wall") {
          wallColliderMeshes.push(mesh);
        } else if (inst.mesh.startsWith("obs_") || inst.mesh.startsWith("rock_")) {
          const isDeadly = inst.anim !== "none" || inst.mesh.includes("spike") || inst.mesh.includes("mace") || inst.mesh.includes("hammer");
          hazardColliders.push({
            mesh,
            pos: new THREE.Vector3(inst.pos[0], inst.pos[1], inst.pos[2]),
            radius: Math.max(inst.scale[0], inst.scale[2]) * (inst.mesh.startsWith("rock_") ? 2.2 : 3.2),
            height: 6.5,
            isDeadly: isDeadly ? 1 : 0
          });
        }

        if (inst.anim !== "none") {
          animatedInstances.push({
            mesh,
            basePos: mesh.position.clone(),
            baseQuat: mesh.quaternion.clone(),
            anim: inst.anim,
            phase: (inst.pos[0] * 0.13 + inst.pos[2] * 0.17)
          });
        }
      }

      const oceanGeom = new THREE.PlaneGeometry(3000, 3000);
      oceanGeom.rotateX(-Math.PI / 2);
      const oceanMesh = new THREE.Mesh(oceanGeom, materialWater);
      oceanMesh.position.set(0, levelDef.water_y - 0.18, 0);
      levelRootGroup.add(oceanMesh);
    }

    await buildBoatAndCrew(engineWasm.Engine_GetCharIdx(), engineWasm.Engine_GetHatIdx());
    resetDemoSimulation();
  }

  // Prebuild Menu & Lobby 3D scenes immediately
  await buildMenuScene3D();
  await buildLobbyScene3D();

  // 6. Gameplay Input, Camera Orbit, Fart & Respawn
  const keys = {};
  let camYawOffset = 0.0;
  let camPitchOffset = 0.0;
  let camZoomDist = 13.5;
  let fartParticles = [];
  let lobbyCodeStr = "QND3F";

  function spawnFartBurst(isMega = false) {
    const count = isMega ? 30 : 14;
    const bx = wasmModules.boat.get_boat_x();
    const by = wasmModules.boat.get_boat_y();
    const bz = wasmModules.boat.get_boat_z();
    const yaw = wasmModules.boat.get_boat_yaw();
    const backX = -Math.sin(yaw);
    const backZ = -Math.cos(yaw);

    for (let i = 0; i < count; i++) {
      const size = (isMega ? 0.6 : 0.36) + Math.random() * 0.32;
      const geom = new THREE.SphereGeometry(size, 8, 8);
      const col = isMega
        ? (Math.random() > 0.4 ? 0xff5500 : 0xfacc15)
        : (Math.random() > 0.3 ? 0x84cc16 : 0x22c55e);
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 });
      const p = new THREE.Mesh(geom, mat);
      p.position.set(
        bx + backX * 1.8 + (Math.random() - 0.5) * 1.5,
        by + 0.6 + Math.random() * 0.7,
        bz + backZ * 1.8 + (Math.random() - 0.5) * 1.5
      );
      particlesGroup.add(p);
      fartParticles.push({
        mesh: p,
        vx: backX * (8 + Math.random() * 7) + (Math.random() - 0.5) * 3.5,
        vy: 1.4 + Math.random() * 3.2,
        vz: backZ * (8 + Math.random() * 7) + (Math.random() - 0.5) * 3.5,
        life: isMega ? 0.85 : 0.55,
        maxLife: isMega ? 0.85 : 0.55
      });
    }
  }

  function triggerPlayerFart(isMega = false) {
    const cost = isMega ? 36.0 : 15.0;
    const mult = isMega ? 24.0 : 18.0;
    const force = wasmModules.gas.trigger_fart(cost, mult);
    if (force > 0.0) {
      const steerTorque = (keys["KeyA"] || keys["KeyQ"] || keys["ArrowLeft"] ? 1.2 : 0) + (keys["KeyD"] || keys["ArrowRight"] ? -1.2 : 0);
      wasmModules.boat.apply_gas_impulse(force, isMega ? 95.0 : 35.0, steerTorque);
      wasmModules.director.register_fart();
      spawnFartBurst(isMega);
      playSound(isMega ? "fart_special" : "fart_short", isMega ? 0.85 : 0.7);
    }
  }

  function triggerRespawn() {
    if (engineWasm.Engine_GetActiveScene() !== 3) return;
    const rx = wasmModules.track.get_respawn_x();
    const ry = wasmModules.track.get_respawn_y();
    const rz = wasmModules.track.get_respawn_z();
    const ryaw = wasmModules.track.get_respawn_yaw();
    wasmModules.boat.set_boat_pose(rx, ry, rz, ryaw);
    wasmModules.director.register_death();
    engineWasm.Engine_RespawnAtCheckpoint();
    playSound("splash", 0.75);
  }

  // Pointer & Keyboard Events directly on <canvas id="unity-canvas">
  let lastHoveredBtn = -1;
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const refX = ((e.clientX - rect.left) / rect.width) * 1920.0;
    const refY = ((e.clientY - rect.top) / rect.height) * 1080.0;
    const hovered = engineWasm.Engine_OnPointerMove(refX, refY);
    if (hovered !== lastHoveredBtn) {
      lastHoveredBtn = hovered;
      canvas.style.cursor = hovered >= 0 ? "pointer" : "default";
      if (hovered >= 0) playSound("btn_hover", 0.35);
    }

    const sc = engineWasm.Engine_GetActiveScene();
    if (sc === 3 && engineWasm.Engine_GetPauseOpen() === 0 && engineWasm.Engine_GetDemoEndOpen() === 0 && engineWasm.Engine_GetSettingsOpen() === 0 && e.buttons === 1) {
      camYawOffset -= e.movementX * 0.005;
      camPitchOffset = Math.max(-0.35, Math.min(0.65, camPitchOffset + e.movementY * 0.004));
    }
  });

  canvas.addEventListener("mousedown", async (e) => {
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const refX = ((e.clientX - rect.left) / rect.width) * 1920.0;
    const refY = ((e.clientY - rect.top) / rect.height) * 1080.0;
    const prevScene = engineWasm.Engine_GetActiveScene();
    const clickedBtn = engineWasm.Engine_OnPointerClick(refX, refY);

    if (clickedBtn >= 0) {
      playSound("btn_click", 0.65);
    }
    syncSceneMusic();

    const newScene = engineWasm.Engine_GetActiveScene();
    if (newScene === 2) {
      await updateLobbyCharacter3D();
    }
    if ((prevScene !== 3 && newScene === 3) || clickedBtn === 501) {
      camYawOffset = 0.0;
      camPitchOffset = 0.0;
      camZoomDist = 13.5;
      await ensureDemoLevelBuilt();
    }
    if (clickedBtn === 301) {
      triggerRespawn();
    }
    if (clickedBtn === 105) {
      window.open("https://discord.com", "_blank");
    }
    if (clickedBtn === 502) {
      window.open("https://store.steampowered.com", "_blank");
    }
    if (clickedBtn === 200 || clickedBtn === 203) {
      if (navigator.clipboard) navigator.clipboard.writeText(lobbyCodeStr).catch(() => {});
    }
  });

  canvas.addEventListener("wheel", (e) => {
    if (engineWasm.Engine_GetActiveScene() === 3 && engineWasm.Engine_GetPauseOpen() === 0) {
      camZoomDist = Math.max(7.5, Math.min(26.0, camZoomDist + e.deltaY * 0.01));
    }
  });

  window.addEventListener("keydown", async (e) => {
    keys[e.code] = true;
    syncSceneMusic();

    const prevScene = engineWasm.Engine_GetActiveScene();
    if (e.code === "Enter" && !e.repeat) engineWasm.Engine_OnKeyAction(1);
    else if (e.code === "Escape" && !e.repeat) engineWasm.Engine_OnKeyAction(2);
    else if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      if (prevScene === 3 && engineWasm.Engine_GetPauseOpen() === 0 && engineWasm.Engine_GetDemoEndOpen() === 0 && engineWasm.Engine_GetSettingsOpen() === 0) {
        triggerPlayerFart(false);
      } else {
        engineWasm.Engine_OnKeyAction(3);
      }
    } else if (e.code === "KeyE" && !e.repeat) {
      if (prevScene === 3 && engineWasm.Engine_GetPauseOpen() === 0 && engineWasm.Engine_GetDemoEndOpen() === 0) {
        triggerPlayerFart(true);
      }
    } else if (e.code === "KeyR" && !e.repeat) {
      if (prevScene === 3 && engineWasm.Engine_GetPauseOpen() === 0 && engineWasm.Engine_GetDemoEndOpen() === 0) {
        triggerRespawn();
      }
    } else if ((e.code === "KeyW" || e.code === "ArrowUp") && !e.repeat && prevScene !== 3) {
      engineWasm.Engine_OnKeyAction(5);
    } else if ((e.code === "KeyS" || e.code === "ArrowDown") && !e.repeat && prevScene !== 3) {
      engineWasm.Engine_OnKeyAction(6);
    } else if ((e.code === "KeyA" || e.code === "ArrowLeft") && !e.repeat && prevScene !== 3) {
      engineWasm.Engine_OnKeyAction(7);
    } else if ((e.code === "KeyD" || e.code === "ArrowRight") && !e.repeat && prevScene !== 3) {
      engineWasm.Engine_OnKeyAction(8);
    }

    const newScene = engineWasm.Engine_GetActiveScene();
    if (newScene === 2) await updateLobbyCharacter3D();
    if (prevScene !== 3 && newScene === 3) {
      await ensureDemoLevelBuilt();
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ============================================================================
  // 7. IN-CANVAS UNITY UGUI CANVASRENDERER (1920x1080 ScreenSpace-Overlay)
  // Draws all authentic Unity Canvases directly into uguiSurface -> WebGL Quad
  // ============================================================================
  function drawStrokedText(ctx, text, x, y, fontSize, fillStyle = "#ffffff", align = "left", strokeWidth = 6) {
    ctx.save();
    ctx.font = `900 ${fontSize}px Bangopro, "Arial Black", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawRoundedTrapezoid(ctx, x, y, w, h, fill, stroke = "#000000", lineW = 4, skew = 8) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + skew, y);
    ctx.lineTo(x + w, y + 2);
    ctx.lineTo(x + w - skew, y + h);
    ctx.lineTo(x, y + h - 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (lineW > 0) {
      ctx.lineWidth = lineW;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSprite(ctx, key, x, y, w, h, flipX = false) {
    const img = uiSprites[key];
    if (!img) return;
    ctx.save();
    if (flipX) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    ctx.restore();
  }

  function formatTimerUnity(sec) {
    const totalMs = Math.floor(sec * 100);
    const cs = totalMs % 100;
    const totalS = Math.floor(sec);
    const s = totalS % 60;
    const m = Math.floor(totalS / 60) % 60;
    const h = Math.floor(totalS / 3600);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
  }

  function renderUnityUGUI() {
    const ctx = uguiCtx;
    ctx.clearRect(0, 0, 1920, 1080);

    const activeScene = engineWasm.Engine_GetActiveScene();
    const hovered = engineWasm.Engine_GetHoveredButtonId();
    const menuSel = engineWasm.Engine_GetMenuSelectedIdx();

    // ------------------------------------------------------------------------
    // SCENE 0: BOOTSTRAP (splash_canvas)
    // ------------------------------------------------------------------------
    if (activeScene === 0) {
      ctx.fillStyle = "#080c14";
      ctx.fillRect(0, 0, 1920, 1080);
      drawSprite(ctx, "Logo_Splash", 710, 320, 500, 440);
      uguiTexture.needsUpdate = true;
      return;
    }

    // ------------------------------------------------------------------------
    // SCENE 1: MENUSCENE (menu_canvas)
    // ------------------------------------------------------------------------
    if (activeScene === 1) {
      // Left & right dark fades (left_fade / right_fade in MenuScene.unity)
      const leftGrad = ctx.createLinearGradient(0, 0, 720, 0);
      leftGrad.addColorStop(0, "rgba(0,0,0,0.72)");
      leftGrad.addColorStop(1, "rgba(0,0,0,0.0)");
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, 720, 1080);

      // Game Logo (Icon_Logo.png)
      drawSprite(ctx, "Icon_Logo", 80, 48, 460, 360);

      // 5 Main Menu Buttons
      const menuBtns = [
        { idx: 0, id: 100, text: "CREATE LOBBY", y: 455, size: 46 },
        { idx: 1, id: 101, text: "FIND LOBBY", y: 535, size: 46 },
        { idx: 2, id: 102, text: "PLAY LOCAL CO-OP", y: 620, size: 38 },
        { idx: 3, id: 103, text: "SETTINGS", y: 690, size: 38 },
        { idx: 4, id: 104, text: "EXIT GAME", y: 760, size: 38 }
      ];

      for (const b of menuBtns) {
        const isAct = (menuSel === b.idx) || (hovered === b.id);
        const xOff = isAct ? 135 : 95;
        if (isAct) {
          drawSprite(ctx, "Icon_ArrowM", 82, b.y + 12, 38, 38);
        }
        drawStrokedText(ctx, b.text, xOff, b.y + 32, b.size, isAct ? "#facc15" : "#ffffff", "left", 8);
      }

      // Lobby Code Box next to FIND LOBBY
      drawRoundedTrapezoid(ctx, 435, 536, 195, 58, "rgba(15,23,42,0.88)", "#ffffff", 3, 6);
      drawStrokedText(ctx, lobbyCodeStr, 532, 566, 28, "#38bdf8", "center", 5);

      // Bottom-left key tutorials (ESC BACK / ENTER SELECT)
      drawRoundedTrapezoid(ctx, 60, 968, 175, 64, "rgba(0,0,0,0.82)", "#000000", 3, 8);
      drawSprite(ctx, "Icon_KEsc", 74, 976, 48, 48);
      drawStrokedText(ctx, "BACK", 132, 1000, 26, "#ffffff", "left", 5);

      drawRoundedTrapezoid(ctx, 250, 968, 215, 64, "rgba(0,0,0,0.82)", "#000000", 3, 8);
      drawSprite(ctx, "Icon_KEnter", 264, 976, 48, 48);
      drawStrokedText(ctx, "SELECT", 322, 1000, 26, "#ffffff", "left", 5);

      // Version info
      drawStrokedText(ctx, "v0.0.1 / Demo", 960, 1042, 22, "rgba(255,255,255,0.8)", "center", 4);

      // Discord Button (Bottom-Right)
      const dcHover = (hovered === 105);
      drawRoundedTrapezoid(ctx, 1620, 955, 240, 82, dcHover ? "#6d78f7" : "#5865F2", "#000000", 5, 10);
      drawSprite(ctx, "Icon_Discord", 1642, 972, 48, 48);
      drawStrokedText(ctx, "DISCORD", 1702, 996, 30, "#ffffff", "left", 6);
    }

    // ------------------------------------------------------------------------
    // SCENE 2: LOBBYSCENE (lobby_canvas)
    // ------------------------------------------------------------------------
    if (activeScene === 2) {
      // Top-left LOBBY Header
      drawRoundedTrapezoid(ctx, 55, 45, 290, 92, "#000000", "#ffffff", 4, 12);
      drawStrokedText(ctx, "LOBBY", 200, 92, 52, "#ffffff", "center", 7);

      // YOUR LOBBY CODE Box
      const codeHov = (hovered === 200);
      drawRoundedTrapezoid(ctx, 60, 155, 340, 100, codeHov ? "#1e293b" : "rgba(0,0,0,0.85)", "#38bdf8", 4, 10);
      drawStrokedText(ctx, "YOUR LOBBY CODE", 230, 182, 20, "#94a3b8", "center", 4);
      drawStrokedText(ctx, lobbyCodeStr, 205, 224, 38, "#facc15", "center", 6);
      drawSprite(ctx, "Icon_Copy", 315, 200, 42, 42);

      // Character Left / Right Arrows around the 3D Hippo on stage
      drawRoundedTrapezoid(ctx, 440, 580, 85, 85, hovered === 201 ? "#facc15" : "rgba(0,0,0,0.8)", "#ffffff", 4, 6);
      drawSprite(ctx, "Icon_ArrowM", 456, 596, 52, 52, true);

      drawRoundedTrapezoid(ctx, 895, 580, 85, 85, hovered === 202 ? "#facc15" : "rgba(0,0,0,0.8)", "#ffffff", 4, 6);
      drawSprite(ctx, "Icon_ArrowM", 911, 596, 52, 52, false);

      // Right-Side SELECT MODE Panel
      drawRoundedTrapezoid(ctx, 1120, 130, 740, 72, "#000000", "#ffffff", 4, 10);
      drawStrokedText(ctx, "SELECT MODE", 1490, 166, 38, "#ffffff", "center", 6);

      drawRoundedTrapezoid(ctx, 1120, 212, 740, 550, "rgba(0,0,0,0.78)", "#000000", 4, 8);

      // 3 Mode Cards (CO-OP RUN, TEAM RACE, RUFT RUMBLE)
      const modes = [
        { title: "CO-OP RUN", pill: "FART RUN", sprite: "Mode_FartRun", x: 1142, selected: true },
        { title: "TEAM RACE", pill: "RACE. TROLL WIN.", sprite: "Mode_TeamRace", x: 1378, selected: false },
        { title: "RUFT RUMBLE", pill: "LAST RUFT WINS", sprite: "Mode_RaftRumble", x: 1614, selected: false }
      ];
      for (const m of modes) {
        drawRoundedTrapezoid(
          ctx, m.x, 235, 224, 500,
          m.selected ? "#1e293b" : "rgba(15,23,42,0.65)",
          m.selected ? "#4ade80" : "#475569",
          m.selected ? 6 : 3, 6
        );
        drawSprite(ctx, m.sprite, m.x + 12, 250, 200, 330);
        if (!m.selected) {
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillRect(m.x + 12, 250, 200, 330);
          drawRoundedTrapezoid(ctx, m.x + 18, 390, 188, 46, "#ef4444", "#000000", 3, 4);
          drawStrokedText(ctx, "COMING SOON", m.x + 112, 413, 22, "#ffffff", "center", 4);
        }
        drawStrokedText(ctx, m.title, m.x + 112, 622, 28, "#ffffff", "center", 6);
        drawRoundedTrapezoid(ctx, m.x + 20, 660, 184, 48, m.selected ? "#4ade80" : "#334155", "#000000", 3, 5);
        drawStrokedText(ctx, m.pill, m.x + 112, 684, 20, "#ffffff", "center", 4);
      }

      // INVITE FRIENDS & START GAME Buttons
      drawRoundedTrapezoid(ctx, 1140, 790, 330, 84, hovered === 203 ? "#38bdf8" : "#0284c7", "#000000", 5, 10);
      drawStrokedText(ctx, "INVITE FRIENDS", 1305, 832, 32, "#ffffff", "center", 6);

      drawRoundedTrapezoid(ctx, 1500, 790, 360, 84, hovered === 204 ? "#4ade80" : "#22c55e", "#000000", 5, 10);
      drawSprite(ctx, "keyboard_enter", 1522, 804, 56, 56);
      drawStrokedText(ctx, "START GAME", 1710, 832, 34, "#ffffff", "center", 6);

      // Bottom Bar (Black panel + White/Green READY panel)
      ctx.fillStyle = "rgba(0,0,0,0.92)";
      ctx.fillRect(0, 960, 1410, 120);

      // ESC LEAVE
      drawSprite(ctx, "Icon_KEsc", 55, 992, 54, 54);
      drawStrokedText(ctx, "LEAVE", 122, 1020, 30, hovered === 205 ? "#facc15" : "#ffffff", "left", 5);

      // W/S CHANGE OUTFIT
      drawSprite(ctx, "Icon_KW", 640, 992, 50, 50);
      drawSprite(ctx, "Icon_KS", 695, 992, 50, 50);
      drawStrokedText(ctx, "CHANGE OUTFIT", 758, 1020, 26, hovered === 206 ? "#facc15" : "#ffffff", "left", 5);

      // A/D SELECT CHARACTER
      drawSprite(ctx, "Icon_KA", 1015, 992, 50, 50);
      drawSprite(ctx, "Icon_KD", 1070, 992, 50, 50);
      drawStrokedText(ctx, "SELECT CHARACTER", 1132, 1020, 26, hovered === 207 ? "#facc15" : "#ffffff", "left", 5);

      // SPACE READY
      const isReady = engineWasm.Engine_GetLobbyReady() === 1;
      ctx.fillStyle = isReady ? "#22c55e" : "#ffffff";
      ctx.fillRect(1410, 960, 510, 120);
      drawSprite(ctx, isReady ? "keyboard_space" : "keyboard_x", 1525, 986, 68, 68);
      drawStrokedText(ctx, isReady ? "READY" : "NOT READY", 1615, 1020, 44, "#ffffff", "left", 7);

      // Are You Sure Modal (START GAME Confirmation)
      if (engineWasm.Engine_GetLobbyConfirmOpen() === 1) {
        ctx.fillStyle = "rgba(0,0,0,0.78)";
        ctx.fillRect(0, 0, 1920, 1080);

        drawRoundedTrapezoid(ctx, 560, 290, 800, 470, "#1e293b", "#ffffff", 6, 14);
        drawRoundedTrapezoid(ctx, 680, 250, 560, 88, "#000000", "#ffffff", 5, 10);
        drawStrokedText(ctx, "START GAME", 960, 294, 46, "#facc15", "center", 7);

        drawStrokedText(ctx, "Everyone ready?", 960, 430, 38, "#ffffff", "center", 6);
        drawStrokedText(ctx, "Once the game is started new players cannot join.", 960, 505, 28, "#cbd5e1", "center", 5);

        drawRoundedTrapezoid(ctx, 635, 635, 300, 86, hovered === 210 ? "#f87171" : "#ef4444", "#000000", 5, 8);
        drawStrokedText(ctx, "NO WAIT!", 785, 678, 34, "#ffffff", "center", 6);

        drawRoundedTrapezoid(ctx, 985, 635, 300, 86, hovered === 211 ? "#4ade80" : "#22c55e", "#000000", 5, 8);
        drawStrokedText(ctx, "YES", 1135, 678, 36, "#ffffff", "center", 6);
      }
    }

    // ------------------------------------------------------------------------
    // SCENE 3: PUFFTEST DEMO LEVEL (gameplay_canvas, pause_canvas, demo_end_canvas)
    // ------------------------------------------------------------------------
    if (activeScene === 3) {
      // 1. Top Progress Bar (gameplay_canvas/progress)
      drawRoundedTrapezoid(ctx, 560, 28, 800, 46, "rgba(0,0,0,0.78)", "#000000", 4, 8);
      ctx.fillStyle = "#334155";
      ctx.fillRect(590, 45, 720, 12);
      const prog = Math.max(0, Math.min(1, engineWasm.Engine_GetProgressRatio()));
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(590, 45, 720 * prog, 12);
      drawSprite(ctx, "Icon_Finish", 1295, 22, 54, 54);
      drawSprite(ctx, "Icon_RaftS", 570 + 710 * prog, 16, 62, 62);

      // 2. Bottom-Right Gas Slider + Character Portrait (gameplay_canvas/gas_content)
      const gas = Math.max(0, Math.min(100, engineWasm.Engine_GetGasAmount()));
      drawRoundedTrapezoid(ctx, 1450, 955, 330, 56, "rgba(0,0,0,0.82)", "#000000", 4, 8);
      ctx.fillStyle = gas > 30 ? "#84cc16" : "#ef4444";
      ctx.fillRect(1464, 967, (300 * gas) / 100.0, 32);

      const charSpriteNames = ["Character_GameGreen", "Character_GameBlue", "Character_GameOrange", "Character_GameGrey"];
      const cName = charSpriteNames[engineWasm.Engine_GetCharIdx() % 4];
      drawSprite(ctx, cName, 1765, 918, 115, 115);

      // 3. Top-Right Timer & Death Counter
      drawRoundedTrapezoid(ctx, 1540, 28, 330, 58, "rgba(0,0,0,0.78)", "#000000", 4, 8);
      drawSprite(ctx, "Icon_Clock", 1554, 35, 44, 44);
      drawStrokedText(ctx, formatTimerUnity(engineWasm.Engine_GetRunTimer()), 1612, 58, 30, "#ffffff", "left", 5);

      drawRoundedTrapezoid(ctx, 1690, 96, 180, 54, "rgba(0,0,0,0.78)", "#000000", 4, 8);
      drawSprite(ctx, "Icon_RaftCrashed", 1705, 101, 44, 44);
      drawStrokedText(ctx, String(engineWasm.Engine_GetDeathCount()), 1765, 124, 30, "#f87171", "left", 5);

      // 4. Bottom-Left Tutorials (ESC LEAVE / R SUICIDE)
      drawRoundedTrapezoid(ctx, 42, 965, 210, 72, "rgba(0,0,0,0.82)", "#000000", 4, 8);
      drawSprite(ctx, "Icon_KEsc", 56, 976, 48, 48);
      drawStrokedText(ctx, "LEAVE", 116, 1001, 28, hovered === 300 ? "#facc15" : "#ffffff", "left", 5);

      drawRoundedTrapezoid(ctx, 268, 965, 220, 72, "rgba(0,0,0,0.82)", "#000000", 4, 8);
      drawSprite(ctx, "Icon_KR", 282, 976, 48, 48);
      drawStrokedText(ctx, "SUICIDE", 342, 1001, 28, hovered === 301 ? "#facc15" : "#ffffff", "left", 5);

      // 5. PAUSE_CANVAS Overlay
      if (engineWasm.Engine_GetPauseOpen() === 1) {
        ctx.fillStyle = "rgba(0,0,0,0.78)";
        ctx.fillRect(0, 0, 1920, 1080);

        const pauseBtns = [
          { id: 400, text: "CONTINUE", y: 380, size: 46 },
          { id: 401, text: "SETTINGS", y: 470, size: 38 },
          { id: 402, text: "RETURN THE MENU", y: 550, size: 38 },
          { id: 403, text: "EXIT TO DESKTOP", y: 630, size: 38 }
        ];
        for (const b of pauseBtns) {
          const isH = (hovered === b.id);
          if (isH) drawSprite(ctx, "Icon_ArrowM", 82, b.y + 12, 38, 38);
          drawStrokedText(ctx, b.text, isH ? 135 : 95, b.y + 32, b.size, isH ? "#facc15" : "#ffffff", "left", 8);
        }

        // Control Hints on Right Side of Pause Menu
        drawRoundedTrapezoid(ctx, 1180, 320, 620, 420, "rgba(15,23,42,0.9)", "#334155", 4, 10);
        drawSprite(ctx, "mouse_move", 1230, 355, 58, 58);
        drawStrokedText(ctx, "ROTATE CAMERA", 1320, 384, 28, "#ffffff", "left", 5);

        drawSprite(ctx, "mouse_scroll_vertical", 1230, 445, 58, 58);
        drawStrokedText(ctx, "CAMERA ZOOM IN/OUT", 1320, 474, 28, "#ffffff", "left", 5);

        drawSprite(ctx, "keyboard_w", 1210, 535, 52, 52);
        drawSprite(ctx, "keyboard_s", 1265, 535, 52, 52);
        drawStrokedText(ctx, "MOVE / FART (SPACE)", 1340, 561, 28, "#ffffff", "left", 5);

        drawSprite(ctx, "keyboard_a", 1210, 625, 52, 52);
        drawSprite(ctx, "keyboard_d", 1265, 625, 52, 52);
        drawStrokedText(ctx, "SLIDE", 1340, 651, 28, "#ffffff", "left", 5);
      }

      // 6. DEMO_END_CANVAS Overlay
      if (engineWasm.Engine_GetDemoEndOpen() === 1) {
        ctx.fillStyle = "rgba(0,0,0,0.84)";
        ctx.fillRect(0, 0, 1920, 1080);

        drawSprite(ctx, "Icon_Logo", 760, 45, 400, 300);
        drawRoundedTrapezoid(ctx, 520, 355, 880, 88, "#22c55e", "#000000", 5, 12);
        drawStrokedText(ctx, "YOU COMPLETED THE DEMO!", 960, 400, 46, "#ffffff", "center", 7);

        drawSprite(ctx, "Icon_Vuvuzela", 410, 340, 96, 96, true);
        drawSprite(ctx, "Icon_Vuvuzela", 1414, 340, 96, 96, false);

        drawRoundedTrapezoid(ctx, 450, 470, 1020, 340, "rgba(15,23,42,0.92)", "#334155", 4, 10);
        drawStrokedText(ctx, "Thanks for playing Fart Together demo all the way to the end!", 960, 535, 28, "#facc15", "center", 5);
        drawStrokedText(ctx, "We hope you had a blast with your friends.", 960, 595, 26, "#ffffff", "center", 5);
        drawStrokedText(ctx, "This is still a demo, so please forgive us if you ran into a few little bugs!", 960, 650, 24, "#cbd5e1", "center", 4);
        drawStrokedText(ctx, "If you enjoyed the game, wishlisting Fart Together on Steam would mean a lot!", 960, 710, 26, "#4ade80", "center", 5);

        drawRoundedTrapezoid(ctx, 450, 855, 310, 88, hovered === 500 ? "#60a5fa" : "#3b82f6", "#000000", 5, 8);
        drawStrokedText(ctx, "MAIN MENU", 605, 899, 32, "#ffffff", "center", 6);

        drawRoundedTrapezoid(ctx, 795, 855, 310, 88, hovered === 501 ? "#4ade80" : "#22c55e", "#000000", 5, 8);
        drawStrokedText(ctx, "PLAY AGAIN", 950, 899, 32, "#ffffff", "center", 6);

        drawRoundedTrapezoid(ctx, 1140, 855, 340, 88, hovered === 502 ? "#facc15" : "#eab308", "#000000", 5, 8);
        drawStrokedText(ctx, "WISHLIST ON STEAM", 1310, 899, 28, "#ffffff", "center", 6);
      }
    }

    // ------------------------------------------------------------------------
    // GLOBAL OVERLAY: SETTINGS_CANVAS (MenuScene & PuffTest)
    // ------------------------------------------------------------------------
    if (engineWasm.Engine_GetSettingsOpen() === 1) {
      ctx.fillStyle = "rgba(0,0,0,0.88)";
      ctx.fillRect(0, 0, 1920, 1080);

      // Return button + SETTINGS header
      drawRoundedTrapezoid(ctx, 95, 52, 110, 95, hovered === 600 ? "#facc15" : "#1e293b", "#ffffff", 4, 8);
      drawSprite(ctx, "Icon_ArrowM", 122, 72, 54, 54, true);
      drawStrokedText(ctx, "SETTINGS", 240, 100, 54, "#ffffff", "left", 7);

      // 4 Settings Tabs
      const activeTab = engineWasm.Engine_GetSettingsTab();
      const sndOn = engineWasm.Engine_GetSoundEnabled() === 1;
      const tabs = [
        { id: 601, idx: 0, label: "GENERAL", icon: "Icon_General", x: 140 },
        { id: 602, idx: 1, label: "GRAPHIC", icon: "Icon_Graphic", x: 545 },
        { id: 603, idx: 2, label: sndOn ? "SOUND: ON" : "SOUND: OFF", icon: "Icon_Sound", x: 950 },
        { id: 604, idx: 3, label: "CONTROL", icon: "Icon_Control", x: 1355 }
      ];
      for (const t of tabs) {
        const isSel = (activeTab === t.idx) || (hovered === t.id);
        drawRoundedTrapezoid(ctx, t.x, 210, 380, 78, isSel ? "#22c55e" : "#1e293b", "#ffffff", 4, 8);
        drawSprite(ctx, t.icon, t.x + 24, 225, 48, 48);
        drawStrokedText(ctx, t.label, t.x + 215, 249, 28, "#ffffff", "center", 5);
      }

      // Main Settings Content Box (Shows official Keyboard/Mouse control sheet)
      drawRoundedTrapezoid(ctx, 140, 315, 1595, 680, "rgba(15,23,42,0.94)", "#334155", 4, 10);
      drawSprite(ctx, "Tutorial_KeyboardMouse", 310, 340, 1260, 630);
    }

    uguiTexture.needsUpdate = true;
  }

  // ============================================================================
  // 8. MAIN UNITY WEBGL FRAME LOOP (Pass 1: 3D Camera + Pass 2: UGUI Overlay)
  // ============================================================================
  let lastTime = performance.now();
  let raycastFrameCounter = 0;

  function updateLoop(now) {
    requestAnimationFrame(updateLoop);
    const dt = Math.min((now - lastTime) / 1000.0, 0.05);
    lastTime = now;
    const t = now * 0.001;

    // Step C++ Engine State Machine
    engineWasm.Engine_Step(dt, 0, 0, 0, 0);

    const activeScene = engineWasm.Engine_GetActiveScene();
    menuSceneGroup.visible = (activeScene === 0 || activeScene === 1);
    lobbySceneGroup.visible = (activeScene === 2);
    const inGame = (activeScene === 3);
    levelRootGroup.visible = inGame;
    boatRootGroup.visible = inGame;
    particlesGroup.visible = inGame;

    if (activeScene === 0 || activeScene === 1) {
      camera.position.set(
        -5.77 + Math.sin(t * 0.5) * 0.08,
        2.05 + Math.sin(t * 0.8) * 0.04,
        -3.66 + Math.cos(t * 0.5) * 0.08
      );
      camera.lookAt(0.45, -0.05, -1.42);
    } else if (activeScene === 2) {
      camera.position.set(Math.sin(t * 0.6) * 0.04, 0.68, -0.35);
      camera.lookAt(0.0, 0.48, 3.80);
      if (lobbyCharacterGroup.children[0]) {
        lobbyCharacterGroup.children[0].position.y = -0.05 + Math.abs(Math.sin(t * 2.2)) * 0.04;
      }
    } else if (activeScene === 3 && demoLevelBuilt) {
      const paused = engineWasm.Engine_GetPauseOpen() === 1 || engineWasm.Engine_GetDemoEndOpen() === 1 || engineWasm.Engine_GetSettingsOpen() === 1;
      if (!paused) {
        let steer = 0.0;
        if (keys["KeyA"] || keys["KeyQ"] || keys["ArrowLeft"])  steer += 1.0;
        if (keys["KeyD"] || keys["ArrowRight"])                 steer -= 1.0;

        let rowThrust = 0.0;
        if (keys["KeyW"] || keys["KeyZ"] || keys["ArrowUp"])    rowThrust += 15.5;
        if (keys["KeyS"] || keys["ArrowDown"])                  rowThrust -= 9.5;

        wasmModules.gas.update_gas(dt);
        wasmModules.hazards.step_obstacles(dt);
        wasmModules.boat.step_boat_physics(steer, rowThrust, dt);
        const raceTime = wasmModules.director.update_timer(dt);

        const bx = wasmModules.boat.get_boat_x();
        const by = wasmModules.boat.get_boat_y();
        const bz = wasmModules.boat.get_boat_z();
        const byaw = wasmModules.boat.get_boat_yaw();
        const bpitch = wasmModules.boat.get_boat_pitch();
        const broll = wasmModules.boat.get_boat_roll();
        const bspeed = wasmModules.boat.get_boat_speed();

        raycastFrameCounter++;
        if (raycastFrameCounter % 3 === 0) {
          const levelDef = window.FT_BUNDLE.levels["Level_Platform"];
          let detectedWaterY = levelDef.water_y;

          if (waterColliderMeshes.length > 0) {
            raycaster.set(new THREE.Vector3(bx, by + 25.0, bz), new THREE.Vector3(0, -1, 0));
            raycaster.far = 60.0;
            const hits = raycaster.intersectObjects(waterColliderMeshes, false);
            if (hits.length > 0) detectedWaterY = hits[0].point.y + 0.35;
            else if (bx > 20.0) detectedWaterY = levelDef.upper_water_y;
          }

          if (wallColliderMeshes.length > 0) {
            raycaster.set(new THREE.Vector3(bx, by + 15.0, bz), new THREE.Vector3(0, -1, 0));
            raycaster.far = 35.0;
            const groundHits = raycaster.intersectObjects(wallColliderMeshes, false);
            if (groundHits.length > 0) {
              const gy = groundHits[0].point.y + 0.65;
              if (gy > detectedWaterY && gy - by < 6.0) detectedWaterY = gy;
            }
          }

          wasmModules.boat.set_water_surface_y(detectedWaterY);

          if (wallColliderMeshes.length > 0 && bspeed > 1.0) {
            const fwd = new THREE.Vector3(Math.sin(byaw), 0, Math.cos(byaw));
            raycaster.set(new THREE.Vector3(bx, by + 1.0, bz), fwd);
            raycaster.far = 2.6;
            const wallHits = raycaster.intersectObjects(wallColliderMeshes, false);
            if (wallHits.length > 0 && wallHits[0].face) {
              const n = wallHits[0].face.normal.clone().transformDirection(wallHits[0].object.matrixWorld);
              if (Math.abs(n.y) < 0.65) {
                wasmModules.boat.bounce_velocity(n.x, n.z, 0.65);
                playSound("impact", 0.45);
              }
            }
          }
        }

        // Obstacles Animation
        const rotAngle = wasmModules.hazards.get_rotor_angle();
        const simTime = wasmModules.hazards.get_sim_time();
        for (const item of animatedInstances) {
          if (item.anim === "spin_y") {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotAngle + item.phase);
            item.mesh.quaternion.copy(item.baseQuat).multiply(q);
          } else if (item.anim === "spin_z") {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotAngle * 1.3 + item.phase);
            item.mesh.quaternion.copy(item.baseQuat).multiply(q);
          } else if (item.anim === "spin_x") {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotAngle * 1.2 + item.phase);
            item.mesh.quaternion.copy(item.baseQuat).multiply(q);
          } else if (item.anim === "swing_z") {
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(simTime * 2.2 + item.phase) * 0.75);
            item.mesh.quaternion.copy(item.baseQuat).multiply(q);
          } else if (item.anim === "bob_y") {
            item.mesh.position.y = item.basePos.y + Math.sin(simTime * 3.0 + item.phase) * 1.1;
          }
        }

        if (wasmModules.boat.is_invulnerable() === 0) {
          for (const h of hazardColliders) {
            const hit = wasmModules.hazards.test_obstacle_collision(
              bx, by, bz, h.pos.x, h.pos.y, h.pos.z, h.radius, h.height, h.isDeadly
            );
            if (hit === 2) {
              playSound("impact", 0.85);
              triggerRespawn();
              break;
            } else if (hit === 1) {
              const nx = (bx - h.pos.x) || 0.1;
              const nz = (bz - h.pos.z) || 0.1;
              const len = Math.hypot(nx, nz);
              wasmModules.boat.apply_world_impulse((nx / len) * 260.0, 40.0, (nz / len) * 260.0);
              playSound("impact", 0.65);
              break;
            }
          }
        }

        let demoCompletedNow = 0;
        const cpResult = wasmModules.track.evaluate_boat_position(bx, by, bz);
        if (cpResult === 1) {
          const cid = wasmModules.track.get_current_checkpoint_id();
          wasmModules.director.register_checkpoint(cid);
          playSound("checkpoint", 0.85);
        } else if (cpResult === 2) {
          demoCompletedNow = 1;
          wasmModules.director.finish_race(0);
          playSound("checkpoint", 1.0);
          const finAudio = new Audio("assets/audio/game_finished.ogg");
          finAudio.volume = 0.85;
          finAudio.play().catch(() => {});
        }

        boatRootGroup.position.set(bx, by, bz);
        boatRootGroup.rotation.set(bpitch, byaw, broll, "YXZ");

        const jiggle = wasmModules.gas.get_jiggle_intensity();
        if (crewGroup) {
          const s = 1.0 + jiggle * Math.sin(now * 0.04) * 0.18;
          crewGroup.scale.set(s, 1.0 - (s - 1.0) * 0.5, s);
        }

        for (let i = fartParticles.length - 1; i >= 0; i--) {
          const fp = fartParticles[i];
          fp.life -= dt;
          if (fp.life <= 0) {
            particlesGroup.remove(fp.mesh);
            fartParticles.splice(i, 1);
          } else {
            fp.mesh.position.x += fp.vx * dt;
            fp.mesh.position.y += fp.vy * dt;
            fp.mesh.position.z += fp.vz * dt;
            const ratio = fp.life / fp.maxLife;
            fp.mesh.scale.setScalar(1.0 + (1.0 - ratio) * 1.8);
            fp.mesh.material.opacity = ratio * 0.85;
          }
        }

        const totalYaw = byaw + camYawOffset;
        const camHeight = 5.8 + camPitchOffset * 8.0;
        const desiredCamX = bx - Math.sin(totalYaw) * camZoomDist;
        const desiredCamY = by + camHeight;
        const desiredCamZ = bz - Math.cos(totalYaw) * camZoomDist;
        camera.position.lerp(new THREE.Vector3(desiredCamX, desiredCamY, desiredCamZ), 0.14);
        camera.lookAt(bx + Math.sin(byaw) * 5.0, by + 1.4, bz + Math.cos(byaw) * 5.0);

        const pct = wasmModules.track.get_progress_percentage(bx, by, bz) / 100.0;
        const gasEnergy = wasmModules.gas.get_gas_energy();
        const deaths = wasmModules.director.get_deaths();
        const cpId = wasmModules.track.get_current_checkpoint_id();

        engineWasm.Engine_SetRaftState(bx, by, bz, gasEnergy, pct, cpId, deaths, raceTime, demoCompletedNow);
      }
    }

    // Render Pass 1: 3D Scene
    renderer.clear();
    renderer.render(scene, camera);

    // Render Pass 2: Unity UGUI ScreenSpace-Overlay Canvas inside the same WebGL <canvas>
    renderUnityUGUI();
    renderer.clearDepth();
    renderer.render(uguiScene, uguiCamera);
  }

  requestAnimationFrame(updateLoop);
};
