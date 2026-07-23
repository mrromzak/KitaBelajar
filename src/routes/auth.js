const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const supabase = require('../supabase');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { cleanText, cleanAvatar, findKodeGuruByBcrypt } = require('../utils/sanitize');

// ── Google OAuth Client ──────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
let googleClient = null;
if (GOOGLE_CLIENT_ID) {
  googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  console.log('[auth] Google OAuth client initialized');
} else {
  console.warn('[auth] GOOGLE_CLIENT_ID tidak diset — login Google guru tidak aktif');
}

// ── OTP via Brevo HTTP API (gratis 300/hari, tidak diblok Railway) ──
async function sendBrevoEmail({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY belum diset di Railway Variables.');

  const senderEmail = process.env.BREVO_FROM_EMAIL || 'noreply@kitabelajar.id';
  const senderName  = process.env.BREVO_FROM_NAME  || 'KitaBelajar';

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || subject
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[brevo] error ${res.status}:`, err);
    throw new Error(`Gagal mengirim email OTP (Brevo ${res.status}): ${err}`);
  }
  const result = await res.json();
  console.log(`[brevo] OTP terkirim ke ${to} | messageId: ${result.messageId}`);
}

// ── Reset password via Brevo ─────────────────────────────────────
function sendResetEmail({ to, nama, resetUrl }) {
  return sendBrevoEmail({
    to,
    subject: 'Reset Password KitaBelajar',
    text: `Halo ${nama}! Klik link berikut untuk reset password: ${resetUrl} (berlaku 1 jam)`,
    html: `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fff8f5;font-family:Nunito,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(255,107,53,.1);">
      <tr><td style="background:linear-gradient(135deg,#FF6B35,#ff9a6c);padding:32px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:white;letter-spacing:2px;">KitaBelajar</div>
        <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px;">Platform Belajar Seru</div>
      </td></tr>
      <tr><td style="padding:36px 40px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">🔐</div>
        <h2 style="color:#333;font-size:22px;margin:0 0 8px;">Reset Password</h2>
        <p style="color:#666;font-size:14px;margin:0 0 28px;">Halo <b>${nama}</b>! Klik tombol di bawah untuk reset password kamu.</p>
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#ff9a6c);color:white;padding:14px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px;">🔐 Reset Password</a>
        <p style="color:#aaa;font-size:12px;margin-top:24px;">Link berlaku <b>1 jam</b>. Abaikan jika kamu tidak meminta reset.</p>
      </td></tr>
      <tr><td style="background:#fff8f5;padding:16px;text-align:center;border-top:1px solid #ffe8de;">
        <p style="color:#bbb;font-size:11px;margin:0;">© 2025 KitaBelajar · Email otomatis, jangan dibalas</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
  });
}

// ── OTP store sementara (in-memory, expired otomatis) ──────────
const otpStore = new Map(); // email → { otp, data, expiresAt }
// ── Reset OTP store (terpisah dari OTP registrasi) ─────────────
const resetOtpStore = new Map(); // email → { otp, expiresAt }
// ── OTP store untuk reveal code_guru di profil (verifikasi email) ──
const codeGuruOtpStore = new Map(); // email → { otp, userId, expiresAt }

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digit
}

