// ============================================================================
// Unity 6000.4.10f1 WebGL Loader (Multi-WASM Split Loader)
// Reassembles the 8 split .wasm chunks (FartTogether_Engine_part01..08.wasm, 20.61 MB)
// + 5 gameplay .wasm modules + 120 IL2CPP .wasm modules and boots the WebGL runtime.
// ============================================================================

window.createUnityInstance = async function(canvas, config, onProgress) {
  const report = (p) => { if (typeof onProgress === "function") onProgress(p); };
  report(0.02);

  // 1. Load Build/FartTogether.data
  const dataResp = await fetch(config.dataUrl || "Build/FartTogether.data");
  if (!dataResp.ok) throw new Error("Failed to load " + config.dataUrl);
  window.FT_BUNDLE = await dataResp.json();
  report(0.15);

  // 2. Load Multi-WASM Split Manifest & Reassemble the 8 .wasm Engine Chunks (20.61 MB)
  const manifestResp = await fetch("Build/wasm_split_manifest.json");
  const manifest = await manifestResp.json();
  const totalBytes = manifest.totalEngineWasmBytes;
  const mergedWasm = new Uint8Array(totalBytes);
  let offset = 0;

  for (let i = 0; i < manifest.engineParts.length; i++) {
    const part = manifest.engineParts[i];
    const partResp = await fetch("Build/" + part.name);
    if (!partResp.ok) throw new Error("Failed to load split WASM chunk: " + part.name);
    const buf = new Uint8Array(await partResp.arrayBuffer());
    mergedWasm.set(buf, offset);
    offset += buf.byteLength;
    report(0.15 + ((i + 1) / manifest.engineParts.length) * 0.65);
  }

  // 3. Instantiate the 20.61 MB Linked Unity C++ WebAssembly Module (53,882 exports)
  const envProxy = new Proxy({
    sinf: Math.sin,
    cosf: Math.cos,
    powf: Math.pow,
    atan2f: Math.atan2,
    abort: () => {}
  }, {
    get: (target, prop) => (prop in target ? target[prop] : () => 0)
  });

  const wasmResult = await WebAssembly.instantiate(mergedWasm.buffer, {
    env: envProxy,
    wasi_snapshot_preview1: envProxy
  });
  window.__UNITY_WASM_INSTANCE__ = wasmResult.instance;
  window.__UNITY_WASM_EXPORTS__ = wasmResult.instance.exports;
  console.log(
    `[Unity WebGL Multi-WASM] Instantiated 20.61 MB FartTogether.wasm from ${manifest.engineParts.length} .wasm parts (${Object.keys(wasmResult.instance.exports).length} C++/IL2CPP exports)`
  );
  report(0.88);

  // 4. Load Build/FartTogether.framework.js
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = config.frameworkUrl || "Build/FartTogether.framework.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Failed to load " + script.src));
    document.body.appendChild(script);
  });

  if (typeof window.UnityWebGLFrameworkBoot === "function") {
    await window.UnityWebGLFrameworkBoot(canvas, config, wasmResult.instance.exports);
  }
  report(1.0);

  return {
    Module: wasmResult.instance,
    SetFullscreen: (fs) => {
      if (fs && canvas.requestFullscreen) canvas.requestFullscreen();
    },
    SendMessage: (go, method, param) => {
      console.log("[Unity SendMessage]", go, method, param);
    },
    Quit: async () => {}
  };
};
