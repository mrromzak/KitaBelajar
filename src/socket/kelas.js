// =====================================================
//  src/socket/kelas.js
//  Real-time chat & online/offline tracking per kelas
// =====================================================

module.exports = function (io) {
  // socketId -> { userId, nama, avatar, role, kelasId }
  const connectedUsers = {};
  // kelasId -> Set<socketId>
  const kelasRooms = {};

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
