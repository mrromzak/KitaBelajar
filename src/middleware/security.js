// ============================================================
//  src/middleware/security.js
//  Middleware keamanan terpusat: helmet, CSP, anti-judol/iklan
// ============================================================
const helmet = require('helmet');

// ── Daftar kata kunci judol & iklan berbahaya ───────────────
const BLOCKED_KEYWORDS = [
  // Judol
  'slot', 'gacor', 'jackpot', 'togel', 'toto', 'casino', 'poker',
  'judi', 'bet', 'betting', 'sbobet', 'maxwin', 'scatter', 'rtp',
  'pragmatic', 'pg soft', 'habanero', 'spadegaming', 'joker123',
  'slot88', 'slot777', 'olympus', 'mahjong', 'gates of', 'wild west',
  'bonanza', 'starlight', 'sweet bonanza', 'demo slot', 'link slot',
  // Pinjol & penipuan
  'pinjol', 'kredit cepat', 'dana cair', 'limit besar', 'bunga 0',
  'investasi bodong', 'cuan instan', 'passive income cepat',
  // Iklan spam
  'klik di sini', 'menangkan hadiah', 'selamat anda terpilih',
  'transfer sekarang', 'whatsapp kami', 'hubungi admin',
];

// ── Cek apakah konten mengandung kata judol/iklan ───────────
function containsBlockedContent(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Middleware: blokir request body yang mengandung judol ───
function antiJudolMiddleware(req, res, next) {
  if (!req.body) return next();

  // Cek semua string field di body
  const bodyStr = JSON.stringify(req.body);
  if (containsBlockedContent(bodyStr)) {
    return res.status(400).json({
      success: false,
      pesan: 'Konten tidak diizinkan. Platform ini khusus untuk pembelajaran.'
    });
  }
  next();
}

// ── Middleware: blokir referer dari situs judol ─────────────
const BLOCKED_DOMAINS = [
  'slot', 'togel', 'casino', 'poker', 'judi', 'bet', 'sbobet',
  'gambling', 'jackpot', 'gacor'
];

function blockBadReferer(req, res, next) {
  const referer = (req.headers['referer'] || '').toLowerCase();
  const origin  = (req.headers['origin']  || '').toLowerCase();

  const isBad = BLOCKED_DOMAINS.some(d => referer.includes(d) || origin.includes(d));
  if (isBad) {
    return res.status(403).json({ success: false, pesan: 'Akses ditolak.' });
  }
  next();
}

// ── Helmet: Security Headers ────────────────────────────────
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      // unsafe-inline diperlukan karena HTML menggunakan onclick/onchange inline
      // unsafe-eval diperlukan oleh beberapa library (socket.io, dll)
      scriptSrc:      ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                       'https://cdn.socket.io', 'https://cdn.jsdelivr.net',
                       'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com',
                       'https://meet.ffmuc.net', 'https://*.daily.co'],
      // Izinkan inline event handler (onclick, onchange, dll di HTML)
      scriptSrcAttr:  ["'unsafe-inline'"],
      styleSrc:       ["'self'", "'unsafe-inline'",
                       'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc:         ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc:     ["'self'",
                       'wss:', 'ws:',
                       'https://api.groq.com',
                       'https://*.supabase.co',
                       'https://api.daily.co',
                       'https://*.railway.app', 'wss://*.railway.app'],
      mediaSrc:       ["'self'", 'https:', 'blob:'],
      objectSrc:      ["'none'"],
      frameSrc:       ["'self'", 'https://*.daily.co', 'https://meet.ffmuc.net', 'https://*.jitsi.org'],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

module.exports = { helmetMiddleware, antiJudolMiddleware, blockBadReferer, containsBlockedContent };