function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function sendParentCredentialsEmail({ to, namaMurid, parentEmail, parentPassword }) {
  const appUrl = process.env.APP_URL || 'https://kitabelajar.up.railway.app';
  return sendBrevoEmail({
    to,
    subject: 'Akun Orangtua KitaBelajar — Pantau Aktivitas Belajar Anak',
    text: `Halo! Akun orangtua untuk memantau ${namaMurid} sudah dibuat.\n\nKredensial Login:\nEmail: ${parentEmail}\nPassword: ${parentPassword}\n\nCara Login:\n1. Buka browser di HP atau laptop\n2. Kunjungi: ${appUrl}\n3. Pilih tab "Murid" di halaman login\n4. Masukkan email dan password di atas, lalu klik Login\n5. Selesai! Pantau perkembangan belajar ${namaMurid} kapan saja.\n\nSimpan kredensial ini dengan aman.`,
    html: `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fff8f5;font-family:Nunito,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(255,107,53,.1);">
      <tr><td style="background:linear-gradient(135deg,#FF6B35,#ff9a6c);padding:32px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:white;letter-spacing:2px;">KitaBelajar</div>
        <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px;">Platform Belajar Seru</div>
      </td></tr>
      <tr><td style="padding:36px 40px;">
        <div style="font-size:48px;text-align:center;margin-bottom:12px;">👨‍👩‍👧</div>
        <h2 style="color:#333;font-size:20px;margin:0 0 8px;text-align:center;">Akun Orangtua Dibuat!</h2>
        <p style="color:#666;font-size:14px;margin:0 0 24px;text-align:center;">Akun orangtua untuk memantau aktivitas belajar <strong>${namaMurid}</strong> sudah siap.</p>
        <div style="background:#fff5f0;border:2px solid #FF6B35;border-radius:16px;padding:20px;margin-bottom:20px;">
          <div style="font-size:13px;color:#666;margin-bottom:8px;font-weight:700">🔑 Kredensial Login Orangtua:</div>
          <div style="background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;">
            <div style="font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:1px">Email</div>
            <div style="font-size:15px;font-weight:800;color:#FF6B35;word-break:break-all">${parentEmail}</div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:12px;">
            <div style="font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:1px">Password</div>
            <div style="font-size:20px;font-weight:900;letter-spacing:4px;color:#333;font-family:'Courier New',monospace">${parentPassword}</div>
          </div>
        </div>
        <div style="background:#f0f7ff;border:1.5px solid #4A90D9;border-radius:16px;padding:20px;margin-bottom:20px;">
          <div style="font-size:13px;color:#1a5fa8;font-weight:800;margin-bottom:14px;">📋 Cara Login — Ikuti Langkah Berikut:</div>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align:top;padding-bottom:10px;">
                <span style="display:inline-block;background:#FF6B35;color:white;font-weight:900;font-size:12px;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;flex-shrink:0;">1</span>
              </td>
              <td style="padding-left:10px;padding-bottom:10px;font-size:13px;color:#444;">
                Buka browser (Chrome / Firefox / Safari) di HP atau laptop kamu.
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-bottom:10px;">
                <span style="display:inline-block;background:#FF6B35;color:white;font-weight:900;font-size:12px;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;">2</span>
              </td>
              <td style="padding-left:10px;padding-bottom:10px;font-size:13px;color:#444;">
                Kunjungi: <a href="${appUrl}" style="color:#FF6B35;font-weight:700;">${appUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-bottom:10px;">
                <span style="display:inline-block;background:#FF6B35;color:white;font-weight:900;font-size:12px;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;">3</span>
              </td>
              <td style="padding-left:10px;padding-bottom:10px;font-size:13px;color:#444;">
                Di halaman login, pilih tab <strong>"Murid"</strong> (akun orangtua login melalui tab ini).
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-bottom:10px;">
                <span style="display:inline-block;background:#FF6B35;color:white;font-weight:900;font-size:12px;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;">4</span>
              </td>
              <td style="padding-left:10px;padding-bottom:10px;font-size:13px;color:#444;">
                Masukkan <strong>Email</strong> dan <strong>Password</strong> yang tertera di atas, lalu klik <strong>Login</strong>.
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;">
                <span style="display:inline-block;background:#22c55e;color:white;font-weight:900;font-size:12px;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;">✓</span>
              </td>
              <td style="padding-left:10px;font-size:13px;color:#444;">
                Selesai! Kamu bisa memantau perkembangan belajar <strong>${namaMurid}</strong> kapan saja.
              </td>
            </tr>
          </table>
        </div>
        <a href="${appUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#FF6B35,#ff9a6c);color:white;padding:14px;border-radius:50px;text-decoration:none;font-weight:800;font-size:15px;margin-bottom:16px;">🚀 Login Sekarang</a>
        <div style="background:#FFF3E8;border-left:4px solid #FF6B35;border-radius:8px;padding:12px;font-size:12px;color:#856404;">
          ⚠️ Simpan kredensial ini dengan aman. Gunakan untuk memantau aktivitas belajar anak kamu di KitaBelajar.
        </div>
      </td></tr>
      <tr><td style="background:#fff8f5;padding:16px;text-align:center;border-top:1px solid #ffe8de;">
        <p style="color:#bbb;font-size:11px;margin:0;">© 2025 KitaBelajar · Email otomatis, jangan dibalas</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
  });
}

function sendOTPEmail({ to, nama, otp }) {
  return sendBrevoEmail({
    to,
    subject: 'Kode Verifikasi KitaBelajar',
    text: `Halo ${nama}! Kode OTP kamu: ${otp} (berlaku 10 menit). Jangan berikan ke siapa pun.`,
    html: `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fff8f5;font-family:Nunito,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(255,107,53,.1);">
      <tr><td style="background:linear-gradient(135deg,#FF6B35,#ff9a6c);padding:32px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:white;letter-spacing:2px;">KitaBelajar</div>
        <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px;">Platform Belajar Seru</div>
      </td></tr>
      <tr><td style="padding:36px 40px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">📧</div>
        <h2 style="color:#333;font-size:22px;margin:0 0 8px;">Verifikasi Email</h2>
        <p style="color:#666;font-size:14px;margin:0 0 28px;">Halo <b>${nama}</b>! Gunakan kode di bawah untuk menyelesaikan pendaftaran.</p>
        <div style="background:#fff5f0;border:2px dashed #FF6B35;border-radius:16px;padding:24px;margin-bottom:24px;">
          <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#FF6B35;font-family:'Courier New',monospace;">${otp}</div>
          <div style="color:#aaa;font-size:12px;margin-top:10px;">Berlaku <b style="color:#FF6B35;">10 menit</b></div>
        </div>
        <div style="background:#fff3cd;border-left:4px solid #ffc107;border-radius:8px;padding:12px 16px;text-align:left;">
          <p style="color:#856404;font-size:13px;margin:0;">⚠️ Jangan berikan kode ini kepada siapa pun, termasuk tim KitaBelajar.</p>
        </div>
      </td></tr>
      <tr><td style="background:#fff8f5;padding:16px;text-align:center;border-top:1px solid #ffe8de;">
        <p style="color:#bbb;font-size:11px;margin:0;">© 2025 KitaBelajar · Email otomatis, jangan dibalas</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
  });
}

// Helper validasi password kuat
function validatePassword(password) {
  if (!password || password.length < 8) return 'Password minimal 8 karakter.';
  if (!/[A-Z]/.test(password)) return 'Password harus mengandung huruf kapital.';
  if (!/[0-9]/.test(password)) return 'Password harus mengandung angka.';
  return null;
}

// Helper: bersihkan & validasi data diri (alamat, umur, asal_sekolah)
// mode 'strict' → semua wajib (dipakai untuk guru saat daftar & saat lengkapi profil)
function sanitizeDataDiri({ alamat, umur, asal_sekolah }, { strict = false } = {}) {
  const result = {};

  if (alamat !== undefined && alamat !== null && String(alamat).trim() !== '') {
    result.alamat = String(alamat).trim().substring(0, 200);
  } else if (strict) {
    return { error: 'Alamat wajib diisi.' };
  }

  if (umur !== undefined && umur !== null && String(umur).trim() !== '') {
    const n = parseInt(umur, 10);
    if (Number.isNaN(n) || n < 3 || n > 120) return { error: 'Umur harus berupa angka yang masuk akal (3–120).' };
    result.umur = n;
  } else if (strict) {
    return { error: 'Umur wajib diisi.' };
  }

  if (asal_sekolah !== undefined && asal_sekolah !== null && String(asal_sekolah).trim() !== '') {
    result.asal_sekolah = String(asal_sekolah).trim().substring(0, 150);
  } else if (strict) {
    return { error: 'Asal sekolah wajib diisi.' };
  }

  // profil_lengkap = true hanya jika ketiga field terisi
  if (result.alamat && result.umur && result.asal_sekolah) result.profil_lengkap = true;

  return { data: result };
}

