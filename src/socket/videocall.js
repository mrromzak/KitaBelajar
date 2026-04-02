// =====================================================
//  src/socket/videocall.js
//  WebRTC signaling server — KitaBelajar Video Call
//  Topologi: Mesh P2P (cocok s/d ~6-8 peserta)
//  Room ID = kelas_id
// =====================================================

module.exports = function (io) {
  // rooms[kelasId] = { hostId, peers: { socketId -> { userId, nama, avatar } } }
  const rooms = {};

  io.on('connection', (socket) => {

    // ── Guru/Murid: Bergabung ke ruang video ──────────────────
    socket.on('vc:join', ({ kelasId, nama, avatar }) => {
      // Gunakan data dari JWT, fallback ke data client
      const userId = socket.user?.id || null;
      const role   = socket.user?.role || 'murid';
      const safeNama   = socket.user?.nama || nama || 'Anonim';
      const safeAvatar = avatar || (role === 'guru' ? '👩‍🏫' : '🦁');

      if (!kelasId || !userId) return;

      if (!rooms[kelasId]) {
        rooms[kelasId] = { hostId: userId, peers: {} };
      }

      const room = rooms[kelasId];

      // Kirim daftar peer yang sudah ada ke pendatang baru
      const existingPeers = Object.entries(room.peers).map(([sid, p]) => ({
        socketId: sid,
        userId: p.userId,
        nama: p.nama,
        avatar: p.avatar
      }));
      socket.emit('vc:existing_peers', existingPeers);

      // Daftarkan peer baru
      room.peers[socket.id] = { userId, nama: safeNama, avatar: safeAvatar, role };
      socket.join('vc:' + kelasId);
      socket.data.vcKelasId = kelasId;
      socket.data.vcUserId = userId;

      // Beritahu peer lain bahwa ada yang baru masuk
      socket.to('vc:' + kelasId).emit('vc:peer_joined', {
        socketId: socket.id,
        userId,
        nama: safeNama,
        avatar: safeAvatar
      });

      // Beritahu semua (termasuk diri sendiri) jumlah peserta terkini
      broadcastCount(kelasId);
    });

    // ── Relay: SDP Offer ──────────────────────────────────────
    socket.on('vc:offer', ({ toSocketId, offer }) => {
      io.to(toSocketId).emit('vc:offer', {
        fromSocketId: socket.id,
        offer
      });
    });

    // ── Relay: SDP Answer ─────────────────────────────────────
    socket.on('vc:answer', ({ toSocketId, answer }) => {
      io.to(toSocketId).emit('vc:answer', {
        fromSocketId: socket.id,
        answer
      });
    });

    // ── Relay: ICE Candidate ──────────────────────────────────
    socket.on('vc:ice', ({ toSocketId, candidate }) => {
      io.to(toSocketId).emit('vc:ice', {
        fromSocketId: socket.id,
        candidate
      });
    });

    // ── Notifikasi status mic/kamera ──────────────────────────
    socket.on('vc:status', ({ kelasId, mic, cam }) => {
      socket.to('vc:' + kelasId).emit('vc:peer_status', {
        socketId: socket.id,
        mic,
        cam
      });
    });

    // ── Keluar dari ruang video ───────────────────────────────
    socket.on('vc:leave', ({ kelasId }) => {
      leaveRoom(socket, kelasId);
    });

    socket.on('disconnect', () => {
      const kelasId = socket.data.vcKelasId;
      if (kelasId) leaveRoom(socket, kelasId);
    });

  });

  function leaveRoom(socket, kelasId) {
    const room = rooms[kelasId];
    if (!room) return;

    delete room.peers[socket.id];
    socket.leave('vc:' + kelasId);
    socket.to('vc:' + kelasId).emit('vc:peer_left', { socketId: socket.id });

    // Hapus room kalau sudah kosong
    if (Object.keys(room.peers).length === 0) {
      delete rooms[kelasId];
    } else {
      broadcastCount(kelasId);
    }

    delete socket.data.vcKelasId;
    delete socket.data.vcUserId;
  }

  function broadcastCount(kelasId) {
    const room = rooms[kelasId];
    const count = room ? Object.keys(room.peers).length : 0;
    io.to('vc:' + kelasId).emit('vc:participant_count', { count });
  }
};
