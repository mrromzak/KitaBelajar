const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// Helper validasi password kuat
function validatePassword(password) {
  if (!password || password.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Z]/.test(password)) return 'Password harus mengandung huruf kapital.';
  if (!/[0-9]/.test(password)) return 'Password harus mengandung angka.';
  return null;
}

// =============================================
//  POST /api/auth/register
// =============================================
router.post('/register', async (req, res) => {
  try {
    const { nama, email, password, role, kelas, kode_kelas } = req.body;

    if (!nama || !email || !password || !role)
      return res.status(400).json({ success: false, pesan: 'Nama, email, password, dan role wajib diisi.' });
    if (!['guru', 'murid'].includes(role))
      return res.status(400).json({ success: false, pesan: 'Role harus "guru" atau "murid".' });

    // Validasi format email
    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    if (!validator.isEmail(normalEmail))
      return res.status(400).json({ success: false, pesan: 'Format email tidak valid.' });

    // Validasi nama (max 100 karakter, tidak boleh hanya spasi)
    const safaNama = nama.trim().substring(0, 100);
    if (safaNama.length < 2)
      return res.status(400).json({ success: false, pesan: 'Nama minimal 2 karakter.' });

    // Validasi password kuat
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ success: false, pesan: pwError });

    // Cek email sudah ada
    const { data: existing } = await supabase
      .from('users').select('id').eq('email', normalEmail).single();
    if (existing)
      return res.status(409).json({ success: false, pesan: 'Email sudah terdaftar.' });

    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const avatar = role === 'guru' ? '👩‍🏫' : '🦁';

    const { error } = await supabase.from('users').insert({
      id, nama: safaNama, email: normalEmail, password: hashedPassword, role, avatar, kelas: kelas || null, xp: 0, level: 1
    });
    if (error) throw error;

    // Join kelas otomatis jika murid punya kode
    if (role === 'murid' && kode_kelas) {
      const { data: kelasData } = await supabase
        .from('kelas').select('id').eq('kode_akses', kode_kelas.toUpperCase()).single();
      if (kelasData) {
        await supabase.from('kelas_murid').insert({ kelas_id: kelasData.id, murid_id: id });
      }
    }

    // Notifikasi selamat datang
    await supabase.from('notifikasi').insert({
      id: uuidv4(), user_id: id,
      judul: '🎉 Selamat Datang!',
      pesan: `Halo ${safaNama}! Selamat bergabung di BelajarSeru. Semangat belajar ya!`
    });

    const token = jwt.sign({ id, nama: safaNama, email: normalEmail, role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success: true, pesan: 'Registrasi berhasil!', token, user: { id, nama: safaNama, email: normalEmail, role, avatar } });
  } catch (err) {
    console.error('[register]', err.message);
    res.status(500).json({ success: false, pesan: 'Registrasi gagal. Silakan coba lagi.' });
  }
});

// =============================================
//  POST /api/auth/login
// =============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, pesan: 'Email dan password wajib diisi.' });

    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    if (!validator.isEmail(normalEmail))
      return res.status(400).json({ success: false, pesan: 'Format email tidak valid.' });

    const { data: user } = await supabase
      .from('users').select('*').eq('email', normalEmail).single();
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ success: false, pesan: 'Email atau password salah.' });

    const token = jwt.sign(
      { id: user.id, nama: user.nama, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({
      success: true,
      pesan: `Selamat datang kembali, ${user.nama}!`,
      token,
      user: { id: user.id, nama: user.nama, email: user.email, role: user.role, avatar: user.avatar, kelas: user.kelas, xp: user.xp, level: user.level }
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ success: false, pesan: 'Login gagal. Silakan coba lagi.' });
  }
});

// =============================================
//  GET /api/auth/profile
// =============================================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, nama, email, role, avatar, kelas, xp, level, created_at')
      .eq('id', req.user.id).single();

    if (!user) return res.status(404).json({ success: false, pesan: 'User tidak ditemukan.' });

    let rank = null;
    if (user.role === 'murid') {
      const { count } = await supabase
        .from('users').select('id', { count: 'exact', head: true })
        .eq('role', 'murid').gt('xp', user.xp);
      rank = (count || 0) + 1;
    }
    res.json({ success: true, data: { ...user, rank } });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =============================================
//  PUT /api/auth/profile
// =============================================
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { nama, avatar, password_baru, password_lama } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ success: false, pesan: 'User tidak ditemukan.' });

    const updates = {};
    if (nama) updates.nama = nama;
    if (avatar) updates.avatar = avatar;

    if (password_baru) {
      if (!password_lama)
        return res.status(400).json({ success: false, pesan: 'Password lama wajib diisi.' });
      if (!bcrypt.compareSync(password_lama, user.password))
        return res.status(401).json({ success: false, pesan: 'Password lama tidak sesuai.' });
      const pwError = validatePassword(password_baru);
      if (pwError) return res.status(400).json({ success: false, pesan: pwError });
      updates.password = bcrypt.hashSync(password_baru, 10);
    }

    await supabase.from('users').update(updates).eq('id', req.user.id);
    res.json({ success: true, pesan: 'Profil berhasil diperbarui.' });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;