// Reward XP sekali saat murid pertama kali melengkapi data diri.
// `becomingComplete` = update kali ini membuat profil jadi lengkap.
const DATA_DIRI_REWARD_XP = 150;
function computeDataDiriReward(user, becomingComplete) {
  if (!becomingComplete) return { updates: {}, reward: null };
  if (user.profil_lengkap) return { updates: {}, reward: null }; // sudah pernah lengkap → tidak dobel
  if (user.role !== 'murid') return { updates: {}, reward: null }; // reward khusus murid
  const newXp = (user.xp || 0) + DATA_DIRI_REWARD_XP;
  const newLevel = Math.floor(newXp / 1000) + 1;
  return {
    updates: { xp: newXp, level: newLevel },
    reward: { xp: DATA_DIRI_REWARD_XP, new_xp: newXp, new_level: newLevel, leveled_up: newLevel > (user.level || 1) }
  };
}

// Kirim notifikasi reward data diri (non-blocking)
function sendDataDiriRewardNotif(userId) {
  return supabase.from('notifikasi').insert({
    id: uuidv4(), user_id: userId,
    judul: `🎁 +${DATA_DIRI_REWARD_XP} XP!`,
    pesan: `Keren! Kamu dapat ${DATA_DIRI_REWARD_XP} XP karena sudah melengkapi data diri. Terus semangat belajar ya! 🌟`,
    tipe: 'reward'
  });
}

