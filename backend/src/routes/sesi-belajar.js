const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { checkBadges } = require('../utils/badgeChecker');

const MAX_SESI_DURASI_DETIK = 6 * 3600; // 6 jam — safety absolute
const ABANDONED_TIMEOUT_DETIK = 30 * 60; // 30 menit

// ── Helpers ──────────────────────────────────────────────────

async function cleanupAbandonedSesi(murid_id) {
  const cutoff = new Date(Date.now() - ABANDONED_TIMEOUT_DETIK * 1000).toISOString();
  const { data: abandoned } = await supabase
    .from('sesi_baca_materi')
    .select('id, mulai_at')
    .is('selesai_at', null)
    .eq('murid_id', murid_id)
    .lt('mulai_at', cutoff);

  if (abandoned && abandoned.length > 0) {
    const xpMax = 10 * 60; // cap 10 menit untuk abandoned
    for (const sesi of abandoned) {
      const elapsed = Math.round((Date.now() - new Date(sesi.mulai_at).getTime()) / 1000);
      const capped  = Math.min(elapsed, xpMax);
      await supabase.from('sesi_baca_materi').update({
        selesai_at:         new Date().toISOString(),
        durasi_aktif_detik: capped
      }).eq('id', sesi.id);
      await addWaktuBelajar(murid_id, capped);
    }
  }
}

async function addWaktuBelajar(murid_id, detik) {
  if (detik <= 0) return;
  const { data: user } = await supabase.from('users')
    .select('total_waktu_belajar_detik')
    .eq('id', murid_id)
    .single();
  const current = user?.total_waktu_belajar_detik || 0;
  await supabase.from('users')
    .update({ total_waktu_belajar_detik: current + detik })
    .eq('id', murid_id);
}

// ── POST /api/sesi-belajar/mulai ─────────────────────────────
router.post('/mulai', authMiddleware, async (req, res) => {
  try {
    const murid_id = req.user.id;
    const { materi_id } = req.body;

    if (materi_id) {
      const { data: materi, error: materiErr } = await supabase
        .from('materi')
        .select('id')
        .eq('id', materi_id)
        .maybeSingle();
      if (materiErr || !materi) {
        return res.status(404).json({ success: false, pesan: 'Materi tidak ditemukan.' });
      }
    }

    // Tutup sesi sebelumnya yang masih terbuka (user lupa panggil selesai)
    await cleanupAbandonedSesi(murid_id);

    // Buat sesi baru
    const { data: sesi, error } = await supabase
      .from('sesi_baca_materi')
      .insert({ murid_id, materi_id, mulai_at: new Date().toISOString() })
      .select('id')
      .single();

    if (error) {
      console.error('[sesi-belajar] insert error:', error.message);
      return res.status(500).json({ success: false, pesan: 'Gagal memulai sesi.' });
    }

    res.json({ success: true, session_id: sesi.id });
  } catch (err) {
    console.error('[POST /sesi-belajar/mulai]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// ── POST /api/sesi-belajar/selesai ────────────────────────────
router.post('/selesai', authMiddleware, async (req, res) => {
  try {
    const murid_id = req.user.id;
    const { session_id, durasi_aktif_detik } = req.body;

    if (!session_id || durasi_aktif_detik === undefined || durasi_aktif_detik === null) {
      return res.status(400).json({ success: false, pesan: 'session_id dan durasi_aktif_detik wajib diisi.' });
    }

    // Ambil sesi
    const { data: sesi, error: sesiErr } = await supabase
      .from('sesi_baca_materi')
      .select('*')
      .eq('id', session_id)
      .eq('murid_id', murid_id)
      .maybeSingle();

    if (sesiErr || !sesi) {
      return res.status(404).json({ success: false, pesan: 'Sesi tidak ditemukan.' });
    }
    if (sesi.selesai_at) {
      return res.status(400).json({ success: false, pesan: 'Sesi sudah ditutup sebelumnya.' });
    }

    // Hitung elapsed time real dari mulai_at ke sekarang
    const now = new Date();
    const mulai = new Date(sesi.mulai_at);
    const maxDurasi = Math.round((now.getTime() - mulai.getTime()) / 1000);

    // Validasi dan clamp durasi
    let durasiFinal = Math.round(durasi_aktif_detik);
    if (durasiFinal < 0) durasiFinal = 0;
    if (durasiFinal > maxDurasi) durasiFinal = maxDurasi;
    if (durasiFinal > MAX_SESI_DURASI_DETIK) durasiFinal = MAX_SESI_DURASI_DETIK;

    // Update sesi
    const { error: updateErr } = await supabase
      .from('sesi_baca_materi')
      .update({
        selesai_at:         now.toISOString(),
        durasi_aktif_detik: durasiFinal
      })
      .eq('id', session_id);

    if (updateErr) {
      console.error('[sesi-belajar] update error:', updateErr.message);
      return res.status(500).json({ success: false, pesan: 'Gagal menyimpan sesi.' });
    }

    // Update akumulasi total di users
    await addWaktuBelajar(murid_id, durasiFinal);

    // Cek badge setelah waktu belajar bertambah
    const badgeBaru = await checkBadges(murid_id, 'belajar');

    res.json({
      success: true,
      durasi_aktif_detik: durasiFinal,
      badge_baru: badgeBaru.length > 0 ? badgeBaru : undefined
    });
  } catch (err) {
    console.error('[POST /sesi-belajar/selesai]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

module.exports = router;
