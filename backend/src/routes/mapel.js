const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const { authMiddleware, guruOnly } = require('../middleware/auth');
const { cleanText } = require('../utils/sanitize');

// GET /api/mapel — Daftar mapel milik user (guru: punya sendiri; selain itu kosong)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('mapel')
      .select('*')
      .eq('guru_id', req.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// POST /api/mapel — Guru tambah mapel
router.post('/', authMiddleware, guruOnly, async (req, res) => {
  try {
    const nama = cleanText(req.body?.nama, 40);
    const emoji = cleanText(req.body?.emoji || '📌', 8);
    if (!nama) return res.status(400).json({ success: false, pesan: 'Nama mata pelajaran wajib diisi.' });

    const { data: existing } = await supabase.from('mapel')
      .select('id').eq('guru_id', req.user.id).eq('nama', nama).maybeSingle();
    if (existing) return res.status(409).json({ success: false, pesan: 'Mata pelajaran itu sudah ada.' });

    const { data, error } = await supabase.from('mapel')
      .insert({ id: uuidv4(), guru_id: req.user.id, nama, emoji })
      .select('*').single();
    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// DELETE /api/mapel/:id — Guru hapus mapel miliknya sendiri (anti-IDOR)
router.delete('/:id', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { data: existing } = await supabase.from('mapel')
      .select('id').eq('id', req.params.id).eq('guru_id', req.user.id).maybeSingle();
    if (!existing) return res.status(404).json({ success: false, pesan: 'Mata pelajaran tidak ditemukan.' });

    const { error } = await supabase.from('mapel').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true, pesan: 'Mata pelajaran berhasil dihapus.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;
