const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const { authMiddleware, guruOnly } = require('../middleware/auth');

// =====================================================
// POST /api/soal – Tambah soal baru
// =====================================================
router.post('/', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin, tingkat } = req.body;
    if (!pertanyaan || !mapel || !jenis || !jawaban)
      return res.status(400).json({ success: false, pesan: 'Pertanyaan, mapel, jenis, dan jawaban wajib diisi.' });

    const id = uuidv4();
    const { error } = await supabase.from('soal').insert({
      id, pertanyaan,
      emoji: emoji || '❓',
      mapel, jenis,
      opsi: opsi || null,
      jawaban,
      poin: poin || 100,
      tingkat: tingkat || 'mudah',
      guru_id: req.user.id
    });
    if (error) throw error;

    // Otomatis masukkan ke quiz "Kumpulan Soal" milik guru ini
    // Cari atau buat quiz default untuk guru ini
    let { data: quizDefault } = await supabase
      .from('quiz')
      .select('id')
      .eq('guru_id', req.user.id)
      .eq('judul', 'Kumpulan Soal')
      .single();

    if (!quizDefault) {
      const quizId = uuidv4();
      await supabase.from('quiz').insert({
        id: quizId,
        judul: 'Kumpulan Soal',
        deskripsi: 'Quiz berisi semua soal yang dibuat guru',
        mapel: 'Umum',
        guru_id: req.user.id,
        durasi: 15,
        status: 'aktif'
      });
      quizDefault = { id: quizId };
    }

    // Hitung urutan
    const { count } = await supabase
      .from('quiz_soal')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizDefault.id);

    await supabase.from('quiz_soal').insert({
      quiz_id: quizDefault.id,
      soal_id: id,
      urutan: (count || 0) + 1
    });

    res.status(201).json({ success: true, pesan: 'Soal berhasil ditambahkan!', data: { id } });
  } catch (err) {
    console.error('POST /soal error:', err.message);
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// GET /api/soal – List soal milik guru
// =====================================================
router.get('/', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { mapel, tingkat } = req.query;
    let query = supabase.from('soal').select('*').eq('guru_id', req.user.id);
    if (mapel) query = query.eq('mapel', mapel);
    if (tingkat) query = query.eq('tingkat', tingkat);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, soal: data || [], data: data || [] });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// PUT /api/soal/:id – Update soal
