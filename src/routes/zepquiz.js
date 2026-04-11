// =====================================================
//  src/routes/zepquiz.js
//  Zep Quiz — Live Multiplayer Quiz Game
//  Tambahkan di server.js:
//    require('./socket/zepquiz')(io);
//    app.use('/api/zepquiz', require('./routes/zepquiz'));
// =====================================================

const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');
const { authMiddleware, guruOnly } = require('../middleware/auth');

// ============================================================
//  POST /api/zepquiz/room — Guru buat room baru
// ============================================================
router.post('/room', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { quiz_id } = req.body;
    if (!quiz_id) return res.status(400).json({ success: false, pesan: 'quiz_id wajib diisi.' });

    // Ambil soal quiz
    const { data: quiz, error: qErr } = await supabase
      .from('quiz').select('*, guru:guru_id(nama)').eq('id', quiz_id).single();
    if (qErr || !quiz) return res.status(404).json({ success: false, pesan: 'Quiz tidak ditemukan.' });

    const { data: qs } = await supabase
      .from('quiz_soal')
      .select('urutan, soal:soal_id(id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin)')
      .eq('quiz_id', quiz_id)
      .order('urutan');

    const soal = (qs || []).map(r => r.soal).filter(Boolean);
    if (!soal.length) return res.status(400).json({ success: false, pesan: 'Quiz tidak punya soal.' });

    // Generate kode room 6 huruf
    const kode_room = Math.random().toString(36).substring(2, 8).toUpperCase();

    res.json({
      success: true,
      room: {
        kode_room,
        quiz_id,
        judul: quiz.judul,
        mapel: quiz.mapel,
        kelas_id: quiz.kelas_id || null,
        durasi_per_soal: quiz.durasi || 15,
        total_soal: soal.length,
        soal: soal.map(s => ({
          ...s,
          opsi: typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || [])
        }))
      }
    });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// ============================================================
//  GET /api/zepquiz/quiz — List quiz milik guru untuk dipilih
// ============================================================
router.get('/quiz', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quiz')
      .select('id, judul, mapel, durasi, quiz_soal(count)')
      .eq('guru_id', req.user.id)
      .eq('status', 'aktif')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (data || []).map(q => ({
      ...q,
      total_soal: q.quiz_soal?.[0]?.count || 0
    })).filter(q => q.total_soal > 0);

    res.json({ success: true, quiz: result });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// ============================================================
//  GET /api/zepquiz/murid-quiz — Quiz dari kelas yang diikuti murid (untuk VS AI / VS Online)
// ============================================================
router.get('/murid-quiz', authMiddleware, async (req, res) => {
  try {
    // Ambil kelas yang diikuti murid
    const { data: kelasMurid } = await supabase
      .from('kelas_murid').select('kelas_id').eq('murid_id', req.user.id);
    const kelasIds = (kelasMurid || []).map(k => k.kelas_id);

    if (!kelasIds.length) return res.json({ success: true, quiz: [] });

    const { data, error } = await supabase
      .from('quiz')
      .select('id, judul, mapel, durasi, kelas_id, quiz_soal(count)')
      .in('kelas_id', kelasIds)
      .eq('status', 'aktif')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (data || []).map(q => ({
      id: q.id, judul: q.judul, mapel: q.mapel,
      durasi: q.durasi || 15, kelas_id: q.kelas_id,
      total_soal: q.quiz_soal?.[0]?.count || 0
    })).filter(q => q.total_soal > 0);

    res.json({ success: true, quiz: result });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// ============================================================
//  GET /api/zepquiz/quiz-soal/:quiz_id — Ambil soal untuk VS AI
// ============================================================
router.get('/quiz-soal/:quiz_id', authMiddleware, async (req, res) => {
  try {
    const { data: qs } = await supabase
      .from('quiz_soal')
      .select('urutan, soal:soal_id(id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin)')
      .eq('quiz_id', req.params.quiz_id)
      .order('urutan');

    const soal = (qs || []).map(r => r.soal).filter(Boolean).map(s => ({
      ...s,
      opsi: typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || [])
    }));

    if (!soal.length) return res.status(404).json({ success: false, pesan: 'Soal tidak ditemukan.' });
    res.json({ success: true, soal });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// ============================================================
//  POST /api/zepquiz/room-public — Murid buat public room (VS Online)
// ============================================================
router.post('/room-public', authMiddleware, async (req, res) => {
  try {
    const { quiz_id } = req.body;
    if (!quiz_id) return res.status(400).json({ success: false, pesan: 'quiz_id wajib diisi.' });

    const { data: quiz } = await supabase.from('quiz').select('id, judul, mapel, durasi, kelas_id').eq('id', quiz_id).single();
    if (!quiz) return res.status(404).json({ success: false, pesan: 'Quiz tidak ditemukan.' });

    const { data: qs } = await supabase
      .from('quiz_soal')
      .select('urutan, soal:soal_id(id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin)')
      .eq('quiz_id', quiz_id).order('urutan');

    const soal = (qs || []).map(r => r.soal).filter(Boolean);
    if (!soal.length) return res.status(400).json({ success: false, pesan: 'Quiz tidak punya soal.' });

    const kode_room = Math.random().toString(36).substring(2, 8).toUpperCase();
    res.json({
      success: true,
      room: {
        kode_room, quiz_id,
        judul: quiz.judul, mapel: quiz.mapel,
        kelas_id: quiz.kelas_id || null,
        durasi_per_soal: quiz.durasi || 15,
        total_soal: soal.length,
        is_public: true,
        soal: soal.map(s => ({ ...s, opsi: typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || []) }))
      }
    });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

module.exports = router;
