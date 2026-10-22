// ============================================================================
// FART TOGETHER — MOTEUR 3D PUR & MULTI-WASM (5 MODULES .WASM COMPILÉS)
// Charge les vraies géométries 3D de PuffTest.unity (Level_Platform, Stage1, Parkur, RaceScene, Level1)
// ============================================================================

const wasmModules = {
  track: null,
  boat: null,
  gas: null,
  hazards: null,
  director: null
};

let scene, camera, renderer;
let levelRootGroup, boatRootGroup, crewGroup, particlesGroup, checkpointBeaconGroup;
let animatedInstances = [];
let wallColliderMeshes = [];
let waterColliderMeshes = [];
let hazardColliders = [];
let raycaster = new THREE.Raycaster();

let textures = {};
let materialPalette155 = null;
let materialPalette222 = null;
let materialWater = null;
let geometryCache = {};

let currentMapKey = "Level_Platform";
let currentBoatModelName = "boat_4p";
let currentOutfitIndex = 0;
let freeCameraMode = false;
let musicEnabled = true;
let bgMusic = null;
let sfxClips = {};

const keys = {};
let fartParticles = [];
let nextCheckpointArrow = null;

// --- 1. DÉCODAGE ET INSTANCIATION DES 5 MODULES WEBASSEMBLY (.WASM) ---
function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function loadWasmModule(name, fileUrl, b64Fallback) {
  const imports = {
    env: {
      abort: () => console.warn("[WASM abort] " + name)
    }
  };
  try {
    const resp = await fetch(fileUrl);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      const res = await WebAssembly.instantiate(buf, imports);
      return res.instance.exports;
    }
  } catch (e) {
    // Fallback sur le bundle Base64 si ouvert en file://
  }
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

  // Préchargement asynchrone des 24 modules WebAssembly IL2CPP (Assembly-CSharp.wasm à __14.wasm + FishNet.Runtime.wasm)
  wasmModules.il2cpp = {};
  fetch("wasm/unity_il2cpp/il2cpp_multi_wasm_manifest.json")
    .then(r => r.json())
    .then(async (manifest) => {
      for (const m of manifest.modules) {
        try {
          const resp = await fetch(m.file);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            const mod = await WebAssembly.compile(buf);
            wasmModules.il2cpp[m.file] = mod;
          }
        } catch (e) {}
      }
      console.log(`[Unity 6 IL2CPP Multi-WASM] ${Object.keys(wasmModules.il2cpp).length} modules .wasm chargés (${manifest.total_compiled_csharp_functions} fonctions C# compilées).`);
    })
    .catch(() => {});
}

