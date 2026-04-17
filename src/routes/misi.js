const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { claimMisiReward, getTodayDate, getMondayDate } = require('../utils/gamification');

const WELCOME_BADGE_ID = 'b0000000-0000-0000-0000-000000000001';

// ── Auto-award badge pertama jika murid belum punya badge apapun ──
async function autoAwardWelcomeBadge(murid_id) {
  try {
    // Cek apakah sudah punya badge apapun
    const { count } = await supabase
      .from('murid_badges')
      .select('id', { count: 'exact', head: true })
      .eq('murid_id', murid_id);

    if (count && count > 0) return null; // sudah punya badge

    // Award welcome badge
    const { error } = await supabase.from('murid_badges').insert({
      murid_id,
      badge_id: WELCOME_BADGE_ID,
      diperoleh_at: new Date().toISOString()
    });

    if (error) return null; // mungkin sudah ada (race condition)

    // Ambil info badge untuk dikirim ke frontend
    const { data: badge } = await supabase
      .from('badges')
      .select('id, nama, deskripsi, icon')
      .eq('id', WELCOME_BADGE_ID)
      .single();

    return badge || null;
  } catch { return null; }
}

// ── Auto-klaim reward misi yang sudah selesai tapi belum diklaim ──
async function autoClaimSelesai(murid_id) {
  try {
    const { data: selesai } = await supabase
      .from('misi_murid')
      .select('id, misi:misi_id(reward_xp, reward_badge_id, judul)')
      .eq('murid_id', murid_id)
      .eq('selesai', true)
      .eq('reward_claimed', false);

    if (!selesai || selesai.length === 0) return [];

    const claimed = [];
    for (const record of selesai) {
      const misi = record.misi;
      if (!misi) continue;

      // Award XP
      if (misi.reward_xp > 0) {
        const { data: user } = await supabase.from('users').select('xp').eq('id', murid_id).single();
        const newXp    = (user?.xp || 0) + misi.reward_xp;
        const newLevel = Math.floor(newXp / 1000) + 1;
        await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('id', murid_id);
      }

      // Award badge
      let badge = null;
      if (misi.reward_badge_id) {
        const { error: badgeErr } = await supabase.from('murid_badges').insert({
          murid_id,
          badge_id: misi.reward_badge_id,
          diperoleh_at: new Date().toISOString()
        });
        if (!badgeErr) {
          const { data: b } = await supabase
            .from('badges')
            .select('id, nama, deskripsi, icon')
            .eq('id', misi.reward_badge_id)
            .single();
          badge = b || null;
        }
      }

      await supabase.from('misi_murid').update({ reward_claimed: true }).eq('id', record.id);
      claimed.push({ misi_judul: misi.judul, xp: misi.reward_xp || 0, badge });
    }
    return claimed;
  } catch { return []; }
}

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

    // Auto-klaim misi yang sudah selesai (tanpa perlu klik tombol)
    const autoClaimed = await autoClaimSelesai(murid_id);

    // Auto-award welcome badge jika belum punya badge sama sekali
    const welcomeBadge = await autoAwardWelcomeBadge(murid_id);

    // Gabungkan badge baru dari auto-claim + welcome badge
    const badgeBaru = [];
    if (welcomeBadge) badgeBaru.push(welcomeBadge);
    for (const c of autoClaimed) {
      if (c.badge) badgeBaru.push(c.badge);
    }

    // Reload progres setelah auto-claim agar UI sinkron
    if (autoClaimed.length > 0) {
      const { data: progresUpdate } = await supabase
        .from('misi_murid')
        .select('*')
        .eq('murid_id', murid_id)
        .or(`periode.eq.${today},periode.eq.${monday},periode.is.null`);

      const progresMapUpdate = {};
      (progresUpdate || []).forEach(p => {
        const key = `${p.misi_id}_${p.periode || 'null'}`;
        progresMapUpdate[key] = p;
      });

      // Update reward_claimed di result
      for (const tipe of ['harian', 'mingguan', 'achievement']) {
        result[tipe] = result[tipe].map(m => {
          const periode = tipe === 'harian' ? today : tipe === 'mingguan' ? monday : null;
          const key = `${m.misi_id}_${periode || 'null'}`;
          const p = progresMapUpdate[key];
          if (p) return { ...m, reward_claimed: p.reward_claimed };
          return m;
        });
      }
    }

    res.json({
      success:    true,
      data:       result,
      badge_baru: badgeBaru.length > 0 ? badgeBaru : undefined,
      auto_xp:    autoClaimed.reduce((s, c) => s + (c.xp || 0), 0) || undefined
    });
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
