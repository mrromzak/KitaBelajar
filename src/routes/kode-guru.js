// =====================================================
//  src/routes/kode-guru.js
//  Endpoint KEPALA SEKOLAH untuk mengelola kode undangan guru.
//  Mounted di server.js pada prefix '/api/kode-guru'.
//  Lihat rancangan: dokumentasi/arsitektur-kode-guru.md
//
//  Catatan:
//  - Semua endpoint butuh authMiddleware + kepalaOnly.
//  - Operasi di-scope ke kode milik kepala yang login (dibuat_oleh)
//    → mencegah IDOR (kepala A tak bisa lihat/cabut kode kepala B).
//  - Semua query lewat Supabase client (parameterized) → bebas SQL injection.
// =====================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const { authMiddleware, kepalaOnly } = require('../middleware/auth');
const { cleanText } = require('../utils/sanitize');

// Charset tanpa karakter ambigu (tanpa I, O, 0, 1) — sama seperti kode_akses kelas.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomKode(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]; // CSPRNG
  return out;
}

// Status turunan (dihitung saat baca — tanpa timer/cron → tanpa memory leak).
function deriveStatus(c) {
  if (c.status === 'revoked') return 'revoked';
  if (c.expires_at && new Date(c.expires_at) < new Date()) return 'expired';
  if ((c.used_count || 0) >= c.max_uses) return 'used_up';
  return 'active';
}

function publicKode(c) {
  return {
    id: c.id,
    kode: c.kode,
    status: deriveStatus(c),
    max_uses: c.max_uses,
    used_count: c.used_count || 0,
    sisa_kuota: Math.max(0, c.max_uses - (c.used_count || 0)),
    expires_at: c.expires_at,
    label: c.label,
    created_at: c.created_at
  };
}

// =====================================================
//  POST /api/kode-guru — kepala generate kode baru
// =====================================================
router.post('/', authMiddleware, kepalaOnly, async (req, res) => {
  try {
    const { max_uses, expires_in_days, label } = req.body;

    const maxUses = Math.min(Math.max(parseInt(max_uses, 10) || 1, 1), 1000);
    let expiresAt = null;
    if (expires_in_days !== undefined && expires_in_days !== null && String(expires_in_days).trim() !== '') {
      const days = parseInt(expires_in_days, 10);
      if (Number.isNaN(days) || days < 1 || days > 365)
        return res.status(400).json({ success: false, pesan: 'Masa berlaku harus 1–365 hari.' });
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    const safeLabel = label ? cleanText(label, 100) : null;

    // Generate kode unik (cek duplikat ke DB, maks 10 percobaan).
    let kode;
    let attempts = 0;
    do {
      kode = randomKode(8);
      const { data: dup } = await supabase.from('kode_guru').select('id').eq('kode', kode).maybeSingle();
      if (!dup) break;
      attempts++;
    } while (attempts < 10);

    const id = uuidv4();
    const { error } = await supabase.from('kode_guru').insert({
      id, kode, dibuat_oleh: req.user.id, status: 'active',
      max_uses: maxUses, used_count: 0, expires_at: expiresAt, label: safeLabel
    });
    if (error) throw error;

    res.status(201).json({
      success: true,
      pesan: 'Kode undangan guru berhasil dibuat.',
      data: publicKode({ id, kode, status: 'active', max_uses: maxUses, used_count: 0, expires_at: expiresAt, label: safeLabel })
    });
  } catch (err) {
    console.error('[kode-guru:create]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal membuat kode. Coba lagi.' });
  }
});

// =====================================================
//  GET /api/kode-guru — daftar kode milik kepala ini
// =====================================================
router.get('/', authMiddleware, kepalaOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('kode_guru').select('*')
      .eq('dibuat_oleh', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(publicKode) });
  } catch (err) {
    console.error('[kode-guru:list]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal memuat kode.' });
  }
});

// =====================================================
//  GET /api/kode-guru/guru — daftar guru terdaftar
// =====================================================
router.get('/guru', authMiddleware, kepalaOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users').select('id, nama, email, avatar, created_at')
      .eq('role', 'guru')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[kode-guru:guru]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal memuat daftar guru.' });
  }
});

// =====================================================
//  POST /api/kode-guru/validate — cek kode (publik, tanpa auth)
//  Body: { kode: "ABCD1234" }
//  Dipakai frontend sebelum submit form register guru.
// =====================================================
router.post('/validate', async (req, res) => {
  try {
    const { kode } = req.body;
    if (!kode || typeof kode !== 'string' || kode.trim().length === 0)
      return res.status(400).json({ success: false, pesan: 'Kode wajib diisi.' });

    const safeKode = kode.trim().toUpperCase();
    const { data: entry, error } = await supabase
      .from('kode_guru').select('*').eq('kode', safeKode).maybeSingle();

    if (error) throw error;
    if (!entry)
      return res.status(404).json({ success: false, pesan: 'Kode tidak ditemukan.' });

    const status = deriveStatus(entry);
    if (status !== 'active')
      return res.status(400).json({
        success: false,
        pesan: status === 'revoked' ? 'Kode sudah dicabut oleh kepala sekolah.'
             : status === 'expired' ? 'Kode sudah kadaluarsa.'
             : 'Kode sudah habis kuotanya.',
        status
      });

    res.json({
      success: true,
      valid: true,
      pesan: 'Kode valid. Silakan lanjutkan pendaftaran.',
      data: {
        kode: entry.kode,
        label: entry.label,
        sisa_kuota: Math.max(0, entry.max_uses - (entry.used_count || 0)),
        expires_at: entry.expires_at
      }
    });
  } catch (err) {
    console.error('[kode-guru:validate]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal memvalidasi kode. Coba lagi.' });
  }
});

// =====================================================
//  PATCH /api/kode-guru/:id/revoke — cabut kode
// =====================================================
router.patch('/:id/revoke', authMiddleware, kepalaOnly, async (req, res) => {
  try {
    // Hanya boleh mencabut kode milik sendiri (cegah IDOR).
    const { data: kode } = await supabase
      .from('kode_guru').select('id, status')
      .eq('id', req.params.id).eq('dibuat_oleh', req.user.id).maybeSingle();
    if (!kode) return res.status(404).json({ success: false, pesan: 'Kode tidak ditemukan.' });

    if (kode.status !== 'revoked') {
      const { error } = await supabase.from('kode_guru')
        .update({ status: 'revoked' })
        .eq('id', req.params.id).eq('dibuat_oleh', req.user.id);
      if (error) throw error;
    }
    res.json({ success: true, pesan: 'Kode berhasil dicabut.' });
  } catch (err) {
    console.error('[kode-guru:revoke]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal mencabut kode.' });
  }
});

module.exports = router;
