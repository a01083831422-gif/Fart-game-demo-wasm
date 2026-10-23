// ============================================================================
// FART TOGETHER DEMO — PURE WEBGL + MULTI-WASM RUNTIME (29 MODULES .WASM)
// Scenes: Bootstrap -> MenuScene (level1) -> LobbyScene (level2) -> PuffTest (level3)
// ============================================================================

const wasmModules = {
  track: null,
  boat: null,
  gas: null,
  hazards: null,
  director: null,
  il2cpp: {}
};

// Scene States: "SPLASH" | "MENU" | "LOBBY" | "GAMEPLAY"
let currentSceneState = "SPLASH";
let isPaused = false;
let isDemoCompleted = false;

let scene, camera, renderer;
let menuSceneGroup, lobbySceneGroup, lobbyCharacterGroup;
let levelRootGroup, boatRootGroup, crewGroup, particlesGroup, checkpointBeaconGroup;

let animatedInstances = [];
let wallColliderMeshes = [];
let waterColliderMeshes = [];
let hazardColliders = [];
let raycaster = new THREE.Raycaster();

let materialPalette155 = null;
let materialPalette222 = null;
let materialBgr = null;
let materialWater = null;
let skyboxCubeTex = null;
let geometryCache = {};

// Player Customization (LobbyScene -> Gameplay)
let selectedCharIdx = 0; // 0: Green, 1: Blue, 2: Orange, 3: Grey
let selectedOutfitIdx = 0; // 0..4
let isLobbyReady = true;
const charIcons = [
  "assets/ui/Character_GameGreen.png",
  "assets/ui/Character_GameBlue.png",
  "assets/ui/Character_GameOrange.png",
  "assets/ui/Character_GameGrey.png"
];

// Camera Orbit / Zoom in Gameplay (BoatCamera.cs)
let camYawOffset = 0.0;
let camPitchOffset = 0.0;
let camZoomDist = 13.5;

// Audio
let musicEnabled = true;
let menuMusic = null;
let raceMusic = null;
let sfxClips = {};

const keys = {};
let fartParticles = [];

// --- 0. UNITY CANVASSCALER (1920x1080 REFERENCE RESOLUTION) ---
function updateCanvasScaler() {
  const scaler = document.getElementById("unity-canvas-scaler");
  if (!scaler) return;
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale = Math.min(scaleX, scaleY);
  scaler.style.transform = `scale(${scale})`;
}
window.addEventListener("resize", updateCanvasScaler);
updateCanvasScaler();

// --- 1. MULTI-WASM LOADER (5 GAMEPLAY .WASM + 24 UNITY IL2CPP .WASM) ---
function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function loadWasmModule(name, fileUrl, b64Fallback) {
  const imports = {
    env: {
      abort: () => {}
    }
  };
  try {
    const resp = await fetch(fileUrl);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      const res = await WebAssembly.instantiate(buf, imports);
      return res.instance.exports;
    }
  } catch (e) {}
  const buf = base64ToArrayBuffer(b64Fallback);
  const res = await WebAssembly.instantiate(buf, imports);
  return res.instance.exports;
}

async function initAllWasmModules() {
  const b = window.FT_BUNDLE.wasm;
  wasmModules.track    = await loadWasmModule("track_engine",     "wasm/track_engine.wasm",     b.track_engine);
  wasmModules.boat     = await loadWasmModule("boat_buoyancy",    "wasm/boat_buoyancy.wasm",    b.boat_buoyancy);
  wasmModules.gas      = await loadWasmModule("gas_physics",      "wasm/gas_physics.wasm",      b.gas_physics);
  wasmModules.hazards  = await loadWasmModule("obstacle_hazards", "wasm/obstacle_hazards.wasm", b.obstacle_hazards);
  wasmModules.director = await loadWasmModule("game_director",    "wasm/game_director.wasm",    b.game_director);

  wasmModules.gas.init_gas(100.0, 22.0, 0.65);
  wasmModules.director.init_director();

  // Asynchronous background loading of the 24 Unity 6 IL2CPP .wasm modules
  fetch("wasm/unity_il2cpp/il2cpp_multi_wasm_manifest.json")
    .then(r => r.json())
    .then(async (manifest) => {
      for (const m of manifest.modules) {
        try {
          const resp = await fetch(m.file);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            wasmModules.il2cpp[m.file] = await WebAssembly.compile(buf);
          }
        } catch (e) {}
      }
    })
    .catch(() => {});
}

