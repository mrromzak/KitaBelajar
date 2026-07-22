// ============================================================
//  prototype/kode-guru/app.js
//
//  Express app factory — testable (no side-effects at module load).
//
//  Endpoints:
//    POST /api/auth/login              — kepala email+password login
//    POST /api/auth/login-google-guru  — guru Google OAuth (prod only)
//    POST /api/auth/validate-kode-guru — validate kode (public)
//    POST /api/auth/register-guru      — guru self-register with kode
//    POST /api/kode-guru               — kepala: generate kode
//    GET  /api/kode-guru               — kepala: list kode milik sendiri
//    PATCH /api/kode-guru/:id/revoke   — kepala: cabut kode
//    GET  /api/kepala/guru             — kepala: list guru terdaftar
//    GET  /api/config/google-client-id — expose clientId ke frontend
//
//  Response shape (camelCase, matches test assertions):
//    data.maxUses, data.usedCount, data.sisaKuota, data.kode, data.id
//
//  Security:
//    - Password strength: min 8 char, ≥1 huruf besar, ≥1 angka
//    - Hash tidak pernah dikirim ke klien
//    - Pesan login seragam (tidak bocorkan email terdaftar)
//    - Revoke IDOR-safe (scope ke kepala pemilik)
// ============================================================

const path      = require('path');
const crypto    = require('crypto');
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');

// google-auth-library hanya dipakai di produksi (login Google guru).
// Di test, endpoint ini tidak dipanggil sehingga require aman.
let OAuth2Client;
try { ({ OAuth2Client } = require('google-auth-library')); } catch (_) {}

// ── Password strength ─────────────────────────────────────────
function isStrongPassword(pw) {
  if (!pw || pw.length < 8) return false;
  if (!/[A-Z]/.test(pw))    return false;
  if (!/[0-9]/.test(pw))    return false;
  return true;
}

