const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { checkMisi } = require('../utils/gamification');

// ── POST /api/belajar/buka — catat murid membuka AyoBelajar ──
// Dipanggil satu kali per sesi dari kita-materi.html
router.post('/buka', authMiddleware, async (req, res) => {
  try {
    const murid_id = req.user.id;

    const misiSelesai = await checkMisi(murid_id, {
      tipe_aktivitas: 'belajar',
      nilai:          0,
      xpDapat:        0
    });

    res.json({
      success:      true,
      misi_selesai: misiSelesai.map(m => ({
        judul:    m.misi.judul,
        xp:       m.xp,
        badge_id: m.badge_id
      }))
    });
  } catch (err) {
    console.error('[POST /belajar/buka]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

module.exports = router;
