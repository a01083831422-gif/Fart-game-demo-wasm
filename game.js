// game.js - Fart Together WebAssembly Game Engine

let wasmTrack = null;
let wasmGas = null;
let wasmBoat = null;
let wasmHazards = null;
let wasmDirector = null;

let currentLevelId = 1;
let currentSkinKey = 'palette_officielle.png';
let isRunning = false;

// Audio Helper
function playSound(audioName) {
    if (typeof GAME_ASSETS_BUNDLE !== 'undefined' && GAME_ASSETS_BUNDLE.audio && GAME_ASSETS_BUNDLE.audio[audioName]) {
        const audio = new Audio(GAME_ASSETS_BUNDLE.audio[audioName]);
        audio.play().catch(() => {});
    }
}

// Convert base64 to Uint8Array for offline WASM execution
function base64ToUint8(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

// Instantiate WASM module from file or bundle fallback
async function loadWasmModule(name) {
    try {
        const response = await fetch(`wasm/${name}.wasm`);
        if (response.ok) {
            const buffer = await response.arrayBuffer();
            const res = await WebAssembly.instantiate(buffer);
            return res.instance.exports;
        }
    } catch (e) {
        // Fallback to embedded bundle (useful when running locally via file:///)
    }

    if (typeof GAME_ASSETS_BUNDLE !== 'undefined' && GAME_ASSETS_BUNDLE.wasm && GAME_ASSETS_BUNDLE.wasm[name]) {
        const bytes = base64ToUint8(GAME_ASSETS_BUNDLE.wasm[name]);
        const res = await WebAssembly.instantiate(bytes);
        return res.instance.exports;
    }
    throw new Error(`WASM module ${name} could not be loaded`);
}

async function initAllWasm() {
    wasmTrack = await loadWasmModule('track_engine');
    wasmGas = await loadWasmModule('gas_physics');
    wasmBoat = await loadWasmModule('boat_buoyancy');
    wasmHazards = await loadWasmModule('obstacle_hazards');
    wasmDirector = await loadWasmModule('game_director');

    wasmGas.init_gas(100.0, 16.0, 1.0);
    console.log("🚀 All 5 WebAssembly modules successfully initialized!");
}

// Three.js 3D Engine Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b14);
scene.fog = new THREE.FogExp2(0x070b14, 0.012);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.85);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfffaed, 1.1);
sunLight.position.set(20, 40, 20);
scene.add(sunLight);

const ambientWaterLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
ambientWaterLight.position.set(-20, -10, -20);
scene.add(ambientWaterLight);

// Water Mesh
const waterGeo = new THREE.PlaneGeometry(200, 800, 60, 120);
const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.75
});
const waterPlane = new THREE.Mesh(waterGeo, waterMat);
waterPlane.rotation.x = -Math.PI / 2;
waterPlane.position.set(0, -0.5, 200);
scene.add(waterPlane);

// Boat Root & Materials
const boatGroup = new THREE.Group();
scene.add(boatGroup);

let boatMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.05
});

const objLoader = new THREE.OBJLoader();

