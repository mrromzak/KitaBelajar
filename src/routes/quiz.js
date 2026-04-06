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
// ============================================================
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Ambil info quiz
    const { data: quiz, error: qErr } = await supabase
      .from('quiz')
      .select('*')
      .eq('id', id)
      .single();
    if (qErr) throw qErr;

    // Ambil soal lewat quiz_soal
    const { data: qs, error: sErr } = await supabase
      .from('quiz_soal')
      .select(`urutan, soal(id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin)`)
      .eq('quiz_id', id)
      .order('urutan');
    if (sErr) throw sErr;

    const soal = (qs || []).map(r => r.soal);

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
//  POST /api/quiz/hasil  — simpan hasil pengerjaan murid
// ============================================================
router.post('/hasil', authMiddleware, async (req, res) => {
  try {
    const { quiz_id, skor, jawaban } = req.body;
    const murid_id = req.user.id || req.user.userId;
    if (!quiz_id) return res.status(400).json({ success: false, pesan: 'quiz_id wajib' });

    // Cek apakah sudah pernah mengerjakan
    const { data: existing } = await supabase
      .from('hasil_quiz')
      .select('id, skor')
      .eq('murid_id', murid_id)
      .eq('quiz_id', quiz_id)
      .maybeSingle();

    if (existing) {
      // Update jika skor lebih baik
      if ((skor || 0) > (existing.skor || 0)) {
        await supabase.from('hasil_quiz')
          .update({ skor: skor || 0, jawaban: JSON.stringify(jawaban || []), waktu_selesai: new Date().toISOString() })
          .eq('id', existing.id);
      }
      return res.json({ success: true, pesan: 'Hasil diperbarui', skor });
    }

    // Insert hasil baru — pakai kolom yang sudah terbukti ada di tabel
    const { v4: uuidv4 } = require('uuid');
    const { data: hasil, error } = await supabase
      .from('hasil_quiz')
      .insert({
        id: uuidv4(),
        murid_id,
        quiz_id,
        skor: skor || 0,
        jawaban: JSON.stringify(jawaban || []),
        waktu_selesai: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[POST /quiz/hasil] insert error:', error.message);
      return res.status(500).json({ success: false, pesan: 'Gagal menyimpan hasil: ' + error.message });
    }

    // Update XP murid (opsional — tidak gagalkan request jika error)
    try {
      const xpGain = Math.round((skor || 0) / 10);
      if (xpGain > 0) {
        const { data: userData } = await supabase.from('users').select('xp, level').eq('id', murid_id).single();
        if (userData) {
          const newXp = (userData.xp || 0) + xpGain;
          const newLevel = Math.floor(newXp / 1000) + 1;
          await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('id', murid_id);
        }
      }
    } catch(xpErr) { console.warn('[XP update]', xpErr.message); }

    return res.status(201).json({ success: true, pesan: 'Hasil tersimpan!', hasil });
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
      .select('id, skor, waktu_selesai')
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
