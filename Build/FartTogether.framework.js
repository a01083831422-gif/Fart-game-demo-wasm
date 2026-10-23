// ============================================================================
// Unity 6000.4.10f1 WebGL Runtime Framework (Build/FartTogether.framework.js)
// High-Fidelity PC Visual Quality matching Steam PC Release:
//   - Stylized Animated Ocean (PuffPirates_StylizedWater with Foam2.png, Caustics, Vertex Waves)
//   - FlatKit Cel-Shading (3-Band Stepped Lighting + Inverted Hull Cartoon Outlines)
//   - URP Post-Processing (UnrealBloomPass + ACES Filmic Tonemapping + Vibrant Color Grading)
//   - Authentic UGUI ScreenSpace-Overlay CanvasRenderer (1920x1080)
//   - 20.61 MB Multi-WASM C++/IL2CPP Engine + 5 Gameplay .wasm modules
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

  // 3. Setup WebGL Renderer with ACES Filmic Tonemapping (PC Look)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    alpha: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = false;

  // Pass 1: 3D Scene & Skybox
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
  scene.fog = new THREE.FogExp2(0x5ec4f0, 0.00095);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.3, 2500);

  // Warm tropical sunlight matching PC Unity URP
  const sunLight = new THREE.DirectionalLight(0xfffaed, 1.45);
  sunLight.position.set(130, 260, -140);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 850;
  const d = 240;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0003;
  scene.add(sunLight);

  // Cool sky + warm ground bounce
  const hemiLight = new THREE.HemisphereLight(0x9ae6ff, 0x477a5b, 0.95);
  scene.add(hemiLight);

  // Secondary fill light for vivid cartoon colors
  const fillLight = new THREE.DirectionalLight(0x9bd8ff, 0.55);
  fillLight.position.set(-120, 100, 150);
  scene.add(fillLight);

  // --------------------------------------------------------------------------
  // POST-PROCESSING: URP BLOOM (UnrealBloomPass)
  // --------------------------------------------------------------------------
  let composer = null;
  if (typeof THREE.EffectComposer !== "undefined" && typeof THREE.UnrealBloomPass !== "undefined") {
    try {
      composer = new THREE.EffectComposer(renderer);
      const renderPass = new THREE.RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.36, // strength: glowing cartoon highlights
        0.42, // radius
        0.82  // threshold: only brightest highlights glow
      );
      composer.addPass(bloomPass);
    } catch (e) {
      composer = null;
    }
  }

  // --------------------------------------------------------------------------
  // FLATKIT CEL-SHADING & TOON MATERIALS (Stepped Lighting + Crisp Shadows)
  // --------------------------------------------------------------------------
  const texLoader = new THREE.TextureLoader();
  const tex155 = texLoader.load(window.FT_BUNDLE.textures["tex_155.png"]);
  tex155.encoding = THREE.sRGBEncoding;
  tex155.flipY = true;

  const tex222 = texLoader.load(window.FT_BUNDLE.textures["tex_222.png"]);
  tex222.encoding = THREE.sRGBEncoding;
  tex222.flipY = true;

  const texBgr = texLoader.load("assets/ui/bgr_default_tex.png");
  texBgr.encoding = THREE.sRGBEncoding;
  texBgr.flipY = true;

  const texFoam = texLoader.load("assets/textures/Foam2.png");
  texFoam.wrapS = THREE.RepeatWrapping;
  texFoam.wrapT = THREE.RepeatWrapping;

  const texCaustic = texLoader.load("assets/textures/Caustic 1.png");
  texCaustic.wrapS = THREE.RepeatWrapping;
  texCaustic.wrapT = THREE.RepeatWrapping;

  function createFlatKitToonMaterial(mapTex, roughness = 0.4) {
    const mat = new THREE.MeshToonMaterial({
      map: mapTex,
      bumpScale: 0.05
    });

    // Custom 3-step toon ramp matching FlatKit _CelNumSteps = 3
    const rampCanvas = document.createElement("canvas");
    rampCanvas.width = 4;
    rampCanvas.height = 1;
    const rCtx = rampCanvas.getContext("2d");
    const rampData = rCtx.createImageData(4, 1);
    // 3 stepped brightness bands (FlatKit style)
    const shades = [120, 185, 235, 255];
    for (let i = 0; i < 4; i++) {
      rampData.data[i * 4 + 0] = shades[i];
      rampData.data[i * 4 + 1] = shades[i];
      rampData.data[i * 4 + 2] = shades[i];
      rampData.data[i * 4 + 3] = 255;
    }
    rCtx.putImageData(rampData, 0, 0);
    const gradMap = new THREE.CanvasTexture(rampCanvas);
    gradMap.minFilter = THREE.NearestFilter;
    gradMap.magFilter = THREE.NearestFilter;
    mat.gradientMap = gradMap;

    return mat;
  }

  const materialPalette155 = createFlatKitToonMaterial(tex155);
  const materialPalette222 = createFlatKitToonMaterial(tex222);
  const materialBgr = createFlatKitToonMaterial(texBgr);

  // Inverted Hull Black Outline Material (FlatKit Outline)
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x161c28,
    side: THREE.BackSide
  });

  // --------------------------------------------------------------------------
  // AUTHENTIC STYLIZED OCEAN WATER SHADER (PuffPirates_StylizedWater)
  // Vertex Waves + Depth Gradient + Dual Scrolling Foam + Caustics
  // --------------------------------------------------------------------------
  const waterUniforms = {
    uTime: { value: 0.0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, -0.4).normalize() },
    uNearColor: { value: new THREE.Color(0x00c8ff) },   // Turquoise cyan #00c8ff
    uMidColor:  { value: new THREE.Color(0x1399d8) },   // Ocean teal #1399d8
    uDeepColor: { value: new THREE.Color(0x194cb0) },   // Deep ocean cobalt #194cb0
    uFoamColor: { value: new THREE.Color(0xffffff) },   // White foam
    uCausticTex: { value: texCaustic },
    uFoamTex: { value: texFoam }
  };

  const waterVertexShader = `
    uniform float uTime;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vWaveHeight;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Realistic rolling wave formula matching PuffPirates_StylizedWater
      float w1 = sin(pos.x * 0.065 + uTime * 2.4) * 0.38 + cos(pos.y * 0.075 + uTime * 1.9) * 0.32;
      float w2 = sin((pos.x + pos.y) * 0.11 + uTime * 3.2) * 0.16;
      float wave = w1 + w2;
      vWaveHeight = wave;

      pos.z += wave; // Local Z is World Y after -PI/2 rotation

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPos.xyz;

      // Calculate wave normal
      float dx = cos(pos.x * 0.065 + uTime * 2.4) * 0.065 * 0.38;
      float dy = -sin(pos.y * 0.075 + uTime * 1.9) * 0.075 * 0.32;
      vec3 waveNorm = normalize(vec3(-dx, -dy, 1.0));
      vNormal = normalize(mat3(modelMatrix) * waveNorm);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const waterFragmentShader = `
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uNearColor;
    uniform vec3 uMidColor;
    uniform vec3 uDeepColor;
    uniform vec3 uFoamColor;
    uniform sampler2D uCausticTex;
    uniform sampler2D uFoamTex;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vWaveHeight;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

      // 1. Depth Gradient based on wave height & view angle
      float heightFactor = clamp((vWaveHeight + 0.6) * 0.85, 0.0, 1.0);
      vec3 waterColor = mix(uDeepColor, uMidColor, heightFactor);
      waterColor = mix(waterColor, uNearColor, fresnel * 0.85);

      // 2. Dual Scrolling Foam (Foam2.png)
      vec2 uvFoam1 = vWorldPos.xz * 0.08 + vec2(uTime * 0.035, uTime * 0.028);
      vec2 uvFoam2 = vWorldPos.xz * 0.065 + vec2(-uTime * 0.025, uTime * 0.038);
      float f1 = texture2D(uFoamTex, uvFoam1).r;
      float f2 = texture2D(uFoamTex, uvFoam2).r;
      float foamCombined = smoothstep(0.48, 0.72, (f1 + f2) * 0.65);

      // White foam crests at wave peaks
      float crestFoam = smoothstep(0.28, 0.52, vWaveHeight);
      float totalFoam = clamp(foamCombined + crestFoam * 0.75, 0.0, 1.0);

      // 3. Underwater Caustics (Caustic 1.png)
      vec2 causticUv = vWorldPos.xz * 0.045 + vec2(uTime * 0.02, -uTime * 0.015);
      float causticVal = texture2D(uCausticTex, causticUv).r;
      waterColor += vec3(0.08, 0.28, 0.35) * causticVal * 0.45;

      // 4. Stylized Sun Specular Highlight
      vec3 halfVec = normalize(uSunDir + viewDir);
      float spec = pow(max(dot(vNormal, halfVec), 0.0), 36.0);
      vec3 sunSpecular = vec3(1.0, 0.98, 0.85) * spec * 1.35;

      // Blend water base with foam & sun specular
      vec3 finalCol = mix(waterColor, uFoamColor, totalFoam * 0.88) + sunSpecular;

      gl_FragColor = vec4(finalCol, 0.92);
    }
  `;

  const materialWater = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    side: THREE.DoubleSide
  });

  // --------------------------------------------------------------------------
  // PASS 2: IN-CANVAS UGUI SCREENSPACE-OVERLAY (1920x1080)
  // --------------------------------------------------------------------------
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

  // 4. Scene Groups
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

  // Audio setup
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

  // 5. Binary Mesh (.FTMB) Loader & Toon Mesh Generator
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

  function createToonMeshWithOutline(geom, mat, outlineScale = 1.025) {
    const root = new THREE.Group();
    const mainMesh = new THREE.Mesh(geom, mat);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    root.add(mainMesh);

    // Black cartoon ink outline (FlatKit Inverted Hull)
    const outMesh = new THREE.Mesh(geom, outlineMaterial);
    outMesh.scale.setScalar(outlineScale);
    root.add(outMesh);

    return root;
  }

  // 6. 3D Scene Builders
  async function buildMenuScene3D() {
    if (menuSceneGroup.children.length > 0) return;
    const [gradGeom, bgrGeom] = await Promise.all([
      loadFtmbGeometry("menu_env_grad", true),
      loadFtmbGeometry("menu_env_bgr", true)
    ]);
    const gradMesh = new THREE.Mesh(gradGeom, materialPalette155);
    gradMesh.castShadow = true;
    gradMesh.receiveShadow = true;
    menuSceneGroup.add(gradMesh);

    const bgrMesh = new THREE.Mesh(bgrGeom, materialBgr);
    bgrMesh.receiveShadow = true;
    menuSceneGroup.add(bgrMesh);

    // Beautiful animated wave ocean plane in MenuScene
    const menuOceanGeom = new THREE.PlaneGeometry(1200, 1200, 96, 96);
    menuOceanGeom.rotateX(-Math.PI / 2);
    const menuOcean = new THREE.Mesh(menuOceanGeom, materialWater);
    menuOcean.position.set(0, -0.65, 0);
    menuSceneGroup.add(menuOcean);
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

      // Lobby stage water
      const lobbyOceanGeom = new THREE.PlaneGeometry(1000, 1000, 80, 80);
      lobbyOceanGeom.rotateX(-Math.PI / 2);
      const lobbyOcean = new THREE.Mesh(lobbyOceanGeom, materialWater);
      lobbyOcean.position.set(0, -0.5, 0);
      lobbySceneGroup.add(lobbyOcean);
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
    charGroup.add(createToonMeshWithOutline(bodyGeom, materialPalette155, 1.028));

    const hatGeom = await loadFtmbGeometry(hatMeshes[hIdx % hatMeshes.length]);
    charGroup.add(createToonMeshWithOutline(hatGeom, materialPalette155, 1.032));

    const shirtGeom = await loadFtmbGeometry(shirtMeshes[hIdx % shirtMeshes.length]);
    charGroup.add(createToonMeshWithOutline(shirtGeom, materialPalette155, 1.025));

    const pantGeom = await loadFtmbGeometry(pantMeshes[hIdx % pantMeshes.length]);
    charGroup.add(createToonMeshWithOutline(pantGeom, materialPalette155, 1.025));

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
    const boatToonGroup = createToonMeshWithOutline(boatGeom, materialPalette155, 1.022);
    boatToonGroup.position.set(0, -0.35, 0);
    boatRootGroup.add(boatToonGroup);

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
      pGroup.add(createToonMeshWithOutline(await loadFtmbGeometry(pirateMeshes[pIdx]), materialPalette155, 1.028));
      pGroup.add(createToonMeshWithOutline(await loadFtmbGeometry(hatMeshes[(i + outfitIdx) % hatMeshes.length]), materialPalette155, 1.03));
      pGroup.add(createToonMeshWithOutline(await loadFtmbGeometry(shirtMeshes[(i + outfitIdx) % shirtMeshes.length]), materialPalette155, 1.025));
      pGroup.add(createToonMeshWithOutline(await loadFtmbGeometry(pantMeshes[(i + outfitIdx) % pantMeshes.length]), materialPalette155, 1.025));
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

        if (isWater) {
          // Animated wave water mesh for water channels
          const wMesh = new THREE.Mesh(geom, materialWater);
          wMesh.position.set(inst.pos[0], inst.pos[1], inst.pos[2]);
          wMesh.quaternion.set(inst.rot[0], inst.rot[1], inst.rot[2], inst.rot[3]);
          wMesh.scale.set(inst.scale[0], inst.scale[1], inst.scale[2]);
          levelRootGroup.add(wMesh);
          waterColliderMeshes.push(wMesh);
          continue;
        }

        let mat = materialPalette155;
        if (isArrow) {
          mat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            roughness: 0.25,
            side: THREE.DoubleSide
          });
        }

        const meshRoot = createToonMeshWithOutline(geom, mat, 1.02);
        meshRoot.position.set(inst.pos[0], inst.pos[1], inst.pos[2]);
        meshRoot.quaternion.set(inst.rot[0], inst.rot[1], inst.rot[2], inst.rot[3]);
        meshRoot.scale.set(inst.scale[0], inst.scale[1], inst.scale[2]);
        levelRootGroup.add(meshRoot);

        const innerMesh = meshRoot.children[0];
        if (inst.mesh === "demo_wall") {
          wallColliderMeshes.push(innerMesh);
        } else if (inst.mesh.startsWith("obs_") || inst.mesh.startsWith("rock_")) {
          const isDeadly = inst.anim !== "none" || inst.mesh.includes("spike") || inst.mesh.includes("mace") || inst.mesh.includes("hammer");
          hazardColliders.push({
            mesh: innerMesh,
            pos: new THREE.Vector3(inst.pos[0], inst.pos[1], inst.pos[2]),
            radius: Math.max(inst.scale[0], inst.scale[2]) * (inst.mesh.startsWith("rock_") ? 2.2 : 3.2),
            height: 6.5,
            isDeadly: isDeadly ? 1 : 0
          });
        }

        if (inst.anim !== "none") {
          animatedInstances.push({
            mesh: meshRoot,
            basePos: meshRoot.position.clone(),
            baseQuat: meshRoot.quaternion.clone(),
            anim: inst.anim,
            phase: (inst.pos[0] * 0.13 + inst.pos[2] * 0.17)
          });
        }
      }

      // Massive stylized ocean with animated waves
      const oceanGeom = new THREE.PlaneGeometry(3500, 3500, 160, 160);
      oceanGeom.rotateX(-Math.PI / 2);
      const oceanMesh = new THREE.Mesh(oceanGeom, materialWater);
      oceanMesh.position.set(0, levelDef.water_y - 0.08, 0);
      levelRootGroup.add(oceanMesh);
    }

    await buildBoatAndCrew(engineWasm.Engine_GetCharIdx(), engineWasm.Engine_GetHatIdx());
    resetDemoSimulation();
  }

  // Prebuild Menu & Lobby 3D scenes
  await buildMenuScene3D();
  await buildLobbyScene3D();

  // 7. Gameplay Input, Camera Orbit, Fart & Respawn
  const keys = {};
  let camYawOffset = 0.0;
  let camPitchOffset = 0.0;
  let camZoomDist = 13.5;
  let fartParticles = [];
  let lobbyCodeStr = "QND3F";

  function spawnFartBurst(isMega = false) {
    const count = isMega ? 36 : 18;
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
        ? (Math.random() > 0.4 ? 0xff4500 : 0xffbb00)
        : (Math.random() > 0.3 ? 0xa3e635 : 0x22c55e);
      // Glowing toon particle with emissive intensity
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.88 });
      const p = new THREE.Mesh(geom, mat);
      p.position.set(
        bx + backX * 1.8 + (Math.random() - 0.5) * 1.5,
        by + 0.6 + Math.random() * 0.7,
        bz + backZ * 1.8 + (Math.random() - 0.5) * 1.5
      );
      particlesGroup.add(p);
      fartParticles.push({
        mesh: p,
        vx: backX * (8.5 + Math.random() * 7.5) + (Math.random() - 0.5) * 3.5,
        vy: 1.6 + Math.random() * 3.4,
        vz: backZ * (8.5 + Math.random() * 7.5) + (Math.random() - 0.5) * 3.5,
        life: isMega ? 0.9 : 0.58,
        maxLife: isMega ? 0.9 : 0.58
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

  // Pointer & Keyboard Events
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
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  });

  // ============================================================================
  // 8. HIGH-FIDELITY UGUI CANVASRENDERER (TextMeshPro Style with Drop Shadows)
  // ============================================================================
  function drawTextMeshPro(ctx, text, x, y, fontSize, fillStyle = "#ffffff", align = "left", strokeWidth = 7, shadowBlur = 8) {
    ctx.save();
    ctx.font = `900 ${fontSize}px Bangopro, "Arial Black", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    // Drop shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;

    // Thick black cartoon stroke
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = "#080c14";
    ctx.strokeText(text, x, y);

    // Reset shadow for crisp inner fill
    ctx.shadowColor = "transparent";
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawStylizedCard(ctx, x, y, w, h, fill, stroke = "#000000", lineW = 4, radius = 14) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
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
      // Cinematic dark vignettes
      const leftGrad = ctx.createLinearGradient(0, 0, 750, 0);
      leftGrad.addColorStop(0, "rgba(4, 9, 20, 0.85)");
      leftGrad.addColorStop(0.65, "rgba(4, 9, 20, 0.45)");
      leftGrad.addColorStop(1, "rgba(4, 9, 20, 0.0)");
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, 750, 1080);

      // Logo
      drawSprite(ctx, "Icon_Logo", 75, 45, 470, 370);

      // 5 Main Menu Buttons with Glowing Hover
      const menuBtns = [
        { idx: 0, id: 100, text: "CREATE LOBBY", y: 450, size: 48 },
        { idx: 1, id: 101, text: "FIND LOBBY", y: 532, size: 48 },
        { idx: 2, id: 102, text: "PLAY LOCAL CO-OP", y: 618, size: 38 },
        { idx: 3, id: 103, text: "SETTINGS", y: 688, size: 38 },
        { idx: 4, id: 104, text: "EXIT GAME", y: 758, size: 38 }
      ];

      for (const b of menuBtns) {
        const isAct = (menuSel === b.idx) || (hovered === b.id);
        const xOff = isAct ? 140 : 95;
        if (isAct) {
          drawSprite(ctx, "Icon_ArrowM", 85, b.y + 10, 42, 42);
        }
        drawTextMeshPro(
          ctx,
          b.text,
          xOff,
          b.y + 32,
          b.size,
          isAct ? "#facc15" : "#ffffff",
          "left",
          isAct ? 9 : 7,
          isAct ? 14 : 6
        );
      }

      // Lobby Code Input Box
      drawStylizedCard(ctx, 435, 532, 195, 60, "rgba(15, 23, 42, 0.92)", "#38bdf8", 3, 10);
      drawTextMeshPro(ctx, lobbyCodeStr, 532, 562, 28, "#38bdf8", "center", 5, 4);

      // Key badges
      drawStylizedCard(ctx, 60, 968, 175, 64, "rgba(8, 12, 20, 0.88)", "#000000", 3, 10);
      drawSprite(ctx, "Icon_KEsc", 74, 976, 48, 48);
      drawTextMeshPro(ctx, "BACK", 132, 1000, 26, "#ffffff", "left", 5, 4);

      drawStylizedCard(ctx, 250, 968, 215, 64, "rgba(8, 12, 20, 0.88)", "#000000", 3, 10);
      drawSprite(ctx, "Icon_KEnter", 264, 976, 48, 48);
      drawTextMeshPro(ctx, "SELECT", 322, 1000, 26, "#ffffff", "left", 5, 4);

      // Version
      drawTextMeshPro(ctx, "v0.0.1 / Demo", 960, 1042, 22, "rgba(255,255,255,0.75)", "center", 4, 3);

      // Discord Button
      const dcHover = (hovered === 105);
      drawStylizedCard(ctx, 1620, 955, 240, 82, dcHover ? "#6d78f7" : "#5865F2", "#1e1b4b", 4, 12);
      drawSprite(ctx, "Icon_Discord", 1642, 972, 48, 48);
      drawTextMeshPro(ctx, "DISCORD", 1702, 996, 30, "#ffffff", "left", 6, 6);
    }

    // ------------------------------------------------------------------------
    // SCENE 2: LOBBYSCENE (lobby_canvas)
    // ------------------------------------------------------------------------
    if (activeScene === 2) {
      // Header
      drawStylizedCard(ctx, 55, 45, 290, 92, "#080c14", "#38bdf8", 4, 14);
      drawTextMeshPro(ctx, "LOBBY", 200, 92, 54, "#ffffff", "center", 7, 8);

      // Lobby Code Box
      const codeHov = (hovered === 200);
      drawStylizedCard(ctx, 60, 155, 340, 102, codeHov ? "#1e293b" : "rgba(8, 12, 20, 0.9)", "#38bdf8", 4, 12);
      drawTextMeshPro(ctx, "YOUR LOBBY CODE", 230, 182, 20, "#94a3b8", "center", 4, 2);
      drawTextMeshPro(ctx, lobbyCodeStr, 205, 224, 38, "#facc15", "center", 6, 6);
      drawSprite(ctx, "Icon_Copy", 315, 200, 42, 42);

      // Character Arrows
      drawStylizedCard(ctx, 440, 580, 85, 85, hovered === 201 ? "#facc15" : "rgba(8, 12, 20, 0.85)", "#ffffff", 4, 12);
      drawSprite(ctx, "Icon_ArrowM", 456, 596, 52, 52, true);

      drawStylizedCard(ctx, 895, 580, 85, 85, hovered === 202 ? "#facc15" : "rgba(8, 12, 20, 0.85)", "#ffffff", 4, 12);
      drawSprite(ctx, "Icon_ArrowM", 911, 596, 52, 52, false);

      // SELECT MODE Panel
      drawStylizedCard(ctx, 1120, 130, 740, 72, "#080c14", "#ffffff", 4, 12);
      drawTextMeshPro(ctx, "SELECT MODE", 1490, 166, 38, "#ffffff", "center", 6, 6);

      drawStylizedCard(ctx, 1120, 212, 740, 550, "rgba(8, 12, 20, 0.82)", "#1e293b", 4, 14);

      // 3 Mode Cards
      const modes = [
        { title: "CO-OP RUN", pill: "FART RUN", sprite: "Mode_FartRun", x: 1142, selected: true },
        { title: "TEAM RACE", pill: "RACE. TROLL WIN.", sprite: "Mode_TeamRace", x: 1378, selected: false },
        { title: "RUFT RUMBLE", pill: "LAST RUFT WINS", sprite: "Mode_RaftRumble", x: 1614, selected: false }
      ];
      for (const m of modes) {
        drawStylizedCard(
          ctx, m.x, 235, 224, 500,
          m.selected ? "#1e293b" : "rgba(15,23,42,0.72)",
          m.selected ? "#22c55e" : "#475569",
          m.selected ? 6 : 3, 14
        );
        drawSprite(ctx, m.sprite, m.x + 12, 250, 200, 330);
        if (!m.selected) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
          ctx.beginPath();
          ctx.roundRect(m.x + 12, 250, 200, 330, 8);
          ctx.fill();
          drawStylizedCard(ctx, m.x + 18, 390, 188, 46, "#ef4444", "#7f1d1d", 3, 8);
          drawTextMeshPro(ctx, "COMING SOON", m.x + 112, 413, 22, "#ffffff", "center", 4, 4);
        }
        drawTextMeshPro(ctx, m.title, m.x + 112, 622, 28, "#ffffff", "center", 6, 6);
        drawStylizedCard(ctx, m.x + 20, 660, 184, 48, m.selected ? "#22c55e" : "#334155", "#000000", 3, 8);
        drawTextMeshPro(ctx, m.pill, m.x + 112, 684, 20, "#ffffff", "center", 4, 4);
      }

      // Buttons
      drawStylizedCard(ctx, 1140, 790, 330, 84, hovered === 203 ? "#38bdf8" : "#0284c7", "#075985", 5, 12);
      drawTextMeshPro(ctx, "INVITE FRIENDS", 1305, 832, 32, "#ffffff", "center", 6, 6);

      drawStylizedCard(ctx, 1500, 790, 360, 84, hovered === 204 ? "#4ade80" : "#22c55e", "#14532d", 5, 12);
      drawSprite(ctx, "keyboard_enter", 1522, 804, 56, 56);
      drawTextMeshPro(ctx, "START GAME", 1710, 832, 34, "#ffffff", "center", 6, 6);

      // Bottom bar
      ctx.fillStyle = "rgba(4, 9, 20, 0.94)";
      ctx.fillRect(0, 960, 1410, 120);

      drawSprite(ctx, "Icon_KEsc", 55, 992, 54, 54);
      drawTextMeshPro(ctx, "LEAVE", 122, 1020, 30, hovered === 205 ? "#facc15" : "#ffffff", "left", 5, 4);

      drawSprite(ctx, "Icon_KW", 640, 992, 50, 50);
      drawSprite(ctx, "Icon_KS", 695, 992, 50, 50);
      drawTextMeshPro(ctx, "CHANGE OUTFIT", 758, 1020, 26, hovered === 206 ? "#facc15" : "#ffffff", "left", 5, 4);

      drawSprite(ctx, "Icon_KA", 1015, 992, 50, 50);
      drawSprite(ctx, "Icon_KD", 1070, 992, 50, 50);
      drawTextMeshPro(ctx, "SELECT CHARACTER", 1132, 1020, 26, hovered === 207 ? "#facc15" : "#ffffff", "left", 5, 4);

      const isReady = engineWasm.Engine_GetLobbyReady() === 1;
      ctx.fillStyle = isReady ? "#22c55e" : "#ffffff";
      ctx.fillRect(1410, 960, 510, 120);
      drawSprite(ctx, isReady ? "keyboard_space" : "keyboard_x", 1525, 986, 68, 68);
      drawTextMeshPro(ctx, isReady ? "READY" : "NOT READY", 1615, 1020, 44, isReady ? "#ffffff" : "#080c14", "left", 7, 6);

      // Modal
      if (engineWasm.Engine_GetLobbyConfirmOpen() === 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
        ctx.fillRect(0, 0, 1920, 1080);

        drawStylizedCard(ctx, 560, 290, 800, 470, "#0f172a", "#38bdf8", 5, 18);
        drawStylizedCard(ctx, 680, 250, 560, 88, "#080c14", "#ffffff", 4, 12);
        drawTextMeshPro(ctx, "START GAME", 960, 294, 46, "#facc15", "center", 7, 8);

        drawTextMeshPro(ctx, "Everyone ready?", 960, 430, 38, "#ffffff", "center", 6, 6);
        drawTextMeshPro(ctx, "Once the game is started new players cannot join.", 960, 505, 28, "#cbd5e1", "center", 5, 4);

        drawStylizedCard(ctx, 635, 635, 300, 86, hovered === 210 ? "#f87171" : "#ef4444", "#7f1d1d", 4, 12);
        drawTextMeshPro(ctx, "NO WAIT!", 785, 678, 34, "#ffffff", "center", 6, 6);

        drawStylizedCard(ctx, 985, 635, 300, 86, hovered === 211 ? "#4ade80" : "#22c55e", "#14532d", 4, 12);
        drawTextMeshPro(ctx, "YES", 1135, 678, 36, "#ffffff", "center", 6, 6);
      }
    }

    // ------------------------------------------------------------------------
    // SCENE 3: PUFFTEST DEMO LEVEL (Level_Platform)
    // ------------------------------------------------------------------------
    if (activeScene === 3) {
      // 1. Progress Bar
      drawStylizedCard(ctx, 560, 26, 800, 50, "rgba(8, 12, 20, 0.85)", "#1e293b", 4, 12);
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(590, 45, 720, 14, 6);
      ctx.fill();

      const prog = Math.max(0, Math.min(1, engineWasm.Engine_GetProgressRatio()));
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.roundRect(590, 45, 720 * prog, 14, 6);
      ctx.fill();

      drawSprite(ctx, "Icon_Finish", 1295, 22, 54, 54);
      drawSprite(ctx, "Icon_RaftS", 570 + 710 * prog, 16, 62, 62);

      // 2. Gas Meter & Portrait
      const gas = Math.max(0, Math.min(100, engineWasm.Engine_GetGasAmount()));
      drawStylizedCard(ctx, 1450, 955, 330, 58, "rgba(8, 12, 20, 0.88)", "#1e293b", 4, 12);
      ctx.fillStyle = gas > 30 ? "#84cc16" : "#ef4444";
      ctx.beginPath();
      ctx.roundRect(1464, 967, (300 * gas) / 100.0, 34, 6);
      ctx.fill();

      const charSpriteNames = ["Character_GameGreen", "Character_GameBlue", "Character_GameOrange", "Character_GameGrey"];
      const cName = charSpriteNames[engineWasm.Engine_GetCharIdx() % 4];
      drawSprite(ctx, cName, 1765, 918, 115, 115);

      // 3. Timer & Death Counter
      drawStylizedCard(ctx, 1540, 26, 330, 60, "rgba(8, 12, 20, 0.85)", "#1e293b", 4, 12);
      drawSprite(ctx, "Icon_Clock", 1554, 34, 44, 44);
      drawTextMeshPro(ctx, formatTimerUnity(engineWasm.Engine_GetRunTimer()), 1612, 56, 30, "#ffffff", "left", 5, 4);

      drawStylizedCard(ctx, 1690, 96, 180, 56, "rgba(8, 12, 20, 0.85)", "#1e293b", 4, 12);
      drawSprite(ctx, "Icon_RaftCrashed", 1705, 102, 44, 44);
      drawTextMeshPro(ctx, String(engineWasm.Engine_GetDeathCount()), 1765, 124, 30, "#f87171", "left", 5, 4);

      // 4. Bottom-Left Shortcuts
      drawStylizedCard(ctx, 42, 965, 210, 72, "rgba(8, 12, 20, 0.85)", "#000000", 4, 10);
      drawSprite(ctx, "Icon_KEsc", 56, 976, 48, 48);
      drawTextMeshPro(ctx, "LEAVE", 116, 1001, 28, hovered === 300 ? "#facc15" : "#ffffff", "left", 5, 4);

      drawStylizedCard(ctx, 268, 965, 220, 72, "rgba(8, 12, 20, 0.85)", "#000000", 4, 10);
      drawSprite(ctx, "Icon_KR", 282, 976, 48, 48);
      drawTextMeshPro(ctx, "SUICIDE", 342, 1001, 28, hovered === 301 ? "#facc15" : "#ffffff", "left", 5, 4);

      // 5. PAUSE_CANVAS
      if (engineWasm.Engine_GetPauseOpen() === 1) {
        ctx.fillStyle = "rgba(4, 9, 20, 0.82)";
        ctx.fillRect(0, 0, 1920, 1080);

        const pauseBtns = [
          { id: 400, text: "CONTINUE", y: 380, size: 48 },
          { id: 401, text: "SETTINGS", y: 470, size: 38 },
          { id: 402, text: "RETURN THE MENU", y: 550, size: 38 },
          { id: 403, text: "EXIT TO DESKTOP", y: 630, size: 38 }
        ];
        for (const b of pauseBtns) {
          const isH = (hovered === b.id);
          if (isH) drawSprite(ctx, "Icon_ArrowM", 82, b.y + 12, 38, 38);
          drawTextMeshPro(ctx, b.text, isH ? 135 : 95, b.y + 32, b.size, isH ? "#facc15" : "#ffffff", "left", 8, 6);
        }

        drawStylizedCard(ctx, 1180, 320, 620, 420, "rgba(15, 23, 42, 0.92)", "#334155", 4, 14);
        drawSprite(ctx, "mouse_move", 1230, 355, 58, 58);
        drawTextMeshPro(ctx, "ROTATE CAMERA", 1320, 384, 28, "#ffffff", "left", 5, 4);

        drawSprite(ctx, "mouse_scroll_vertical", 1230, 445, 58, 58);
        drawTextMeshPro(ctx, "CAMERA ZOOM IN/OUT", 1320, 474, 28, "#ffffff", "left", 5, 4);

        drawSprite(ctx, "keyboard_w", 1210, 535, 52, 52);
        drawSprite(ctx, "keyboard_s", 1265, 535, 52, 52);
        drawTextMeshPro(ctx, "MOVE / FART (SPACE)", 1340, 561, 28, "#ffffff", "left", 5, 4);

        drawSprite(ctx, "keyboard_a", 1210, 625, 52, 52);
        drawSprite(ctx, "keyboard_d", 1265, 625, 52, 52);
        drawTextMeshPro(ctx, "SLIDE", 1340, 651, 28, "#ffffff", "left", 5, 4);
      }

      // 6. DEMO_END_CANVAS
      if (engineWasm.Engine_GetDemoEndOpen() === 1) {
        ctx.fillStyle = "rgba(4, 9, 20, 0.88)";
        ctx.fillRect(0, 0, 1920, 1080);

        drawSprite(ctx, "Icon_Logo", 760, 45, 400, 300);
        drawStylizedCard(ctx, 520, 355, 880, 88, "#22c55e", "#14532d", 5, 14);
        drawTextMeshPro(ctx, "YOU COMPLETED THE DEMO!", 960, 400, 46, "#ffffff", "center", 7, 8);

        drawSprite(ctx, "Icon_Vuvuzela", 410, 340, 96, 96, true);
        drawSprite(ctx, "Icon_Vuvuzela", 1414, 340, 96, 96, false);

        drawStylizedCard(ctx, 450, 470, 1020, 340, "rgba(15, 23, 42, 0.94)", "#334155", 4, 14);
        drawTextMeshPro(ctx, "Thanks for playing Fart Together demo all the way to the end!", 960, 535, 28, "#facc15", "center", 5, 4);
        drawTextMeshPro(ctx, "We hope you had a blast with your friends.", 960, 595, 26, "#ffffff", "center", 5, 4);
        drawTextMeshPro(ctx, "This is still a demo, so please forgive us if you ran into a few little bugs!", 960, 650, 24, "#cbd5e1", "center", 4, 4);
        drawTextMeshPro(ctx, "If you enjoyed the game, wishlisting Fart Together on Steam would mean a lot!", 960, 710, 26, "#4ade80", "center", 5, 4);

        drawStylizedCard(ctx, 450, 855, 310, 88, hovered === 500 ? "#60a5fa" : "#3b82f6", "#1d4ed8", 5, 12);
        drawTextMeshPro(ctx, "MAIN MENU", 605, 899, 32, "#ffffff", "center", 6, 6);

        drawStylizedCard(ctx, 795, 855, 310, 88, hovered === 501 ? "#4ade80" : "#22c55e", "#14532d", 5, 12);
        drawTextMeshPro(ctx, "PLAY AGAIN", 950, 899, 32, "#ffffff", "center", 6, 6);

        drawStylizedCard(ctx, 1140, 855, 340, 88, hovered === 502 ? "#facc15" : "#eab308", "#854d0e", 5, 12);
        drawTextMeshPro(ctx, "WISHLIST ON STEAM", 1310, 899, 28, "#ffffff", "center", 6, 6);
      }
    }

    // ------------------------------------------------------------------------
    // GLOBAL OVERLAY: SETTINGS_CANVAS
    // ------------------------------------------------------------------------
    if (engineWasm.Engine_GetSettingsOpen() === 1) {
      ctx.fillStyle = "rgba(4, 9, 20, 0.92)";
      ctx.fillRect(0, 0, 1920, 1080);

      drawStylizedCard(ctx, 95, 52, 110, 95, hovered === 600 ? "#facc15" : "#1e293b", "#ffffff", 4, 12);
      drawSprite(ctx, "Icon_ArrowM", 122, 72, 54, 54, true);
      drawTextMeshPro(ctx, "SETTINGS", 240, 100, 54, "#ffffff", "left", 7, 8);

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
        drawStylizedCard(ctx, t.x, 210, 380, 78, isSel ? "#22c55e" : "#1e293b", "#ffffff", 4, 10);
        drawSprite(ctx, t.icon, t.x + 24, 225, 48, 48);
        drawTextMeshPro(ctx, t.label, t.x + 215, 249, 28, "#ffffff", "center", 5, 4);
      }

      drawStylizedCard(ctx, 140, 315, 1595, 680, "rgba(15, 23, 42, 0.94)", "#334155", 4, 14);
      drawSprite(ctx, "Tutorial_KeyboardMouse", 310, 340, 1260, 630);
    }

    uguiTexture.needsUpdate = true;
  }

  // ============================================================================
  // 9. MAIN UNITY WEBGL FRAME LOOP (3D Pass + Water Animation + UGUI Pass)
  // ============================================================================
  let lastTime = performance.now();
  let raycastFrameCounter = 0;

  function updateLoop(now) {
    requestAnimationFrame(updateLoop);
    const dt = Math.min((now - lastTime) / 1000.0, 0.05);
    lastTime = now;
    const t = now * 0.001;

    // Update Water Wave & Foam Time Uniform
    waterUniforms.uTime.value = t;

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

          // Add animated water wave displacement under the boat
          const waveUnderBoat = Math.sin(bx * 0.065 + t * 2.4) * 0.38 + Math.cos(bz * 0.075 + t * 1.9) * 0.32;
          wasmModules.boat.set_water_surface_y(detectedWaterY + waveUnderBoat * 0.45);

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
            fp.mesh.material.opacity = ratio * 0.88;
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

    // Render Pass 1: 3D Scene with Post-Processing Bloom & Tonemapping
    renderer.clear();
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }

    // Render Pass 2: High-Fidelity Unity UGUI CanvasRenderer Overlay
    renderUnityUGUI();
    renderer.clearDepth();
    renderer.render(uguiScene, uguiCamera);
  }

  requestAnimationFrame(updateLoop);
};
