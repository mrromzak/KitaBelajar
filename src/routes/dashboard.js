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
    // Ambil kelas milik guru dulu
    const { data: kelasList } = await supabase.from('kelas').select('id').eq('guru_id', guruId);
    const kelasIds = kelasList?.map(k => k.id) || [];

    const [
      { count: totalMurid },
      { count: totalMateri },
      { count: totalSoal },
      { data: quizList },
      { data: topMurid },
      { data: materiTerbaru }
    ] = await Promise.all([
      kelasIds.length > 0
        ? supabase.from('kelas_murid').select('murid_id', { count: 'exact', head: true }).in('kelas_id', kelasIds)
        : Promise.resolve({ count: 0 }),
      supabase.from('materi').select('id', { count: 'exact', head: true }).eq('guru_id', guruId),
      supabase.from('soal').select('id', { count: 'exact', head: true }).eq('guru_id', guruId),
      supabase.from('quiz').select('id, judul, mapel').eq('guru_id', guruId).order('created_at', { ascending: false }),
      supabase.from('users').select('nama, avatar, xp, level').eq('role', 'murid').order('xp', { ascending: false }).limit(5),
      supabase.from('materi').select('id, judul, mapel, jenis, status, views, created_at').eq('guru_id', guruId).order('created_at', { ascending: false }).limit(5)
    ]);

    const totalQuiz = quizList?.length || 0;
    const quizTerbaru = (quizList || []).slice(0, 3);
    const allQuizIds = (quizList || []).map(q => q.id);

    // Rata-rata nilai: skor semua murid di semua quiz guru ini
    let rataRataNilai = null;
    if (allQuizIds.length > 0) {
      const { data: hasilSemua } = await supabase
        .from('hasil_quiz')
        .select('skor')
        .in('quiz_id', allQuizIds);
      const skorList = (hasilSemua || []).filter(h => typeof h.skor === 'number');
      if (skorList.length > 0) {
        rataRataNilai = Math.round(skorList.reduce((s, h) => s + h.skor, 0) / skorList.length);
      }
    }

    res.json({
      success: true, role: 'guru',
      data: {
        stats: {
          total_murid: totalMurid || 0,
          total_materi: totalMateri || 0,
          total_soal: totalSoal || 0,
          total_quiz: totalQuiz,
          total_kelas: kelasIds.length,
          rata_rata_nilai: rataRataNilai
        },
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

// GET /api/dashboard/penilaian — daftar quiz + skor murid per kelas untuk guru
router.get('/penilaian', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ success: false, pesan: 'Hanya guru.' });
  try {
    const guruId = req.user.id;
    const { kelas_id } = req.query;

    // Ambil semua quiz milik guru (bisa difilter per kelas)
    let quizQuery = supabase
      .from('quiz').select('id, judul, mapel, kelas_id, tipe, deadline, created_at')
      .eq('guru_id', guruId).order('created_at', { ascending: false });
    if (kelas_id) quizQuery = quizQuery.eq('kelas_id', kelas_id);

    const { data: quizList } = await quizQuery;
    if (!quizList || quizList.length === 0) return res.json({ success: true, data: [], by_kelas: [] });

    const quizIds = quizList.map(q => q.id);

    // Ambil info kelas untuk label
    const kelasIds = [...new Set(quizList.map(q => q.kelas_id).filter(Boolean))];
    const { data: kelasList } = kelasIds.length > 0
      ? await supabase.from('kelas').select('id, nama, mapel').in('id', kelasIds)
      : { data: [] };
    const kelasMap = Object.fromEntries((kelasList || []).map(k => [k.id, k]));

    // Ambil semua hasil quiz
    const { data: hasilList, error: hasilErr } = await supabase
      .from('hasil_quiz')
      .select('quiz_id, murid_id, skor, benar, total_soal, selesai_at, murid:murid_id(id, nama, avatar)')
      .in('quiz_id', quizIds)
      .order('selesai_at', { ascending: false });
    if (hasilErr) console.error('hasil_quiz fetch error:', hasilErr.message);

    // Ambil daftar murid per kelas (untuk info belum mengerjakan)
    const { data: kelasMuridList } = kelasIds.length > 0
      ? await supabase.from('kelas_murid').select('kelas_id, murid_id, users:murid_id(id, nama, avatar)').in('kelas_id', kelasIds)
      : { data: [] };
    // Map: kelas_id -> array of murid
    const kelasMuridMap = {};
    (kelasMuridList || []).forEach(km => {
      if (!kelasMuridMap[km.kelas_id]) kelasMuridMap[km.kelas_id] = [];
      if (km.users) kelasMuridMap[km.kelas_id].push({ id: km.murid_id, nama: km.users.nama || 'Murid', avatar: km.users.avatar || '🦁' });
    });

    // Susun per quiz
    const quizResult = quizList.map(q => {
      const hasilQuiz = (hasilList || []).filter(h => h.quiz_id === q.id);
      const totalSkor = hasilQuiz.reduce((s, h) => s + (h.skor || 0), 0);
      const rataRata = hasilQuiz.length > 0 ? Math.round(totalSkor / hasilQuiz.length) : null;
      const kelas = q.kelas_id ? kelasMap[q.kelas_id] : null;

      // Murid yang sudah mengerjakan
      const sudahIds = new Set(hasilQuiz.map(h => h.murid_id));
      // Murid yang belum mengerjakan (hanya jika quiz terikat kelas)
      const allMuridKelas = q.kelas_id ? (kelasMuridMap[q.kelas_id] || []) : [];
      const belumMengerjakan = allMuridKelas.filter(m => !sudahIds.has(m.id));

      return {
        ...q,
        kelas_nama: kelas?.nama || 'Semua Kelas',
        kelas_mapel: kelas?.mapel || q.mapel || '',
        total_murid: allMuridKelas.length,
        total_pengerjaan: hasilQuiz.length,
        rata_rata: rataRata,
        hasil: hasilQuiz.map(h => ({
          murid_id: h.murid_id,
          nama: h.murid?.nama || 'Murid',
          avatar: h.murid?.avatar || '🦁',
          skor: h.skor,
          benar: h.benar,
          total_soal: h.total_soal,
          waktu_selesai: h.selesai_at
        })),
        belum_mengerjakan: belumMengerjakan
      };
    });

    // Kelompokkan per kelas untuk tampilan terorganisir
    const byKelas = {};
    quizResult.forEach(q => {
      const key = q.kelas_id || '__semua__';
      if (!byKelas[key]) {
        byKelas[key] = {
          kelas_id: q.kelas_id,
          kelas_nama: q.kelas_nama,
          kelas_mapel: q.kelas_mapel,
          fun_quiz: [],
          pr: []
        };
      }
      const tipe = q.tipe === 'pr' ? 'pr' : 'fun_quiz';
      byKelas[key][tipe].push(q);
    });

    res.json({ success: true, data: quizResult, by_kelas: Object.values(byKelas) });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// GET /api/dashboard/murid-init — satu endpoint untuk semua data awal dashboard murid
// Menggantikan: /kelas + /quiz?kelas_id=X (loop) + /quiz/hasil/cek?quiz_id=X (loop)
router.get('/murid-init', authMiddleware, async (req, res) => {
  if (req.user.role !== 'murid') return res.status(403).json({ success: false, pesan: 'Hanya murid.' });
  const muridId = req.user.id;
  try {
    // Ambil semua kelas murid
    const { data: kelasMuridRows } = await supabase
      .from('kelas_murid')
      .select('kelas:kelas_id(id, nama, tahun_ajar, mapel, kode_akses, guru:guru_id(nama, avatar))')
      .eq('murid_id', muridId);
    const kelasList = (kelasMuridRows || []).map(r => r.kelas).filter(Boolean);
    const kelasIds = kelasList.map(k => k.id);

    if (kelasIds.length === 0) {
      return res.json({ success: true, kelas: [], deadlines: [] });
    }

    // Ambil semua quiz aktif dari semua kelas sekaligus (1 query, bukan N)
    const [{ data: quizList }, { data: hasilList }] = await Promise.all([
      supabase.from('quiz')
        .select('id, judul, mapel, kelas_id, tipe, deadline, durasi, status')
        .in('kelas_id', kelasIds)
        .eq('status', 'aktif')
        .order('created_at', { ascending: false }),
      // Ambil semua hasil quiz murid ini untuk semua kelas sekaligus (1 query, bukan N)
      supabase.from('hasil_quiz')
        .select('quiz_id, skor, benar, total_soal')
        .eq('murid_id', muridId)
    ]);

    // Index hasil quiz by quiz_id
    const hasilMap = {};
    (hasilList || []).forEach(h => { hasilMap[h.quiz_id] = h; });

    // Gabungkan quiz + status sudah/belum dikerjakan
    const quizWithStatus = (quizList || []).map(q => ({
      ...q,
      sudah_dikerjakan: !!hasilMap[q.id],
      hasil: hasilMap[q.id] || null
    }));

    // Filter untuk deadline alert: PR dengan deadline dalam 7 hari ke depan
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const deadlines = quizWithStatus.filter(q =>
      q.tipe === 'pr' && q.deadline && new Date(q.deadline) > now && new Date(q.deadline) <= sevenDays
    ).map(q => ({
      ...q,
      kelas_nama: kelasList.find(k => k.id === q.kelas_id)?.nama || ''
    }));

    res.json({ success: true, kelas: kelasList, quiz: quizWithStatus, deadlines });
  } catch (err) {
    console.error('murid-init error:', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
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
