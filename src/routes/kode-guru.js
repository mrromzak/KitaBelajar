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
const bcrypt = require('bcryptjs');
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
      .from('users').select('id, nama, email, avatar, created_at, alamat, umur, asal_sekolah, code_guru')
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
//  POST /api/kode-guru/guru — kepala daftarkan guru secara manual
// =====================================================
router.post('/guru', authMiddleware, kepalaOnly, async (req, res) => {
  try {
    const { nama, email, password, alamat, umur, asal_sekolah } = req.body;
    if (!nama || !email || !password) {
      return res.status(400).json({ success: false, pesan: 'Nama, email, dan password wajib diisi.' });
    }

    const normalEmail = email.toLowerCase().trim();
    const { data: existing } = await supabase.from('users').select('id').eq('email', normalEmail).maybeSingle();
    if (existing) {
      return res.status(400).json({ success: false, pesan: 'Email sudah terdaftar.' });
    }

    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Generate code_guru baru
    let newCode = '';
    const { data: generated } = await supabase.rpc('generate_code_guru_for_user', { p_user_id: id }).catch(() => ({ data: null }));
    if (!generated) {
      for (let i = 0; i < 8; i++) newCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }

    const { error } = await supabase.from('users').insert({
      id,
      nama: cleanText(nama, 100),
      email: normalEmail,
      password: hashedPassword,
      role: 'guru',
      avatar: '👩‍🏫',
      alamat: alamat ? cleanText(alamat, 200) : null,
      umur: umur ? parseInt(umur, 10) : null,
      asal_sekolah: asal_sekolah ? cleanText(asal_sekolah, 150) : null,
      profil_lengkap: !!(alamat && umur && asal_sekolah),
      code_guru: newCode || null,
      code_guru_generated_at: newCode ? new Date().toISOString() : null
    });
    if (error) throw error;

    if (!newCode) {
      // Panggil RPC ulang jika tadi tidak langsung di-insert (karena id user harus terdaftar dulu)
      await supabase.rpc('generate_code_guru_for_user', { p_user_id: id }).catch(() => {});
    }

    res.status(201).json({ success: true, pesan: 'Guru berhasil didaftarkan secara manual.' });
  } catch (err) {
    console.error('[kode-guru:create-guru-manual]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal mendaftarkan guru secara manual.' });
  }
});

// =====================================================
//  PUT /api/kode-guru/guru/:id — kepala edit data diri guru
// =====================================================
router.put('/guru/:id', authMiddleware, kepalaOnly, async (req, res) => {
  try {
    const { nama, email, password, alamat, umur, asal_sekolah } = req.body;
    const { id } = req.params;

    const updates = {};
    if (nama) updates.nama = cleanText(nama, 100);
    if (email) updates.email = email.toLowerCase().trim();
    if (password) updates.password = bcrypt.hashSync(password, 10);
    if (alamat !== undefined) updates.alamat = alamat ? cleanText(alamat, 200) : null;
    if (umur !== undefined) updates.umur = umur ? parseInt(umur, 10) : null;
    if (asal_sekolah !== undefined) updates.asal_sekolah = asal_sekolah ? cleanText(asal_sekolah, 150) : null;

    if (updates.alamat !== undefined || updates.umur !== undefined || updates.asal_sekolah !== undefined) {
      // Ambil user dulu untuk mengecek profil lengkap
      const { data: user } = await supabase.from('users').select('alamat, umur, asal_sekolah').eq('id', id).single();
      if (user) {
        const finalAlamat = updates.alamat !== undefined ? updates.alamat : user.alamat;
        const finalUmur = updates.umur !== undefined ? updates.umur : user.umur;
        const finalSekolah = updates.asal_sekolah !== undefined ? updates.asal_sekolah : user.asal_sekolah;
        updates.profil_lengkap = !!(finalAlamat && finalUmur && finalSekolah);
      }
    }

    const { error } = await supabase.from('users').update(updates).eq('id', id).eq('role', 'guru');
    if (error) throw error;

    res.json({ success: true, pesan: 'Data guru berhasil diperbarui.' });
  } catch (err) {
    console.error('[kode-guru:update-guru]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal memperbarui data guru.' });
  }
});

// =====================================================
//  POST /api/kode-guru/guru/:id/regenerate — kepala re-generate code_guru guru
// =====================================================
router.post('/guru/:id/regenerate', authMiddleware, kepalaOnly, async (req, res) => {
  try {
    const { id } = req.params;
    let generatedCode = '';
    for (let i = 0; i < 8; i++) generatedCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];

    const { error } = await supabase.from('users')
      .update({ code_guru: generatedCode, code_guru_generated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('role', 'guru');
    if (error) throw error;

    res.json({ success: true, pesan: 'Kode guru berhasil di-generate ulang.', code_guru: generatedCode });
  } catch (err) {
    console.error('[kode-guru:regenerate-guru-code]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal me-regenerate kode guru.' });
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
