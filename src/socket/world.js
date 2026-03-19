// =====================================================
//  src/socket/world.js
//  KitaBelajar World — Multiplayer + Voting Map
// =====================================================

module.exports = function(io) {
  const players     = {};  // pemain di world
  const lobbyPlayers = {}; // pemain di voting lobby

  // State voting — reset setiap sesi baru
  function buatVoteStateBaru() {
    return {
      active: false,
      votes: { sekolah:0, pantai:0, gunung:0, kota:0, angkasa:0, kastil:0 },
      pemainVote: {}, // playerId -> mapId
      timer: null,
      timerSisa: 30,
    };
  }

  let voteState = buatVoteStateBaru();

  function resetVoting() {
    if (voteState.timer) clearInterval(voteState.timer);
    voteState = buatVoteStateBaru();
  }

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

    // Reset voting state setelah semua masuk (3 detik)
    setTimeout(() => {
      resetVoting();
      console.log('🗳️ Voting state di-reset untuk sesi berikutnya');
    }, 3000);
  }

  io.on('connection', (socket) => {

    // ── Pemain masuk voting lobby ──
    socket.on('world:voting_join', (data) => {
      // Hapus vote lama dari pemain ini jika ada (kasus refresh)
      const idLama = data.id;
      if (voteState.pemainVote[idLama]) {
        const mapLama = voteState.pemainVote[idLama];
        voteState.votes[mapLama] = Math.max(0, (voteState.votes[mapLama] || 1) - 1);
        delete voteState.pemainVote[idLama];
      }

      lobbyPlayers[data.id] = { ...data, socketId: socket.id };
      socket.data.votingId = data.id;

      // Mulai timer kalau belum jalan
      if (!voteState.active) mulaiVotingTimer();

      // Kirim state voting BERSIH ke pemain baru (votes saat ini, bukan vote dia)
      socket.emit('world:voting_state', {
        votes: { ...voteState.votes },
        pemain: Object.values(lobbyPlayers),
        timerSisa: voteState.timerSisa,
        myVote: null  // selalu null untuk pemain baru/refresh
      });

      // Broadcast pemain baru ke semua
      io.emit('world:voting_pemain', { pemain: Object.values(lobbyPlayers) });

      console.log(`🗳️ ${data.nama} masuk lobby (${Object.keys(lobbyPlayers).length} di lobby)`);
    });

    // ── Pemain vote map ──
    socket.on('world:vote', ({ id, mapId, prev }) => {
      // Batalkan vote lama pemain ini
      const voteLama = voteState.pemainVote[id];
      if (voteLama && voteState.votes[voteLama] !== undefined) {
        voteState.votes[voteLama] = Math.max(0, voteState.votes[voteLama] - 1);
      }
      // Catat vote baru
      voteState.pemainVote[id] = mapId;
      if (voteState.votes[mapId] !== undefined) {
        voteState.votes[mapId]++;
      }
      // Broadcast update ke semua
      io.emit('world:vote_update', { votes: { ...voteState.votes } });
    });

    // ── Pemain masuk ke dunia (setelah voting) ──
    socket.on('world:join', (data) => {
      players[data.id] = { ...data, socketId: socket.id };
      socket.data.worldId = data.id;

      // Hapus dari lobby
      delete lobbyPlayers[data.id];
      // Hapus vote-nya dari state (sudah masuk dunia)
      const mapVote = voteState.pemainVote[data.id];
      if (mapVote) {
        voteState.votes[mapVote] = Math.max(0, (voteState.votes[mapVote] || 1) - 1);
        delete voteState.pemainVote[data.id];
      }

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
        console.log(`🌍 ${nama} keluar world (${Object.keys(players).length} online)`);
      }

      if (vid && lobbyPlayers[vid]) {
        // Hapus vote saat disconnect dari lobby
        const mapVote = voteState.pemainVote[vid];
        if (mapVote) {
          voteState.votes[mapVote] = Math.max(0, (voteState.votes[mapVote] || 1) - 1);
          delete voteState.pemainVote[vid];
        }
        delete lobbyPlayers[vid];
        io.emit('world:voting_pemain', { pemain: Object.values(lobbyPlayers) });
        io.emit('world:vote_update', { votes: { ...voteState.votes } });
      }

      // Kalau lobby kosong, reset voting
      if (Object.keys(lobbyPlayers).length === 0 && !voteState.active) {
        resetVoting();
      }
    });
  });
};