function setupBoatModel() {
    if (typeof GAME_ASSETS_BUNDLE !== 'undefined' && GAME_ASSETS_BUNDLE.models) {
        const boatObj = objLoader.parse(GAME_ASSETS_BUNDLE.models['bouee_principale.obj']);
        boatObj.traverse(child => {
            if (child.isMesh) child.material = boatMaterial;
        });

        // Center and scale boat
        const box = new THREE.Box3().setFromObject(boatObj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 2.8 / Math.max(size.x, size.y, size.z);

        boatObj.scale.set(scale, scale, scale);
        boatObj.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        boatGroup.add(boatObj);
    }
}

function updateBoatTexture(textureKey) {
    if (typeof GAME_ASSETS_BUNDLE !== 'undefined' && GAME_ASSETS_BUNDLE.textures && GAME_ASSETS_BUNDLE.textures[textureKey]) {
        const img = new Image();
        img.onload = () => {
            const tex = new THREE.Texture(img);
            tex.needsUpdate = true;
            boatMaterial.map = tex;
            boatMaterial.needsUpdate = true;
        };
        img.src = GAME_ASSETS_BUNDLE.textures[textureKey];
    }
}

// Track 3D Elements
let trackObjects = [];
let hazardsList = [];

function clearTrack() {
    trackObjects.forEach(obj => scene.remove(obj));
    trackObjects = [];
    hazardsList = [];
}

function createArch(z, labelText, colorHex) {
    const archGroup = new THREE.Group();
    const centerX = wasmTrack.get_river_center_x(z);
    const width = wasmTrack.get_river_width();

    const postGeo = new THREE.CylinderGeometry(0.3, 0.4, 6, 12);
    const beamGeo = new THREE.BoxGeometry(width + 2, 0.6, 0.6);
    const archMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.5 });

    const leftPost = new THREE.Mesh(postGeo, archMat);
    leftPost.position.set(centerX - width / 2 - 0.5, 2.5, z);

    const rightPost = new THREE.Mesh(postGeo, archMat);
    rightPost.position.set(centerX + width / 2 + 0.5, 2.5, z);

    const beam = new THREE.Mesh(beamGeo, archMat);
    beam.position.set(centerX, 5.5, z);

    // Glowing Banner
    const bannerGeo = new THREE.PlaneGeometry(width - 1, 1.4);
    const bannerMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(centerX, 4.4, z);

    archGroup.add(leftPost, rightPost, beam, banner);
    scene.add(archGroup);
    trackObjects.push(archGroup);
}

function buildLevelTrack() {
    clearTrack();
    wasmTrack.init_track(currentLevelId);

    const finishZ = wasmTrack.get_finish_z();
    const cp1Z = wasmTrack.get_cp1_z();
    const cp2Z = wasmTrack.get_cp2_z();
    const width = wasmTrack.get_river_width();

    // 1. Arches
    createArch(0, "DÉPART", 0x38bdf8);
    createArch(cp1Z, "CHECKPOINT 1", 0x22c55e);
    createArch(cp2Z, "CHECKPOINT 2", 0xeab308);
    createArch(finishZ, "ARRIVÉE", 0xef4444);

    // 2. River boundary buoy markers
    const buoyGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const buoyMatRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2 });
    const buoyMatWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });

    for (let z = 0; z <= finishZ + 20; z += 6) {
        const cx = wasmTrack.get_river_center_x(z);
        const mat = (Math.floor(z / 6) % 2 === 0) ? buoyMatRed : buoyMatWhite;

        const leftBuoy = new THREE.Mesh(buoyGeo, mat);
        leftBuoy.position.set(cx - width / 2, -0.2, z);
        scene.add(leftBuoy);
        trackObjects.push(leftBuoy);

        const rightBuoy = new THREE.Mesh(buoyGeo, mat);
        rightBuoy.position.set(cx + width / 2, -0.2, z);
        scene.add(rightBuoy);
        trackObjects.push(rightBuoy);
    }

    // 3. Hazards / Obstacles
    const rockGeo = new THREE.DodecahedronGeometry(1.3, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });

    const rotorArmGeo = new THREE.BoxGeometry(7, 0.4, 0.4);
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3 });

    const boostGeo = new THREE.BoxGeometry(3.5, 0.05, 4);
    const boostMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // Level-specific obstacles
    const hazardConfigs = [
        { z: cp1Z * 0.5, type: 'rock', xOffset: -2 },
        { z: cp1Z * 0.8, type: 'rock', xOffset: 2.5 },
        { z: cp1Z + 20, type: 'rotor', xOffset: 0 },
        { z: cp1Z + 45, type: 'boost', xOffset: 0 },
        { z: cp2Z - 20, type: 'rock', xOffset: -1.5 },
        { z: cp2Z + 25, type: 'rotor', xOffset: 0 },
        { z: finishZ - 30, type: 'boost', xOffset: 0 }
    ];

    if (currentLevelId >= 2) {
        hazardConfigs.push(
            { z: cp1Z * 0.3, type: 'rotor', xOffset: 0 },
            { z: cp2Z + 10, type: 'rock', xOffset: 2 },
            { z: finishZ - 45, type: 'rotor', xOffset: 0 }
        );
    }

    hazardConfigs.forEach(cfg => {
        const cx = wasmTrack.get_river_center_x(cfg.z) + cfg.xOffset;
        if (cfg.type === 'rock') {
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(cx, 0.2, cfg.z);
            scene.add(rock);
            trackObjects.push(rock);
            hazardsList.push({ type: 'rock', x: cx, z: cfg.z, radius: 1.3 });
        } else if (cfg.type === 'rotor') {
            const rotor = new THREE.Mesh(rotorArmGeo, rotorMat);
            rotor.position.set(cx, 0.5, cfg.z);
            scene.add(rotor);
            trackObjects.push(rotor);
            hazardsList.push({ type: 'rotor', x: cx, z: cfg.z, mesh: rotor, length: 3.5 });
        } else if (cfg.type === 'boost') {
            const boost = new THREE.Mesh(boostGeo, boostMat);
            boost.position.set(cx, -0.45, cfg.z);
            scene.add(boost);
            trackObjects.push(boost);
            hazardsList.push({ type: 'boost', x: cx, z: cfg.z });
        }
    });

    // Reset boat to level start
    const startX = wasmTrack.get_river_center_x(0);
    wasmBoat.init_boat(startX, 0.0);
}

