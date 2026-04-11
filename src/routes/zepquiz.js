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
const { decrypt } = require('../utils/crypto');

// Helper: decrypt jawaban di array soal
function decryptSoal(soalArr) {
  return soalArr.map(s => ({
    ...s,
    jawaban: (() => { try { return decrypt(s.jawaban); } catch(e) { return s.jawaban; } })(),
    opsi: typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || [])
  }));
}

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

    const soal = decryptSoal((qs || []).map(r => r.soal).filter(Boolean));
    if (!soal.length) return res.status(400).json({ success: false, pesan: 'Quiz tidak punya soal.' });

    // Generate kode room 6 huruf
    const kode_room = Math.random().toString(36).substring(2, 8).toUpperCase();

    res.json({
      success: true,
      room: {
        kode_room, quiz_id,
        judul: quiz.judul, mapel: quiz.mapel,
        kelas_id: quiz.kelas_id || null,
        durasi_per_soal: quiz.durasi || 15,
        total_soal: soal.length,
        soal
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

    const soal = decryptSoal((qs || []).map(r => r.soal).filter(Boolean));

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

    const soal = decryptSoal((qs || []).map(r => r.soal).filter(Boolean));
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
        soal
      }
    });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// ============================================================
//  GET /api/zepquiz/bank-mapel — Daftar mapel tersedia di bank soal
// ============================================================
router.get('/bank-mapel', authMiddleware, async (_req, res) => {
  try {
    const { data } = await supabase
      .from('soal')
      .select('mapel')
      .eq('jenis', 'pilihan_ganda');
    const counts = {};
    (data || []).forEach(s => { counts[s.mapel] = (counts[s.mapel] || 0) + 1; });
    const result = Object.entries(counts)
      .map(([mapel, total]) => ({ mapel, total }))
      .sort((a, b) => b.total - a.total);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// ============================================================
//  GET /api/zepquiz/bank-soal?mapel=&jumlah= — Ambil soal dari bank untuk game
// ============================================================
router.get('/bank-soal', authMiddleware, async (req, res) => {
  try {
    const { mapel, jumlah = 10 } = req.query;
    if (!mapel) return res.status(400).json({ success: false, pesan: 'mapel wajib diisi.' });

    const { data, error } = await supabase
      .from('soal')
      .select('id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin')
      .eq('jenis', 'pilihan_ganda')
      .eq('mapel', mapel)
      .limit(parseInt(jumlah) * 3); // ambil lebih, lalu acak

    if (error) throw error;

    // Acak dan ambil sejumlah yang diminta
    const all = (data || []).filter(s => {
      const opsi = typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || []);
      return opsi.length >= 2;
    });

    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, parseInt(jumlah));
    if (!shuffled.length) return res.status(404).json({ success: false, pesan: `Belum ada soal untuk mapel "${mapel}".` });

    const soal = decryptSoal(shuffled);
    res.json({ success: true, soal, mapel, total: soal.length });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// ============================================================
//  GET /api/zepquiz/ai-generate?mapel=&jenjang=&kelas=&jumlah=
//  Generate soal pilihan ganda via Groq AI — fresh setiap request
// ============================================================
router.get('/ai-generate', authMiddleware, async (req, res) => {
  try {
    const { mapel, jenjang = 'SMP', kelas = 7, jumlah = 10 } = req.query;
    if (!mapel) return res.status(400).json({ success: false, pesan: 'mapel wajib diisi.' });
    if (!process.env.GROQ_API_KEY)
      return res.status(500).json({ success: false, pesan: 'Layanan AI belum dikonfigurasi.' });

    const n    = Math.min(parseInt(jumlah) || 10, 15);
    const seed = Math.random().toString(36).substring(2, 8); // buat variasi setiap request

    const systemPrompt =
      'Kamu adalah generator soal kuis pendidikan Indonesia. ' +
      'Jawab HANYA dengan JSON array yang valid, tanpa teks, komentar, atau markdown apapun di luar array. ' +
      'Pastikan setiap soal BERBEDA dan UNIK, jangan gunakan soal klise yang sering muncul.';

    const userPrompt =
      `Buat ${n} soal pilihan ganda untuk mata pelajaran "${mapel}", jenjang ${jenjang} kelas ${kelas} (kurikulum Merdeka Indonesia). ` +
      `Seed variasi: ${seed}. ` +
      `Variasikan jenis soal: definisi, analisis, hitungan, penerapan, perbandingan, sebab-akibat. ` +
      `Variasikan tingkat kesulitan (mudah, sedang, sulit). ` +
      `\n\nFormat output (HANYA JSON array, tidak ada teks lain):\n` +
      `[\n` +
      `  {\n` +
      `    "pertanyaan": "teks soal lengkap?",\n` +
      `    "opsi": ["A. teks", "B. teks", "C. teks", "D. teks"],\n` +
      `    "jawaban": "A. teks",\n` +
      `    "emoji": "emoji relevan dengan topik"\n` +
      `  }\n` +
      `]\n\n` +
      `Pastikan "jawaban" sama persis dengan salah satu elemen di "opsi".`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        max_tokens: 3000,
        temperature: 0.9,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   }
        ]
      })
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      if (groqRes.status === 429) {
        console.warn('[AI generate soal] Rate limit Groq tercapai — fallback ke bank soal disarankan.');
        return res.json({ success: false, fallback: true });
      }
      console.error('[AI generate soal] Groq error:', JSON.stringify(groqData.error));
      throw new Error(groqData.error?.message || 'Groq API error');
    }

    const raw = groqData.choices?.[0]?.message?.content || '';

    // Ekstrak JSON array dari respons (model kadang masih menambah teks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI tidak menghasilkan JSON yang valid.');

    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch (e) { throw new Error('Format JSON dari AI tidak bisa diparsing.'); }

    const soal = parsed
      .filter(s => s.pertanyaan && Array.isArray(s.opsi) && s.opsi.length >= 2 && s.jawaban)
      .map((s, i) => ({
        id:          `ai-${seed}-${i}`,
        pertanyaan:  String(s.pertanyaan).trim(),
        emoji:       String(s.emoji || '❓').trim(),
        mapel,
        jenis:       'pilihan_ganda',
        opsi:        s.opsi.map(o => String(o).trim()),
        jawaban:     String(s.jawaban).trim(),
        poin:        100
      }));

    if (!soal.length)
      return res.status(500).json({ success: false, pesan: 'AI tidak menghasilkan soal yang valid. Coba lagi.' });

    res.json({ success: true, soal, mapel, jenjang, kelas, total: soal.length, generated: true });
  } catch (err) {
    console.error('[AI generate soal]', err.message);
    res.json({ success: false, fallback: true });
  }
});

module.exports = router;