// --- 2. CHARGEUR DE GÉOMÉTRIES BINAIRES (.FTMB) EXTRAITES DE UNITY ---
async function loadFtmbGeometry(meshName) {
  if (geometryCache[meshName]) return geometryCache[meshName];

  const url = `assets/meshes_bin/${meshName}.ftmb`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Impossible de charger ${url}`);
  const buffer = await resp.arrayBuffer();

  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "FTMB") throw new Error(`En-tête FTMB invalide pour ${meshName}`);

  const numVerts = view.getUint32(4, true);
  let byteOffset = 8;

  const posBytes = numVerts * 3 * 4;
  const normBytes = numVerts * 3 * 4;
  const uvBytes = numVerts * 2 * 4;

  const positions = new Float32Array(buffer, byteOffset, numVerts * 3);
  byteOffset += posBytes;
  const normals = new Float32Array(buffer, byteOffset, numVerts * 3);
  byteOffset += normBytes;
  const uvs = new Float32Array(buffer, byteOffset, numVerts * 2);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.computeBoundingSphere();
  geom.computeBoundingBox();

  geometryCache[meshName] = geom;
  return geom;
}

// --- 3. INITIALISATION THREE.JS, TEXTURES OFFICIELLES & AUDIO ---
function initThreeScene() {
  const canvas = document.getElementById("game-canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5ec8f8);
  scene.fog = new THREE.FogExp2(0x7fd4fa, 0.0014);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.4, 2500);

  // Éclairage solaire tropical identique à PuffTest.unity
  const hemiLight = new THREE.HemisphereLight(0xdff4ff, 0x3b6e52, 0.85);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff6e0, 1.15);
  sunLight.position.set(120, 260, 140);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 800;
  const d = 220;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  scene.add(sunLight);

  levelRootGroup = new THREE.Group();
  boatRootGroup = new THREE.Group();
  crewGroup = new THREE.Group();
  particlesGroup = new THREE.Group();
  checkpointBeaconGroup = new THREE.Group();

  boatRootGroup.add(crewGroup);
  scene.add(levelRootGroup);
  scene.add(boatRootGroup);
  scene.add(particlesGroup);
  scene.add(checkpointBeaconGroup);

  // Chargement des vraies textures de palettes Unity (Gradient Pallete 155 & Palette 222)
  const loader = new THREE.TextureLoader();
  const tex155 = loader.load(window.FT_BUNDLE.textures["tex_155.png"]);
  tex155.encoding = THREE.sRGBEncoding;
  tex155.flipY = true;
  textures["tex_155.png"] = tex155;

  const tex222 = loader.load(window.FT_BUNDLE.textures["tex_222.png"]);
  tex222.encoding = THREE.sRGBEncoding;
  tex222.flipY = true;
  textures["tex_222.png"] = tex222;

  materialPalette155 = new THREE.MeshStandardMaterial({
    map: tex155,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  materialPalette222 = new THREE.MeshStandardMaterial({
    map: tex222,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  materialWater = new THREE.MeshStandardMaterial({
    color: 0x16d9e8,
    emissive: 0x054a5c,
    roughness: 0.18,
    metalness: 0.1,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide
  });

  // Flèche directionnelle 3D au-dessus de la bouée pointant vers le prochain checkpoint
  const arrowGeom = new THREE.ConeGeometry(0.45, 1.4, 12);
  arrowGeom.rotateX(Math.PI / 2);
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xca8a04, roughness: 0.2 });
  nextCheckpointArrow = new THREE.Mesh(arrowGeom, arrowMat);
  nextCheckpointArrow.position.set(0, 3.3, 0);
  boatRootGroup.add(nextCheckpointArrow);

  // Audio SFX & Musique officielle
  for (const [k, dataUri] of Object.entries(window.FT_BUNDLE.audio)) {
    sfxClips[k] = new Audio(dataUri);
  }
  bgMusic = new Audio("assets/audio/race_music.ogg");
  bgMusic.loop = true;
  bgMusic.volume = 0.35;

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function playSound(name, volume = 0.7) {
  if (!sfxClips[name]) return;
  try {
    const clone = sfxClips[name].cloneNode();
    clone.volume = volume;
    clone.play().catch(() => {});
  } catch (e) {}
}

function startMusicIfAllowed() {
  if (musicEnabled && bgMusic && bgMusic.paused) {
    bgMusic.play().catch(() => {});
  }
}

// --- 4. CONSTRUCTION DE LA BOUÉE OFFICIELLE ET DES 4 PIRATES + CHAPEAUX/TENUES ---
async function buildBoatAndCrew(boatMeshName = "boat_4p", outfitIdx = 0) {
  currentBoatModelName = boatMeshName;
  while (boatRootGroup.children.length > 0) {
    boatRootGroup.remove(boatRootGroup.children[0]);
  }
  crewGroup = new THREE.Group();
  boatRootGroup.add(crewGroup);
  boatRootGroup.add(nextCheckpointArrow);

  // 1. Modèle 3D réel de la bouée (GM_3D_BoatMain_ThreeP / GM_3D_BoatMain)
  const boatGeom = await loadFtmbGeometry(boatMeshName);
  const boatMesh = new THREE.Mesh(boatGeom, materialPalette155);
  boatMesh.castShadow = true;
  boatMesh.receiveShadow = true;
  // Dans Boat.prefab : GM_3D_BoatMain a une rotation X de +90° (ou 0° pour Boat_FourP) et Model est à y = -0.87
  if (boatMeshName === "boat_2p") {
    boatMesh.rotation.x = Math.PI / 2;
  }
  boatMesh.position.set(0, -0.35, 0);
  boatRootGroup.add(boatMesh);

  // 2. Les 4 Pirates assis sur la bouée (GM_3D_Character_MainA..D) + leurs chapeaux et vêtements
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
  const count = boatMeshName === "boat_2p" ? 2 : 4;

  for (let i = 0; i < count; i++) {
    const pGroup = new THREE.Group();
    const seat = seats4P[i];
    pGroup.position.set(seat.x, seat.y, seat.z);
    pGroup.rotation.y = seat.ry;

    const bodyGeom = await loadFtmbGeometry(pirateMeshes[i % pirateMeshes.length]);
    const bodyMesh = new THREE.Mesh(bodyGeom, materialPalette155);
    bodyMesh.castShadow = true;
    pGroup.add(bodyMesh);

    const hatName = hatMeshes[(i + outfitIdx) % hatMeshes.length];
    const hatGeom = await loadFtmbGeometry(hatName);
    const hatMesh = new THREE.Mesh(hatGeom, materialPalette155);
    pGroup.add(hatMesh);

    const shirtName = shirtMeshes[(i + outfitIdx) % shirtMeshes.length];
    const shirtGeom = await loadFtmbGeometry(shirtName);
    const shirtMesh = new THREE.Mesh(shirtGeom, materialPalette155);
    pGroup.add(shirtMesh);

    const pantName = pantMeshes[(i + outfitIdx) % pantMeshes.length];
    const pantGeom = await loadFtmbGeometry(pantName);
    const pantMesh = new THREE.Mesh(pantGeom, materialPalette155);
    pGroup.add(pantMesh);

    crewGroup.add(pGroup);
  }
}

// --- 5. CHARGEMENT D'UN VRAI NIVEAU 3D COMPLET (PuffTest.unity / sharedassets3) ---
async function loadMapScene(mapKey) {
  const overlay = document.getElementById("loading-overlay");
  const statusEl = document.getElementById("loading-status");
  const progEl = document.getElementById("loader-progress");
  overlay.classList.remove("hidden");

  currentMapKey = mapKey;
  const levelDef = window.FT_BUNDLE.levels[mapKey];

  // Mise à jour des boutons de niveau
  document.querySelectorAll(".lvl-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick").includes(mapKey));
  });

  // Nettoyage de la scène précédente
  while (levelRootGroup.children.length > 0) levelRootGroup.remove(levelRootGroup.children[0]);
  while (checkpointBeaconGroup.children.length > 0) checkpointBeaconGroup.remove(checkpointBeaconGroup.children[0]);
  animatedInstances = [];
  wallColliderMeshes = [];
  waterColliderMeshes = [];
  hazardColliders = [];

  // Choix de la palette officielle du niveau
  const levelMat = levelDef.palette === "tex_222.png" ? materialPalette222 : materialPalette155;

  // Préchargement de tous les fichiers .ftmb uniques requis par ce niveau
  const uniqueMeshes = [...new Set(levelDef.instances.map(inst => inst.mesh))];
  if (mapKey === "Level_Platform") {
    uniqueMeshes.push("crocodile", "shark", "seesaw_main");
  }

  for (let i = 0; i < uniqueMeshes.length; i++) {
    const mName = uniqueMeshes[i];
    statusEl.textContent = `Chargement du modèle 3D officiel : ${mName}.ftmb (${i + 1}/${uniqueMeshes.length})...`;
    progEl.style.width = `${Math.round(((i + 1) / uniqueMeshes.length) * 90)}%`;
    await loadFtmbGeometry(mName);
  }

  // Instanciation exacte de chaque objet 3D du graphe de scène Unity
  for (const inst of levelDef.instances) {
    const geom = geometryCache[inst.mesh];
    if (!geom) continue;

    const isWater = inst.mesh.includes("water");
    const isArrow = inst.mesh === "dir_arrow";
    let mat = levelMat;
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

    // Classification physique pour collisions et raycasting
    if (isWater) {
      waterColliderMeshes.push(mesh);
    } else if (["demo_wall", "stage1_main", "level1_main", "parkur_map", "race_scene", "arena_main"].includes(inst.mesh)) {
      wallColliderMeshes.push(mesh);
      // Si le niveau n'a pas de mesh d'eau séparé, ajoute un plan d'eau océanique à water_y
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

  // Ajout d'un grand plan d'eau sous le niveau pour que l'eau soit visible partout
  const oceanGeom = new THREE.PlaneGeometry(3000, 3000, 32, 32);
  oceanGeom.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(oceanGeom, materialWater);
  oceanMesh.position.set(0, levelDef.water_y - 0.15, 0);
  levelRootGroup.add(oceanMesh);

  // Dans Level_Platform, ajoutons aussi les Crocodiles, Requins et Bascules (Seesaw) issus de sharedassets0 !
  if (mapKey === "Level_Platform") {
    const crocGeom = geometryCache["crocodile"];
    const sharkGeom = geometryCache["shark"];
    const seesawGeom = geometryCache["seesaw_main"];

    const extraCreatures = [
      { geom: crocGeom, pos: [-22.0, 0.6, 35.0], scale: 1.5, anim: "patrol_x" },
      { geom: crocGeom, pos: [10.0, 0.6, 5.0], scale: 1.5, anim: "patrol_z" },
      { geom: sharkGeom, pos: [85.0, 9.8, -80.0], scale: 1.6, anim: "circle" },
      { geom: sharkGeom, pos: [260.0, 9.8, -103.0], scale: 1.6, anim: "circle" },
      { geom: seesawGeom, pos: [150.0, 9.8, -75.0], scale: 1.2, anim: "swing_z" }
    ];
    for (const c of extraCreatures) {
      if (!c.geom) continue;
      const m = new THREE.Mesh(c.geom, materialPalette155);
      m.position.set(c.pos[0], c.pos[1], c.pos[2]);
      m.scale.set(c.scale, c.scale, c.scale);
      levelRootGroup.add(m);
      animatedInstances.push({
        mesh: m,
        basePos: m.position.clone(),
        baseQuat: m.quaternion.clone(),
        anim: c.anim,
        phase: c.pos[0] * 0.1
      });
      hazardColliders.push({
        mesh: m,
        pos: m.position,
        radius: 3.5,
        height: 5.0,
        isDeadly: 0
      });
    }
  }

  // Enregistrement des checkpoints dans le module WebAssembly track_engine.wasm
  wasmModules.track.reset_track(levelDef.id);
  levelDef.checkpoints.forEach((cp, idx) => {
    // Calcul de l'orientation vers le checkpoint suivant pour le respawn
    let yaw = levelDef.spawn_yaw;
    if (idx + 1 < levelDef.checkpoints.length) {
      const next = levelDef.checkpoints[idx + 1];
      yaw = Math.atan2(next.pos[0] - cp.pos[0], next.pos[2] - cp.pos[2]);
    }
    wasmModules.track.register_checkpoint(idx, cp.pos[0], cp.pos[1], cp.pos[2], cp.radius, yaw);

    // Anneau lumineux repère de checkpoint (en complément des vraies arches 3D GM_3D_CheckPointV1/V2/V3)
    const ringGeom = new THREE.TorusGeometry(cp.is_finish ? 9.5 : 7.0, 0.38, 12, 36);
    const ringMat = new THREE.MeshStandardMaterial({
      color: cp.is_finish ? 0xfacc15 : 0x38bdf8,
      emissive: cp.is_finish ? 0xca8a04 : 0x0284c7,
      transparent: true,
      opacity: 0.72
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.set(cp.pos[0], cp.pos[1] + 4.5, cp.pos[2]);
    ringMesh.rotation.y = yaw;
    ringMesh.userData = { cpIndex: idx, isFinish: !!cp.is_finish };
    checkpointBeaconGroup.add(ringMesh);
  });

  // Positionnement initial de la bouée au vrai Spawn du niveau
  const sp = levelDef.spawn;
  let initYaw = levelDef.spawn_yaw;
  if (levelDef.checkpoints.length > 1) {
    const cp1 = levelDef.checkpoints[1];
    initYaw = Math.atan2(cp1.pos[0] - sp[0], cp1.pos[2] - sp[2]);
  }
  wasmModules.boat.set_boat_pose(sp[0], sp[1], sp[2], initYaw);
  wasmModules.boat.set_water_surface_y(levelDef.water_y);
  wasmModules.director.start_race();
  wasmModules.gas.init_gas(100.0, 22.0, 0.65);

  document.getElementById("victory-modal").classList.add("hidden");
  overlay.classList.add("hidden");
  showBanner(`🏁 ${levelDef.title}`, 2600);
}

function showBanner(text, duration = 2000) {
  const b = document.getElementById("center-banner");
  b.textContent = text;
  b.classList.remove("hidden");
  clearTimeout(b._timer);
  b._timer = setTimeout(() => b.classList.add("hidden"), duration);
}

// --- 6. SYSTÈME DE PARTICULES DE GAZ & FLAMMES (PirateGas.cs) ---
function spawnFartBurst(isMega = false) {
  const count = isMega ? 36 : 16;
  const bx = wasmModules.boat.get_boat_x();
  const by = wasmModules.boat.get_boat_y();
  const bz = wasmModules.boat.get_boat_z();
  const yaw = wasmModules.boat.get_boat_yaw();

  const backX = -Math.sin(yaw);
  const backZ = -Math.cos(yaw);

  for (let i = 0; i < count; i++) {
    const size = (isMega ? 0.65 : 0.38) + Math.random() * 0.35;
    const geom = new THREE.SphereGeometry(size, 8, 8);
    const col = isMega
      ? (Math.random() > 0.4 ? 0xff5500 : 0xfacc15)
      : (Math.random() > 0.3 ? 0x84cc16 : 0x22c55e);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.88 });
    const p = new THREE.Mesh(geom, mat);

    p.position.set(
      bx + backX * 1.8 + (Math.random() - 0.5) * 1.6,
      by + 0.6 + Math.random() * 0.8,
      bz + backZ * 1.8 + (Math.random() - 0.5) * 1.6
    );
    particlesGroup.add(p);

    fartParticles.push({
      mesh: p,
      vx: backX * (8 + Math.random() * 8) + (Math.random() - 0.5) * 4,
      vy: 1.5 + Math.random() * 3.5,
      vz: backZ * (8 + Math.random() * 8) + (Math.random() - 0.5) * 4,
      life: isMega ? 0.9 : 0.6,
      maxLife: isMega ? 0.9 : 0.6
    });
  }
}

// --- 7. ACTIONS JOUEUR (PETS, RESPAWN, TÉLÉPORTATION, PERSONNALISATION) ---
function triggerPlayerFart(isMega = false) {
  startMusicIfAllowed();
  const cost = isMega ? 38.0 : 16.0;
  const mult = isMega ? 24.0 : 18.0;
  const force = wasmModules.gas.trigger_fart(cost, mult);
  if (force > 0.0) {
    const steerTorque = (keys["KeyA"] || keys["ArrowLeft"] ? 1.2 : 0) + (keys["KeyD"] || keys["ArrowRight"] ? -1.2 : 0);
    wasmModules.boat.apply_gas_impulse(force, isMega ? 95.0 : 35.0, steerTorque);
    wasmModules.director.register_fart();
    spawnFartBurst(isMega);
    playSound(isMega ? "fart_special" : "fart_short", isMega ? 0.9 : 0.7);
  }
}

window.respawnAtCheckpoint = function() {
  const rx = wasmModules.track.get_respawn_x();
  const ry = wasmModules.track.get_respawn_y();
  const rz = wasmModules.track.get_respawn_z();
  const ryaw = wasmModules.track.get_respawn_yaw();
  wasmModules.boat.set_boat_pose(rx, ry, rz, ryaw);
  wasmModules.director.register_death();
  playSound("splash", 0.75);
  showBanner("🔄 RESPAWN AU DERNIER CHECKPOINT !", 1600);
};

window.teleportNextCheckpoint = function() {
  const cur = wasmModules.track.get_current_checkpoint_id();
  const tot = wasmModules.track.get_total_checkpoints();
  const next = (cur + 1) % tot;
  wasmModules.track.force_checkpoint(next);
  const rx = wasmModules.track.get_respawn_x();
  const ry = wasmModules.track.get_respawn_y();
  const rz = wasmModules.track.get_respawn_z();
  const ryaw = wasmModules.track.get_respawn_yaw();
  wasmModules.boat.set_boat_pose(rx, ry, rz, ryaw);
  showBanner(`⏭️ TÉLÉPORTÉ AU CHECKPOINT ${next}/${tot - 1}`, 1500);
};

window.switchMap = function(mapKey) {
  loadMapScene(mapKey);
};

window.setBoatModel = function(modelName) {
  buildBoatAndCrew(modelName, currentOutfitIndex);
};

window.cycleCrewOutfits = function() {
  currentOutfitIndex = (currentOutfitIndex + 1) % 5;
  buildBoatAndCrew(currentBoatModelName, currentOutfitIndex);
  showBanner(`🎩 TENUE DES PIRATES #${currentOutfitIndex + 1}`, 1200);
};