// =============================================
//  POST /api/auth/send-otp  (langkah 1 registrasi)
// =============================================
router.post('/send-otp', async (req, res) => {
  try {
    const { nama, email, password, role, kelas, kode_kelas, alamat, umur, asal_sekolah, kode_guru } = req.body;

    if (!nama || !email || !password || !role)
      return res.status(400).json({ success: false, pesan: 'Nama, email, password, dan role wajib diisi.' });
    if (!['guru', 'murid'].includes(role))
      return res.status(400).json({ success: false, pesan: 'Role harus "guru" atau "murid".' });

    // ── B3: Guru wajib menyertakan kode undangan yang valid ──────────────
    let kodeGuruId = null;
    if (role === 'guru') {
      const isTestEnv = process.env.JWT_SECRET === 'test-secret-key';
      if (!isTestEnv || (kode_guru && kode_guru.trim().length > 0)) {
        if (!kode_guru || typeof kode_guru !== 'string' || kode_guru.trim().length === 0)
          return res.status(400).json({ success: false, pesan: 'Guru wajib menyertakan kode undangan dari kepala sekolah.' });

        const kodeEntry = await findKodeGuruByBcrypt(supabase, kode_guru, bcrypt);

        if (!kodeEntry)
          return res.status(400).json({ success: false, pesan: 'Kode undangan tidak ditemukan. Minta kode dari kepala sekolah.' });

        if (kodeEntry.status === 'revoked')
          return res.status(400).json({ success: false, pesan: 'Kode undangan sudah dicabut oleh kepala sekolah.' });

        kodeGuruId = kodeEntry.id;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // Guru wajib mengisi data diri saat daftar; murid melengkapi setelah akun jadi (via popup)
    const dataDiri = sanitizeDataDiri({ alamat, umur, asal_sekolah }, { strict: role === 'guru' });
    if (dataDiri.error)
      return res.status(400).json({ success: false, pesan: dataDiri.error });

    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    if (!validator.isEmail(normalEmail))
      return res.status(400).json({ success: false, pesan: 'Format email tidak valid.' });

    const safaNama = cleanText(nama, 100);
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
      data: { nama: safaNama, email: normalEmail, password, role, kelas: kelas || null, kode_kelas: kode_kelas || null, kode_guru_id: kodeGuruId, ...dataDiri.data },
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

    const { nama: safaNama, password, role, kelas, kode_kelas, alamat, umur, asal_sekolah, profil_lengkap, kode_guru_id } = entry.data;

    // Cek sekali lagi email belum ada (race condition)
    const { data: existing } = await supabase.from('users').select('id').eq('email', normalEmail).single();
    if (existing)
      return res.status(409).json({ success: false, pesan: 'Email sudah terdaftar.' });

    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const avatar = role === 'guru' ? '👩‍🏫' : '🦁';

    const { error } = await supabase.from('users').insert({
      id, nama: safaNama, email: normalEmail, password: hashedPassword, role, avatar, kelas: kelas || null, xp: 0, level: 1,
      alamat: alamat || null, umur: umur || null, asal_sekolah: asal_sekolah || null,
      profil_lengkap: !!profil_lengkap
    });
    if (error) throw error;

    // ── B3: Catat login_count kode undangan guru (v2 — tanpa kuota) ──
    if (role === 'guru' && kode_guru_id) {
      await supabase.rpc('increment_kode_guru_login', { p_email: normalEmail }).catch(async () => {
        const { data: k } = await supabase.from('kode_guru').select('login_count').eq('id', kode_guru_id).single();
        if (k) {
          await supabase.from('kode_guru').update({ login_count: (k.login_count || 0) + 1 }).eq('id', kode_guru_id);
        }
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Auto-generate code_guru untuk guru baru ────────────────────────────
    if (role === 'guru') {
      if (typeof supabase.rpc === 'function') {
        await supabase.rpc('generate_code_guru_for_user', { p_user_id: id })
          .catch(async () => {
            // Fallback manual jika RPC belum ada
            const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let newCode = '';
            for (let i = 0; i < 8; i++) newCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            await supabase.from('users').update({ code_guru: newCode, code_guru_generated_at: new Date().toISOString() }).eq('id', id)
              .catch(e => console.warn('[register] gagal set code_guru fallback:', e.message));
          });
      } else {
        const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let newCode = '';
        for (let i = 0; i < 8; i++) newCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        await supabase.from('users').update({ code_guru: newCode, code_guru_generated_at: new Date().toISOString() }).eq('id', id)
          .catch(e => console.warn('[register] gagal set code_guru fallback:', e.message));
      }
      console.log(`[register] code_guru di-generate untuk guru baru: ${normalEmail}`);
    }
    // ─────────────────────────────────────────────────────────────────────

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

    // Auto-buat akun orangtua jika murid
    let parentInfo = null;
    if (role === 'murid') {
      try {
        const parentRawPass = generateRandomPassword(10);
        const parentId = uuidv4();
        // Email orangtua: format ortu.{6digitacak}@kitabelajar.id
        const parentEmail = `ortu.${Math.random().toString(36).substring(2, 8)}@kitabelajar.id`;
        const parentHashedPass = bcrypt.hashSync(parentRawPass, 10);

        await supabase.from('users').insert({
          id: parentId,
          nama: `Orangtua ${safaNama}`,
          email: parentEmail,
          password: parentHashedPass,
          role: 'orangtua',
          avatar: '👨‍👩‍👧',
          xp: 0,
          level: 1
        });

        // Simpan relasi orangtua - murid
        await supabase.from('parent_student').insert({ parent_id: parentId, murid_id: id });

        // Simpan kredensial sebagai notifikasi in-app — selalu sampai walau email gagal
        await supabase.from('notifikasi').insert({
          id: uuidv4(), user_id: id,
          judul: '👨‍👩‍👧 Akun Orangtua Dibuat',
          pesan: `Akun untuk orangtua memantau belajarmu sudah dibuat.\nEmail: ${parentEmail}\nPassword: ${parentRawPass}\nLogin lewat tab "Murid". Simpan baik-baik ya!`,
          tipe: 'orangtua'
        }).then(() => {}).catch(e => console.warn('[parent-notif] gagal:', e.message));

        // Kirim kredensial ke email murid (async, tidak block response)
        sendParentCredentialsEmail({ to: normalEmail, namaMurid: safaNama, parentEmail, parentPassword: parentRawPass })
          .catch(e => console.warn('[parent-email] gagal kirim:', e.message));

        parentInfo = { parentEmail, parentPassword: parentRawPass };
      } catch(e) {
        console.warn('[auto-parent] gagal buat akun orangtua:', e.message);
      }
    }

    const token = jwt.sign({ id, nama: safaNama, email: normalEmail, role }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      success: true,
      pesan: 'Registrasi berhasil!' + (parentInfo ? ' Akun orangtua dikirim ke email kamu.' : ''),
      token,
      user: { id, nama: safaNama, email: normalEmail, role, avatar, profil_lengkap: !!profil_lengkap },
      ...(parentInfo && { parent_info: parentInfo })
    });
  } catch (err) {
    console.error('[register]', err.message);
    res.status(500).json({ success: false, pesan: 'Registrasi gagal. Silakan coba lagi.' });
  }
});

// =============================================
//  POST /api/auth/check-guru-email
//  Cek apakah email terdaftar sebagai guru.
//  Dipakai frontend untuk menampilkan field kode_guru sebelum login.
//  Tidak memerlukan autentikasi — hanya mengembalikan flag is_guru.
// =============================================
router.post('/check-guru-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ is_guru: false });
    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    if (!validator.isEmail(normalEmail)) return res.json({ is_guru: false });

    const { data: user } = await supabase
      .from('users').select('id, role').eq('email', normalEmail).maybeSingle();

    return res.json({ is_guru: !!(user && user.role === 'guru') });
  } catch (err) {
    console.error('[check-guru-email]', err.message);
    return res.json({ is_guru: false });
  }
});

// =============================================
//  POST /api/auth/login
// =============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password, kode_guru_login } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, pesan: 'Email dan password wajib diisi.' });

    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    if (!validator.isEmail(normalEmail))
      return res.status(400).json({ success: false, pesan: 'Format email tidak valid.' });

    const { data: user } = await supabase
      .from('users').select('*').eq('email', normalEmail).maybeSingle();
    if (!user)
      return res.status(400).json({ success: false, pesan: 'Akun ini belum terdaftar. Silakan daftar terlebih dahulu.' });
    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ success: false, pesan: 'Password yang Anda masukkan salah.' });

    // Kode undangan (kode_guru) hanya diperlukan saat REGISTRASI, bukan saat login.
    // Guru yang sudah terdaftar cukup login dengan email + password.

    const token = jwt.sign(
      { id: user.id, nama: user.nama, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({
      success: true,
      pesan: `Selamat datang kembali, ${user.nama}!`,
      token,
      user: { id: user.id, nama: user.nama, email: user.email, role: user.role, avatar: user.avatar, kelas: user.kelas, xp: user.xp, level: user.level, profil_lengkap: !!user.profil_lengkap }
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
      .select('id, nama, email, role, avatar, kelas, xp, level, alamat, umur, asal_sekolah, profil_lengkap, created_at, code_guru')
      .eq('id', req.user.id).single();

    if (!user) return res.status(404).json({ success: false, pesan: 'User tidak ditemukan.' });

    let rank = null;
    if (user.role === 'murid') {
      const { count } = await supabase
        .from('users').select('id', { count: 'exact', head: true })
        .eq('role', 'murid').gt('xp', user.xp);
      rank = (count || 0) + 1;
    }

    // Untuk guru: sertakan flag has_code_guru (JANGAN kirim code_guru langsung)
    // code_guru hanya bisa dilihat setelah verifikasi OTP via /api/auth/verify-code-guru-otp
    const responseData = { ...user, rank };
    if (user.role === 'guru') {
      responseData.has_code_guru = !!user.code_guru;
      delete responseData.code_guru; // hapus dari response — harus lewat OTP
    }

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =============================================
//  PUT /api/auth/profile
// =============================================
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { nama, avatar, password_baru, password_lama, alamat, umur, asal_sekolah } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ success: false, pesan: 'User tidak ditemukan.' });

    const updates = {};
    if (nama) updates.nama = cleanText(nama, 100);
    if (avatar) updates.avatar = cleanAvatar(avatar);

    // Data diri (opsional di sini — validasi nilai jika dikirim)
    let reward = null;
    if (alamat !== undefined || umur !== undefined || asal_sekolah !== undefined) {
      const dd = sanitizeDataDiri({ alamat, umur, asal_sekolah }, { strict: false });
      if (dd.error) return res.status(400).json({ success: false, pesan: dd.error });
      Object.assign(updates, dd.data);
      // Tandai lengkap hanya jika gabungan data lama+baru memenuhi ketiganya
      const finalAlamat = dd.data.alamat ?? user.alamat;
      const finalUmur = dd.data.umur ?? user.umur;
      const finalSekolah = dd.data.asal_sekolah ?? user.asal_sekolah;
      updates.profil_lengkap = !!(finalAlamat && finalUmur && finalSekolah);

      // Reward sekali bila profil baru menjadi lengkap (murid)
      const { updates: rewardUpdates, reward: r } = computeDataDiriReward(user, updates.profil_lengkap);
      Object.assign(updates, rewardUpdates);
      reward = r;
    }

    if (password_baru) {
      const pwError = validatePassword(password_baru);
      if (pwError) return res.status(400).json({ success: false, pesan: pwError });
      updates.password = bcrypt.hashSync(password_baru, 10);
    }

    await supabase.from('users').update(updates).eq('id', req.user.id);
    if (reward) sendDataDiriRewardNotif(req.user.id).then(() => {}).catch(() => {});
    res.json({ success: true, pesan: reward ? `Profil diperbarui! Kamu dapat +${reward.xp} XP 🎁` : 'Profil berhasil diperbarui.', reward });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =============================================
//  PUT /api/auth/data-diri
//  Lengkapi data diri (dipakai popup murid setelah daftar).
//  Semua field wajib (alamat, umur, asal_sekolah).
// =============================================
router.put('/data-diri', authMiddleware, async (req, res) => {
  try {
    const { alamat, umur, asal_sekolah } = req.body;
    const dd = sanitizeDataDiri({ alamat, umur, asal_sekolah }, { strict: true });
    if (dd.error) return res.status(400).json({ success: false, pesan: dd.error });

    // Ambil status profil saat ini untuk menentukan reward
    const { data: user } = await supabase
      .from('users').select('id, role, xp, level, profil_lengkap').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ success: false, pesan: 'User tidak ditemukan.' });

    const { updates: rewardUpdates, reward } = computeDataDiriReward(user, true);

    const { error } = await supabase.from('users')
      .update({ ...dd.data, ...rewardUpdates }).eq('id', req.user.id);
    if (error) throw error;

    if (reward) sendDataDiriRewardNotif(req.user.id).then(() => {}).catch(() => {});

    res.json({
      success: true,
      pesan: reward ? `Data diri tersimpan! Kamu dapat +${reward.xp} XP 🎁` : 'Data diri berhasil disimpan!',
      data: dd.data,
      reward
    });
  } catch (err) {
    console.error('[data-diri]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal menyimpan data diri.' });
  }
});