// User Actions & Inputs
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        triggerFart();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

function triggerFart() {
    if (!isRunning || !wasmGas || !wasmBoat) return;
    const force = wasmGas.trigger_fart(25.0, 50.0);
    if (force > 0) {
        wasmBoat.apply_impulse(force, force * 0.4);
        wasmDirector.add_fart_score();
        playSound('fart_special.wav');
    }
}

function showBanner(text, duration = 1800) {
    const banner = document.getElementById('banner-msg');
    banner.innerText = text;
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), duration);
}

function selectLevel(lvl) {
    currentLevelId = lvl;
    document.querySelectorAll('.lvl-btn').forEach((b, idx) => {
        b.classList.toggle('active', idx + 1 === lvl);
    });
    const names = ["1 - Rivière Calme", "2 - Rapides Périlleux", "3 - Canyon Extrême"];
    document.getElementById('levelName').innerText = names[lvl - 1];
}

function changeSkin(texKey) {
    currentSkinKey = texKey;
    updateBoatTexture(texKey);
    document.querySelectorAll('.skin-dot').forEach(d => d.classList.remove('active'));
}

function startGame() {
    document.getElementById('menu-panel').style.display = 'none';
    document.getElementById('victory-modal').style.display = 'none';
    buildLevelTrack();
    wasmDirector.start_race();
    isRunning = true;
    playSound('splash.wav');
}

function restartLevel() {
    document.getElementById('victory-modal').style.display = 'none';
    startGame();
}

function nextLevel() {
    if (currentLevelId < 3) currentLevelId++;
    else currentLevelId = 1;
    selectLevel(currentLevelId);
    startGame();
}

// Main Game Loop
let lastTime = performance.now();

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec * 10) % 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}

