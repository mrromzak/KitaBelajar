const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

// GET /api/chat/private/:userId — ambil riwayat chat privat dengan user tertentu
router.get('/private/:userId', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const otherId = req.params.userId;

    const { data, error } = await supabase
      .from('pesan_private')
      .select('*, pengirim:dari_id(id, nama, avatar, role)')
      .or(`and(dari_id.eq.${myId},ke_id.eq.${otherId}),and(dari_id.eq.${otherId},ke_id.eq.${myId})`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    // Tandai semua pesan dari lawan bicara sebagai dibaca
    await supabase
      .from('pesan_private')
      .update({ dibaca: true })
      .eq('ke_id', myId)
      .eq('dari_id', otherId)
      .eq('dibaca', false);

    const result = (data || []).map(p => ({ ...p, isi: decrypt(p.isi) }));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// POST /api/chat/private/:userId — kirim pesan privat ke user tertentu
router.post('/private/:userId', authMiddleware, async (req, res) => {
  try {
    const { isi } = req.body;
    if (!isi?.trim()) return res.status(400).json({ success: false, pesan: 'Pesan tidak boleh kosong.' });

    const plainIsi = isi.trim();
    const id = uuidv4();
    const { error } = await supabase.from('pesan_private').insert({
      id,
      dari_id: req.user.id,
      ke_id: req.params.userId,
      isi: encrypt(plainIsi)
    });
    if (error) throw error;

    res.status(201).json({
      success: true,
      data: { id, dari_id: req.user.id, ke_id: req.params.userId, isi: plainIsi, created_at: new Date().toISOString() }
    });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// GET /api/chat/inbox — daftar percakapan (siapa saja yang pernah chat)
router.get('/inbox', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const { data, error } = await supabase
      .from('pesan_private')
      .select('*, pengirim:dari_id(id, nama, avatar, role), penerima:ke_id(id, nama, avatar, role)')
      .or(`dari_id.eq.${myId},ke_id.eq.${myId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by conversation partner
    const seen = new Set();
    const conversations = [];
    for (const p of (data || [])) {
      const partner = p.dari_id === myId ? p.penerima : p.pengirim;
      if (!partner || seen.has(partner.id)) continue;
      seen.add(partner.id);
      const unread = (data || []).filter(m => m.dari_id === partner.id && m.ke_id === myId && !m.dibaca).length;
      conversations.push({ partner, last_message: decrypt(p.isi), last_at: p.created_at, unread });
    }

    res.json({ success: true, data: conversations });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;
