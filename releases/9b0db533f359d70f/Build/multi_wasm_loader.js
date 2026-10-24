// Chargeur Multi-WASM automatique pour Unity 6 WebGL sur GitHub Pages
(function() {
  const MANIFEST = {
  "engine_wasm_original": "FartTogether_Unity_WebGL_Build.wasm",
  "engine_wasm_total_bytes": 89146583,
  "engine_wasm_parts": [
    {
      "name": "FartTogether_Engine.part01.wasm",
      "size": 18874368,
      "index": 1
    },
    {
      "name": "FartTogether_Engine.part02.wasm",
      "size": 18874368,
      "index": 2
    },
    {
      "name": "FartTogether_Engine.part03.wasm",
      "size": 18874368,
      "index": 3
    },
    {
      "name": "FartTogether_Engine.part04.wasm",
      "size": 18874368,
      "index": 4
    },
    {
      "name": "FartTogether_Engine.part05.wasm",
      "size": 13649111,
      "index": 5
    }
  ],
  "assets_data_original": "FartTogether_Unity_WebGL_Build.data",
  "assets_data_total_bytes": 114514612,
  "assets_data_parts": [
    {
      "name": "FartTogether_Assets.part01.data.part",
      "size": 18874368,
      "index": 1
    },
    {
      "name": "FartTogether_Assets.part02.data.part",
      "size": 18874368,
      "index": 2
    },
    {
      "name": "FartTogether_Assets.part03.data.part",
      "size": 18874368,
      "index": 3
    },
    {
      "name": "FartTogether_Assets.part04.data.part",
      "size": 18874368,
      "index": 4
    },
    {
      "name": "FartTogether_Assets.part05.data.part",
      "size": 18874368,
      "index": 5
    },
    {
      "name": "FartTogether_Assets.part06.data.part",
      "size": 18874368,
      "index": 6
    },
    {
      "name": "FartTogether_Assets.part07.data.part",
      "size": 1268404,
      "index": 7
    }
  ],
  "framework_js": "FartTogether_Unity_WebGL_Build.framework.js",
  "loader_js": "FartTogether_Unity_WebGL_Build.loader.js"
};
  const origFetch = window.fetch.bind(window);

  async function fetchAndMergeParts(baseUrl, parts, totalBytes, label) {
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const partUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1) + p.name;
      if (window.onMultiWasmProgress) {
        window.onMultiWasmProgress(label, i + 1, parts.length, p.name);
      }
      const resp = await origFetch(partUrl);
      if (!resp.ok) throw new Error('Failed to load chunk ' + partUrl);
      const buf = new Uint8Array(await resp.arrayBuffer());
      merged.set(buf, offset);
      offset += buf.byteLength;
    }
    return merged.buffer;
  }

  window.fetch = async function(resource, init) {
    const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    if (MANIFEST.engine_wasm_original && url.endsWith(MANIFEST.engine_wasm_original)) {
      console.log('[Multi-WASM Loader] Assemblage de ' + MANIFEST.engine_wasm_parts.length + ' fichiers .wasm...');
      const buffer = await fetchAndMergeParts(url, MANIFEST.engine_wasm_parts, MANIFEST.engine_wasm_total_bytes, 'WASM');
      return new Response(buffer, {
        status: 200,
        headers: { 'Content-Type': 'application/wasm' }
      });
    }
    if (MANIFEST.assets_data_original && url.endsWith(MANIFEST.assets_data_original) && MANIFEST.assets_data_parts.length > 1) {
      console.log('[Multi-WASM Loader] Assemblage de ' + MANIFEST.assets_data_parts.length + ' fichiers .data...');
      const buffer = await fetchAndMergeParts(url, MANIFEST.assets_data_parts, MANIFEST.assets_data_total_bytes, 'DATA');
      return new Response(buffer, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' }
      });
    }
    return origFetch(resource, init);
  };
})();
