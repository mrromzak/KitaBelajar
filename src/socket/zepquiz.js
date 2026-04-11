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

// ── Soal Cache: hindari generate berulang untuk kategori sama ──
// Key: "mapel_jenjang_kelas", value: { soal[], expiry }
const soalCache = {};
const CACHE_TTL  = 8 * 60 * 1000; // 8 menit

// ── Antrian generate soal: batasi max 2 concurrent Groq call ──
let   groqConcurrent = 0;
const GROQ_MAX_CONCURRENT = 2;
const groqQueue = [];

function processGroqQueue() {
  while (groqConcurrent < GROQ_MAX_CONCURRENT && groqQueue.length > 0) {
    const task = groqQueue.shift();
    groqConcurrent++;
    _callGroq(task.mapel, task.jenjang, task.kelas, task.jumlah)
      .then(soal => {
        // Simpan ke cache
        const key = `${task.mapel}_${task.jenjang}_${task.kelas}`;
        soalCache[key] = { soal, expiry: Date.now() + CACHE_TTL };
        task.resolve(soal);
      })
      .catch(task.reject)
      .finally(() => { groqConcurrent--; processGroqQueue(); });
  }
}

// ── Generate soal: cache-first → antrian Groq → fallback bank soal ──
async function generateSoalServer(mapel, jenjang, kelas, jumlah = 10) {
  const key = `${mapel}_${jenjang}_${kelas}`;

  // 1. Cache hit → acak ulang dan kembalikan
  if (soalCache[key] && soalCache[key].expiry > Date.now()) {
    const cached = [...soalCache[key].soal].sort(() => Math.random() - 0.5);
    console.log(`[soal] cache hit: ${key}`);
    return cached.slice(0, jumlah);
  }

  // 2. Coba via Groq (dengan antrian & retry)
  try {
    const soal = await new Promise((resolve, reject) => {
      groqQueue.push({ mapel, jenjang, kelas, jumlah, resolve, reject });
      processGroqQueue();
    });
    return soal;
  } catch (groqErr) {
    console.warn(`[soal] Groq gagal (${groqErr.message}), fallback ke bank soal`);
  }

  // 3. Fallback: ambil dari bank soal Supabase
  const { data } = await supabase
    .from('soal')
    .select('id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin')
    .eq('jenis', 'pilihan_ganda')
    .eq('mapel', mapel)
    .limit(jumlah * 3);

  let bankSoal = (data || []).filter(s => {
    const opsi = typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || []);
    return opsi.length >= 2;
  });

  // Kalau tidak ada soal mapel ini, ambil soal apapun
  if (!bankSoal.length) {
    const { data: any } = await supabase
      .from('soal')
      .select('id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin')
      .eq('jenis', 'pilihan_ganda')
      .limit(jumlah * 2);
    bankSoal = (any || []).filter(s => {
      const opsi = typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || []);
      return opsi.length >= 2;
    });
  }

  if (!bankSoal.length) throw new Error('Tidak ada soal tersedia');

  const { decrypt } = require('../utils/crypto');
  return bankSoal
    .sort(() => Math.random() - 0.5)
    .slice(0, jumlah)
    .map((s, i) => ({
      id: s.id || `bk-${i}`,
      pertanyaan: s.pertanyaan,
      emoji: s.emoji || '❓',
      mapel: s.mapel,
      jenis: 'pilihan_ganda',
      opsi: typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || []),
      jawaban: (() => { try { return decrypt(s.jawaban); } catch(e) { return s.jawaban; } })(),
      poin: s.poin || 100
    }));
}

