// =====================================================
//  src/routes/kode-guru.js
//  Endpoint KEPALA SEKOLAH untuk mengelola kode undangan guru.
//  Mounted di server.js pada prefix '/api/kode-guru'.
//
//  Skema database (v2):
//    kode_guru (id, kode, nama_guru, email_guru, no_telepon,
//                alamat, status, login_count, label, dibuat_oleh, created_at)
//  Catatan:
//  - Semua endpoint butuh authMiddleware + kepalaOnly (kecuali /validate).
//  - Operasi di-scope ke kode milik kepala yang login (dibuat_oleh).
// =====================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const { authMiddleware, kepalaOnly } = require('../middleware/auth');
const { cleanText, findKodeGuruByBcrypt } = require('../utils/sanitize');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomKode(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return out;
}

function publicKode(c) {
  return {
    id: c.id,
    kode: c.kode ? '••••••••' : null,
    status: c.status === 'revoked' ? 'revoked' : 'active',
    nama_guru: c.nama_guru,
    email_guru: c.email_guru,
    login_count: c.login_count || 0,
    label: c.label,
    created_at: c.created_at
  };
}

// =====================================================
//  POST /api/kode-guru — kepala generate kode baru
//  Kode di-hash dengan bcrypt sebelum disimpan.
// =====================================================
router.post('/', authMiddleware, kepalaOnly, async (req, res) => {
  try {
    const { nama_guru, email_guru, no_telepon, alamat, label } = req.body;
    if (!nama_guru || !email_guru) {
      return res.status(400).json({ success: false, pesan: 'Nama guru dan email guru wajib diisi.' });
    }

    const normalEmail = email_guru.toLowerCase().trim();
    const safeLabel = label ? cleanText(label, 100) : null;

    // Cek duplikat email di kode_guru
    const { data: dup } = await supabase.from('kode_guru').select('id').eq('email_guru', normalEmail).maybeSingle();
    if (dup) {
      return res.status(400).json({ success: false, pesan: 'Email guru sudah memiliki kode undangan.' });
    }

    // Generate random kode (plaintext — dikembalikan sekali ke frontend)
    const plainKode = randomKode(8);
    // Hash dengan bcrypt
    const hashedKode = await bcrypt.hash(plainKode, 10);

    const id = uuidv4();
    const { error } = await supabase.from('kode_guru').insert({
      id, kode: hashedKode, dibuat_oleh: req.user.id,
      status: 'active',
      nama_guru: cleanText(nama_guru, 100),
      email_guru: normalEmail,
      no_telepon: no_telepon ? cleanText(no_telepon, 20) : null,
      alamat: alamat ? cleanText(alamat, 200) : null,
      login_count: 0,
      label: safeLabel
    });
    if (error) throw error;

    res.status(201).json({
      success: true,
      pesan: 'Kode undangan guru berhasil dibuat.',
      plain_kode: plainKode,
      data: publicKode({ id, kode: hashedKode, status: 'active', nama_guru: cleanText(nama_guru, 100), email_guru: normalEmail, login_count: 0, label: safeLabel })
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

    const bcrypt = require('bcryptjs');
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
    if (password) { const bcrypt = require('bcryptjs'); updates.password = bcrypt.hashSync(password, 10); }
    if (alamat !== undefined) updates.alamat = alamat ? cleanText(alamat, 200) : null;
    if (umur !== undefined) updates.umur = umur ? parseInt(umur, 10) : null;
    if (asal_sekolah !== undefined) updates.asal_sekolah = asal_sekolah ? cleanText(asal_sekolah, 150) : null;

    if (updates.alamat !== undefined || updates.umur !== undefined || updates.asal_sekolah !== undefined) {
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
//  Kode sudah di-hash bcrypt → lookup pakai compare.
// =====================================================
router.post('/validate', async (req, res) => {
  try {
    const { kode } = req.body;
    if (!kode || typeof kode !== 'string' || kode.trim().length === 0)
      return res.status(400).json({ success: false, pesan: 'Kode wajib diisi.' });

    const entry = await findKodeGuruByBcrypt(supabase, kode, bcrypt);
    if (!entry)
      return res.status(404).json({ success: false, pesan: 'Kode tidak ditemukan.' });

    if (entry.status === 'revoked')
      return res.status(400).json({ success: false, pesan: 'Kode sudah dicabut oleh kepala sekolah.', status: 'revoked' });

    res.json({
      success: true,
      valid: true,
      pesan: 'Kode valid. Silakan lanjutkan pendaftaran.',
      data: {
        kode: '••••••••',
        nama_guru: entry.nama_guru,
        email_guru: entry.email_guru,
        label: entry.label
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
