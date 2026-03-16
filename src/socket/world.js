// =====================================================
//  src/socket/world.js
//  KitaBelajar World — Multiplayer + Voting Map
// =====================================================

module.exports = function(io) {
  const players  = {};   // pemain di world
  const lobbyPlayers = {}; // pemain di voting lobby

  // State voting
  let voteState = {
    active: false,
    votes: { sekolah:0, pantai:0, gunung:0, kota:0, angkasa:0, kastil:0 },
    pemainVote: {},   // playerId -> mapId
    timer: null,
    timerSisa: 0,
  };

  function mulaiVotingTimer() {
    if (voteState.timer) clearInterval(voteState.timer);
    voteState.timerSisa = 30;
    voteState.active = true;
    voteState.timer = setInterval(() => {
      voteState.timerSisa--;
      if (voteState.timerSisa <= 0) {
        clearInterval(voteState.timer);
        voteState.active = false;
        selesaiVoting();
      }
    }, 1000);
  }

  function selesaiVoting() {
    // Hitung pemenang
    let winner = 'sekolah', maxVote = 0;
    Object.entries(voteState.votes).forEach(([id, count]) => {
      if (count > maxVote) { maxVote = count; winner = id; }
    });
    if (maxVote === 0) {
      const maps = ['sekolah','pantai','gunung','kota','angkasa','kastil'];
      winner = maps[Math.floor(Math.random() * maps.length)];
    }
    io.emit('world:voting_end', { winner });
    // Reset untuk voting berikutnya
    setTimeout(() => {
      voteState.votes = { sekolah:0, pantai:0, gunung:0, kota:0, angkasa:0, kastil:0 };
      voteState.pemainVote = {};
    }, 5000);
  }

  io.on('connection', (socket) => {

    // ── Pemain masuk voting lobby ──
    socket.on('world:voting_join', (data) => {
      lobbyPlayers[data.id] = { ...data, socketId: socket.id };
      socket.data.votingId = data.id;

      // Mulai timer kalau belum jalan
      if (!voteState.active) mulaiVotingTimer();

      // Kirim state voting saat ini
      socket.emit('world:voting_state', {
        votes: voteState.votes,
        pemain: Object.values(lobbyPlayers),
        timerSisa: voteState.timerSisa
      });

      // Broadcast pemain baru ke semua
      io.emit('world:voting_pemain', { pemain: Object.values(lobbyPlayers) });
    });

    // ── Pemain vote map ──
    socket.on('world:vote', ({ id, mapId, prev }) => {
      // Batalkan vote lama
      if (prev && voteState.votes[prev] !== undefined) {
        voteState.votes[prev] = Math.max(0, voteState.votes[prev] - 1);
      }
      // Catat vote baru
      voteState.pemainVote[id] = mapId;
      if (voteState.votes[mapId] !== undefined) {
        voteState.votes[mapId]++;
      }
      // Broadcast update ke semua
      io.emit('world:vote_update', { votes: voteState.votes });
    });

    // ── Pemain masuk ke dunia (setelah voting) ──
    socket.on('world:join', (data) => {
      players[data.id] = { ...data, socketId: socket.id };
      socket.data.worldId = data.id;
      delete lobbyPlayers[data.id];

      socket.emit('world:players', Object.values(players).filter(p => p.id !== data.id));
      socket.broadcast.emit('world:player_join', data);
      console.log(`🌍 ${data.nama} masuk world (${Object.keys(players).length} online)`);
    });

    // ── Pemain bergerak ──
    socket.on('world:move', (data) => {
      if (players[data.id]) { players[data.id].x = data.x; players[data.id].y = data.y; }
      socket.broadcast.emit('world:player_move', data);
    });

    // ── Jawab soal ──
    socket.on('world:jawab', (data) => {
      if (players[data.id] && data.benar) {
        players[data.id].skor = (players[data.id].skor || 0) + (data.poin || 0);
      }
      io.emit('world:player_jawab', {
        id: data.id,
        nama: players[data.id]?.nama,
        avatar: players[data.id]?.avatar,
        benar: data.benar,
        soalIdx: data.soalIdx
      });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      const wid = socket.data.worldId;
      const vid = socket.data.votingId;
      if (wid && players[wid]) {
        const nama = players[wid].nama;
        delete players[wid];
        socket.broadcast.emit('world:player_leave', { id: wid });
        console.log(`🌍 ${nama} keluar (${Object.keys(players).length} online)`);
      }
      if (vid && lobbyPlayers[vid]) {
        delete lobbyPlayers[vid];
        io.emit('world:voting_pemain', { pemain: Object.values(lobbyPlayers) });
      }
    });
  });
};