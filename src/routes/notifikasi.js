const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

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
    res.status(500).json({ success: false, pesan: err.message });
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
    res.status(500).json({ success: false, pesan: err.message });
  }
});

module.exports = router;