// ── Panggil Groq API dengan retry + backoff ──────────────────
async function _callGroq(mapel, jenjang, kelas, jumlah, retries = 3) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GROQ_MODEL   = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY tidak diset');

  const seed = Math.random().toString(36).substring(2, 8);
  const systemPrompt = 'Kamu adalah generator soal kuis pendidikan Indonesia. Jawab HANYA dengan JSON array yang valid, tanpa teks atau markdown apapun.';
  const userPrompt =
    `Buat ${jumlah} soal pilihan ganda untuk "${mapel}", jenjang ${jenjang} kelas ${kelas} (kurikulum Merdeka). ` +
    `Seed: ${seed}. Variasikan jenis dan tingkat kesulitan.\n` +
    `Format (HANYA JSON array, tidak ada teks lain):\n` +
    `[{"pertanyaan":"...?","opsi":["A. ...","B. ...","C. ...","D. ..."],"jawaban":"A. ...","emoji":"🔢"}]\n` +
    `Pastikan "jawaban" sama persis dengan salah satu elemen "opsi".`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: GROQ_MODEL, max_tokens: 3000, temperature: 0.85,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
        }),
        signal: AbortSignal.timeout(25000) // timeout 25 detik
      });

      if (res.status === 503 || res.status === 429) {
        const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.warn(`[Groq] ${res.status} — retry ${attempt}/${retries} dalam ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Groq ${res.status}`);

      const raw = (data.choices?.[0]?.message?.content || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('JSON tidak valid dari AI');

      const parsed = JSON.parse(jsonMatch[0]);
      const soal = parsed
        .filter(s => s.pertanyaan && Array.isArray(s.opsi) && s.opsi.length >= 2 && s.jawaban)
        .map((s, i) => ({
          id: `srv-${seed}-${i}`,
          pertanyaan: String(s.pertanyaan).trim(),
          emoji: String(s.emoji || '❓').trim(),
          mapel, jenis: 'pilihan_ganda',
          opsi:    s.opsi.map(o => String(o).trim()),
          jawaban: String(s.jawaban).trim(),
          poin:    100
        }));

      if (!soal.length) throw new Error('Soal tidak valid dari AI');
      console.log(`[Groq] OK: ${soal.length} soal untuk ${mapel} (attempt ${attempt})`);
      return soal;

    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(`[Groq] Error attempt ${attempt}: ${err.message} — retry dalam ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Groq gagal setelah semua retry');
}

module.exports = function(io) {

  // rooms[kode] = { kode, quiz, soal[], pemain{}, status, soalIdx, timer, scores{} }
  const rooms = {};

  // matchmakingQueue[kategori] = [{ userId, socketId, user, mapel, jenjang, kelas, durasi }, ...]
  const matchmakingQueue = {};

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
        jawaban: {},       // soalIdx -> { userId -> { benar, poin, waktu } }
        soalStartTime: {}, // soalIdx -> timestamp server (anti-cheat)
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

      // Gunakan userId dari JWT jika tersedia (lebih aman)
      const userId   = socket.user?.id   || user?.id;
      const userNama = socket.user?.nama || user?.nama || 'Anonim';
      const userAvatar = user?.avatar || '🦁';

      if (!userId) {
        socket.emit('zep:error', { pesan: 'Kamu harus login untuk bergabung.' });
        return;
      }

      // Validasi: murid harus terdaftar di kelas yang sama dengan kuis ini
      if (room.quiz?.kelas_id) {
        const { data: member } = await supabase
          .from('kelas_murid')
          .select('kelas_id')
          .eq('kelas_id', room.quiz.kelas_id)
          .eq('murid_id', userId)
          .single();
        if (!member) {
          socket.emit('zep:error', { pesan: 'Kamu tidak terdaftar di kelas ini.' });
          return;
        }
      }

      room.pemain[userId] = { id: userId, nama: userNama, avatar: userAvatar, socketId: socket.id };
      room.scores[userId] = 0;
      socket.join(kode_room);
      socket.data.kode = kode_room;
      socket.data.userId = userId;

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
    socket.on('zep:jawab', ({ kode_room, soalIdx, jawaban }) => {
      const room = rooms[kode_room];
      if (!room || room.status !== 'playing') return;
      if (room.soalIdx !== soalIdx) return;

      const userId = socket.data.userId;
      if (!userId) return;

      // Pastikan belum jawab soal ini
      if (!room.jawaban[soalIdx]) room.jawaban[soalIdx] = {};
      if (room.jawaban[soalIdx][userId]) return; // sudah jawab

      // Validasi jawaban — harus string, max 500 karakter
      if (typeof jawaban !== 'string' || jawaban.trim().length === 0 || jawaban.length > 500) return;

      const soal = room.soal[soalIdx];
      const benar = jawaban.trim().toLowerCase() === String(soal.jawaban).trim().toLowerCase();
      const durasi = room.quiz.durasi_per_soal || 25;

      // Hitung waktu sisa berdasarkan server timer (anti-cheat: abaikan waktu dari client)
      const elapsed = (Date.now() - (room.soalStartTime[soalIdx] || Date.now())) / 1000;
      const waktuSisaServer = Math.max(0, durasi - elapsed);

      // Bonus poin berdasarkan kecepatan (server-side)
      const poinDapat = benar ? Math.round((soal.poin || 100) * (0.5 + 0.5 * (waktuSisaServer / durasi))) : 0;

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
      // Hapus dari matchmaking queue
      const mmKat = socket.data.mmKategori;
      if (mmKat && matchmakingQueue[mmKat]) {
        matchmakingQueue[mmKat] = matchmakingQueue[mmKat].filter(e => e.socketId !== socket.id);
      }

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

    // ── VS ONLINE: Murid buat public room ────────────────────
    socket.on('zep:create_public_room', ({ kode_room, quiz, soal, creator }) => {
      if (rooms[kode_room]) { socket.emit('zep:error', { pesan: 'Kode room sudah ada.' }); return; }
      rooms[kode_room] = {
        kode: kode_room, quiz, soal,
        guru: null, creator,
        pemain: {}, scores: {}, jawaban: {}, soalStartTime: {},
        status: 'lobby', soalIdx: -1, timer: null,
        is_public: true, auto_start_timer: null
      };
      const userId = creator.id;
      rooms[kode_room].pemain[userId] = { id: userId, nama: creator.nama, avatar: creator.avatar || '🦁', socketId: socket.id };
      rooms[kode_room].scores[userId] = 0;
      socket.join(kode_room);
      socket.data.kode = kode_room;
      socket.data.userId = userId;
      socket.emit('zep:public_room_created', getRoomState(kode_room));
    });

    // ── VS ONLINE: List public rooms yang sedang lobby ────────
    socket.on('zep:get_public_rooms', () => {
      const list = Object.values(rooms)
        .filter(r => r.is_public && r.status === 'lobby' && Object.keys(r.pemain).length < 2)
        .map(r => ({
          kode: r.kode,
          judul: r.quiz.judul,
          mapel: r.quiz.mapel,
          total_soal: r.soal.length,
          pemain_count: Object.keys(r.pemain).length
        }));
      socket.emit('zep:public_rooms_list', { rooms: list });
    });

    // ── VS ONLINE: Join public room (murid) ───────────────────
    socket.on('zep:join_public_room', ({ kode_room, user }) => {
      const room = rooms[kode_room];
      if (!room || !room.is_public) { socket.emit('zep:error', { pesan: 'Room tidak ditemukan.' }); return; }
      if (room.status !== 'lobby') { socket.emit('zep:error', { pesan: 'Game sudah dimulai.' }); return; }

      const userId = user?.id;
      if (!userId) { socket.emit('zep:error', { pesan: 'Login dulu ya!' }); return; }

      // Batasi maksimal 2 pemain per battle
      const sudahAda = Object.keys(room.pemain).length;
      if (sudahAda >= 2) { socket.emit('zep:error', { pesan: 'Room sudah penuh (maks. 2 pemain).' }); return; }

      room.pemain[userId] = { id: userId, nama: user.nama, avatar: user.avatar || '🦁', socketId: socket.id };
      room.scores[userId] = 0;
      socket.join(kode_room);
      socket.data.kode = kode_room;
      socket.data.userId = userId;

      socket.emit('zep:joined', getRoomState(kode_room));
      broadcast(kode_room, 'zep:pemain_masuk', {
        pemain: Object.values(room.pemain).map(p => ({ id: p.id, nama: p.nama, avatar: p.avatar, skor: 0 }))
      });

      // Auto-start tepat saat pemain ke-2 masuk (room 1v1, langsung mulai dalam 3 detik)
      const jumlahPemain = Object.keys(room.pemain).length;
      if (jumlahPemain === 2 && !room.auto_start_timer) {
        let countdown = 3;
        broadcast(kode_room, 'zep:auto_start_countdown', { detik: countdown });
        room.auto_start_timer = setInterval(() => {
          countdown--;
          broadcast(kode_room, 'zep:auto_start_countdown', { detik: countdown });
          if (countdown <= 0) {
            clearInterval(room.auto_start_timer);
            room.auto_start_timer = null;
            room.status = 'playing';
            broadcast(kode_room, 'zep:game_start', { totalSoal: room.soal.length });
            setTimeout(() => kirimSoal(kode_room, 0), 1500);
          }
        }, 1000);
      }
    });

    // ── MATCHMAKING: Masuk antrian ────────────────────────────
    // Soal TIDAK dikirim dari client — server yang generate setelah match
    socket.on('zep:matchmaking_join', ({ kategori, user, mapel, jenjang, kelas, durasi }) => {
      if (!kategori || !user?.id) return;

      if (!matchmakingQueue[kategori]) matchmakingQueue[kategori] = [];

      // Hapus entry lama dari user yang sama (reconnect)
      matchmakingQueue[kategori] = matchmakingQueue[kategori].filter(e => e.userId !== user.id);

      matchmakingQueue[kategori].push({
        userId: user.id, socketId: socket.id, user,
        mapel: mapel || 'Matematika',
        jenjang: jenjang || 'SMP',
        kelas: kelas || 7,
        durasi: durasi || 25
      });

      socket.data.mmKategori = kategori;
      socket.data.userId = user.id;

      // Kalau ada 2+ di antrian → cocokkan 2 pemain pertama
      if (matchmakingQueue[kategori].length >= 2) {
        const [p1, p2] = matchmakingQueue[kategori].splice(0, 2);

        const finalMapel  = p1.mapel || p2.mapel;
        const finalJenjang = p1.jenjang || p2.jenjang;
        const finalKelas  = p1.kelas || p2.kelas;
        const finalDurasi = p1.durasi || p2.durasi || 25;
        const finalJudul  = `${finalMapel} · ${finalJenjang}`;

        // Buat room dengan status 'generating' — soal belum ada
        const kode_room = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[kode_room] = {
          kode: kode_room,
          quiz: { judul: finalJudul, mapel: finalMapel, durasi_per_soal: finalDurasi, kelas_id: null },
          soal: [],
          guru: null, creator: p1.user,
          pemain: {}, scores: {}, jawaban: {}, soalStartTime: {},
          status: 'generating', soalIdx: -1, timer: null,
          is_public: true, auto_start_timer: null
        };

        // Masukkan kedua pemain ke room
        [p1, p2].forEach(p => {
          rooms[kode_room].pemain[p.userId] = { id: p.userId, nama: p.user.nama, avatar: p.user.avatar || '🦁', socketId: p.socketId };
          rooms[kode_room].scores[p.userId] = 0;
          const s = io.sockets.sockets.get(p.socketId);
          if (s) {
            s.join(kode_room);
            s.data.kode = kode_room;
            s.data.userId = p.userId;
            const lawan = p.userId === p1.userId ? p2.user : p1.user;
            // Beritahu sudah match, server sedang generate soal
            s.emit('zep:matched', { kode_room, lawan, judul: finalJudul, generating: true });
          }
        });

        // Generate soal di server — tidak ada konflik antar player
        generateSoalServer(finalMapel, finalJenjang, finalKelas, 10)
          .then(soal => {
            if (!rooms[kode_room]) return; // room sudah tutup
            rooms[kode_room].soal   = soal;
            rooms[kode_room].status = 'lobby';
            // Mulai game setelah 2 detik
            setTimeout(() => {
              if (!rooms[kode_room]) return;
              rooms[kode_room].status = 'playing';
              broadcast(kode_room, 'zep:game_start', { totalSoal: soal.length });
              setTimeout(() => kirimSoal(kode_room, 0), 1500);
            }, 2000);
          })
          .catch(() => {
            // Gagal generate — tutup room dan beritahu kedua player
            broadcast(kode_room, 'zep:error', { pesan: 'Gagal membuat soal. Silakan coba lagi.' });
            delete rooms[kode_room];
          });

      } else {
        // Masih sendirian di antrian
        socket.emit('zep:matchmaking_waiting', { posisi: matchmakingQueue[kategori].length });
      }
    });

    // ── REJOIN: Pemain reconnect saat game sedang berjalan ───
    socket.on('zep:rejoin', ({ kode_room, user_id }) => {
      const room = rooms[kode_room];
      if (!room) { socket.emit('zep:error', { pesan: 'Room sudah tidak ada.' }); return; }

      // Update socket ID pemain yang reconnect
      if (room.pemain[user_id]) {
        room.pemain[user_id].socketId = socket.id;
        socket.join(kode_room);
        socket.data.kode    = kode_room;
        socket.data.userId  = user_id;

        // Kirim state game saat ini agar pemain bisa lanjut
        const state = getRoomState(kode_room);
        socket.emit('zep:rejoined', {
          ...state,
          soalIdx:  room.soalIdx,
          status:   room.status,
          mySkor:   room.scores[user_id] || 0
        });

        // Kalau game sedang jalan, kirim soal sekarang
        if (room.status === 'playing' && room.soalIdx >= 0) {
          const soal = room.soal[room.soalIdx];
          const durasi = room.quiz.durasi_per_soal || 25;
          const elapsed = (Date.now() - (room.soalStartTime[room.soalIdx] || Date.now())) / 1000;
          const sisaWaktu = Math.max(1, Math.round(durasi - elapsed));
          socket.emit('zep:soal', {
            idx: room.soalIdx,
            totalSoal: room.soal.length,
            soal: { id: soal.id, pertanyaan: soal.pertanyaan, emoji: soal.emoji, opsi: soal.opsi, poin: soal.poin },
            durasi: sisaWaktu  // waktu tersisa, bukan durasi penuh
          });
        }
      }
    });

    // ── MATCHMAKING: Batal ────────────────────────────────────
    socket.on('zep:matchmaking_cancel', ({ user_id }) => {
      const kategori = socket.data.mmKategori;
      if (kategori && matchmakingQueue[kategori]) {
        matchmakingQueue[kategori] = matchmakingQueue[kategori].filter(e => e.userId !== user_id);
      }
      socket.data.mmKategori = null;
    });

    // ── VS ONLINE: Creator bisa mulai lebih awal ──────────────
    socket.on('zep:online_start_now', ({ kode_room }) => {
      const room = rooms[kode_room];
      if (!room || !room.is_public || room.status !== 'lobby') return;
      if (room.creator?.id !== socket.data.userId) return;
      if (room.auto_start_timer) { clearInterval(room.auto_start_timer); room.auto_start_timer = null; }
      room.status = 'playing';
      broadcast(kode_room, 'zep:game_start', { totalSoal: room.soal.length });
      setTimeout(() => kirimSoal(kode_room, 0), 1500);
    });

  }); // end io.on connection

  // ── Helpers ──────────────────────────────────────────────────

  function kirimSoal(kode, idx) {
    const room = rooms[kode];
    if (!room) return;
    room.soalIdx = idx;
    if (!room.jawaban[idx]) room.jawaban[idx] = {};
    room.soalStartTime[idx] = Date.now(); // catat waktu server saat soal dikirim

    const soal = room.soal[idx];
    const durasi = room.quiz.durasi_per_soal || 25;

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
    Object.values(jawaban).forEach(_j => { /* statistik per opsi — reserved */ });

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
