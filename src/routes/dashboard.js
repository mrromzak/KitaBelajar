const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', authMiddleware, async (req, res) => {
  req.user.role === 'guru' ? dashboardGuru(req, res) : dashboardMurid(req, res);
});

async function dashboardGuru(req, res) {
  try {
    const guruId = req.user.id;

    // Statistik paralel
    const [
      { count: totalMurid },
      { count: totalMateri },
      { count: totalSoal },
      { count: totalQuiz },
      { data: topMurid },
      { data: materiTerbaru },
      { data: quizTerbaru }
    ] = await Promise.all([
      supabase.from('kelas_murid').select('murid_id', { count: 'exact', head: true })
        .in('kelas_id', (await supabase.from('kelas').select('id').eq('guru_id', guruId)).data?.map(k => k.id) || []),
      supabase.from('materi').select('id', { count: 'exact', head: true }).eq('guru_id', guruId),
      supabase.from('soal').select('id', { count: 'exact', head: true }).eq('guru_id', guruId),
      supabase.from('quiz').select('id', { count: 'exact', head: true }).eq('guru_id', guruId),
      supabase.from('users').select('nama, avatar, xp, level').eq('role', 'murid').order('xp', { ascending: false }).limit(5),
      supabase.from('materi').select('id, judul, mapel, jenis, status, views, created_at').eq('guru_id', guruId).order('created_at', { ascending: false }).limit(5),
      supabase.from('quiz').select('id, judul, mapel').eq('guru_id', guruId).order('created_at', { ascending: false }).limit(3)
    ]);

    res.json({
      success: true, role: 'guru',
      data: {
        stats: { total_murid: totalMurid, total_materi: totalMateri, total_soal: totalSoal, total_quiz: totalQuiz },
        top_murid: topMurid || [],
        materi_terbaru: materiTerbaru || [],
        quiz_terbaru: quizTerbaru || []
      }
    });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
}

async function dashboardMurid(req, res) {
  try {
    const muridId = req.user.id;

    const [
      { data: user },
      { data: kelasData },
      { data: quizBaru },
      { data: quizSelesai },
      { data: progresData },
      { count: notifCount }
    ] = await Promise.all([
      supabase.from('users').select('nama, avatar, xp, level').eq('id', muridId).single(),
      supabase.from('kelas_murid').select('kelas:kelas_id(id, nama, tahun_ajar, guru:guru_id(nama))').eq('murid_id', muridId),
      supabase.from('quiz').select('id, judul, mapel, durasi').eq('status', 'aktif').order('created_at', { ascending: false }).limit(5),
      supabase.from('hasil_quiz').select('skor, selesai_at, quiz:quiz_id(judul, mapel)').eq('murid_id', muridId).order('selesai_at', { ascending: false }).limit(5),
      supabase.from('progres_materi').select('materi:materi_id(mapel), selesai').eq('murid_id', muridId),
      supabase.from('notifikasi').select('id', { count: 'exact', head: true }).eq('user_id', muridId).eq('dibaca', false)
    ]);

    const { count: rankCount } = await supabase.from('users')
      .select('id', { count: 'exact', head: true }).eq('role', 'murid').gt('xp', user?.xp || 0);

    res.json({
      success: true, role: 'murid',
      data: {
        profil: { ...user, rank: (rankCount || 0) + 1, xp_progress: (user?.xp || 0) % 100, xp_target: (user?.level || 1) * 100 },
        kelas: kelasData?.map(k => k.kelas) || [],
        quiz_baru: quizBaru || [],
        quiz_selesai: quizSelesai || [],
        progres: progresData || [],
        notif_belum_dibaca: notifCount || 0
      }
    });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
}

// GET /api/dashboard/leaderboard
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { kelas_id } = req.query;
    let query = supabase.from('users').select('nama, avatar, xp, level').eq('role', 'murid').order('xp', { ascending: false }).limit(20);

    if (kelas_id) {
      const { data: members } = await supabase.from('kelas_murid').select('murid_id').eq('kelas_id', kelas_id);
      const ids = members?.map(m => m.murid_id) || [];
      query = supabase.from('users').select('nama, avatar, xp, level').in('id', ids).order('xp', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;

    const ranked = (data || []).map((u, i) => ({ ...u, peringkat: i + 1 }));
    res.json({ success: true, data: ranked });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// GET /api/dashboard/notifikasi
router.get('/notifikasi', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase
      .from('notifikasi').select('*').eq('user_id', req.user.id)
      .order('created_at', { ascending: false }).limit(20);
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// PUT /api/dashboard/notifikasi/:id/baca
router.put('/notifikasi/:id/baca', authMiddleware, async (req, res) => {
  try {
    await supabase.from('notifikasi').update({ dibaca: true }).eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ success: true, pesan: 'Notifikasi ditandai dibaca.' });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// GET /api/dashboard/penilaian — daftar quiz + skor murid untuk guru
router.get('/penilaian', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ success: false, pesan: 'Hanya guru.' });
  try {
    const guruId = req.user.id;
    // Ambil semua quiz milik guru
    const { data: quizList } = await supabase
      .from('quiz').select('id, judul, mapel, kelas_id, created_at')
      .eq('guru_id', guruId).order('created_at', { ascending: false });

    if (!quizList || quizList.length === 0) return res.json({ success: true, data: [] });

    const quizIds = quizList.map(q => q.id);

    // Ambil semua hasil quiz untuk quiz milik guru ini
    const { data: hasilList } = await supabase
      .from('hasil_quiz')
      .select('quiz_id, murid_id, skor, waktu_selesai, murid:murid_id(nama, avatar)')
      .in('quiz_id', quizIds)
      .order('waktu_selesai', { ascending: false });

    // Hitung rata-rata per quiz dan susun data
    const result = quizList.map(q => {
      const hasilQuiz = (hasilList || []).filter(h => h.quiz_id === q.id);
      const totalSkor = hasilQuiz.reduce((s, h) => s + (h.skor || 0), 0);
      const rataRata = hasilQuiz.length > 0 ? Math.round(totalSkor / hasilQuiz.length) : null;
      return {
        ...q,
        total_pengerjaan: hasilQuiz.length,
        rata_rata: rataRata,
        hasil: hasilQuiz.map(h => ({
          murid_id: h.murid_id,
          nama: h.murid?.nama || 'Murid',
          avatar: h.murid?.avatar || '🦁',
          skor: h.skor,
          waktu_selesai: h.waktu_selesai
        }))
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// PUT /api/dashboard/notifikasi/baca-semua
router.put('/notifikasi/baca-semua', authMiddleware, async (req, res) => {
  try {
    await supabase.from('notifikasi').update({ dibaca: true }).eq('user_id', req.user.id);
    res.json({ success: true, pesan: 'Semua notifikasi dibaca.' });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;