// =====================================================
router.put('/:id', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { pertanyaan, emoji, opsi, jawaban, poin, tingkat } = req.body;
    const updates = {};
    if (pertanyaan) updates.pertanyaan = pertanyaan;
    if (emoji) updates.emoji = emoji;
    if (opsi) updates.opsi = opsi;
    if (jawaban) updates.jawaban = jawaban;
    if (poin) updates.poin = poin;
    if (tingkat) updates.tingkat = tingkat;

    const { error } = await supabase.from('soal').update(updates)
      .eq('id', req.params.id).eq('guru_id', req.user.id);
    if (error) throw error;
    res.json({ success: true, pesan: 'Soal berhasil diperbarui.' });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// DELETE /api/soal/:id – Hapus soal
// =====================================================
router.delete('/:id', authMiddleware, guruOnly, async (req, res) => {
  try {
    await supabase.from('quiz_soal').delete().eq('soal_id', req.params.id);
    await supabase.from('soal').delete().eq('id', req.params.id).eq('guru_id', req.user.id);
    res.json({ success: true, pesan: 'Soal berhasil dihapus.' });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// GET /api/soal/quiz – Ambil soal untuk dimainkan murid
// =====================================================
router.get('/quiz', authMiddleware, async (req, res) => {
  try {
    let soalList = [];
    let quizId = null;

    if (req.user.role === 'murid') {
      // Ambil semua soal dari semua quiz aktif
      const { data: quizData } = await supabase
        .from('quiz')
        .select('id')
        .eq('status', 'aktif')
        .order('created_at', { ascending: false })
        .limit(1);

      if (quizData?.length) {
        quizId = quizData[0].id;
        const { data: quizSoal } = await supabase
          .from('quiz_soal')
          .select('urutan, soal:soal_id(id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin)')
          .eq('quiz_id', quizId)
          .order('urutan');

        soalList = quizSoal?.map(qs => qs.soal).filter(Boolean) || [];
      }

      // Kalau tidak ada quiz, ambil langsung dari tabel soal
      if (!soalList.length) {
        const { data: allSoal } = await supabase
          .from('soal')
          .select('id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin')
          .eq('jenis', 'pilihan_ganda')
          .order('created_at', { ascending: false })
          .limit(10);
        soalList = allSoal || [];
      }

    } else {
      // Guru: ambil soal miliknya
      const { data } = await supabase
        .from('soal')
        .select('id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin')
        .eq('guru_id', req.user.id)
        .order('created_at', { ascending: false });
      soalList = data || [];

      const { data: quizData } = await supabase
        .from('quiz')
        .select('id')
        .eq('guru_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (quizData?.length) quizId = quizData[0].id;
    }

    // Parse opsi jika masih string JSON
    soalList = soalList.map(s => ({
      ...s,
      opsi: typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || [])
    }));

    // Filter hanya soal pilihan ganda untuk quiz game
    const soalPG = soalList.filter(s => s.jenis === 'pilihan_ganda' && s.opsi?.length >= 2);

    res.json({
      success: true,
      soal: soalPG,
      quiz_id: quizId,
      total: soalPG.length
    });
  } catch (err) {
    console.error('GET /soal/quiz error:', err.message);
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// POST /api/soal/quiz – Buat quiz baru (guru)
// =====================================================
router.post('/quiz', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { judul, deskripsi, mapel, kelas_id, durasi, soal_ids } = req.body;
    if (!judul || !mapel || !soal_ids?.length)
      return res.status(400).json({ success: false, pesan: 'Judul, mapel, dan minimal 1 soal wajib diisi.' });

    const id = uuidv4();
    const { error } = await supabase.from('quiz').insert({
      id, judul, deskripsi: deskripsi || null, mapel,
      guru_id: req.user.id, kelas_id: kelas_id || null,
      durasi: durasi || 15, status: 'aktif'
    });
    if (error) throw error;

    const quizSoal = soal_ids.map((sid, i) => ({ quiz_id: id, soal_id: sid, urutan: i + 1 }));
    await supabase.from('quiz_soal').insert(quizSoal);

    if (kelas_id) {
      const { data: muridList } = await supabase
        .from('kelas_murid').select('murid_id').eq('kelas_id', kelas_id);
      if (muridList?.length) {
        const notifs = muridList.map(m => ({
          id: uuidv4(), user_id: m.murid_id,
          judul: '⚡ Quiz Baru!',
          pesan: `Ada quiz baru: "${judul}". Ayo kerjakan sekarang!`
        }));
        await supabase.from('notifikasi').insert(notifs);
      }
    }

    res.status(201).json({ success: true, pesan: `Quiz "${judul}" berhasil dibuat!`, data: { id } });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// GET /api/soal/quiz/:id – Detail quiz + soal
// =====================================================
router.get('/quiz/:id', authMiddleware, async (req, res) => {
  try {
    const { data: quiz } = await supabase
      .from('quiz').select('*, guru:guru_id(nama)').eq('id', req.params.id).single();
    if (!quiz) return res.status(404).json({ success: false, pesan: 'Quiz tidak ditemukan.' });

    const { data: quizSoal } = await supabase
      .from('quiz_soal')
      .select('urutan, soal:soal_id(*)')
      .eq('quiz_id', req.params.id)
      .order('urutan');

    let soalList = quizSoal?.map(qs => ({ ...qs.soal, urutan: qs.urutan })) || [];
    if (req.user.role === 'murid') {
      soalList = soalList.map(({ jawaban, ...rest }) => rest);
    }

    res.json({ success: true, data: { ...quiz, soal: soalList } });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// POST /api/soal/quiz/:id/submit – Murid submit hasil
// =====================================================
router.post('/quiz/:id/submit', authMiddleware, async (req, res) => {
  try {
    const { skor, benar, total_soal, durasi_detik } = req.body;

    const hasilId = uuidv4();
    await supabase.from('hasil_quiz').insert({
      id: hasilId,
      murid_id: req.user.id,
      quiz_id: req.params.id,
      skor: skor || 0,
      benar: benar || 0,
      total_soal: total_soal || 0,
      durasi_detik: durasi_detik || 0
    });

    // Update XP + level murid
    const xpDapat = skor || 0;
    const { data: user } = await supabase.from('users').select('xp').eq('id', req.user.id).single();
    const newXp = (user?.xp || 0) + xpDapat;
    const newLevel = Math.floor(newXp / 1000) + 1;
    await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('id', req.user.id);

    res.json({
      success: true,
      pesan: 'Hasil quiz tersimpan!',
      data: { skor, benar, total_soal, xp_dapat: xpDapat, total_xp: newXp }
    });
  } catch (err) {
    console.error('Submit quiz error:', err.message);
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// GET /api/soal/quiz/:id/leaderboard
router.get('/quiz/:id/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase
      .from('hasil_quiz')
      .select('skor, murid:murid_id(nama, avatar)')
      .eq('quiz_id', req.params.id)
      .order('skor', { ascending: false })
      .limit(10);
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;