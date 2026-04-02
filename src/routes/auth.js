const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// ── Email transporter (opsional, butuh SMTP_* di .env) ──────
function getMailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 10000
  });
}

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

// =============================================
//  POST /api/auth/forgot-password
// =============================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, pesan: 'Email wajib diisi.' });
    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();

    const { data: user } = await supabase.from('users').select('id, nama').eq('email', normalEmail).single();
    // Selalu return sukses agar tidak bocor info user terdaftar atau tidak
    if (!user) return res.json({ success: true, pesan: 'Jika email terdaftar, link reset akan dikirim.' });

    // Generate token reset 1 jam
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 3600000).toISOString();
    const { error: updateErr } = await supabase.from('users').update({ reset_token: resetToken, reset_token_expiry: resetExpiry }).eq('id', user.id);
    if (updateErr) {
      console.error('[forgot-password] update token gagal — kolom reset_token mungkin belum ada di Supabase:', updateErr.message);
      return res.status(500).json({ success: false, pesan: 'Fitur reset sandi belum dikonfigurasi. Hubungi admin.' });
    }

    const resetUrl = `${process.env.APP_URL || 'https://kitabelajar.up.railway.app'}/?reset_token=${resetToken}`;
    const mailer = getMailer();

    if (mailer) {
      // Jangan blok response — kirim email di background, timeout 10 detik
      mailer.sendMail({
        from: `"KitaBelajar" <${process.env.SMTP_USER}>`,
        to: normalEmail,
        subject: '🔐 Reset Password KitaBelajar',
        html: `<div style="font-family:Nunito,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#FF6B35">Reset Password KitaBelajar</h2>
          <p>Halo <b>${user.nama}</b>! Klik tombol di bawah untuk reset password kamu.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#FF6B35;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin:16px 0">🔐 Reset Password</a>
          <p style="color:#888;font-size:13px">Link ini berlaku 1 jam. Abaikan jika kamu tidak meminta reset.</p>
        </div>`
      }).catch(e => console.error('[forgot-password] email gagal:', e.message));
    }

    res.json({ success: true, pesan: 'Jika email terdaftar, link reset akan dikirim.', ...(process.env.NODE_ENV !== 'production' && { reset_url: resetUrl }) });
  } catch (err) {
    console.error('[forgot-password]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal memproses permintaan.' });
  }
});

// =============================================
//  POST /api/auth/reset-password
// =============================================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password_baru } = req.body;
    if (!token || !password_baru) return res.status(400).json({ success: false, pesan: 'Token dan password baru wajib diisi.' });

    const pwError = validatePassword(password_baru);
    if (pwError) return res.status(400).json({ success: false, pesan: pwError });

    const { data: user } = await supabase.from('users')
      .select('id, reset_token_expiry').eq('reset_token', token).single();

    if (!user) return res.status(400).json({ success: false, pesan: 'Token tidak valid atau sudah digunakan.' });
    if (new Date(user.reset_token_expiry) < new Date()) return res.status(400).json({ success: false, pesan: 'Token sudah kedaluwarsa. Minta reset ulang.' });

    const hashedPassword = bcrypt.hashSync(password_baru, 10);
    await supabase.from('users').update({ password: hashedPassword, reset_token: null, reset_token_expiry: null }).eq('id', user.id);

    res.json({ success: true, pesan: 'Password berhasil direset! Silakan login.' });
  } catch (err) {
    console.error('[reset-password]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal reset password.' });
  }
});

// =============================================
//  POST /api/auth/google — Login/Register via Google OAuth
// =============================================
router.post('/google', async (req, res) => {
  try {
    const { google_token, role } = req.body;
    if (!google_token) return res.status(400).json({ success: false, pesan: 'Google token wajib diisi.' });

    // Verifikasi token ke Google
    const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${google_token}`);
    const gData = await gRes.json();

    if (!gRes.ok || !gData.email) return res.status(401).json({ success: false, pesan: 'Token Google tidak valid.' });
    if (process.env.GOOGLE_CLIENT_ID && gData.aud !== process.env.GOOGLE_CLIENT_ID)
      return res.status(401).json({ success: false, pesan: 'Token Google tidak valid.' });

    const normalEmail = gData.email.toLowerCase().trim();
    let { data: user } = await supabase.from('users').select('*').eq('email', normalEmail).single();

    if (!user) {
      // Jika role belum dipilih, minta frontend pilih dulu
      if (!role || !['guru', 'murid'].includes(role)) {
        return res.json({
          success: true,
          is_new: true,
          google_token: req.body.google_token,
          nama: gData.name || gData.email.split('@')[0],
          email: normalEmail
        });
      }

      // Buat akun baru dengan role yang dipilih
      const id = uuidv4();
      const safaNama = (gData.name || gData.email.split('@')[0]).trim().substring(0, 100);
      const avatar = role === 'guru' ? '👩‍🏫' : '🦁';
      const { error } = await supabase.from('users').insert({
        id, nama: safaNama, email: normalEmail, password: bcrypt.hashSync(id, 10), role, avatar, xp: 0, level: 1
      });
      if (error) throw error;

      await supabase.from('notifikasi').insert({
        id: uuidv4(), user_id: id,
        judul: '🎉 Selamat Datang!',
        pesan: `Halo ${safaNama}! Selamat bergabung di KitaBelajar. Semangat belajar ya!`
      });

      const jwtToken = jwt.sign({ id, nama: safaNama, email: normalEmail, role }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({ success: true, pesan: `Selamat datang, ${safaNama}!`, token: jwtToken, user: { id, nama: safaNama, email: normalEmail, role, avatar, xp: 0, level: 1 } });
    }

    const jwtToken = jwt.sign({ id: user.id, nama: user.nama, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, is_new: false, pesan: `Selamat datang, ${user.nama}!`, token: jwtToken, user: { id: user.id, nama: user.nama, email: user.email, role: user.role, avatar: user.avatar, xp: user.xp, level: user.level } });
  } catch (err) {
    console.error('[google-auth]', err.message);
    res.status(500).json({ success: false, pesan: 'Login Google gagal.' });
  }
});

module.exports = router;
