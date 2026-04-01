// =====================================================
//  src/socket/zepquiz.js
//  Socket.io handler — Zep Quiz Live Game
//  Cara pakai di server.js:
//    const { createServer } = require('http');
//    const { Server } = require('socket.io');
//    const httpServer = createServer(app);
//    const io = new Server(httpServer, { cors: { origin: '*' } });
//    require('./socket/zepquiz')(io);
//    httpServer.listen(PORT, ...);
// =====================================================

const supabase = require('../supabase');

module.exports = function(io) {

  // rooms[kode] = { kode, quiz, soal[], pemain{}, status, soalIdx, timer, scores{} }
  const rooms = {};

  function broadcast(kode, event, data) {
    io.to(kode).emit(event, data);
  }

  function getRoomState(kode) {
    const r = rooms[kode];
    if (!r) return null;
    return {
      kode,
      judul: r.quiz.judul,
      mapel: r.quiz.mapel,
      status: r.status,          // 'lobby' | 'playing' | 'finished'
      soalIdx: r.soalIdx,
      totalSoal: r.soal.length,
      pemain: Object.values(r.pemain).map(p => ({
        id: p.id, nama: p.nama, avatar: p.avatar,
        skor: r.scores[p.id] || 0
      }))
    };
  }

  io.on('connection', (socket) => {

    // ── GURU: Buat room ──────────────────────────────────────
    socket.on('zep:create_room', ({ kode_room, quiz, soal, guru }) => {
      if (rooms[kode_room]) {
        socket.emit('zep:error', { pesan: 'Kode room sudah ada.' });
        return;
      }
      rooms[kode_room] = {
        kode: kode_room,
        quiz,
        soal,
        guru,
        pemain: {},
        scores: {},
        jawaban: {},   // soalIdx -> { userId -> { benar, poin, waktu } }
        status: 'lobby',
        soalIdx: -1,
        timer: null
      };
      socket.join(kode_room);
      socket.data.kode = kode_room;
      socket.data.isGuru = true;
      socket.emit('zep:room_created', getRoomState(kode_room));
    });

    // ── MURID: Join room ─────────────────────────────────────
    socket.on('zep:join_room', async ({ kode_room, user }) => {
      const room = rooms[kode_room];
      if (!room) { socket.emit('zep:error', { pesan: 'Room tidak ditemukan.' }); return; }
      if (room.status !== 'lobby') { socket.emit('zep:error', { pesan: 'Quiz sudah dimulai.' }); return; }

      // Validasi: murid harus terdaftar di kelas yang sama dengan kuis ini
      if (room.quiz?.kelas_id) {
        const { data: member } = await supabase
          .from('kelas_murid')
          .select('kelas_id')
          .eq('kelas_id', room.quiz.kelas_id)
          .eq('murid_id', user.id)
          .single();
        if (!member) {
          socket.emit('zep:error', { pesan: 'Kamu tidak terdaftar di kelas ini.' });
          return;
        }
      }

      room.pemain[user.id] = { ...user, socketId: socket.id };
      room.scores[user.id] = 0;
      socket.join(kode_room);
      socket.data.kode = kode_room;
      socket.data.userId = user.id;

      socket.emit('zep:joined', getRoomState(kode_room));
      broadcast(kode_room, 'zep:pemain_masuk', {
        pemain: Object.values(room.pemain).map(p => ({
          id: p.id, nama: p.nama, avatar: p.avatar, skor: room.scores[p.id] || 0
        }))
      });
    });

    // ── GURU: Mulai game ─────────────────────────────────────
    socket.on('zep:start_game', ({ kode_room }) => {
      const room = rooms[kode_room];
      if (!room) return;
      if (room.status !== 'lobby') return;
      room.status = 'playing';
      broadcast(kode_room, 'zep:game_start', { totalSoal: room.soal.length });
      setTimeout(() => kirimSoal(kode_room, 0), 1500);
    });

    // ── MURID: Jawab soal ────────────────────────────────────
    socket.on('zep:jawab', ({ kode_room, soalIdx, jawaban, waktuSisa }) => {
      const room = rooms[kode_room];
      if (!room || room.status !== 'playing') return;
      if (room.soalIdx !== soalIdx) return;

      const userId = socket.data.userId;
      if (!userId) return;

      // Pastikan belum jawab soal ini
      if (!room.jawaban[soalIdx]) room.jawaban[soalIdx] = {};
      if (room.jawaban[soalIdx][userId]) return; // sudah jawab

      const soal = room.soal[soalIdx];
      const benar = String(jawaban).trim().toLowerCase() === String(soal.jawaban).trim().toLowerCase();
      const durasi = room.quiz.durasi_per_soal || 15;
      // Bonus poin berdasarkan kecepatan (max 100% dari poin soal)
      const poinDapat = benar ? Math.round((soal.poin || 100) * (0.5 + 0.5 * (waktuSisa / durasi))) : 0;

      room.jawaban[soalIdx][userId] = { benar, poin: poinDapat, waktu: Date.now() };
      room.scores[userId] = (room.scores[userId] || 0) + poinDapat;

      // Kirim konfirmasi ke murid yang menjawab
      socket.emit('zep:hasil_jawab', {
        benar,
        poinDapat,
        jawabanBenar: soal.jawaban,
        totalSkor: room.scores[userId]
      });

      // Update skor live ke semua
      broadcast(kode_room, 'zep:update_skor', {
        pemain: Object.values(room.pemain).map(p => ({
          id: p.id, nama: p.nama, avatar: p.avatar, skor: room.scores[p.id] || 0
        })).sort((a, b) => b.skor - a.skor)
      });

      // Cek apakah semua sudah jawab
      const totalJawab = Object.keys(room.jawaban[soalIdx]).length;
      const totalPemain = Object.keys(room.pemain).length;
      if (totalJawab >= totalPemain && totalPemain > 0) {
        clearTimeout(room.timer);
        tampilkanHasilSoal(kode_room, soalIdx);
      }
    });

    // ── GURU: Soal berikutnya manual ─────────────────────────
    socket.on('zep:next_soal', ({ kode_room }) => {
      const room = rooms[kode_room];
      if (!room || !socket.data.isGuru) return;
      clearTimeout(room.timer);
      const next = room.soalIdx + 1;
      if (next < room.soal.length) {
        kirimSoal(kode_room, next);
      } else {
        akhiriGame(kode_room);
      }
    });

    // ── Disconnect ───────────────────────────────────────────
    socket.on('disconnect', () => {
      const kode = socket.data.kode;
      const userId = socket.data.userId;
      if (!kode || !rooms[kode]) return;

      if (socket.data.isGuru) {
        // Guru disconnect → tutup room setelah 30 detik
        setTimeout(() => {
          if (rooms[kode]) {
            broadcast(kode, 'zep:room_closed', { pesan: 'Guru menutup room.' });
            delete rooms[kode];
          }
        }, 30000);
      } else if (userId) {
        delete rooms[kode].pemain[userId];
        broadcast(kode, 'zep:pemain_keluar', { userId });
      }
    });

    // ── GURU: Tutup room ─────────────────────────────────────
    socket.on('zep:close_room', ({ kode_room }) => {
      broadcast(kode_room, 'zep:room_closed', { pesan: 'Guru menutup room.' });
      if (rooms[kode_room]) {
        clearTimeout(rooms[kode_room].timer);
        delete rooms[kode_room];
      }
    });

  }); // end io.on connection

  // ── Helpers ──────────────────────────────────────────────────

  function kirimSoal(kode, idx) {
    const room = rooms[kode];
    if (!room) return;
    room.soalIdx = idx;
    if (!room.jawaban[idx]) room.jawaban[idx] = {};

    const soal = room.soal[idx];
    const durasi = room.quiz.durasi_per_soal || 15;

    // Kirim soal tanpa jawaban ke murid
    broadcast(kode, 'zep:soal', {
      idx,
      totalSoal: room.soal.length,
      soal: {
        id: soal.id,
        pertanyaan: soal.pertanyaan,
        emoji: soal.emoji,
        opsi: soal.opsi,
        poin: soal.poin
      },
      durasi
    });

    // Timer countdown
    room.timer = setTimeout(() => {
      tampilkanHasilSoal(kode, idx);
    }, (durasi + 1) * 1000);
  }

  function tampilkanHasilSoal(kode, idx) {
    const room = rooms[kode];
    if (!room) return;

    const soal = room.soal[idx];
    const jawaban = room.jawaban[idx] || {};

    // Hitung statistik jawaban per opsi
    const opsiCount = {};
    (soal.opsi || []).forEach(o => { opsiCount[o] = 0; });
    Object.values(jawaban).forEach(j => {
      // cari jawaban user dari event — kita simpan jawabanTeks di sini nanti
    });

    broadcast(kode, 'zep:hasil_soal', {
      idx,
      jawabanBenar: soal.jawaban,
      leaderboard: Object.values(room.pemain).map(p => ({
        id: p.id, nama: p.nama, avatar: p.avatar,
        skor: room.scores[p.id] || 0,
        benar: room.jawaban[idx]?.[p.id]?.benar || false,
        poin: room.jawaban[idx]?.[p.id]?.poin || 0
      })).sort((a, b) => b.skor - a.skor)
    });

    // Auto next soal setelah 4 detik
    room.timer = setTimeout(() => {
      const next = idx + 1;
      if (next < room.soal.length) {
        kirimSoal(kode, next);
      } else {
        akhiriGame(kode);
      }
    }, 4000);
  }

  function akhiriGame(kode) {
    const room = rooms[kode];
    if (!room) return;
    room.status = 'finished';

    const final = Object.values(room.pemain).map(p => ({
      id: p.id, nama: p.nama, avatar: p.avatar,
      skor: room.scores[p.id] || 0
    })).sort((a, b) => b.skor - a.skor);

    broadcast(kode, 'zep:game_selesai', {
      leaderboard: final,
      judul: room.quiz.judul
    });

    // Bersihkan room setelah 5 menit
    setTimeout(() => { delete rooms[kode]; }, 300000);
  }

};
