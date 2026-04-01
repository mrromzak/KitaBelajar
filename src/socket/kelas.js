// =====================================================
//  src/socket/kelas.js
//  Real-time chat & online/offline tracking per kelas
// =====================================================

module.exports = function (io) {
  // socketId -> { userId, nama, avatar, role, kelasId }
  const connectedUsers = {};
  // kelasId -> Set<socketId>
  const kelasRooms = {};
  // kelasId -> { roomUrl, nama, ts } — meeting yang sedang aktif
  const activeMeetings = {};

  function broadcastOnlineList(kelasId) {
    if (!kelasRooms[kelasId]) return;
    const list = [...kelasRooms[kelasId]]
      .map(sid => connectedUsers[sid])
      .filter(Boolean);
    io.to('kelas:' + kelasId).emit('kelas:online_list', list);
  }

  io.on('connection', (socket) => {

    socket.on('kelas:join', ({ kelasId, userId, nama, avatar, role }) => {
      socket.join('kelas:' + kelasId);
      connectedUsers[socket.id] = { userId, nama, avatar, role, kelasId };
      if (!kelasRooms[kelasId]) kelasRooms[kelasId] = new Set();
      kelasRooms[kelasId].add(socket.id);
      broadcastOnlineList(kelasId);

      // Jika ada meeting aktif di kelas ini, langsung kirim ke murid yang baru join
      if (role === 'murid' && activeMeetings[kelasId]) {
        socket.emit('kelas:meeting_banner', { kelasId, ...activeMeetings[kelasId] });
      }
    });

    socket.on('kelas:leave', ({ kelasId }) => {
      socket.leave('kelas:' + kelasId);
      if (kelasRooms[kelasId]) kelasRooms[kelasId].delete(socket.id);
      delete connectedUsers[socket.id];
      broadcastOnlineList(kelasId);
    });

    // Kirim pesan real-time ke semua anggota kelas
    socket.on('kelas:chat', ({ kelasId, isi, pengirim }) => {
      const pesan = {
        id: Date.now().toString(),
        kelas_id: kelasId,
        isi,
        pengirim,
        created_at: new Date().toISOString()
      };
      io.to('kelas:' + kelasId).emit('kelas:pesan_baru', pesan);
    });

    // Guru mulai meeting → broadcast ke seluruh murid di kelas (sertakan roomUrl)
    socket.on('kelas:meeting_started', ({ kelasId, nama, roomUrl }) => {
      socket.to('kelas:' + kelasId).emit('kelas:meeting_started', { kelasId, nama, roomUrl });
    });

    // Guru broadcast banner meeting → simpan di server + relay ke semua murid
    socket.on('kelas:meeting_banner', ({ kelasId, roomUrl, nama }) => {
      activeMeetings[kelasId] = { roomUrl, nama, ts: Date.now() };
      socket.to('kelas:' + kelasId).emit('kelas:meeting_banner', { kelasId, roomUrl, nama });
    });

    // Guru akhiri meeting → hapus dari server + hide banner semua murid
    socket.on('kelas:meeting_ended', ({ kelasId }) => {
      delete activeMeetings[kelasId];
      socket.to('kelas:' + kelasId).emit('kelas:meeting_ended', { kelasId });
    });

    // Edit pesan kelas — broadcast ke seluruh anggota kelas
    socket.on('kelas:edit_pesan', ({ kelasId, msgId, isi }) => {
      io.to('kelas:' + kelasId).emit('kelas:pesan_diedit', { msgId, isi });
    });

    // Hapus pesan kelas — broadcast ke seluruh anggota kelas
    socket.on('kelas:hapus_pesan', ({ kelasId, msgId }) => {
      io.to('kelas:' + kelasId).emit('kelas:pesan_dihapus', { msgId });
    });

    // ── Private Chat ──────────────────────────────
    // User join channel pribadinya agar bisa terima pesan
    socket.on('private:join', ({ userId }) => {
      if (userId) socket.join('user:' + userId);
    });

    // Kirim pesan privat ke user tertentu
    socket.on('private:send', (payload) => {
      const { toUserId } = payload;
      if (toUserId) {
        io.to('user:' + toUserId).emit('private:receive', payload);
      }
    });

    socket.on('disconnect', () => {
      const info = connectedUsers[socket.id];
      if (info) {
        const { kelasId } = info;
        if (kelasRooms[kelasId]) kelasRooms[kelasId].delete(socket.id);
        delete connectedUsers[socket.id];
        broadcastOnlineList(kelasId);
      }
    });
  });
};
