const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { claimMisiReward, getTodayDate, getMondayDate } = require('../utils/gamification');

// ── GET /api/misi — ambil misi aktif + progres murid ────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const murid_id = req.user.id;
    const today    = getTodayDate();
    const monday   = getMondayDate();

    // Ambil semua misi aktif
    const { data: templates } = await supabase
      .from('misi_template')
      .select('*, badge:reward_badge_id(nama, icon)')
      .eq('aktif', true)
      .order('urutan');

    if (!templates) return res.json({ success: true, data: { harian: [], mingguan: [], achievement: [] } });

    // Ambil progres murid (harian + mingguan hari ini, achievement semua)
    const { data: progres } = await supabase
      .from('misi_murid')
      .select('*')
      .eq('murid_id', murid_id)
      .or(`periode.eq.${today},periode.eq.${monday},periode.is.null`);

    const progresMap = {};
    (progres || []).forEach(p => {
      const key = `${p.misi_id}_${p.periode || 'null'}`;
      progresMap[key] = p;
    });

    const result = { harian: [], mingguan: [], achievement: [] };

    for (const misi of templates) {
      const periode = misi.tipe === 'harian'
        ? today : misi.tipe === 'mingguan'
        ? monday : null;

      const key = `${misi.id}_${periode || 'null'}`;
      const p   = progresMap[key];

      result[misi.tipe].push({
        id:             p?.id || null,
        misi_id:        misi.id,
        judul:          misi.judul,
        deskripsi:      misi.deskripsi,
        icon:           misi.icon,
        reward_xp:      misi.reward_xp,
        reward_badge:   misi.badge || null,
        kondisi_tipe:   misi.kondisi_tipe,
        kondisi_target: misi.kondisi_target,
        progres:        p?.progres || 0,
        target:         misi.kondisi_target,
        selesai:        p?.selesai || false,
        reward_claimed: p?.reward_claimed || false
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[GET /misi]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// ── POST /api/misi/:id/klaim — klaim reward misi ────────────
router.post('/:id/klaim', authMiddleware, async (req, res) => {
  try {
    const result = await claimMisiReward(req.user.id, req.params.id);
    if (!result.success) return res.status(400).json(result);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[POST /misi/klaim]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// ── GET /api/misi/badges — badge milik murid ────────────────
router.get('/badges', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase
      .from('murid_badges')
      .select('diperoleh_at, badge:badge_id(id, nama, deskripsi, icon, tipe)')
      .eq('murid_id', req.user.id)
      .order('diperoleh_at', { ascending: false });

    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[GET /misi/badges]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// ── GET /api/misi/badges/semua — semua badge (untuk showcase) ─
router.get('/badges/semua', authMiddleware, async (req, res) => {
  try {
    const [{ data: semua }, { data: dimiliki }] = await Promise.all([
      supabase.from('badges').select('*').order('tipe'),
      supabase.from('murid_badges').select('badge_id').eq('murid_id', req.user.id)
    ]);

    const dimilikiSet = new Set((dimiliki || []).map(d => d.badge_id));
    const result = (semua || []).map(b => ({ ...b, dimiliki: dimilikiSet.has(b.id) }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[GET /misi/badges/semua]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;