window.toggleMusic = function() {
  musicEnabled = !musicEnabled;
  const btn = document.getElementById("btn-music");
  btn.textContent = musicEnabled ? "🎵 Musique: ON" : "🔇 Musique: OFF";
  if (musicEnabled) startMusicIfAllowed();
  else if (bgMusic) bgMusic.pause();
};

window.toggleCameraMode = function() {
  freeCameraMode = !freeCameraMode;
  showBanner(freeCameraMode ? "🎥 CAMÉRA PANORAMIQUE HAUTE" : "🎥 CAMÉRA COURSE POURSUITE", 1400);
};

window.restartCurrentMap = function() {
  loadMapScene(currentMapKey);
};

window.nextMap = function() {
  const mapKeys = Object.keys(window.FT_BUNDLE.levels);
  const idx = (mapKeys.indexOf(currentMapKey) + 1) % mapKeys.length;
  loadMapScene(mapKeys[idx]);
};

// --- 8. GESTION DES ENTRÉES CLAVIER ---
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  startMusicIfAllowed();
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    triggerPlayerFart(false);
  } else if (e.code === "KeyE" && !e.repeat) {
    triggerPlayerFart(true);
  } else if (e.code === "KeyR" && !e.repeat) {
    window.respawnAtCheckpoint();
  } else if (e.code === "KeyT" && !e.repeat) {
    window.teleportNextCheckpoint();
  } else if (e.code === "KeyC" && !e.repeat) {
    window.toggleCameraMode();
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// --- 9. BOUCLE DE SIMULATION PRINCIPALE (60 FPS, PILOTÉE PAR LES 5 FICHIERS .WASM) ---
let lastTime = performance.now();
let raycastFrameCounter = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000.0, 0.05);
  lastTime = now;

  if (!wasmModules.boat || !wasmModules.track) return;

  // 1. Entrées de pilotage (ZQSD / WASD / Flèches)
  let steer = 0.0;
  if (keys["KeyA"] || keys["KeyQ"] || keys["ArrowLeft"])  steer += 1.0;
  if (keys["KeyD"] || keys["ArrowRight"])                 steer -= 1.0;

  let rowThrust = 0.0;
  if (keys["KeyW"] || keys["KeyZ"] || keys["ArrowUp"])    rowThrust += 15.5;
  if (keys["KeyS"] || keys["ArrowDown"])                  rowThrust -= 9.5;

  // 2. Mise à jour des 5 modules WebAssembly (.wasm)
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

  // 3. Adaptation de la hauteur de l'eau (WaterChannel / Raycast sur le vrai mesh d'eau ou de canal)
  raycastFrameCounter++;
  if (raycastFrameCounter % 3 === 0) {
    const levelDef = window.FT_BUNDLE.levels[currentMapKey];
    let detectedWaterY = levelDef.water_y;

    if (waterColliderMeshes.length > 0) {
      raycaster.set(new THREE.Vector3(bx, by + 25.0, bz), new THREE.Vector3(0, -1, 0));
      raycaster.far = 60.0;
      const hits = raycaster.intersectObjects(waterColliderMeshes, false);
      if (hits.length > 0) {
        detectedWaterY = hits[0].point.y + 0.35;
      } else if (currentMapKey === "Level_Platform" && bx > 20.0) {
        detectedWaterY = levelDef.upper_water_y;
      }
    }

    // Raycast sur le sol/canal du niveau pour suivre le relief (ponts, rampes, cascades)
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

    // Collision horizontale avec les parois du canal (GM_3D_Demo_Wall / Stage1 / Parkur)
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

  // 4. Animation et collisions des obstacles 3D via obstacle_hazards.wasm
  const rotAngle = wasmModules.hazards.get_rotor_angle();
  const swingAngle = wasmModules.hazards.get_swing_angle();
  const bobOffset = wasmModules.hazards.get_bob_offset();
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
    } else if (item.anim === "patrol_x") {
      item.mesh.position.x = item.basePos.x + Math.sin(simTime * 1.2 + item.phase) * 6.5;
      item.mesh.rotation.y = Math.cos(simTime * 1.2 + item.phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else if (item.anim === "patrol_z") {
      item.mesh.position.z = item.basePos.z + Math.sin(simTime * 1.2 + item.phase) * 6.5;
      item.mesh.rotation.y = Math.cos(simTime * 1.2 + item.phase) > 0 ? 0 : Math.PI;
    } else if (item.anim === "circle") {
      const a = simTime * 1.1 + item.phase;
      item.mesh.position.x = item.basePos.x + Math.cos(a) * 7.0;
      item.mesh.position.z = item.basePos.z + Math.sin(a) * 7.0;
      item.mesh.rotation.y = -a;
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

  // 5. Validation des Checkpoints & Ligne d'Arrivée via track_engine.wasm
  const cpResult = wasmModules.track.evaluate_boat_position(bx, by, bz);
  if (cpResult === 1) {
    const cid = wasmModules.track.get_current_checkpoint_id();
    const tot = wasmModules.track.get_total_checkpoints() - 1;
    wasmModules.director.register_checkpoint(cid);
    playSound("checkpoint", 0.85);
    showBanner(`✅ CHECKPOINT ${cid} / ${tot} VALIDÉ !`, 1800);
  } else if (cpResult === 2) {
    const levelDef = window.FT_BUNDLE.levels[currentMapKey];
    wasmModules.director.finish_race(levelDef.id);
    playSound("checkpoint", 1.0);
    const finAudio = new Audio("assets/audio/game_finished.ogg");
    finAudio.volume = 0.85;
    finAudio.play().catch(() => {});

    document.getElementById("victory-map-name").textContent = levelDef.title;
    document.getElementById("vic-time").textContent = formatTime(raceTime);
    document.getElementById("vic-farts").textContent = wasmModules.director.get_farts_count();
    document.getElementById("vic-deaths").textContent = wasmModules.director.get_deaths();
    document.getElementById("vic-score").textContent = wasmModules.director.get_score();
    document.getElementById("victory-modal").classList.remove("hidden");
  }

  // 6. Mise à jour visuelle de la Bouée, des Pirates (Jiggle) et de la Flèche de Checkpoint
  boatRootGroup.position.set(bx, by, bz);
  boatRootGroup.rotation.set(bpitch, byaw, broll, "YXZ");

  const jiggle = wasmModules.gas.get_jiggle_intensity();
  if (crewGroup) {
    const s = 1.0 + jiggle * Math.sin(now * 0.04) * 0.18;
    crewGroup.scale.set(s, 1.0 - (s - 1.0) * 0.5, s);
  }

  const nextX = wasmModules.track.get_next_cp_x();
  const nextY = wasmModules.track.get_next_cp_y();
  const nextZ = wasmModules.track.get_next_cp_z();
  if (nextCheckpointArrow) {
    nextCheckpointArrow.lookAt(nextX, nextY + 3.0, nextZ);
  }

  // Mise en évidence de l'anneau du prochain checkpoint
  const targetCpIdx = wasmModules.track.get_current_checkpoint_id() + 1;
  checkpointBeaconGroup.children.forEach(ring => {
    const isNext = ring.userData.cpIndex === targetCpIdx;
    ring.scale.setScalar(isNext ? 1.15 + Math.sin(now * 0.006) * 0.1 : 0.85);
    ring.material.opacity = isNext ? 0.92 : 0.28;
  });

  // 7. Mise à jour des particules de gaz
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

  // 8. Caméra de poursuite fluide (BoatCamera.cs)
  if (freeCameraMode) {
    const targetCamPos = new THREE.Vector3(bx - Math.sin(byaw) * 32, by + 26, bz - Math.cos(byaw) * 32);
    camera.position.lerp(targetCamPos, 0.08);
    camera.lookAt(bx, by + 2.0, bz);
  } else {
    const camDist = 13.5;
    const camHeight = 6.2;
    const desiredCamX = bx - Math.sin(byaw) * camDist;
    const desiredCamY = by + camHeight;
    const desiredCamZ = bz - Math.cos(byaw) * camDist;
    camera.position.lerp(new THREE.Vector3(desiredCamX, desiredCamY, desiredCamZ), 0.12);
    camera.lookAt(bx + Math.sin(byaw) * 6.0, by + 1.4, bz + Math.cos(byaw) * 6.0);
  }

  // 9. Mise à jour du HUD (Chrono, Checkpoints, Morts, Vitesse, Progression, Jauge de Gaz)
  document.getElementById("hud-time").textContent = formatTime(raceTime);
  const curCp = wasmModules.track.get_current_checkpoint_id();
  const maxCp = Math.max(1, wasmModules.track.get_total_checkpoints() - 1);
  document.getElementById("hud-cp").textContent = `${curCp} / ${maxCp}`;
  document.getElementById("hud-deaths").textContent = wasmModules.director.get_deaths();
  document.getElementById("hud-speed").textContent = `${Math.round(bspeed * 3.6)} km/h`;

  const pct = wasmModules.track.get_progress_percentage(bx, by, bz);
  document.getElementById("hud-pct").textContent = `${ pct.toFixed(1) }%`;
  document.getElementById("progress-fill").style.width = `${pct}%`;
  document.getElementById("progress-boat-icon").style.left = `${pct}%`;

  const gasEnergy = wasmModules.gas.get_gas_energy();
  document.getElementById("gas-val").textContent = `${Math.round(gasEnergy)}%`;
  document.getElementById("gas-fill").style.width = `${gasEnergy}%`;

  renderer.render(scene, camera);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${String(m).padStart(2, "0")}:${s.padStart(4, "0")}`;
}

// --- 10. DÉMARRAGE AUTOMATIQUE ---
(async function main() {
  initThreeScene();
  await initAllWasmModules();
  await buildBoatAndCrew("boat_4p", 0);
  await loadMapScene("Level_Platform");
  requestAnimationFrame(animate);
})();
