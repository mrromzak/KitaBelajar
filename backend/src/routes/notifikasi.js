const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware, guruOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// GET /api/notifikasi — ambil notifikasi milik user (max 50 terbaru)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifikasi')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// PATCH /api/notifikasi/baca-semua — tandai semua notifikasi sebagai dibaca
router.patch('/baca-semua', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifikasi')
      .update({ dibaca: true })
      .eq('user_id', req.user.id)
      .eq('dibaca', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// POST /api/notifikasi/kelas/:kelasId — Guru kirim notif ke semua murid di kelas
router.post('/kelas/:kelasId', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { kelasId } = req.params;
    const { judul, pesan, tipe, data_extra } = req.body;
    if (!judul || !pesan) return res.status(400).json({ success: false, pesan: 'judul dan pesan wajib diisi.' });

    // Pastikan guru punya kelas ini
    const { data: kelas } = await supabase.from('kelas').select('id').eq('id', kelasId).eq('guru_id', req.user.id).single();
    if (!kelas) return res.status(403).json({ success: false, pesan: 'Kelas tidak ditemukan.' });

    // Ambil semua murid di kelas
    const { data: muridList } = await supabase.from('kelas_murid').select('murid_id').eq('kelas_id', kelasId);
    if (!muridList?.length) return res.json({ success: true, pesan: 'Tidak ada murid di kelas ini.', terkirim: 0 });

    const notifs = muridList.map(m => ({
      id: uuidv4(),
      user_id: m.murid_id,
      judul,
      pesan,
      tipe: tipe || 'info',
      data_extra: data_extra ? JSON.stringify(data_extra) : null
    }));

    const { error } = await supabase.from('notifikasi').insert(notifs);
    if (error) throw error;

    res.json({ success: true, pesan: `Notifikasi dikirim ke ${notifs.length} murid.`, terkirim: notifs.length });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;
