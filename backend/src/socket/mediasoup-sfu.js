// =====================================================
//  src/socket/mediasoup-sfu.js
//  SFU Video Call via mediasoup — maks 64 peserta/room
// =====================================================

const mediasoup = require('mediasoup');
const os        = require('os');
const dns       = require('dns').promises;

const mediaCodecs = [
  { kind: 'audio', mimeType: 'audio/opus',  clockRate: 48000, channels: 2 },
  { kind: 'video', mimeType: 'video/VP8',   clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 } },
  { kind: 'video', mimeType: 'video/VP9',   clockRate: 90000 },
  { kind: 'video', mimeType: 'video/h264',  clockRate: 90000,
    parameters: { 'packetization-mode': 1, 'profile-level-id': '42e01f', 'level-asymmetry-allowed': 1 } },
];

// Railway tidak punya IP statis — resolve dari hostname atau fallback ke interface lokal
async function getAnnouncedIp() {
  // 1. Jika di-set manual via env, pakai itu
  if (process.env.MEDIASOUP_ANNOUNCED_IP) return process.env.MEDIASOUP_ANNOUNCED_IP;

  // 2. Coba resolve hostname Railway (RAILWAY_PUBLIC_DOMAIN = domain tanpa https)
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railwayDomain) {
    try {
      const { address } = await dns.lookup(railwayDomain);
      console.log('📡 mediasoup announcedIp (dari Railway domain):', address);
      return address;
    } catch(e) {
      console.warn('DNS lookup gagal:', e.message);
    }
  }

  // 3. Fallback: pakai IP interface non-internal
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

