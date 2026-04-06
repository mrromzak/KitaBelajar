// =====================================================
//  src/routes/orangtua.js
//  Akun Orangtua — pantau aktivitas murid
// =====================================================

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// Middleware khusus orangtua
function orangtuaOnly(req, res, next) {
  if (req.user.role !== 'orangtua') return res.status(403).json({ success: false, pesan: 'Hanya untuk akun orangtua.' });
  next();
}

// GET /api/orangtua/anak — ambil data murid yang dipantau
router.get('/anak', authMiddleware, orangtuaOnly, async (req, res) => {
  try {
    const parentId = req.user.id;
    const { data: relations } = await supabase
      .from('parent_student')
      .select('murid:murid_id(id, nama, email, avatar, xp, level, created_at)')
      .eq('parent_id', parentId);

    const anak = relations?.map(r => r.murid).filter(Boolean) || [];
    res.json({ success: true, data: anak });
  } catch(err) {
    console.error(err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// GET /api/orangtua/aktivitas/:murid_id — aktivitas lengkap anak
router.get('/aktivitas/:murid_id', authMiddleware, orangtuaOnly, async (req, res) => {
  try {
    const parentId = req.user.id;
    const { murid_id } = req.params;

    // Verifikasi bahwa ini memang anak dari orangtua ini
    const { data: rel } = await supabase
      .from('parent_student')
      .select('murid_id')
      .eq('parent_id', parentId)
      .eq('murid_id', murid_id)
      .single();

    if (!rel) return res.status(403).json({ success: false, pesan: 'Tidak punya akses ke murid ini.' });

    // Ambil data murid
    const { data: murid } = await supabase
      .from('users')
      .select('id, nama, email, avatar, xp, level, created_at')
      .eq('id', murid_id).single();

    // Ambil kelas murid
    const { data: kelasList } = await supabase
      .from('kelas_murid')
      .select('kelas:kelas_id(id, nama, mapel, tahun_ajar, guru:guru_id(nama))')
      .eq('murid_id', murid_id);

    // Ambil hasil quiz terbaru (10 terakhir)
    const { data: hasilQuiz } = await supabase
      .from('hasil_quiz')
      .select('skor, benar, total_soal, selesai_at, quiz:quiz_id(judul, mapel, tipe)')
      .eq('murid_id', murid_id)
      .order('selesai_at', { ascending: false })
      .limit(10);

    // Ambil materi yang sudah diselesaikan
    const { data: progresMateri, count: totalSelesai } = await supabase
      .from('progres_materi')
      .select('materi:materi_id(judul, mapel), selesai, updated_at', { count: 'exact' })
      .eq('murid_id', murid_id)
      .eq('selesai', true)
      .limit(10);

    // Rank global
    const { count: rankCount } = await supabase
      .from('users').select('id', { count: 'exact', head: true })
      .eq('role', 'murid').gt('xp', murid?.xp || 0);

    res.json({
      success: true,
      data: {
        murid: { ...murid, rank: (rankCount || 0) + 1 },
        kelas: kelasList?.map(k => k.kelas).filter(Boolean) || [],
        hasil_quiz: hasilQuiz || [],
        materi_selesai: progresMateri?.map(p => ({ ...p.materi, updated_at: p.updated_at })) || [],
        total_materi_selesai: totalSelesai || 0
      }
    });
  } catch(err) {
    console.error(err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

module.exports = router;