function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min((now - lastTime) / 1000.0, 0.1);
    lastTime = now;

    if (isRunning && wasmTrack && wasmBoat && wasmGas && wasmHazards && wasmDirector) {
        // 1. Controls
        let steer = 0;
        if (keys['arrowleft'] || keys['q'] || keys['a']) steer -= 1.0;
        if (keys['arrowright'] || keys['d']) steer += 1.0;

        let thrust = 0;
        if (keys['arrowup'] || keys['z'] || keys['w']) thrust += 14.0;
        if (keys['arrowdown'] || keys['s']) thrust -= 7.0;

        // 2. WASM Physics
        wasmBoat.update_boat_physics(steer, thrust, dt);
        const gasVal = wasmGas.update_gas(dt);
        wasmHazards.update_hazards(dt);
        const rTime = wasmDirector.update_timer(dt);

        const bx = wasmBoat.get_boat_x();
        const bz = wasmBoat.get_boat_z();

        // 3. Track Engine: Checkpoints
        const cpEvent = wasmTrack.check_checkpoints(bz);
        if (cpEvent === 1) {
            wasmDirector.add_checkpoint_score(1);
            playSound('checkpoint.wav');
            showBanner("🚩 CHECKPOINT 1 FRANCHI ! (+200 pts)");
            document.getElementById('cp1-marker').classList.add('reached');
        } else if (cpEvent === 2) {
            wasmDirector.add_checkpoint_score(2);
            playSound('checkpoint.wav');
            showBanner("🚩 CHECKPOINT 2 FRANCHI ! (+400 pts)");
            document.getElementById('cp2-marker').classList.add('reached');
        } else if (cpEvent === 3) {
            // Victory!
            isRunning = false;
            wasmDirector.finish_race(currentLevelId);
            playSound('checkpoint.wav');
            document.getElementById('finish-marker').classList.add('reached');

            document.getElementById('winTime').innerText = formatTime(wasmDirector.get_race_time());
            document.getElementById('winScore').innerText = wasmDirector.get_score();
            document.getElementById('winFarts').innerText = wasmDirector.get_farts_count();
            document.getElementById('victory-modal').style.display = 'block';
        }

        // River Off-track boundary
        if (wasmTrack.is_off_track(bx, bz) === 1) {
            const cx = wasmTrack.get_river_center_x(bz);
            const pushDir = cx > bx ? 150 : -150;
            wasmBoat.apply_lateral_push(pushDir * dt * 25, 0);
            playSound('impact.wav');
        }

        // Hazards Collision checks in WASM
        const rotorAngle = wasmHazards.get_rotor_angle();
        hazardsList.forEach(h => {
            if (h.type === 'rotor') {
                h.mesh.rotation.y = rotorAngle;
                if (wasmHazards.check_rotor_hit(bx, bz, h.x, h.z, h.length) === 1) {
                    wasmBoat.apply_lateral_push((bx - h.x) * 450, -300);
                    playSound('impact.wav');
                }
            } else if (h.type === 'rock') {
                if (wasmHazards.check_rock_hit(bx, bz, h.x, h.z, h.radius) === 1) {
                    wasmBoat.apply_lateral_push((bx - h.x) * 350, (bz - h.z) * 350);
                    playSound('impact.wav');
                }
            } else if (h.type === 'boost') {
                if (wasmHazards.check_boost_pad(bx, bz, h.x, h.z) === 1) {
                    wasmBoat.apply_impulse(80.0, 0);
                }
            }
        });

        // 4. Update HUD
        document.getElementById('raceTime').innerText = formatTime(rTime);
        document.getElementById('scoreVal').innerText = wasmDirector.get_score();
        document.getElementById('speedVal').innerText = wasmBoat.get_boat_speed().toFixed(1) + ' m/s';

        const progress = wasmTrack.get_progress_percent(bz);
        document.getElementById('progress-bar-fill').style.width = progress + '%';

        const gasPercent = Math.round(gasVal);
        document.getElementById('gasBar').style.width = gasPercent + '%';
        document.getElementById('gasText').innerText = gasPercent + '%';

        // 5. Update 3D Camera & Boat Position
        boatGroup.position.set(bx, wasmBoat.get_boat_y(), bz);
        boatGroup.rotation.y = -wasmBoat.get_boat_rotation();

        // Jiggle animation on fart
        const jiggle = wasmGas.get_jiggle_intensity();
        boatGroup.scale.y = 1.0 + Math.sin(now * 0.05) * jiggle * 0.2;

        camera.position.x = bx - Math.sin(-boatGroup.rotation.y) * 9;
        camera.position.y = boatGroup.position.y + 4.5;
        camera.position.z = bz - Math.cos(-boatGroup.rotation.y) * 9;
        camera.lookAt(bx, boatGroup.position.y + 1, bz);
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// App Startup
window.addEventListener('DOMContentLoaded', async () => {
    setupBoatModel();
    updateBoatTexture(currentSkinKey);
    await initAllWasm();
    selectLevel(1);
    buildLevelTrack();
    lastTime = performance.now();
    requestAnimationFrame(animate);
});
