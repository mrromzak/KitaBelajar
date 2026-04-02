const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const supabase = require('../supabase');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// ── Generic email sender: Resend (prioritas) atau nodemailer ──
async function sendEmail({ to, subject, html }) {
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM || 'KitaBelajar <onboarding@resend.dev>';
    await resend.emails.send({ from, to, subject, html });
    return;
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] Tidak ada RESEND_API_KEY atau SMTP config — email tidak dikirim.');
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000, greetingTimeout: 5000, socketTimeout: 10000
  });
  await transporter.sendMail({ from: `"KitaBelajar" <${process.env.SMTP_USER}>`, to, subject, html });
}

function sendResetEmail({ to, nama, resetUrl }) {
  return sendEmail({
    to, subject: '🔐 Reset Password KitaBelajar',
    html: `<div style="font-family:Nunito,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#FF6B35">Reset Password KitaBelajar</h2>
      <p>Halo <b>${nama}</b>! Klik tombol di bawah untuk reset password kamu.</p>
      <a href="${resetUrl}" style="display:inline-block;background:#FF6B35;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:700;margin:16px 0">🔐 Reset Password</a>
      <p style="color:#888;font-size:13px">Link ini berlaku 1 jam. Abaikan jika kamu tidak meminta reset.</p>
    </div>`
  });
}

// ── OTP store sementara (in-memory, expired otomatis) ──────────
const otpStore = new Map(); // email → { otp, data, expiresAt }

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digit
}

function sendOTPEmail({ to, nama, otp }) {
  return sendEmail({
    to, subject: '🔑 Kode Verifikasi KitaBelajar',
    html: `<div style="font-family:Nunito,sans-serif;max-width:480px;margin:auto;text-align:center">
      <h2 style="color:#FF6B35">Verifikasi Email KitaBelajar</h2>
      <p>Halo <b>${nama}</b>! Kode OTP kamu adalah:</p>
      <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#FF6B35;margin:24px 0;padding:16px;background:#fff5f0;border-radius:16px">${otp}</div>
      <p style="color:#888;font-size:13px">Kode berlaku 10 menit. Jangan berikan ke siapa pun.</p>
    </div>`
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
//  POST /api/auth/send-otp  (langkah 1 registrasi)
// =============================================
router.post('/send-otp', async (req, res) => {
  try {
    const { nama, email, password, role, kelas, kode_kelas } = req.body;

    if (!nama || !email || !password || !role)
      return res.status(400).json({ success: false, pesan: 'Nama, email, password, dan role wajib diisi.' });
    if (!['guru', 'murid'].includes(role))
      return res.status(400).json({ success: false, pesan: 'Role harus "guru" atau "murid".' });

    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    if (!validator.isEmail(normalEmail))
      return res.status(400).json({ success: false, pesan: 'Format email tidak valid.' });

    const safaNama = nama.trim().substring(0, 100);
    if (safaNama.length < 2)
      return res.status(400).json({ success: false, pesan: 'Nama minimal 2 karakter.' });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ success: false, pesan: pwError });

    const { data: existing } = await supabase.from('users').select('id').eq('email', normalEmail).single();
    if (existing)
      return res.status(409).json({ success: false, pesan: 'Email sudah terdaftar.' });

    // Generate OTP
    const otp = generateOTP();

    // Kirim email dulu — kalau gagal langsung return error ke user
    try {
      await sendOTPEmail({ to: normalEmail, nama: safaNama, otp });
    } catch (mailErr) {
      console.error('[send-otp] email gagal:', mailErr.message);
      return res.status(500).json({ success: false, pesan: 'Gagal mengirim email OTP. Pastikan email benar atau coba beberapa saat lagi.' });
    }

    // Simpan OTP hanya setelah email berhasil terkirim
    otpStore.set(normalEmail, {
      otp,
      data: { nama: safaNama, email: normalEmail, password, role, kelas: kelas || null, kode_kelas: kode_kelas || null },
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 menit
    });

    res.json({ success: true, pesan: 'Kode OTP dikirim ke email kamu.' });
  } catch (err) {
    console.error('[send-otp]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal mengirim OTP. Coba lagi.' });
  }
});

// =============================================
//  POST /api/auth/register  (langkah 2: verifikasi OTP)
// =============================================
router.post('/register', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp)
      return res.status(400).json({ success: false, pesan: 'Email dan kode OTP wajib diisi.' });

    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    const entry = otpStore.get(normalEmail);

    if (!entry)
      return res.status(400).json({ success: false, pesan: 'Kode OTP tidak ditemukan. Minta ulang kode.' });
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalEmail);
      return res.status(400).json({ success: false, pesan: 'Kode OTP sudah kedaluwarsa. Minta ulang kode.' });
    }
    if (entry.otp !== String(otp).trim())
      return res.status(400).json({ success: false, pesan: 'Kode OTP salah.' });

    otpStore.delete(normalEmail); // hapus setelah dipakai

    const { nama: safaNama, password, role, kelas, kode_kelas } = entry.data;

    // Cek sekali lagi email belum ada (race condition)
    const { data: existing } = await supabase.from('users').select('id').eq('email', normalEmail).single();
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

    try {
      await sendResetEmail({ to: normalEmail, nama: user.nama, resetUrl });
    } catch (mailErr) {
      console.error('[forgot-password] email gagal:', mailErr.message);
      return res.status(500).json({ success: false, pesan: 'Gagal mengirim email reset. Pastikan konfigurasi email sudah benar.' });
    }

    res.json({ success: true, pesan: 'Link reset dikirim! Cek email kamu.', ...(process.env.NODE_ENV !== 'production' && { reset_url: resetUrl }) });
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
