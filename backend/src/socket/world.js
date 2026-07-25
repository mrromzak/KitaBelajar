// =====================================================
//  src/socket/world.js
//  KitaBelajar World — Multiplayer + Voting Map
// =====================================================

const { cleanText, cleanAvatar } = require('../utils/sanitize');

module.exports = function(io) {
  // ── Helper: ambil field aman dari data pemain ──
  function safePlayerData(data) {
    return {
      id: String(data.id || '').slice(0, 100),
      nama: cleanText(data.nama || 'Anonim', 50),
      avatar: cleanAvatar(data.avatar || '🦁', 2000),
      x: Number(data.x) || 0,
      y: Number(data.y) || 0,
      skor: Number(data.skor) || 0
    };
  }
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
      const player = safePlayerData(data);
      const idLama = player.id;
      if (voteState.pemainVote[idLama]) {
        const mapLama = voteState.pemainVote[idLama];
        voteState.votes[mapLama] = Math.max(0, (voteState.votes[mapLama] || 1) - 1);
        delete voteState.pemainVote[idLama];
      }

      lobbyPlayers[player.id] = { ...player, socketId: socket.id };
      socket.data.votingId = player.id;

      // Mulai timer kalau belum jalan
      if (!voteState.active) mulaiVotingTimer();

      // Kirim state voting BERSIH ke pemain baru (votes saat ini, bukan vote dia)
      socket.emit('world:voting_state', {
        votes: { ...voteState.votes },
        pemain: Object.values(lobbyPlayers).map(p => ({ id: p.id, nama: p.nama, avatar: p.avatar })),
        timerSisa: voteState.timerSisa,
        myVote: null  // selalu null untuk pemain baru/refresh
      });

      // Broadcast pemain baru ke semua
      io.emit('world:voting_pemain', { pemain: Object.values(lobbyPlayers).map(p => ({ id: p.id, nama: p.nama, avatar: p.avatar })) });

      console.log(`🗳️ ${player.nama} masuk lobby (${Object.keys(lobbyPlayers).length} di lobby)`);
    });

    // ── Pemain vote map ──
    socket.on('world:vote', ({ id, mapId, prev }) => {
      const safeId = String(id || '').slice(0, 100);
      const safeMap = String(mapId || 'sekolah').slice(0, 20);
      // Batalkan vote lama pemain ini
      const voteLama = voteState.pemainVote[safeId];
      if (voteLama && voteState.votes[voteLama] !== undefined) {
        voteState.votes[voteLama] = Math.max(0, voteState.votes[voteLama] - 1);
      }
      // Catat vote baru
      voteState.pemainVote[safeId] = safeMap;
      if (voteState.votes[safeMap] !== undefined) {
        voteState.votes[safeMap]++;
      }
      // Broadcast update ke semua
      io.emit('world:vote_update', { votes: { ...voteState.votes } });
    });

    // ── Pemain masuk ke dunia (setelah voting) ──
    socket.on('world:join', (data) => {
      const player = safePlayerData(data);
      players[player.id] = { ...player, socketId: socket.id };
      socket.data.worldId = player.id;

      // Hapus dari lobby
      delete lobbyPlayers[player.id];
      // Hapus vote-nya dari state (sudah masuk dunia)
      const mapVote = voteState.pemainVote[player.id];
      if (mapVote) {
        voteState.votes[mapVote] = Math.max(0, (voteState.votes[mapVote] || 1) - 1);
        delete voteState.pemainVote[player.id];
      }

      socket.emit('world:players', Object.values(players).filter(p => p.id !== player.id));
      socket.broadcast.emit('world:player_join', { id: player.id, nama: player.nama, avatar: player.avatar, x: player.x, y: player.y });
      console.log(`🌍 ${player.nama} masuk world (${Object.keys(players).length} online)`);
    });

    // ── Pemain bergerak ──
    socket.on('world:move', (data) => {
      const id = String(data.id || '').slice(0, 100);
      if (players[id]) { players[id].x = Number(data.x) || 0; players[id].y = Number(data.y) || 0; }
      socket.broadcast.emit('world:player_move', { id, x: players[id]?.x, y: players[id]?.y });
    });

    // ── Jawab soal ──
    socket.on('world:jawab', (data) => {
      const id = String(data.id || '').slice(0, 100);
      if (players[id] && data.benar) {
        players[id].skor = (players[id].skor || 0) + (Number(data.poin) || 0);
      }
      io.emit('world:player_jawab', {
        id,
        nama: players[id]?.nama || '',
        avatar: players[id]?.avatar || '',
        benar: !!data.benar,
        soalIdx: Number(data.soalIdx) || 0
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