module.exports = async function (io) {
  const worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000'),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '49999'),
  });
  console.log('✅ mediasoup worker PID:', worker.pid);
  worker.on('died', () => { console.error('❌ mediasoup worker died!'); setTimeout(() => process.exit(1), 2000); });

  // Resolve IP — Railway harus async
  const announcedIp = await getAnnouncedIp();
  console.log('📡 mediasoup announcedIp:', announcedIp);

  // Railway tidak expose UDP → gunakan TCP only
  // Jika lokal (bukan Railway), aktifkan UDP juga untuk performa lebih baik
  const isRailway = !!process.env.RAILWAY_PUBLIC_DOMAIN;
  const transportOptions = {
    listenIps: [{ ip: '0.0.0.0', announcedIp }],
    enableUdp: !isRailway,
    enableTcp: true,
    preferUdp: !isRailway,
    preferTcp: isRailway,
    initialAvailableOutgoingBitrate: 800000,
  };

  // rooms[kelasId] = { router, peers: { socketId -> peerData } }
  const rooms = {};

  async function getOrCreateRoom(kelasId) {
    if (!rooms[kelasId]) {
      const router = await worker.createRouter({ mediaCodecs });
      rooms[kelasId] = { router, peers: {} };
    }
    return rooms[kelasId];
  }

  function cleanupPeer(socket, kelasId) {
    const room = rooms[kelasId];
    if (!room || !room.peers[socket.id]) return;
    const peer = room.peers[socket.id];
    Object.values(peer.consumers).forEach(c => { try { c.close(); } catch(e) {} });
    Object.values(peer.producers).forEach(p => { try { p.close(); } catch(e) {} });
    Object.values(peer.transports).forEach(t => { try { t.close(); } catch(e) {} });
    delete room.peers[socket.id];
    socket.leave('vc:' + kelasId);
    socket.to('vc:' + kelasId).emit('vc:peer_left', { socketId: socket.id });
    delete socket.data.vcKelasId;
    if (Object.keys(room.peers).length === 0) { room.router.close(); delete rooms[kelasId]; }
    else broadcastCount(kelasId);
  }

  function broadcastCount(kelasId) {
    const count = rooms[kelasId] ? Object.keys(rooms[kelasId].peers).length : 0;
    io.to('vc:' + kelasId).emit('vc:participant_count', { count });
  }

  io.on('connection', (socket) => {

    // ── 1. Join room ─────────────────────────────────────────
    socket.on('vc:join', async ({ kelasId, userId, nama, avatar }, callback) => {
      try {
        const room = await getOrCreateRoom(kelasId);
        if (Object.keys(room.peers).length >= 64) {
          return socket.emit('vc:error', { pesan: 'Ruangan penuh (maks 64 peserta).' });
        }
        socket.join('vc:' + kelasId);
        socket.data.vcKelasId = kelasId;
        socket.data.vcUserId  = userId;
        room.peers[socket.id] = { userId, nama, avatar, transports: {}, producers: {}, consumers: {} };
        socket.to('vc:' + kelasId).emit('vc:peer_joined', { socketId: socket.id, userId, nama, avatar });
        broadcastCount(kelasId);
        callback({ rtpCapabilities: room.router.rtpCapabilities });
      } catch(e) {
        console.error('[vc:join]', e.message);
        socket.emit('vc:error', { pesan: e.message });
      }
    });

    // ── 2. Buat WebRTC Transport ──────────────────────────────
    socket.on('vc:create_transport', async ({ direction }, callback) => {
      try {
        const kelasId = socket.data.vcKelasId;
        const room    = rooms[kelasId];
        if (!room || !room.peers[socket.id]) return;
        const transport = await room.router.createWebRtcTransport(transportOptions);
        room.peers[socket.id].transports[transport.id] = transport;
        callback({ id: transport.id, iceParameters: transport.iceParameters,
                   iceCandidates: transport.iceCandidates, dtlsParameters: transport.dtlsParameters });
      } catch(e) { callback({ error: e.message }); }
    });

    // ── 3. Connect transport ──────────────────────────────────
    socket.on('vc:connect_transport', async ({ transportId, dtlsParameters }, callback) => {
      try {
        const transport = rooms[socket.data.vcKelasId]?.peers[socket.id]?.transports[transportId];
        if (transport) await transport.connect({ dtlsParameters });
        callback({});
      } catch(e) { callback({ error: e.message }); }
    });

    // ── 4. Produce (kirim track) ──────────────────────────────
    socket.on('vc:produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
      try {
        const kelasId = socket.data.vcKelasId;
        const peer    = rooms[kelasId]?.peers[socket.id];
        const transport = peer?.transports[transportId];
        if (!transport) return callback({ error: 'Transport not found' });
        const producer = await transport.produce({ kind, rtpParameters, appData });
        peer.producers[producer.id] = producer;
        callback({ producerId: producer.id });
        socket.to('vc:' + kelasId).emit('vc:new_producer', {
          producerId: producer.id, socketId: socket.id, kind, nama: peer.nama, avatar: peer.avatar
        });
      } catch(e) { callback({ error: e.message }); }
    });

    // ── 5. Consume (terima track dari peer lain) ──────────────
    socket.on('vc:consume', async ({ producerId, rtpCapabilities, transportId }, callback) => {
      try {
        const kelasId = socket.data.vcKelasId;
        const room    = rooms[kelasId];
        const peer    = room?.peers[socket.id];
        const transport = peer?.transports[transportId];
        if (!transport || !room) return callback({ error: 'Transport not found' });
        if (!room.router.canConsume({ producerId, rtpCapabilities })) return callback({ error: 'Cannot consume' });
        const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
        peer.consumers[consumer.id] = consumer;
        callback({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
      } catch(e) { callback({ error: e.message }); }
    });

    // ── 6. Resume consumer setelah client siap ────────────────
    socket.on('vc:resume_consumer', async ({ consumerId }, callback) => {
      try {
        const consumer = rooms[socket.data.vcKelasId]?.peers[socket.id]?.consumers[consumerId];
        if (consumer) await consumer.resume();
        if (callback) callback({});
      } catch(e) { console.error('[vc:resume]', e.message); }
    });

    // ── 7. Dapatkan semua producer yang sudah ada ─────────────
    socket.on('vc:get_producers', (callback) => {
      const kelasId = socket.data.vcKelasId;
      if (!kelasId || !rooms[kelasId]) return callback([]);
      const result = [];
      Object.entries(rooms[kelasId].peers).forEach(([sid, peer]) => {
        if (sid === socket.id) return;
        Object.entries(peer.producers).forEach(([pid, prod]) => {
          result.push({ producerId: pid, socketId: sid, kind: prod.kind, nama: peer.nama, avatar: peer.avatar });
        });
      });
      callback(result);
    });

    // ── 8. Status mic/cam ─────────────────────────────────────
    socket.on('vc:status', ({ kelasId, mic, cam }) => {
      socket.to('vc:' + kelasId).emit('vc:peer_status', { socketId: socket.id, mic, cam });
    });

    // ── 9. Keluar ─────────────────────────────────────────────
    socket.on('vc:leave', ({ kelasId }) => cleanupPeer(socket, kelasId));
    socket.on('disconnect', () => { if (socket.data.vcKelasId) cleanupPeer(socket, socket.data.vcKelasId); });
  });
};