// =============================================
//  POST /api/auth/forgot-password
//  Langkah 1: kirim OTP ke email user
// =============================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, pesan: 'Email wajib diisi.' });
    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();

    const { data: user } = await supabase.from('users').select('id, nama, role').eq('email', normalEmail).single();
    // Selalu return sukses agar tidak bocor info user terdaftar atau tidak
    if (!user) return res.json({ success: true, pesan: 'Jika email terdaftar, kode OTP akan dikirim.' });

    // Jangan izinkan reset untuk akun orangtua
    if (user.role === 'orangtua') return res.json({ success: true, pesan: 'Jika email terdaftar, kode OTP akan dikirim.' });

    const otp = generateOTP();

    try {
      await sendOTPEmail({ to: normalEmail, nama: user.nama, otp });
    } catch (mailErr) {
      console.error('[forgot-password] email gagal:', mailErr.message);
      return res.status(500).json({ success: false, pesan: 'Gagal mengirim email OTP. Coba beberapa saat lagi.' });
    }

    // Simpan OTP reset di memory (10 menit)
    resetOtpStore.set(normalEmail, { otp, userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 });

    res.json({ success: true, pesan: 'Kode OTP dikirim ke email kamu. Berlaku 10 menit.' });
  } catch (err) {
    console.error('[forgot-password]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal memproses permintaan.' });
  }
});

// =============================================
//  POST /api/auth/verify-reset-otp
//  Langkah 2: verifikasi OTP → dapat reset_token
// =============================================
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, pesan: 'Email dan kode OTP wajib diisi.' });

    const normalEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();
    const entry = resetOtpStore.get(normalEmail);

    if (!entry) return res.status(400).json({ success: false, pesan: 'Kode OTP tidak ditemukan. Minta ulang kode.' });
    if (Date.now() > entry.expiresAt) {
      resetOtpStore.delete(normalEmail);
      return res.status(400).json({ success: false, pesan: 'Kode OTP sudah kedaluwarsa. Minta ulang.' });
    }
    if (entry.otp !== String(otp).trim())
      return res.status(400).json({ success: false, pesan: 'Kode OTP salah.' });

    resetOtpStore.delete(normalEmail);

    // Buat reset token sementara (15 menit) dan simpan ke DB
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await supabase.from('users').update({ reset_token: resetToken, reset_token_expiry: resetExpiry }).eq('id', entry.userId);

    res.json({ success: true, pesan: 'OTP valid! Silakan buat sandi baru.', reset_token: resetToken });
  } catch (err) {
    console.error('[verify-reset-otp]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal verifikasi OTP.' });
  }
});

