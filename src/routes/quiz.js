// =====================================================
//  src/routes/quiz.js
//  Tambahkan ke server.js:
//    const quizRoutes = require('./routes/quiz');
//    app.use('/api/quiz', quizRoutes);
//    app.use('/api/hasil-quiz', quizRoutes);  // untuk POST hasil
// =====================================================

const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { decrypt } = require('../utils/crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// ── Middleware auth (ambil dari server.js milikmu jika berbeda) ──
const jwt = require('jsonwebtoken');
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, pesan: 'Token tidak ada' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ success: false, pesan: 'Token tidak valid' });
  }
}

// ============================================================
//  GET /api/quiz?kelas_id=xxx  — daftar kuis per kelas
// ============================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { kelas_id } = req.query;
    let query = supabase
      .from('quiz')
      .select(`
        id, judul, deskripsi, mapel, durasi, tipe, deadline, status, created_at, kelas_id,
        quiz_soal(count)
      `)
      .eq('status', 'aktif')
      .order('created_at', { ascending: false });

    if (kelas_id) query = query.eq('kelas_id', kelas_id);

    const { data, error } = await query;
    if (error) throw error;

    // Tambahkan total_soal
    const result = (data || []).map(q => ({
      ...q,
      total_soal: q.quiz_soal?.[0]?.count || 0
    }));

    return res.json({ success: true, quiz: result });
  } catch(e) {
    console.error('[GET /quiz]', e.message);
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  GET /api/quiz/:id  — detail kuis + soal-soalnya
//  Guru: soal + jawaban (terdekripsi)
//  Murid: soal tanpa jawaban (validasi dilakukan server-side saat submit)
// ============================================================
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const isGuru = req.user.role === 'guru';

    const { data: quiz, error: qErr } = await supabase
      .from('quiz').select('*').eq('id', id).single();
    if (qErr) throw qErr;

    const { data: qs, error: sErr } = await supabase
      .from('quiz_soal')
      .select('urutan, soal(id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin)')
      .eq('quiz_id', id)
      .order('urutan');
    if (sErr) throw sErr;

    const soal = (qs || []).map(r => {
      const s = { ...r.soal };
      if (isGuru) {
        s.jawaban = decrypt(s.jawaban); // guru boleh lihat jawaban (terdekripsi)
      } else {
        delete s.jawaban; // murid tidak menerima jawaban — validasi di server
      }
      return s;
    });

    return res.json({ success: true, quiz: { ...quiz, soal } });
  } catch(e) {
    console.error('[GET /quiz/:id]', e.message);
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  POST /api/quiz  — buat kuis baru
// ============================================================
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { judul, deskripsi, mapel, kelas_id, durasi, tipe, deadline, status, soal_ids } = req.body;
    if (!judul) return res.status(400).json({ success: false, pesan: 'Judul wajib diisi' });

    const guru_id = req.user.id || req.user.userId;

    // Insert quiz
    const { data: quiz, error } = await supabase
      .from('quiz')
      .insert({
        judul,
        deskripsi: deskripsi || null,
        mapel: mapel || 'Umum',
        guru_id,
        kelas_id: kelas_id || null,
        durasi: durasi || 15,
        tipe: tipe || 'fun',
        deadline: deadline || null,
        status: status || 'aktif'
      })
      .select()
      .single();

    if (error) throw error;

    // Jika ada soal_ids, langsung insert quiz_soal sekalian
    if (soal_ids && soal_ids.length > 0) {
      const rows = soal_ids.map((sid, idx) => ({
        quiz_id: quiz.id,
        soal_id: sid,
        urutan: idx + 1
      }));
      const { error: qsErr } = await supabase.from('quiz_soal').insert(rows);
      if (qsErr) console.warn('[quiz_soal insert]', qsErr.message);
    }

    // Notifikasi ke murid di kelas jika kuis punya kelas_id
    if (kelas_id) {
      const { v4: uuidv4 } = require('uuid');
      const { data: muridList } = await supabase
        .from('kelas_murid').select('murid_id').eq('kelas_id', kelas_id);
      if (muridList?.length) {
        const notifs = muridList.map(m => ({
          id: uuidv4(), user_id: m.murid_id,
          judul: '📝 Kuis Baru!',
          pesan: `Guru membuat kuis baru: "${judul}" (${mapel || 'Umum'})`
        }));
        await supabase.from('notifikasi').insert(notifs);
        const io = req.app.get('io');
        if (io) {
          muridList.forEach(m => {
            io.to('user:' + m.murid_id).emit('notif:baru', {
              tipe: 'quiz',
              judul: '📝 Kuis Baru!',
              pesan: `Guru membuat kuis baru: "${judul}" (${mapel || 'Umum'})`,
              created_at: new Date().toISOString()
            });
          });
        }
      }
    }

    return res.status(201).json({ success: true, quiz, pesan: 'Kuis berhasil dibuat' });
  } catch(e) {
    console.error('[POST /quiz]', e.message);
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  POST /api/quiz/:id/soal  — tambah soal ke kuis
// ============================================================
router.post('/:id/soal', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { soal_id, urutan } = req.body;
    if (!soal_id) return res.status(400).json({ success: false, pesan: 'soal_id wajib' });

    const { error } = await supabase.from('quiz_soal').upsert(
      { quiz_id: id, soal_id, urutan: urutan || 1 },
      { onConflict: 'quiz_id,soal_id' }
    );
    if (error) throw error;

    return res.json({ success: true, pesan: 'Soal ditambahkan' });
  } catch(e) {
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  DELETE /api/quiz/:id  — hapus kuis
// ============================================================
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const guru_id = req.user.id || req.user.userId;

    // Pastikan kuis milik guru ini
    const { data: quiz } = await supabase
      .from('quiz').select('id, guru_id').eq('id', id).single();

    if (!quiz) return res.status(404).json({ success: false, pesan: 'Kuis tidak ditemukan' });
    if (quiz.guru_id !== guru_id) return res.status(403).json({ success: false, pesan: 'Bukan hak kamu' });

    // Hapus quiz_soal dulu (cascade harusnya otomatis, tapi untuk keamanan)
    await supabase.from('quiz_soal').delete().eq('quiz_id', id);
    const { error } = await supabase.from('quiz').delete().eq('id', id);
    if (error) throw error;

    return res.json({ success: true, pesan: 'Kuis berhasil dihapus' });
  } catch(e) {
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  POST /api/quiz/hasil  — simpan + validasi hasil pengerjaan murid
//  Body: { quiz_id, jawaban: [{soal_id, jawaban_user}], durasi_detik }
//  Scoring dilakukan server-side agar jawaban tidak perlu dikirim ke client
// ============================================================
router.post('/hasil', authMiddleware, async (req, res) => {
  try {
    const { quiz_id, jawaban: jawabanMurid, durasi_detik } = req.body;
    const murid_id = req.user.id || req.user.userId;
    if (!quiz_id) return res.status(400).json({ success: false, pesan: 'quiz_id wajib' });

    // Cek apakah sudah pernah mengerjakan
    const { data: existing } = await supabase
      .from('hasil_quiz').select('id, skor, benar, total_soal')
      .eq('murid_id', murid_id).eq('quiz_id', quiz_id).maybeSingle();

    if (existing) {
      return res.json({
        success: true, pesan: 'Sudah pernah mengerjakan',
        skor: existing.skor, benar: existing.benar,
        total_soal: existing.total_soal, totalPoin: existing.skor || 0,
        detail: []
      });
    }

    // Ambil soal quiz dengan jawaban terenkripsi untuk validasi
    const { data: qs, error: sErr } = await supabase
      .from('quiz_soal')
      .select('soal(id, jawaban, poin, jenis)')
      .eq('quiz_id', quiz_id)
      .order('urutan');
    if (sErr) throw sErr;

    const soalList = (qs || []).map(r => r.soal).filter(Boolean);
    const total_soal = soalList.length;
    let benar = 0, totalPoin = 0;
    const detail = [];

    soalList.forEach(q => {
      const jawabanBenar = decrypt(q.jawaban); // dekripsi jawaban dari DB
      const entry = (jawabanMurid || []).find(j => j.soal_id === q.id);
      const jawabanUser = entry?.jawaban_user || null;
      const isBenar = jawabanUser !== null &&
        jawabanUser.trim().toLowerCase() === jawabanBenar.trim().toLowerCase();
      const poinDapat = isBenar ? (q.poin || 100) : 0;
      if (isBenar) { benar++; totalPoin += poinDapat; }
      detail.push({ soal_id: q.id, benar: isBenar, poin_dapat: poinDapat });
    });

    const skor = total_soal > 0 ? Math.round((benar / total_soal) * 100) : 0;

    // Simpan hasil
    const { v4: uuidv4 } = require('uuid');
    const { data: hasil, error } = await supabase
      .from('hasil_quiz')
      .insert({
        id: uuidv4(), murid_id, quiz_id,
        skor, benar, total_soal,
        durasi_detik: durasi_detik || 0
      })
      .select().single();

    if (error) {
      console.error('[POST /quiz/hasil] insert error:', error.message);
      return res.status(500).json({ success: false, pesan: 'Gagal menyimpan hasil: ' + error.message });
    }

    // Update XP murid
    try {
      const xpGain = Math.round(skor / 10);
      if (xpGain > 0) {
        const { data: userData } = await supabase.from('users').select('xp, level').eq('id', murid_id).single();
        if (userData) {
          const newXp = (userData.xp || 0) + xpGain;
          const newLevel = Math.floor(newXp / 1000) + 1;
          await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('id', murid_id);
        }
      }
    } catch(xpErr) { console.warn('[XP update]', xpErr.message); }

    return res.status(201).json({ success: true, pesan: 'Hasil tersimpan!', hasil, skor, benar, total_soal, totalPoin, detail });
  } catch(e) {
    console.error('[POST /quiz/hasil]', e.message);
    return res.status(500).json({ success: false, pesan: 'Gagal menyimpan hasil.' });
  }
});

// ============================================================
//  GET /api/hasil-quiz/cek?quiz_id=xxx  — cek apakah murid sudah kerjakan
// ============================================================
router.get('/hasil/cek', authMiddleware, async (req, res) => {
  try {
    const { quiz_id } = req.query;
    const murid_id = req.user.id || req.user.userId;
    const { data, error } = await supabase
      .from('hasil_quiz')
      .select('id, skor, benar, total_soal')
      .eq('murid_id', murid_id)
      .eq('quiz_id', quiz_id)
      .maybeSingle();

    if (error) {
      console.error('[GET /quiz/hasil/cek]', error.message);
      return res.json({ success: true, sudah: false, hasil: null });
    }
    return res.json({ success: true, sudah: !!data, hasil: data || null });
  } catch(e) {
    console.error('[GET /quiz/hasil/cek catch]', e.message);
    return res.json({ success: true, sudah: false, hasil: null });
  }
});

module.exports = router;
