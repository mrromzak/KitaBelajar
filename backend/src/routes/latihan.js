const express = require('express');
const router  = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { updateUserStats, checkMisi } = require('../utils/gamification');

// ── POST /api/latihan/selesai — catat selesai 1 sesi latihan ──
// Body: { xpDapat: number, skor: number (0-100) }
router.post('/selesai', authMiddleware, async (req, res) => {
  try {
    const murid_id = req.user.id;
    const { xpDapat = 0, skor = 0 } = req.body;

    // Update stats user (latihan_count +1, XP, streak)
    const stats = await updateUserStats(murid_id, {
      xpDapat,
      skor,
      tipe: 'latihan'
    });

    // Cek misi yang bisa selesai dari aktivitas latihan
    const misiSelesai = await checkMisi(murid_id, {
      tipe_aktivitas: 'latihan',
      nilai:          skor,
      xpDapat
    });

    res.json({
      success:      true,
      stats,
      misi_selesai: misiSelesai.map(m => ({
        judul:    m.misi.judul,
        xp:       m.xp,
        badge_id: m.badge_id
      }))
    });
  } catch (err) {
    console.error('[POST /latihan/selesai]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

module.exports = router;