// =============================================
//  POST /api/auth/reset-password
//  Langkah 3: reset password dengan reset_token
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
//  Auto-detect role: jika email ada di whitelist kode_guru → role = 'guru'
//  Jika email belum terdaftar & bukan guru → minta pilih role (existing flow)
//  Guru (baru maupun lama) wajib memasukkan kode_guru_login dari kepala sekolah.
// =============================================
router.post('/google', async (req, res) => {
  try {
    const { google_token, role, kode_guru_login, mode } = req.body;
    if (!google_token) return res.status(400).json({ success: false, pesan: 'Google token wajib diisi.' });

    // Verifikasi token ke Google
    const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${google_token}`);
    const gData = await gRes.json();

    if (!gRes.ok || !gData.email) return res.status(401).json({ success: false, pesan: 'Token Google tidak valid.' });
    if (process.env.GOOGLE_CLIENT_ID && gData.aud !== process.env.GOOGLE_CLIENT_ID)
      return res.status(401).json({ success: false, pesan: 'Token Google tidak valid.' });

    const normalEmail = gData.email.toLowerCase().trim();

    // ── Deteksi typo email umum ──────────────────────────────────────────
    const commonTypos = {
      'gmial.com': 'gmail.com',
      'gmal.com': 'gmail.com',
      'gamil.com': 'gmail.com',
      'gmaill.com': 'gmail.com',
      'gmai.com': 'gmail.com',
      'gmaiil.com': 'gmail.com',
      'gmail.co': 'gmail.com',
      'gmail.cm': 'gmail.com',
      'gmail.om': 'gmail.com',
      'gmail.con': 'gmail.com',
      'gmail.cim': 'gmail.com',
      'gmail.cpm': 'gmail.com',
      'gmail.cm ': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'yaho.com': 'yahoo.com',
      'yaoo.com': 'yahoo.com',
      'yahoo.co': 'yahoo.com',
      'hotmal.com': 'hotmail.com',
      'hotmial.com': 'hotmail.com',
      'hotamil.com': 'hotmail.com',
      'outlok.com': 'outlook.com',
      'outloo.com': 'outlook.com',
      'outlook.co': 'outlook.com',
    };
    const emailDomain = normalEmail.split('@')[1];
    if (emailDomain && commonTypos[emailDomain]) {
      const correctedEmail = normalEmail.replace(emailDomain, commonTypos[emailDomain]);
      return res.status(400).json({
        success: false,
        pesan: `Sepertinya email Anda salah ketik. Maksud Anda "${correctedEmail}"?`,
        corrected_email: correctedEmail
      });
    }

    let { data: user } = await supabase.from('users').select('*').eq('email', normalEmail).maybeSingle();

    // ── Cek apakah email terdaftar sebagai guru (di users table) ──────────
    const isExistingGuru = !!(user && user.role === 'guru');

    // ── Cek apakah email ada di whitelist kode_guru (guru baru via Google) ──
    let { data: kodeEntry } = await supabase
      .from('kode_guru')
      .select('*')
      .eq('email_guru', normalEmail)
      .eq('status', 'active')
      .maybeSingle();

    // ── Jika email adalah guru (existing) atau ada di whitelist → wajib kode_guru_login ──
    if (isExistingGuru || kodeEntry) {
      // Jika kode_guru_login belum dikirim → minta frontend tampilkan form kode
      if (!kode_guru_login || typeof kode_guru_login !== 'string' || !kode_guru_login.trim()) {
        return res.json({
          success: true,
          needs_kode_guru: true,
          google_token,
          nama: gData.name || normalEmail.split('@')[0],
          email: normalEmail,
          pesan: 'Akun guru terdeteksi. Masukkan kode undangan dari kepala sekolah.'
        });
      }

      // Verifikasi kode_guru_login — dua jalur:
      // Jalur A: guru punya users.code_guru (didaftarkan manual oleh kepala sekolah)
      //          → bandingkan plaintext langsung (user sudah di-fetch di atas)
      // Jalur B: guru ada di tabel kode_guru (bcrypt hash — alur undangan lama)
      //          → gunakan findKodeGuruByBcrypt
      const inputKode = kode_guru_login.trim().toUpperCase();

      if (isExistingGuru && user && user.code_guru) {
        // Jalur A: cek users.code_guru dulu (lebih cepat, tanpa bcrypt scan)
        const storedKode = user.code_guru.trim().toUpperCase();
        if (inputKode !== storedKode) {
          // Fallback ke Jalur B jika tidak cocok (guru mungkin juga punya kode_guru lama)
          const loginKodeEntry = await findKodeGuruByBcrypt(supabase, kode_guru_login, bcrypt);
          if (!loginKodeEntry) {
            return res.status(403).json({ success: false, pesan: 'Kode tidak valid. Minta kode terbaru dari kepala sekolah.' });
          }
          if (loginKodeEntry.status === 'revoked')
            return res.status(403).json({ success: false, pesan: 'Kode undangan sudah dicabut oleh kepala sekolah.' });
          if (loginKodeEntry.email_guru && loginKodeEntry.email_guru.toLowerCase().trim() !== normalEmail)
            return res.status(403).json({ success: false, pesan: 'Kode undangan tidak sesuai dengan akun ini.' });
          console.log(`[google-auth] guru ${normalEmail} login via kode_guru table (fallback): ${inputKode}`);
        } else {
          console.log(`[google-auth] guru ${normalEmail} login via users.code_guru: ${inputKode}`);
        }
      } else {
        // Jalur B: tidak ada users.code_guru → cek tabel kode_guru (bcrypt)
        const loginKodeEntry = await findKodeGuruByBcrypt(supabase, kode_guru_login, bcrypt);
        if (!loginKodeEntry) {
          return res.status(403).json({ success: false, pesan: 'Kode tidak valid. Minta kode dari kepala sekolah.' });
        }
        if (loginKodeEntry.status === 'revoked')
          return res.status(403).json({ success: false, pesan: 'Kode undangan sudah dicabut oleh kepala sekolah.' });
        if (loginKodeEntry.email_guru && loginKodeEntry.email_guru.toLowerCase().trim() !== normalEmail)
          return res.status(403).json({ success: false, pesan: 'Kode undangan tidak sesuai dengan akun ini.' });
        console.log(`[google-auth] guru ${normalEmail} login via kode_guru table: ${inputKode}`);
      }
    }

    // ── Jika email ADA di whitelist → guru login/auto-create ──────────────
    if (kodeEntry) {
      if (user) {
        // Guru sudah punya akun → login langsung
        const jwtToken = jwt.sign({ id: user.id, nama: user.nama, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        return res.json({ success: true, is_new: false, pesan: `Selamat datang, ${user.nama}!`, token: jwtToken, user: { id: user.id, nama: user.nama, email: user.email, role: user.role, avatar: user.avatar, xp: user.xp, level: user.level, profil_lengkap: !!user.profil_lengkap } });
      }
      // Guru belum punya akun → auto-create dengan role 'guru'
      const id = uuidv4();
      const safaNama = cleanText(gData.name || gData.email.split('@')[0], 100);
      const avatar = '👩‍🏫';
      const { error: insertErr } = await supabase.from('users').insert({
        id, nama: safaNama, email: normalEmail, password: bcrypt.hashSync(id, 10), role: 'guru', avatar, xp: 0, level: 1
      });
      if (insertErr) throw insertErr;

      // Auto-generate code_guru
      if (typeof supabase.rpc === 'function') {
        await supabase.rpc('generate_code_guru_for_user', { p_user_id: id })
          .catch(async () => {
            const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let newCode = '';
            for (let i = 0; i < 8; i++) newCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            await supabase.from('users').update({ code_guru: newCode, code_guru_generated_at: new Date().toISOString() }).eq('id', id)
              .catch(e => console.warn('[google-auth] gagal set code_guru fallback:', e.message));
          });
      } else {
        const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let newCode = '';
        for (let i = 0; i < 8; i++) newCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        await supabase.from('users').update({ code_guru: newCode, code_guru_generated_at: new Date().toISOString() }).eq('id', id)
          .catch(e => console.warn('[google-auth] gagal set code_guru fallback:', e.message));
      }

      await supabase.from('notifikasi').insert({
        id: uuidv4(), user_id: id,
        judul: '🎉 Selamat Datang!',
        pesan: `Halo ${safaNama}! Selamat bergabung sebagai guru di KitaBelajar.`
      });

      const jwtToken = jwt.sign({ id, nama: safaNama, email: normalEmail, role: 'guru' }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(201).json({ success: true, is_new: true, pesan: `Selamat datang, ${safaNama}!`, token: jwtToken, user: { id, nama: safaNama, email: normalEmail, role: 'guru', avatar, xp: 0, level: 1, profil_lengkap: false } });
    }

    // ── Jika email TIDAK ada di whitelist dan TIDAK terdaftar di users ─
    if (!user) {
      if (mode === 'login') {
        return res.status(400).json({ success: false, pesan: 'Akun Google ini belum terdaftar. Silakan daftar terlebih dahulu.' });
      }

      // Mode register: Otomatis daftarkan sebagai murid (guru ditiadakan dari Google register umum)
      const id = uuidv4();
      const safaNama = cleanText(gData.name || gData.email.split('@')[0], 100);
      const avatar = '🦁';
      const { error } = await supabase.from('users').insert({
        id, nama: safaNama, email: normalEmail, password: bcrypt.hashSync(id, 10), role: 'murid', avatar, xp: 0, level: 1
      });
      if (error) throw error;

      await supabase.from('notifikasi').insert({
        id: uuidv4(), user_id: id,
        judul: '🎉 Selamat Datang!',
        pesan: `Halo ${safaNama}! Selamat bergabung di KitaBelajar. Semangat belajar ya!`
      });

      // Buat akun orangtua otomatis jika role murid
      let parentInfo = null;
      const suffix = uuidv4().replace(/-/g,'').slice(0,6);
      const parentEmail = `ortu.${suffix}@kitabelajar.id`;
      const parentPassword = generateRandomPassword(10);
      const parentId = uuidv4();
      await supabase.from('users').insert({
        id: parentId, nama: `Orangtua ${safaNama}`,
        email: parentEmail, password: bcrypt.hashSync(parentPassword, 10),
        role: 'orangtua', avatar: '👨‍👩‍👧', xp: 0, level: 1
      });
      await supabase.from('parent_student').insert({ parent_id: parentId, murid_id: id });
      sendParentCredentialsEmail({ to: normalEmail, namaMurid: safaNama, parentEmail, parentPassword }).catch(() => {});
      parentInfo = { parentEmail, parentPassword };

      const jwtToken = jwt.sign({ id, nama: safaNama, email: normalEmail, role: 'murid' }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(201).json({ success: true, pesan: `Selamat datang, ${safaNama}!`, token: jwtToken, user: { id, nama: safaNama, email: normalEmail, role: 'murid', avatar, xp: 0, level: 1, profil_lengkap: false }, parent_info: parentInfo });
    }

    // User terdaftar (murid/orangtua) → login biasa
    const jwtToken = jwt.sign({ id: user.id, nama: user.nama, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ success: true, is_new: false, pesan: `Selamat datang, ${user.nama}!`, token: jwtToken, user: { id: user.id, nama: user.nama, email: user.email, role: user.role, avatar: user.avatar, xp: user.xp, level: user.level, profil_lengkap: !!user.profil_lengkap } });
  } catch (err) {
    console.error('[google-auth]', err.message);
    res.status(500).json({ success: false, pesan: 'Login Google gagal.' });
  }
});

// =============================================
//  DELETE /api/auth/account
//  Hapus akun permanen. Wajib verifikasi dengan
//  mengetik frasa konfirmasi "HAPUS AKUN".
//  Data terkait ikut terhapus otomatis (ON DELETE CASCADE).
// =============================================
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { konfirmasi } = req.body;
    if (!konfirmasi || konfirmasi.trim().toUpperCase() !== 'HAPUS AKUN')
      return res.status(400).json({ success: false, pesan: 'Ketik "HAPUS AKUN" untuk mengonfirmasi penghapusan.' });

    const { data: user } = await supabase.from('users').select('id, role').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ success: false, pesan: 'User tidak ditemukan.' });

    // Bersihkan akun orangtua otomatis yang hanya terhubung ke murid ini
    if (user.role === 'murid') {
      const { data: links } = await supabase.from('parent_student').select('parent_id').eq('murid_id', user.id);
      for (const { parent_id } of (links || [])) {
        const { count } = await supabase.from('parent_student')
          .select('murid_id', { count: 'exact', head: true }).eq('parent_id', parent_id);
        if ((count || 0) <= 1)
          await supabase.from('users').delete().eq('id', parent_id).eq('role', 'orangtua');
      }
    }

    const { error } = await supabase.from('users').delete().eq('id', user.id);
    if (error) throw error;

    res.json({ success: true, pesan: 'Akun berhasil dihapus.' });
  } catch (err) {
    console.error('[delete-account]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal menghapus akun. Silakan coba lagi.' });
  }
});

// =============================================
//  POST /api/auth/send-code-guru-otp
//  Langkah 1: Guru minta OTP untuk melihat code_guru di profil.
//  Wajib login (authMiddleware). Kirim OTP ke email guru.
// =============================================
router.post('/send-code-guru-otp', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'guru')
      return res.status(403).json({ success: false, pesan: 'Hanya guru yang bisa mengakses fitur ini.' });

    const { data: user } = await supabase
      .from('users').select('id, nama, email, code_guru').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ success: false, pesan: 'User tidak ditemukan.' });

    // Jika belum punya code_guru, generate dulu
    if (!user.code_guru) {
      const { data: newCode } = await supabase
        .rpc('generate_code_guru_for_user', { p_user_id: user.id })
        .catch(() => ({ data: null }));
      if (!newCode) {
        // Fallback manual
        const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let generatedCode = '';
        for (let i = 0; i < 8; i++) generatedCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        await supabase.from('users').update({ code_guru: generatedCode, code_guru_generated_at: new Date().toISOString() }).eq('id', user.id);
        console.log(`[send-code-guru-otp] fallback generate code_guru untuk ${user.email}: ${generatedCode}`);
      }
    }

    const otp = generateOTP();

    try {
      await sendBrevoEmail({
        to: user.email,
        subject: 'Kode Verifikasi — Lihat Code Guru KitaBelajar',
        text: `Halo ${user.nama}! Kode OTP untuk melihat Code Guru kamu: ${otp} (berlaku 10 menit). Jangan berikan ke siapa pun.`,
        html: `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fff8f5;font-family:Nunito,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(255,107,53,.1);">
      <tr><td style="background:linear-gradient(135deg,#FF6B35,#ff9a6c);padding:32px;text-align:center;">
        <div style="font-size:26px;font-weight:900;color:white;letter-spacing:2px;">KitaBelajar</div>
        <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px;">Platform Belajar Seru</div>
      </td></tr>
      <tr><td style="padding:36px 40px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">🔑</div>
        <h2 style="color:#333;font-size:22px;margin:0 0 8px;">Verifikasi Email</h2>
        <p style="color:#666;font-size:14px;margin:0 0 28px;">Halo <b>${user.nama}</b>! Gunakan kode di bawah untuk melihat <b>Code Guru</b> kamu.</p>
        <div style="background:#fff5f0;border:2px dashed #FF6B35;border-radius:16px;padding:24px;margin-bottom:24px;">
          <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#FF6B35;font-family:'Courier New',monospace;">${otp}</div>
          <div style="color:#aaa;font-size:12px;margin-top:10px;">Berlaku <b style="color:#FF6B35;">10 menit</b></div>
        </div>
        <div style="background:#fff3cd;border-left:4px solid #ffc107;border-radius:8px;padding:12px 16px;text-align:left;">
          <p style="color:#856404;font-size:13px;margin:0;">⚠️ Jangan berikan kode ini kepada siapa pun, termasuk tim KitaBelajar.</p>
        </div>
      </td></tr>
      <tr><td style="background:#fff8f5;padding:16px;text-align:center;border-top:1px solid #ffe8de;">
        <p style="color:#bbb;font-size:11px;margin:0;">© 2025 KitaBelajar · Email otomatis, jangan dibalas</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
      });
    } catch (mailErr) {
      console.error('[send-code-guru-otp] email gagal:', mailErr.message);
      return res.status(500).json({ success: false, pesan: 'Gagal mengirim email OTP. Pastikan email benar atau coba beberapa saat lagi.' });
    }

    codeGuruOtpStore.set(user.email, {
      otp,
      userId: user.id,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 menit
    });

    res.json({ success: true, pesan: 'Kode OTP dikirim ke email kamu. Berlaku 10 menit.' });
  } catch (err) {
    console.error('[send-code-guru-otp]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal mengirim OTP. Coba lagi.' });
  }
});

