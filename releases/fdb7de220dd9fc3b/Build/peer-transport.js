// Browser-to-browser FishNet transport. PeerJS Cloud carries signaling only.
// All game packets currently use one ordered reliable WebRTC data channel.
(function (root) {
  'use strict';
  let current = null;
  const MAX_PACKET = 16384;
  const MAX_BUFFER = 1024 * 1024;

  function stop() {
    const state = current;
    current = null;
    if (!state) return;
    clearTimeout(state.timer);
    for (const connection of state.connections.values()) connection.close();
    if (state.peer) state.peer.destroy();
  }
  function start(room, version, host, maximumClients, emit) {
    stop();
    if (!root.Peer || !root.RTCPeerConnection) {
      emit({kind: 'error', message: 'WebRTC indisponible dans ce navigateur.'});
      return;
    }
    if (!/^[A-Z2-9]{6,12}$/.test(room)) {
      emit({kind: 'error', message: 'Code de salon invalide.'});
      return;
    }
    const protocol = 'ft-' + version.replace(/[^a-zA-Z0-9-]/g, '-');
    const roomId = protocol + '-' + room;
    const state = {host, connections: new Map(), peer: null, emit, nextId: 1};
    current = state;
    const alive = () => current === state;
    const event = value => { if (alive()) emit(value); };
    function fail(message) { event({kind: 'error', message}); }
    state.timer = setTimeout(() => {
      if (!alive()) return;
      fail('Connexion impossible. Verifiez le code du salon et le reseau. Certains reseaux exigent un relais TURN.');
      stop();
      if (!host) emit({kind: 'client-close'});
    }, 25000);
    const options = {
      debug: 1,
      config: {iceServers: [
        {urls: 'stun:stun.l.google.com:19302'},
        {urls: 'stun:global.stun.twilio.com:3478'}
      ]}
    };
    // No TURN credentials or hidden dependency on a paid relay.
    const peer = host ? new root.Peer(roomId, options) : new root.Peer(options);
    state.peer = peer;
    function bind(connection, id) {
      let opened = false;
      let closed = false;
      state.connections.set(id, connection);
      function close() {
        if (closed) return;
        closed = true;
        state.connections.delete(id);
        if (opened || !host) event({kind: host ? 'peer-close' : 'client-close', id});
        if (!host && alive()) stop();
      }
      connection.on('open', () => {
        if (!alive()) { connection.close(); return; }
        opened = true;
        clearTimeout(state.timer);
        event({kind: host ? 'peer-open' : 'client-open', id});
      });
      connection.on('data', payload => {
        if (!alive() || !opened || closed) return;
        if (!(payload instanceof ArrayBuffer) && !ArrayBuffer.isView(payload)) { connection.close(); return; }
        const bytes = payload instanceof ArrayBuffer ? new Uint8Array(payload) : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
        if (bytes.length < 2 || bytes.length > MAX_PACKET + 1 || bytes[0] > 1) { connection.close(); return; }
        let binary = '';
        for (let i = 1; i < bytes.length; ++i) binary += String.fromCharCode(bytes[i]);
        event({kind: host ? 'server-data' : 'client-data', id, channel: bytes[0], data: root.btoa(binary)});
      });
      connection.on('close', close);
      connection.on('error', error => {
        fail('Connexion WebRTC interrompue : ' + error.message);
        close();
        connection.close();
      });
    }
    peer.on('open', () => {
      if (!alive()) return;
      if (host) {
        clearTimeout(state.timer);
        event({kind: 'host-open'});
      } else {
        bind(peer.connect(roomId, {reliable: true, serialization: 'raw', metadata: {protocol}}), 0);
      }
    });
    peer.on('connection', connection => {
      if (!alive() || !host || !connection.metadata || connection.metadata.protocol !== protocol || state.connections.size >= maximumClients - 1) {
        connection.close();
        return;
      }
      bind(connection, state.nextId++);
    });
    peer.on('error', error => {
      const messages = {
        'unavailable-id': 'Ce code de salon est deja utilise. Creez un nouveau salon.',
        'peer-unavailable': 'Salon introuvable. Verifiez le code et demandez a votre ami de garder le jeu ouvert.',
        'network': 'Le service de mise en relation est inaccessible.',
        'webrtc': 'Connexion directe bloquee par le reseau. Un relais TURN peut etre necessaire.'
      };
      fail(messages[error.type] || error.message);
      if (!host) { event({kind: 'client-close'}); stop(); }
    });
    peer.on('disconnected', () => {
      // Established data channels continue without the signaling service.
      if (alive() && !peer.destroyed) peer.reconnect();
    });
    peer.on('close', () => { if (alive() && !host) event({kind: 'client-close'}); });
  }
  function send(server, id, channel, payload) {
    const state = current;
    if (!state || state.host !== server) return;
    const connection = state.connections.get(server ? id : 0);
    if (!connection || !connection.open) return;
    if (payload.length > MAX_PACKET || (connection.dataChannel && connection.dataChannel.bufferedAmount > MAX_BUFFER)) {
      state.emit({kind: 'error', message: 'Connexion trop lente ou paquet trop volumineux.'});
      connection.close();
      return;
    }
    const bytes = new Uint8Array(payload.length + 1);
    bytes[0] = channel;
    bytes.set(payload, 1);
    try { connection.send(bytes.buffer); }
    catch (error) { state.emit({kind: 'error', message: error.message}); connection.close(); }
  }
  function kick(id) {
    if (!current || !current.host) return;
    const connection = current.connections.get(id);
    if (connection) connection.close();
  }
  root.FartPeerTransport = {start, send, stop, kick};
})(typeof window !== 'undefined' ? window : globalThis);