// --- 2. BINARY MESH LOADER (.FTMB) ---
async function loadFtmbGeometry(meshName, flipX = false) {
  const cacheKey = flipX ? `${meshName}__flipX` : meshName;
  if (geometryCache[cacheKey]) return geometryCache[cacheKey];

  const url = `assets/meshes_bin/${meshName}.ftmb`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}`);
  const buffer = await resp.arrayBuffer();

  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "FTMB") throw new Error(`Invalid FTMB header for ${meshName}`);

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

// --- 3. THREE.JS INITIALIZATION, CUBEMAP SKYBOX, PALETTES & AUDIO ---
function initThreeScene() {
  const canvas = document.getElementById("game-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();

  // Load Unity Skybox Cubemap (Day_BlueSky_Nothing)
  const cubeLoader = new THREE.CubeTextureLoader();
  skyboxCubeTex = cubeLoader.load([
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

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 2500);

  const hemiLight = new THREE.HemisphereLight(0xe6f6ff, 0x4b785e, 0.92);
  scene.add(hemiLight);

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

  menuSceneGroup = new THREE.Group();
  lobbySceneGroup = new THREE.Group();
  lobbyCharacterGroup = new THREE.Group();
  lobbySceneGroup.add(lobbyCharacterGroup);

  levelRootGroup = new THREE.Group();
  boatRootGroup = new THREE.Group();
  crewGroup = new THREE.Group();
  particlesGroup = new THREE.Group();
  checkpointBeaconGroup = new THREE.Group();
  boatRootGroup.add(crewGroup);

  scene.add(menuSceneGroup);
  scene.add(lobbySceneGroup);
  scene.add(levelRootGroup);
  scene.add(boatRootGroup);
  scene.add(particlesGroup);
  scene.add(checkpointBeaconGroup);

  // Load Official Unity Textures
  const loader = new THREE.TextureLoader();

  const tex155 = loader.load(window.FT_BUNDLE.textures["tex_155.png"]);
  tex155.encoding = THREE.sRGBEncoding;
  tex155.flipY = true;

  const tex222 = loader.load(window.FT_BUNDLE.textures["tex_222.png"]);
  tex222.encoding = THREE.sRGBEncoding;
  tex222.flipY = true;

  const texBgr = loader.load("assets/ui/bgr_default_tex.png");
  texBgr.encoding = THREE.sRGBEncoding;
  texBgr.flipY = true;

  materialPalette155 = new THREE.MeshStandardMaterial({
    map: tex155,
    roughness: 0.55,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  materialPalette222 = new THREE.MeshStandardMaterial({
    map: tex222,
    roughness: 0.55,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  materialBgr = new THREE.MeshStandardMaterial({
    map: texBgr,
    roughness: 0.65,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  materialWater = new THREE.MeshStandardMaterial({
    color: 0x12d6e3,
    emissive: 0x065466,
    roughness: 0.16,
    metalness: 0.08,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
  });

  // Audio Setup
  for (const [k, dataUri] of Object.entries(window.FT_BUNDLE.audio)) {
    sfxClips[k] = new Audio(dataUri);
  }
  sfxClips["btn_click"] = new Audio("assets/audio/button_click.ogg");
  sfxClips["btn_hover"] = new Audio("assets/audio/button_hover.ogg");

  menuMusic = new Audio("assets/audio/menu_music.ogg");
  menuMusic.loop = true;
  menuMusic.volume = 0.4;

  raceMusic = new Audio("assets/audio/race_music.ogg");
  raceMusic.loop = true;
  raceMusic.volume = 0.35;

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Mouse Orbit & Wheel Zoom in Gameplay
  window.addEventListener("mousemove", (e) => {
    if (currentSceneState === "GAMEPLAY" && !isPaused && !isDemoCompleted && e.buttons === 1) {
      camYawOffset -= e.movementX * 0.005;
      camPitchOffset = Math.max(-0.35, Math.min(0.65, camPitchOffset + e.movementY * 0.004));
    }
  });

  window.addEventListener("wheel", (e) => {
    if (currentSceneState === "GAMEPLAY" && !isPaused) {
      camZoomDist = Math.max(7.5, Math.min(26.0, camZoomDist + e.deltaY * 0.01));
    }
  });

  // Hover sound on Unity buttons
  document.querySelectorAll(".u-menu-btn").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      document.querySelectorAll(".u-menu-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      playSound("btn_hover", 0.4);
    });
  });
}

function playSound(name, volume = 0.7) {
  if (!sfxClips[name] || !musicEnabled) return;
  try {
    const clone = sfxClips[name].cloneNode();
    clone.volume = volume;
    clone.play().catch(() => {});
  } catch (e) {}
}

function syncSceneMusic() {
  if (!musicEnabled) {
    if (menuMusic) menuMusic.pause();
    if (raceMusic) raceMusic.pause();
    return;
  }
  if (currentSceneState === "MENU" || currentSceneState === "LOBBY") {
    if (raceMusic) raceMusic.pause();
    if (menuMusic && menuMusic.paused) menuMusic.play().catch(() => {});
  } else if (currentSceneState === "GAMEPLAY") {
    if (menuMusic) menuMusic.pause();
    if (raceMusic && raceMusic.paused) raceMusic.play().catch(() => {});
  }
}

// --- 4. BUILD 3D SCENE 1: MENUSCENE (level1) ---
async function buildMenuScene3D() {
  if (menuSceneGroup.children.length > 0) return;

  // Flip X so Three.js right-handed camera matches Unity left-handed Menu Camera (1.png) 100%
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

  const watMesh = new THREE.Mesh(watGeom, materialWater);
  menuSceneGroup.add(watMesh);
}

// --- 5. BUILD 3D SCENE 2: LOBBYSCENE (level2) ---
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
  while (lobbyCharacterGroup.children.length > 0) {
    lobbyCharacterGroup.remove(lobbyCharacterGroup.children[0]);
  }

  const pirateMeshes = ["pirate_a", "pirate_b", "pirate_c", "pirate_d"];
  const hatMeshes = ["hat_1", "hat_2", "hat_3", "hat_4", "hat_5"];
  const shirtMeshes = ["shirt_1", "shirt_2", "tshirt_1", "tshirt_2"];
  const pantMeshes = ["pant_1", "pant_2", "pant_3"];

  const charGroup = new THREE.Group();
  // lobby_character_stage seat_1 is at (0, 0, 3.80) in front of lobby_cam
  charGroup.position.set(0.0, -0.05, 3.4);
  charGroup.rotation.y = Math.PI;
  charGroup.scale.set(1.15, 1.15, 1.15);

  const bodyGeom = await loadFtmbGeometry(pirateMeshes[selectedCharIdx % pirateMeshes.length]);
  const bodyMesh = new THREE.Mesh(bodyGeom, materialPalette155);
  bodyMesh.castShadow = true;
  charGroup.add(bodyMesh);

  const hatGeom = await loadFtmbGeometry(hatMeshes[selectedOutfitIdx % hatMeshes.length]);
  charGroup.add(new THREE.Mesh(hatGeom, materialPalette155));

  const shirtGeom = await loadFtmbGeometry(shirtMeshes[selectedOutfitIdx % shirtMeshes.length]);
  charGroup.add(new THREE.Mesh(shirtGeom, materialPalette155));

  const pantGeom = await loadFtmbGeometry(pantMeshes[selectedOutfitIdx % pantMeshes.length]);
  charGroup.add(new THREE.Mesh(pantGeom, materialPalette155));

  lobbyCharacterGroup.add(charGroup);

  const iconEl = document.getElementById("gp-char-icon");
  if (iconEl) iconEl.src = charIcons[selectedCharIdx % charIcons.length];
}

// --- 6. BUILD 3D BOAT & HIPPO CREW + DEMO LEVEL (level3 - Level_Platform) ---
async function buildBoatAndCrew(outfitIdx = 0) {
  while (boatRootGroup.children.length > 0) {
    boatRootGroup.remove(boatRootGroup.children[0]);
  }
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

    const pIdx = (selectedCharIdx + i) % pirateMeshes.length;
    const bodyGeom = await loadFtmbGeometry(pirateMeshes[pIdx]);
    const bodyMesh = new THREE.Mesh(bodyGeom, materialPalette155);
    bodyMesh.castShadow = true;
    pGroup.add(bodyMesh);

    const hatGeom = await loadFtmbGeometry(hatMeshes[(i + outfitIdx) % hatMeshes.length]);
    pGroup.add(new THREE.Mesh(hatGeom, materialPalette155));

    const shirtGeom = await loadFtmbGeometry(shirtMeshes[(i + outfitIdx) % shirtMeshes.length]);
    pGroup.add(new THREE.Mesh(shirtGeom, materialPalette155));

    const pantGeom = await loadFtmbGeometry(pantMeshes[(i + outfitIdx) % pantMeshes.length]);
    pGroup.add(new THREE.Mesh(pantGeom, materialPalette155));

    crewGroup.add(pGroup);
  }
}

async function loadDemoLevel3D() {
  const levelDef = window.FT_BUNDLE.levels["Level_Platform"];

  while (levelRootGroup.children.length > 0) levelRootGroup.remove(levelRootGroup.children[0]);
  while (checkpointBeaconGroup.children.length > 0) checkpointBeaconGroup.remove(checkpointBeaconGroup.children[0]);
  animatedInstances = [];
  wallColliderMeshes = [];
  waterColliderMeshes = [];
  hazardColliders = [];

  const uniqueMeshes = [...new Set(levelDef.instances.map(inst => inst.mesh))];
  uniqueMeshes.push("demo_start_env", "crocodile", "shark", "seesaw_main");

  await Promise.all(uniqueMeshes.map(m => loadFtmbGeometry(m)));

  // Add Start_env (surrounding tropical island/rocks/trees of Level_Platform)
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
    if (isWater) {
      mat = materialWater;
    } else if (isArrow) {
      mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, roughness: 0.3, side: THREE.DoubleSide });
    }

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

  // Ocean water plane at level water_y
  const oceanGeom = new THREE.PlaneGeometry(3000, 3000);
  oceanGeom.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(oceanGeom, materialWater);
  oceanMesh.position.set(0, levelDef.water_y - 0.18, 0);
  levelRootGroup.add(oceanMesh);

  // Register Checkpoints in track_engine.wasm
  wasmModules.track.reset_track(levelDef.id);
  levelDef.checkpoints.forEach((cp, idx) => {
    let yaw = levelDef.spawn_yaw;
    if (idx + 1 < levelDef.checkpoints.length) {
      const next = levelDef.checkpoints[idx + 1];
      yaw = Math.atan2(next.pos[0] - cp.pos[0], next.pos[2] - cp.pos[2]);
    }
    wasmModules.track.register_checkpoint(idx, cp.pos[0], cp.pos[1], cp.pos[2], cp.radius, yaw);
  });

  // Reset Boat at Demo Spawn
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

  camYawOffset = 0.0;
  camPitchOffset = 0.0;
  camZoomDist = 13.5;
  isPaused = false;
  isDemoCompleted = false;
}

// --- 7. SCENE NAVIGATION (MenuScene -> LobbyScene -> PuffTest Demo) ---
function setVisibleCanvas(canvasId) {
  const ids = ["splash-canvas", "menu-canvas", "lobby-canvas", "gameplay-canvas", "pause-canvas", "demo-end-canvas", "settings-canvas"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", id !== canvasId);
  });
}

function update3DGroupVisibility() {
  menuSceneGroup.visible = (currentSceneState === "MENU" || currentSceneState === "SPLASH");
  lobbySceneGroup.visible = (currentSceneState === "LOBBY");
  const inGame = (currentSceneState === "GAMEPLAY");
  levelRootGroup.visible = inGame;
  boatRootGroup.visible = inGame;
  particlesGroup.visible = inGame;
  checkpointBeaconGroup.visible = inGame;
}

window.goToMenuScene = async function() {
  playSound("btn_click", 0.6);
  await buildMenuScene3D();
  currentSceneState = "MENU";
  isPaused = false;
  update3DGroupVisibility();
  setVisibleCanvas("menu-canvas");
  syncSceneMusic();
};

window.onMenuCreateLobby = async function() {
  playSound("btn_click", 0.6);
  await buildLobbyScene3D();
  currentSceneState = "LOBBY";
  update3DGroupVisibility();
  setVisibleCanvas("lobby-canvas");
  document.getElementById("lobby-confirm-panel").classList.add("hidden");
  syncSceneMusic();
};

window.onMenuFindLobby = function() {
  const code = document.getElementById("menu-lobby-code-input").value.trim().toUpperCase() || "QND3F";
  document.getElementById("lobby-code-text").textContent = code;
  window.onMenuCreateLobby();
};

window.onMenuExit = function() {
  playSound("btn_click", 0.6);
  window.goToMenuScene();
};

window.changeLobbyCharacter = function(delta) {
  playSound("btn_click", 0.55);
  selectedCharIdx = (selectedCharIdx + delta + 4) % 4;
  updateLobbyCharacter3D();
};

window.changeLobbyOutfit = function(delta) {
  playSound("btn_click", 0.55);
  selectedOutfitIdx = (selectedOutfitIdx + delta + 5) % 5;
  updateLobbyCharacter3D();
};

window.toggleLobbyReady = function() {
  playSound("btn_click", 0.55);
  isLobbyReady = !isLobbyReady;
  document.getElementById("lobby-ready-text").textContent = isLobbyReady ? "READY" : "UNREADY";
  document.getElementById("lobby-ready-key").src = isLobbyReady ? "assets/ui/keyboard_space.png" : "assets/ui/keyboard_x.png";
};

window.copyLobbyCode = function() {
  playSound("btn_click", 0.55);
  const code = document.getElementById("lobby-code-text").textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
};

window.openLobbyStartConfirm = function() {
  playSound("btn_click", 0.6);
  document.getElementById("lobby-confirm-panel").classList.remove("hidden");
};

window.closeLobbyStartConfirm = function() {
  playSound("btn_click", 0.6);
  document.getElementById("lobby-confirm-panel").classList.add("hidden");
};

window.startDemoGameplay = async function() {
  playSound("btn_click", 0.7);
  document.getElementById("lobby-confirm-panel").classList.add("hidden");
  await buildBoatAndCrew(selectedOutfitIdx);
  await loadDemoLevel3D();
  currentSceneState = "GAMEPLAY";
  update3DGroupVisibility();
  setVisibleCanvas("gameplay-canvas");
  syncSceneMusic();
};

window.restartDemoLevel = async function() {
  playSound("btn_click", 0.6);
  await loadDemoLevel3D();
  currentSceneState = "GAMEPLAY";
  update3DGroupVisibility();
  setVisibleCanvas("gameplay-canvas");
  syncSceneMusic();
};

window.togglePauseCanvas = function(pauseState) {
  if (currentSceneState !== "GAMEPLAY" || isDemoCompleted) return;
  playSound("btn_click", 0.55);
  isPaused = pauseState !== undefined ? pauseState : !isPaused;
  document.getElementById("pause-canvas").classList.toggle("hidden", !isPaused);
};

window.openSettingsCanvas = function() {
  playSound("btn_click", 0.55);
  document.getElementById("settings-canvas").classList.remove("hidden");
};

window.closeSettingsCanvas = function() {
  playSound("btn_click", 0.55);
  document.getElementById("settings-canvas").classList.add("hidden");
};

window.toggleMusic = function() {
  musicEnabled = !musicEnabled;
  const lbl = document.getElementById("settings-sound-label");
  if (lbl) lbl.textContent = musicEnabled ? "SOUND: ON" : "SOUND: OFF";
  syncSceneMusic();
};

// --- 8. PLAYER FART & RESPAWN MECHANICS (PirateGas.cs) ---
function spawnFartBurst(isMega = false) {
  const count = isMega ? 32 : 15;
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
  syncSceneMusic();
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

window.respawnAtCheckpoint = function() {
  if (currentSceneState !== "GAMEPLAY") return;
  const rx = wasmModules.track.get_respawn_x();
  const ry = wasmModules.track.get_respawn_y();
  const rz = wasmModules.track.get_respawn_z();
  const ryaw = wasmModules.track.get_respawn_yaw();
  wasmModules.boat.set_boat_pose(rx, ry, rz, ryaw);
  wasmModules.director.register_death();
  playSound("splash", 0.75);
};

// --- 9. KEYBOARD INPUTS ACROSS ALL 3 SCENES ---
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  syncSceneMusic();

  if (!document.getElementById("settings-canvas").classList.contains("hidden")) {
    if (e.code === "Escape") window.closeSettingsCanvas();
    return;
  }

  if (currentSceneState === "MENU") {
    if (e.code === "Enter" && !e.repeat) {
      window.onMenuCreateLobby();
    }
  } else if (currentSceneState === "LOBBY") {
    const confirmOpen = !document.getElementById("lobby-confirm-panel").classList.contains("hidden");
    if (e.code === "Escape" && !e.repeat) {
      if (confirmOpen) window.closeLobbyStartConfirm();
      else window.goToMenuScene();
    } else if (e.code === "Enter" && !e.repeat) {
      if (confirmOpen) window.startDemoGameplay();
      else window.openLobbyStartConfirm();
    } else if ((e.code === "KeyA" || e.code === "ArrowLeft") && !e.repeat) {
      window.changeLobbyCharacter(-1);
    } else if ((e.code === "KeyD" || e.code === "ArrowRight") && !e.repeat) {
      window.changeLobbyCharacter(1);
    } else if ((e.code === "KeyW" || e.code === "ArrowUp") && !e.repeat) {
      window.changeLobbyOutfit(1);
    } else if ((e.code === "KeyS" || e.code === "ArrowDown") && !e.repeat) {
      window.changeLobbyOutfit(-1);
    } else if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      window.toggleLobbyReady();
    }
  } else if (currentSceneState === "GAMEPLAY") {
    if (e.code === "Escape" && !e.repeat) {
      window.togglePauseCanvas();
      return;
    }
    if (isPaused || isDemoCompleted) return;

    if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      triggerPlayerFart(false);
    } else if (e.code === "KeyE" && !e.repeat) {
      triggerPlayerFart(true);
    } else if (e.code === "KeyR" && !e.repeat) {
      window.respawnAtCheckpoint();
    }
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// --- 10. MAIN RENDER & WASM SIMULATION LOOP ---
let lastTime = performance.now();
let raycastFrameCounter = 0;

function formatTimerUnity(sec) {
  const totalMs = Math.floor(sec * 100);
  const cs = totalMs % 100;
  const totalS = Math.floor(sec);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60) % 60;
  const h = Math.floor(totalS / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000.0, 0.05);
  lastTime = now;
  const t = now * 0.001;

  // SCENE 1: MENUSCENE CAMERA (level1: Menu Camera pos=(5.77, 2.05, -3.66) rot=(0.134, -0.558, 0.092, 0.814) fov=60)
  if (currentSceneState === "MENU" || currentSceneState === "SPLASH") {
    camera.position.set(
      -5.77 + Math.sin(t * 0.5) * 0.08,
      2.05 + Math.sin(t * 0.8) * 0.04,
      -3.66 + Math.cos(t * 0.5) * 0.08
    );
    camera.lookAt(0.45, -0.05, -1.42);
    renderer.render(scene, camera);
    return;
  }

  // SCENE 2: LOBBYSCENE CAMERA (level2: lobby_cam pos=(0, 0.40, 0) looking at lobby_character_stage)
  if (currentSceneState === "LOBBY") {
    camera.position.set(Math.sin(t * 0.6) * 0.04, 0.68, -0.35);
    camera.lookAt(0.0, 0.48, 3.80);
    if (lobbyCharacterGroup.children[0]) {
      lobbyCharacterGroup.children[0].position.y = -0.05 + Math.abs(Math.sin(t * 2.2)) * 0.04;
    }
    renderer.render(scene, camera);
    return;
  }

  // SCENE 3: PUFFTEST GAMEPLAY (level3 - Level_Platform)
  if (!wasmModules.boat || !wasmModules.track) return;

  if (!isPaused && !isDemoCompleted) {
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

    let bx = wasmModules.boat.get_boat_x();
    let by = wasmModules.boat.get_boat_y();
    let bz = wasmModules.boat.get_boat_z();
    const byaw = wasmModules.boat.get_boat_yaw();
    const bpitch = wasmModules.boat.get_boat_pitch();
    const broll = wasmModules.boat.get_boat_roll();
    const bspeed = wasmModules.boat.get_boat_speed();

    // Water Channel Raycasting
    raycastFrameCounter++;
    if (raycastFrameCounter % 3 === 0) {
      const levelDef = window.FT_BUNDLE.levels["Level_Platform"];
      let detectedWaterY = levelDef.water_y;

      if (waterColliderMeshes.length > 0) {
        raycaster.set(new THREE.Vector3(bx, by + 25.0, bz), new THREE.Vector3(0, -1, 0));
        raycaster.far = 60.0;
        const hits = raycaster.intersectObjects(waterColliderMeshes, false);
        if (hits.length > 0) {
          detectedWaterY = hits[0].point.y + 0.35;
        } else if (bx > 20.0) {
          detectedWaterY = levelDef.upper_water_y;
        }
      }

      if (wallColliderMeshes.length > 0) {
        raycaster.set(new THREE.Vector3(bx, by + 15.0, bz), new THREE.Vector3(0, -1, 0));
        raycaster.far = 35.0;
        const groundHits = raycaster.intersectObjects(wallColliderMeshes, false);
        if (groundHits.length > 0) {
          const gy = groundHits[0].point.y + 0.65;
          if (gy > detectedWaterY && gy - by < 6.0) {
            detectedWaterY = gy;
          }
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

    // Obstacles Animation & Collision via obstacle_hazards.wasm
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
          bx, by, bz,
          h.pos.x, h.pos.y, h.pos.z,
          h.radius, h.height, h.isDeadly
        );
        if (hit === 2) {
          playSound("impact", 0.85);
          window.respawnAtCheckpoint();
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

    // Checkpoints & Finish Arch Evaluation via track_engine.wasm
    const cpResult = wasmModules.track.evaluate_boat_position(bx, by, bz);
    if (cpResult === 1) {
      const cid = wasmModules.track.get_current_checkpoint_id();
      wasmModules.director.register_checkpoint(cid);
      playSound("checkpoint", 0.85);
    } else if (cpResult === 2) {
      isDemoCompleted = true;
      wasmModules.director.finish_race(0);
      playSound("checkpoint", 1.0);
      const finAudio = new Audio("assets/audio/game_finished.ogg");
      finAudio.volume = 0.85;
      finAudio.play().catch(() => {});
      document.getElementById("demo-end-canvas").classList.remove("hidden");
    }

    // Update Boat & Hippo Crew Transform
    boatRootGroup.position.set(bx, by, bz);
    boatRootGroup.rotation.set(bpitch, byaw, broll, "YXZ");

    const jiggle = wasmModules.gas.get_jiggle_intensity();
    if (crewGroup) {
      const s = 1.0 + jiggle * Math.sin(now * 0.04) * 0.18;
      crewGroup.scale.set(s, 1.0 - (s - 1.0) * 0.5, s);
    }

    // Update Fart Particles
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

    // BoatCamera.cs Follow Camera
    const totalYaw = byaw + camYawOffset;
    const camHeight = 5.8 + camPitchOffset * 8.0;
    const desiredCamX = bx - Math.sin(totalYaw) * camZoomDist;
    const desiredCamY = by + camHeight;
    const desiredCamZ = bz - Math.cos(totalYaw) * camZoomDist;
    camera.position.lerp(new THREE.Vector3(desiredCamX, desiredCamY, desiredCamZ), 0.14);
    camera.lookAt(bx + Math.sin(byaw) * 5.0, by + 1.4, bz + Math.cos(byaw) * 5.0);

    // Update Authentic gameplay_canvas HUD
    document.getElementById("gp-timer-val").textContent = formatTimerUnity(raceTime);
    document.getElementById("gp-death-val").textContent = wasmModules.director.get_deaths();

    const pct = wasmModules.track.get_progress_percentage(bx, by, bz);
    document.getElementById("gp-progress-raft").style.left = `${pct}%`;

    const gasEnergy = wasmModules.gas.get_gas_energy();
    document.getElementById("gp-gas-fill").style.width = `${gasEnergy}%`;
  }

  renderer.render(scene, camera);
}

// --- 11. BOOTSTRAP STARTUP ---
(async function main() {
  initThreeScene();
  await initAllWasmModules();
  await buildMenuScene3D();
  setTimeout(() => {
    window.goToMenuScene();
  }, 650);
  requestAnimationFrame(animate);
})();