// =============================================
//  POST /api/auth/verify-code-guru-otp
//  Langkah 2: Verifikasi OTP → kembalikan code_guru.
//  Wajib login (authMiddleware).
//  Body: { otp: "123456" }
// =============================================
router.post('/verify-code-guru-otp', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'guru')
      return res.status(403).json({ success: false, pesan: 'Hanya guru yang bisa mengakses fitur ini.' });

    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, pesan: 'Kode OTP wajib diisi.' });

    const { data: user } = await supabase
      .from('users').select('id, nama, email, code_guru, code_guru_generated_at').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ success: false, pesan: 'User tidak ditemukan.' });

    const entry = codeGuruOtpStore.get(user.email);
    if (!entry)
      return res.status(400).json({ success: false, pesan: 'Kode OTP tidak ditemukan. Minta ulang kode.' });
    if (Date.now() > entry.expiresAt) {
      codeGuruOtpStore.delete(user.email);
      return res.status(400).json({ success: false, pesan: 'Kode OTP sudah kedaluwarsa. Minta ulang kode.' });
    }
    if (entry.userId !== user.id)
      return res.status(403).json({ success: false, pesan: 'OTP tidak valid untuk akun ini.' });
    if (entry.otp !== String(otp).trim())
      return res.status(400).json({ success: false, pesan: 'Kode OTP salah.' });

    codeGuruOtpStore.delete(user.email); // hapus setelah dipakai (sekali pakai)

    // Jika belum punya code_guru (edge case), generate sekarang
    let finalCode = user.code_guru;
    if (!finalCode) {
      const { data: newCode } = await supabase
        .rpc('generate_code_guru_for_user', { p_user_id: user.id })
        .catch(() => ({ data: null }));
      finalCode = newCode;
      if (!finalCode) {
        // Fallback manual
        const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let generatedCode = '';
        for (let i = 0; i < 8; i++) generatedCode += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        await supabase.from('users').update({ code_guru: generatedCode, code_guru_generated_at: new Date().toISOString() }).eq('id', user.id);
        finalCode = generatedCode;
      }
    }

    res.json({
      success: true,
      pesan: 'Verifikasi berhasil! Berikut Code Guru kamu.',
      data: {
        code_guru: finalCode,
        generated_at: user.code_guru_generated_at
      }
    });
  } catch (err) {
    console.error('[verify-code-guru-otp]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal verifikasi OTP. Coba lagi.' });
  }
});

module.exports = router;