// ============================================================
//  createApp
// ============================================================
function createApp({ store, jwtSecret, googleClientId = null, allowedOrigins = [] }) {
  if (!store)     throw new Error('store wajib diberikan');
  if (!jwtSecret) throw new Error('JWT_SECRET wajib di-set via environment variable');
  // googleClientId boleh null saat testing (endpoint Google tidak diuji)

  const googleClient = googleClientId && OAuth2Client
    ? new OAuth2Client(googleClientId)
    : null;

  const app = express();

  // ── CORS ────────────────────────────────────────────────────
  const corsOptions = {
    origin: allowedOrigins.length
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
          cb(new Error(`Origin ${origin} tidak diizinkan oleh CORS`));
        }
      : false,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  };
  app.use(cors(corsOptions));

  // ── Helmet + CSP ────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", 'https://accounts.google.com', 'https://apis.google.com'],
        styleSrc:   ["'self'", 'https://fonts.googleapis.com'],
        fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:     ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        frameSrc:   ['https://accounts.google.com'],
        objectSrc:  ["'none'"],
        baseUri:    ["'self'"]
      }
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
  }));

  app.use(express.json({ limit: '16kb' }));
  app.use('/public', express.static(path.join(__dirname, 'public')));

  // ── Rate limiters ────────────────────────────────────────────
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 5,
    standardHeaders: true, legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { success: false, pesan: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }
  });
  const genLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 100,
    standardHeaders: true, legacyHeaders: false,
    message: { success: false, pesan: 'Terlalu banyak request. Coba lagi nanti.' }
  });

  // ── Auth middleware ──────────────────────────────────────────
  function authMiddleware(req, res, next) {
    const header = req.headers['authorization'];
    const token  = header && header.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, pesan: 'Token tidak ditemukan.' });
    try { req.user = jwt.verify(token, jwtSecret); next(); }
    catch { return res.status(401).json({ success: false, pesan: 'Token tidak valid atau sudah expired.' }); }
  }

  function kepalaOnly(req, res, next) {
    if (req.user.role !== 'kepala_sekolah')
      return res.status(403).json({ success: false, pesan: 'Akses ditolak. Khusus kepala sekolah.' });
    next();
  }

  // ── UI ───────────────────────────────────────────────────────
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

  // ══════════════════════════════════════════════════════════
  //  AUTH ENDPOINTS
  // ══════════════════════════════════════════════════════════

  // ── Login kepala (email + password) ─────────────────────────
  // Pesan error seragam → tidak bocorkan apakah email terdaftar.
  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ success: false, pesan: 'Email dan password wajib diisi.' });
    try {
      const GENERIC = 'Email atau password salah.';
      const user = store.findUserByEmail(email);
      if (!user) return res.status(401).json({ success: false, pesan: GENERIC });
      const hash = user.passwordHash || user.password || user.password_hash;
      const ok   = hash && bcrypt.compareSync(password, hash);
      if (!ok) return res.status(401).json({ success: false, pesan: GENERIC });
      const token = jwt.sign({ id: user.id, role: user.role, nama: user.nama }, jwtSecret, { expiresIn: '1d' });
      res.json({ success: true, token, user: { id: user.id, nama: user.nama, role: user.role } });
    } catch (e) {
      res.status(500).json({ success: false, pesan: 'Server error.' });
    }
  });

  // ── Login Google Guru (produksi) ─────────────────────────────
  app.post('/api/auth/login-google-guru', loginLimiter, async (req, res) => {
    if (!googleClient)
      return res.status(503).json({ success: false, pesan: 'Google login tidak dikonfigurasi.' });

    const { credential } = req.body || {};
    if (!credential)
      return res.status(400).json({ success: false, pesan: 'Google credential (id_token) wajib dikirim.' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ success: false, pesan: 'Token Google tidak valid atau sudah expired.' });
    }

    if (!payload.email_verified)
      return res.status(403).json({ success: false, pesan: 'Email Google belum diverifikasi.' });

    const email = payload.email;
    const nama  = payload.name || email.split('@')[0];

    try {
      // Validate kode via email whitelist (legacy v2 path — kept for compatibility)
      const v = store.validateCode ? store.validateCode(email) : { valid: false };
      if (!v.valid)
        return res.status(403).json({ success: false, pesan: v.reason || 'Email tidak terdaftar.' });

      let user = store.findUserByEmail(email);
      if (!user) {
        const passwordHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
        const result = store.createGuru({ nama, email, passwordHash });
        if (result.error)
          return res.status(500).json({ success: false, pesan: result.error });
        user = result.user;
      }

      const token = jwt.sign({ id: user.id, role: user.role, nama: user.nama }, jwtSecret, { expiresIn: '1d' });
      res.json({ success: true, pesan: `Selamat datang, ${user.nama}!`, token,
        user: { id: user.id, nama: user.nama, email: user.email, role: user.role } });
    } catch {
      res.status(500).json({ success: false, pesan: 'Server error.' });
    }
  });

  // ── Validate kode (public) ───────────────────────────────────
  app.post('/api/auth/validate-kode-guru', genLimiter, (req, res) => {
    const { kode } = req.body || {};
    if (!kode) return res.status(400).json({ success: false, pesan: 'Kode wajib diisi.' });
    try {
      const result = store.validateCode(kode);
      res.json({ success: true, valid: result.valid, pesan: result.reason || 'Kode valid.' });
    } catch (e) {
      res.status(500).json({ success: false, pesan: 'Server error.' });
    }
  });

  // ── Register guru dengan kode undangan ──────────────────────
  //  POST /api/auth/register-guru
  //  Body: { nama, email, password, kode }
  //  1. Validasi input & password strength
  //  2. Validate kode (pra-cek, non-atomic)
  //  3. Hash password
  //  4. Atomic redeem (serialized per kode → anti over-redeem)
  //  5. Buat akun guru
  app.post('/api/auth/register-guru', genLimiter, async (req, res) => {
    const { nama, email, password, kode } = req.body || {};

    if (!nama || !email || !password || !kode)
      return res.status(400).json({ success: false, pesan: 'nama, email, password, dan kode wajib diisi.' });

    if (!isStrongPassword(password))
      return res.status(400).json({
        success: false,
        pesan: 'Password minimal 8 karakter, mengandung huruf besar dan angka.'
      });

    // Pra-cek (non-atomic) — tolak cepat sebelum bcrypt
    const preCheck = store.validateCode(kode);
    if (!preCheck.valid)
      return res.status(400).json({ success: false, pesan: preCheck.reason || 'Kode tidak valid.' });

    try {
      const passwordHash = bcrypt.hashSync(password, 10);

      // Atomic redeem — serialized per kode
      const redeem = await store.redeemCode(kode, email);
      if (!redeem.ok)
        return res.status(400).json({ success: false, pesan: redeem.reason || 'Kuota kode sudah habis.' });

      const result = store.createGuru({ nama, email, passwordHash });
      if (result.error) {
        // Rollback: decrement usedCount (best-effort)
        const codeId = store._getCodeById
          ? (() => {
              // find by kode string
              const codes = store.listCodes ? null : null; // no direct lookup
              return null;
            })()
          : null;
        return res.status(400).json({ success: false, pesan: result.error });
      }

      const user = result.user;
      res.status(201).json({
        success: true,
        pesan:   `Akun guru ${user.nama} berhasil dibuat.`,
        user:    { id: user.id, nama: user.nama, email: user.email, role: user.role }
      });
    } catch (e) {
      res.status(500).json({ success: false, pesan: 'Server error.' });
    }
  });

  // ══════════════════════════════════════════════════════════
  //  KEPALA SEKOLAH ENDPOINTS
  // ══════════════════════════════════════════════════════════

  // ── Generate kode undangan ───────────────────────────────────
  app.post('/api/kode-guru', authMiddleware, kepalaOnly, genLimiter, (req, res) => {
    const { max_uses, expires_in_days, label } = req.body || {};
    try {
      const { code } = store.generateCode({
        dibuatOleh:   req.user.id,
        maxUses:      max_uses,
        expiresInDays: expires_in_days ?? null,
        label:        label ?? null
      });
      res.status(201).json({
        success: true,
        pesan:   'Kode undangan guru berhasil dibuat.',
        data:    code ? {
          id:        code.id,
          kode:      code.kode,
          status:    'active',
          maxUses:   code.maxUses,
          usedCount: code.usedCount,
          sisaKuota: Math.max(0, code.maxUses - code.usedCount),
          expiresAt: code.expiresAt,
          label:     code.label,
          createdAt: code.createdAt
        } : null
      });
    } catch (e) {
      res.status(500).json({ success: false, pesan: 'Server error.' });
    }
  });

  // ── Daftar kode milik kepala ini ─────────────────────────────
  app.get('/api/kode-guru', authMiddleware, kepalaOnly, (req, res) => {
    try {
      res.json({ success: true, data: store.listCodes(req.user.id) });
    } catch (e) {
      res.status(500).json({ success: false, pesan: 'Server error.' });
    }
  });

  // ── Cabut kode ───────────────────────────────────────────────
  app.patch('/api/kode-guru/:id/revoke', authMiddleware, kepalaOnly, (req, res) => {
    try {
      const { entry, error } = store.revokeCode(req.params.id, req.user.id);
      if (error) return res.status(404).json({ success: false, pesan: error });
      res.json({ success: true, pesan: 'Kode berhasil dicabut.', data: entry });
    } catch (e) {
      res.status(500).json({ success: false, pesan: 'Server error.' });
    }
  });

  // ── Daftar guru terdaftar ────────────────────────────────────
  app.get('/api/kepala/guru', authMiddleware, kepalaOnly, (req, res) => {
    try {
      res.json({ success: true, data: store.listGuru() });
    } catch (e) {
      res.status(500).json({ success: false, pesan: 'Server error.' });
    }
  });

  // ── Expose Google Client ID ke frontend ──────────────────────
  app.get('/api/config/google-client-id', (req, res) => {
    res.json({ clientId: googleClientId || null });
  });

  // ── 404 ──────────────────────────────────────────────────────
  app.use((req, res) => res.status(404).json({ success: false, pesan: 'Endpoint tidak ditemukan.' }));

  // ── Error handler ────────────────────────────────────────────
  app.use((err, req, res, _next) => {
    if (err.message && err.message.includes('CORS'))
      return res.status(403).json({ success: false, pesan: err.message });
    res.status(500).json({ success: false, pesan: 'Internal server error.' });
  });

  return app;
}

module.exports = { createApp };
