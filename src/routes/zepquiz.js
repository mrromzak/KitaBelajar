// =====================================================
//  src/routes/zepquiz.js
//  Zep Quiz — Live Multiplayer Quiz Game
//  Tambahkan di server.js:
//    require('./socket/zepquiz')(io);
//    app.use('/api/zepquiz', require('./routes/zepquiz'));
// =====================================================

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
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

module.exports = router;
