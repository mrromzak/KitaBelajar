require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { helmetMiddleware, antiJudolMiddleware, blockBadReferer } = require('./middleware/security');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// ── Allowed origins ─────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3001',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [])
];

function corsOriginFn(origin, callback) {
  if (!origin) return callback(null, true);               // request non-browser / same-origin tanpa Origin
  if (allowedOrigins.includes(origin)) return callback(null, true);
  // Izinkan otomatis domain hosting Railway (produksi bisa pindah subdomain sewaktu-waktu).
  try {
    const host = new URL(origin).hostname;
    if (host === 'railway.app' || host.endsWith('.railway.app')) return callback(null, true);
  } catch (e) { /* origin tidak valid → tolak di bawah */ }
  // Tolak dengan halus (tanpa CORS header) — JANGAN lempar Error agar tidak jadi HTTP 500.
  console.warn('CORS: origin tidak diizinkan —', origin);
  return callback(null, false);
}

// ── Rate limiters ───────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, pesan: 'Terlalu banyak request. Coba lagi nanti.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // max 10 percobaan login per 15 menit per IP
  message: { success: false, pesan: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 15,
  message: { success: false, pesan: 'Terlalu banyak request AI. Coba lagi sebentar.' }
});

// ── Socket.io setup ─────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: corsOriginFn, credentials: true },
  pingTimeout: 60000,     // tunggu 60s sebelum anggap disconnect
  pingInterval: 25000,    // kirim ping tiap 25s
  connectTimeout: 45000,  // timeout saat connect awal
  transports: ['websocket', 'polling']
});

// Socket.io auth middleware — verifikasi JWT jika token dikirim
// Jika tidak ada token, tetap boleh connect (untuk world/voting publik)
const jwt = require('jsonwebtoken');
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      socket.user = null;
    }
  } else {
    socket.user = null;
  }
  next();
});

app.set('io', io);

// ── Trust proxy (Railway/Heroku pakai reverse proxy) ────────
app.set('trust proxy', 1);

// ── Security Middleware (urutan penting) ────────────────────
app.use(compression());              // Gzip semua response
app.use(helmetMiddleware);           // Security headers + CSP
app.use(blockBadReferer);            // Blokir referer judol/berbahaya
app.use(globalLimiter);              // Rate limit global
app.use(cors({ origin: corsOriginFn, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(antiJudolMiddleware);        // Blokir konten judol di body

// Static files: assets berat (gambar/font) di-cache 7 hari, CSS/JS/HTML no-cache
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders(res, filePath) {
    if (/\.(png|jpg|jpeg|gif|svg|webp|woff2?|ttf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 hari
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ── Halaman Utama ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'belajar-seru.html'));
});

// Routes — login pakai loginLimiter khusus
app.use('/api/auth/login',           loginLimiter);
app.use('/api/auth/register',        loginLimiter);
app.use('/api/auth/send-otp',        loginLimiter);
app.use('/api/auth/forgot-password', loginLimiter);
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/kode-guru', require('./routes/kode-guru'));
app.use('/api/kelas',     require('./routes/kelas'));
app.use('/api/materi',    require('./routes/materi'));
app.use('/api/soal',      require('./routes/soal'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/zepquiz',   require('./routes/zepquiz'));
app.use('/api/chat',      require('./routes/chat'));
app.use('/api/notifikasi', require('./routes/notifikasi'));
app.use('/api/orangtua',  require('./routes/orangtua'));
app.use('/api/misi',      require('./routes/misi'));
app.use('/api/latihan',   require('./routes/latihan'));
app.use('/api/belajar',   require('./routes/belajar'));

const quizRoutes = require('./routes/quiz');
app.use('/api/quiz', quizRoutes);

// Supabase client untuk endpoint inline (push notif, error logs)
const { createClient } = require('@supabase/supabase-js');
const _sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

// CATATAN KEAMANAN: endpoint lama `POST /api/hasil-quiz` DIHAPUS.
// Endpoint itu menerima `skor` langsung dari client sehingga skor/XP bisa
// dimanipulasi. Penyimpanan hasil quiz kini hanya lewat `POST /api/quiz/hasil`
// (routes/quiz.js) yang menghitung skor di server berdasarkan jawaban.

// Socket.io Zep Quiz handler
require('./socket/zepquiz')(io);

// Socket.io World handler
require('./socket/world')(io);

// Socket.io Kelas (chat + online/offline)
require('./socket/kelas')(io);

// Socket.io Video Call — Daily.co (signaling notifikasi meeting)
require('./socket/videocall')(io);

// ── Push Notification: simpan subscription ───────────────────
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false });
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ success: false, pesan: 'Data subscription tidak lengkap.' });

    await _sb.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    }, { onConflict: 'user_id,endpoint' });

    res.json({ success: true, pesan: 'Notifikasi diaktifkan.' });
  } catch(e) { res.json({ success: false }); }
});

// ── Push Notification: hapus subscription ────────────────────
app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false });
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const { endpoint } = req.body;
    if (endpoint) await _sb.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
    else await _sb.from('push_subscriptions').delete().eq('user_id', user.id);
    res.json({ success: true });
  } catch(e) { res.json({ success: false }); }
});

// Helper: kirim push notification ke user tertentu (jika punya subscription)
async function sendPushToUser(userId, payload) {
  try {
    const webpush = (() => { try { return require('web-push'); } catch { return null; } })();
    if (!webpush) return; // web-push tidak terinstall, skip

    const vapidPublicKey  = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail      = process.env.VAPID_EMAIL || 'mailto:admin@kitabelajar.id';
    if (!vapidPublicKey || !vapidPrivateKey) return;

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    const { data: subs } = await _sb.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId);
    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.allSettled(subs.map(sub =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body)
        .catch(async (e) => {
          if (e.statusCode === 410) { // Gone - subscription expired
            await _sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        })
    ));
  } catch(e) {
    console.error('[push]', e.message);
  }
}

// Expose helper ke socket handlers
app.set('sendPushToUser', sendPushToUser);

// ── Error Logger: terima error dari frontend ─────────────────
app.post('/api/log-error', async (req, res) => {
  try {
    const { pesan, stack, url, user_agent, user_id, extra } = req.body;
    if (!pesan) return res.json({ success: false });
    await _sb.from('error_logs').insert({
      sumber: 'frontend',
      pesan: String(pesan).substring(0, 500),
      stack: stack ? String(stack).substring(0, 2000) : null,
      url: url ? String(url).substring(0, 500) : null,
      method: null,
      user_id: user_id || null,
      user_agent: user_agent ? String(user_agent).substring(0, 300) : null,
      extra: extra ? JSON.stringify(extra).substring(0, 1000) : null
    });
    res.json({ success: true });
  } catch { res.json({ success: false }); }
});

// ── Error Logs: lihat log untuk guru ────────────────────────
app.get('/api/error-logs', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false });
    const jwt = require('jsonwebtoken');
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (user.role !== 'guru') return res.status(403).json({ success: false });

    const { data } = await _sb.from('error_logs')
      .select('*').order('created_at', { ascending: false }).limit(100);
    res.json({ success: true, data: data || [] });
  } catch { res.status(403).json({ success: false }); }
});

// Model yang diizinkan dari frontend (whitelist agar tidak disalahgunakan)
const ALLOWED_GROQ_MODELS = new Set([
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',     // chat & generate soal (pengganti llama-3.3-70b-versatile yg di-decommission)
  'openai/gpt-oss-20b',      // opsi hemat/cepat
  'llama3-70b-8192',
  'llama3-8b-8192',
  'gemma2-9b-it',
  'meta-llama/llama-4-scout-17b-16e-instruct'
]);

// Helper: panggil Groq dengan dual-key fallback (lihat src/utils/groq.js)
const { callGroq, RateLimitError } = require('./utils/groq');

// ── Proxy: Groq AI chat/soal (agar API key tidak terekspos di frontend) ──
// CATATAN: /api/ai/chat TIDAK pakai authMiddleware karena dipakai juga oleh
// NPC chatbot zep-world yang tidak mengirim token (mode anonim didukung).
// Abuse ditahan oleh aiLimiter (rate-limit per IP).
app.post('/api/ai/chat', aiLimiter, async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY)
      return res.status(500).json({ success: false, pesan: 'GROQ_API_KEY belum diset di server.' });

    const { messages, max_tokens, model, temperature, top_p, response_format } = req.body;
    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ success: false, pesan: 'messages wajib berupa array.' });

    // Validasi model — hanya izinkan model dari whitelist
    const safeModel = (model && ALLOWED_GROQ_MODELS.has(model))
      ? model
      : (process.env.GROQ_MODEL || 'llama-3.1-8b-instant');

    const payload = {
      model: safeModel,
      max_tokens: Math.min(parseInt(max_tokens) || 1024, 4096),
      messages
    };
    if (temperature !== undefined) payload.temperature = Math.min(Math.max(parseFloat(temperature) || 0.7, 0), 2);
    if (top_p !== undefined) payload.top_p = Math.min(Math.max(parseFloat(top_p) || 1, 0), 1);
    if (response_format?.type === 'json_object') payload.response_format = { type: 'json_object' };

    const data = await callGroq(payload);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[AI proxy]', err.message);
    if (err instanceof RateLimitError)
      return res.status(429).json({ success: false, pesan: 'Layanan AI sedang sibuk, coba beberapa saat lagi.' });
    res.status(500).json({ success: false, pesan: 'Layanan AI tidak tersedia saat ini.' });
  }
});

// ── Proxy: Groq Vision (analisis gambar untuk chatbot guru) ──
app.post('/api/ai/vision', aiLimiter, authMiddleware, async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY)
      return res.status(500).json({ success: false, pesan: 'GROQ_API_KEY belum diset di server.' });

    const { messages, max_tokens } = req.body;
    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ success: false, pesan: 'messages wajib berupa array.' });

    const data = await callGroq({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: Math.min(parseInt(max_tokens) || 1024, 2048),
      messages
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[AI vision proxy]', err.message);
    if (err instanceof RateLimitError)
      return res.status(429).json({ success: false, pesan: 'Layanan AI Vision sedang sibuk, coba beberapa saat lagi.' });
    res.status(500).json({ success: false, pesan: 'Layanan AI Vision tidak tersedia saat ini.' });
  }
});

// ── Debug: cek status TTS config ──
app.get('/api/ai/tts/status', (req, res) => {
  res.json({
    hf_token_set: !!process.env.HF_TOKEN,
    hf_token_preview: process.env.HF_TOKEN ? process.env.HF_TOKEN.slice(0, 8) + '...' : null
  });
});

// ── HuggingFace TTS Proxy ──
// Inggris  : Kokoro-82M  — af_bella (wanita, natural), am_michael (pria, ringan)
// Indonesia: MMS-TTS-ind — Meta MMS, lebih natural dari Google Translate TTS
app.post('/api/ai/tts/kokoro', aiLimiter, async (req, res) => {
  const { text, voice, lang } = req.body;
  if (!text) return res.status(400).json({ success: false });
  if (!process.env.HF_TOKEN) {
    console.warn('[HF TTS] HF_TOKEN tidak ditemukan di .env');
    return res.json({ success: false, fallback: true });
  }

  const clean = text.slice(0, 400);
  const isId  = lang === 'id';
  console.log(`[HF TTS] request — lang: ${lang}, voice: ${voice}, token: ${process.env.HF_TOKEN.slice(0,8)}...`);

  try {
    let hfRes;

    // Model MMS TTS dari Meta — support Inference API, natural, gratis
    const model = isId
      ? 'facebook/mms-tts-ind'  // Indonesia
      : 'facebook/mms-tts-eng'; // Inggris

    console.log(`[HF TTS] model: ${model}, text: "${clean.slice(0, 40)}..."`);

    hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: clean })
    });

    console.log(`[HF TTS] response status: ${hfRes.status}, content-type: ${hfRes.headers.get('Content-Type')}`);

    if (!hfRes.ok) {
      const errBody = await hfRes.text().catch(() => '');
      console.warn(`[HF TTS] error body:`, errBody.slice(0, 300));
      return res.json({ success: false, fallback: true, status: hfRes.status });
    }

    const audioBuffer = await hfRes.arrayBuffer();
    console.log(`[HF TTS] audio buffer size: ${audioBuffer.byteLength} bytes`);

    if (audioBuffer.byteLength < 100) {
      console.warn('[HF TTS] audio buffer terlalu kecil, kemungkinan response kosong');
      return res.json({ success: false, fallback: true });
    }

    const ct = hfRes.headers.get('Content-Type') || 'audio/wav';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('[HF TTS]', err.message);
    res.json({ success: false, fallback: true });
  }
});

// ── Proxy: fetch artikel untuk AI Materi ──
// Blokir IP internal (anti-SSRF), tapi izinkan semua domain publik
const BLOCKED_INTERNAL = [
  /^localhost$/i, /^127\./, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\.0\.0\.0$/, /^::1$/,
  /^169\.254\./,            // link-local / metadata cloud (AWS/GCP 169.254.169.254)
  /\.internal$/i, /\.local$/i
];

const https = require('https');
const dnsp = require('dns').promises;
const net = require('net');

// Apakah sebuah IP termasuk ruang internal/privat (anti-SSRF).
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 127 || p[0] === 10 || p[0] === 0) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local/metadata
    if (p[0] >= 224) return true;                  // multicast/reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return true;
    if (low.startsWith('::ffff:')) return isPrivateIp(low.replace('::ffff:', ''));
    return false;
  }
  return true; // tak dikenal → anggap tidak aman
}

// Resolve hostname & pastikan tidak ada IP internal (cegah DNS rebinding).
async function hostnameAman(hostname) {
  try {
    const addrs = await dnsp.lookup(hostname, { all: true });
    return addrs.length > 0 && !addrs.some(a => isPrivateIp(a.address));
  } catch {
    return false;
  }
}
app.get('/api/proxy/fetch', aiLimiter, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ success: false, pesan: 'URL wajib diisi' });

  try {
    const parsed = new URL(url);

    // Validasi protocol — hanya https
    if (parsed.protocol !== 'https:') {
      return res.json({ success: false, pesan: 'Hanya URL HTTPS yang diizinkan.' });
    }

    // Blokir IP/hostname internal (anti-SSRF) — cek pola + IP hasil resolusi.
    const hostname = parsed.hostname;
    if (BLOCKED_INTERNAL.some(r => r.test(hostname)) || !(await hostnameAman(hostname))) {
      return res.json({ success: false, pesan: 'URL tidak valid.' });
    }

    // Fungsi fetch dengan follow redirect (max 5 hop)
    async function doFetch(targetUrl, hopsLeft) {
      if (hopsLeft <= 0) return res.json({ success: false, pesan: 'Terlalu banyak redirect.' });
      let parsedTarget;
      try { parsedTarget = new URL(targetUrl); } catch(e) { return res.json({ success: false, pesan: 'URL redirect tidak valid.' }); }
      if (parsedTarget.protocol !== 'https:') return res.json({ success: false, pesan: 'Redirect ke non-HTTPS tidak diizinkan.' });
      // Cek tiap hop (termasuk IP hasil resolusi) agar redirect tak menuju internal.
      if (BLOCKED_INTERNAL.some(r => r.test(parsedTarget.hostname)) || !(await hostnameAman(parsedTarget.hostname)))
        return res.json({ success: false, pesan: 'URL tidak valid.' });

      const request = https.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 15000
      }, (response) => {
        // Ikuti redirect 301/302/303/307/308
        const sc = response.statusCode;
        if (sc >= 300 && sc < 400 && response.headers.location) {
          response.destroy();
          let loc = response.headers.location;
          if (loc.startsWith('/')) loc = `${parsedTarget.protocol}//${parsedTarget.host}${loc}`;
          return doFetch(loc, hopsLeft - 1);
        }

        // Hanya terima content-type html/text
        const ct = response.headers['content-type'] || '';
        if (!ct.includes('text/html') && !ct.includes('text/plain')) {
          response.destroy();
          return res.json({ success: false, pesan: 'Tipe konten tidak didukung.' });
        }

        let html = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { if (html.length < 400000) html += chunk; });
        response.on('end', () => {
          let teks = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<aside[\s\S]*?<\/aside>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#\d+;/g, ' ')
            .replace(/\s{3,}/g, '\n\n')
            .trim();

          if (teks.length > 8000) teks = teks.substring(0, 8000);
          res.json({ success: true, teks, panjang: teks.length });
        });
      });
      request.on('error', () => res.json({ success: false, pesan: 'Gagal mengambil artikel.' }));
      request.on('timeout', () => { request.destroy(); res.json({ success: false, pesan: 'Request timeout.' }); });
    }
    doFetch(url, 5);
  } catch(e) {
    res.json({ success: false, pesan: 'URL tidak valid.' });
  }
});

// ── Web search ──
// Sumber utama: SearXNG (mikosearch) → data realtime; fallback: DuckDuckGo.
// Dipakai oleh Asisten Guru untuk carikan artikel/referensi.
// Normalisasi: tambahkan https:// jika lupa, dan buang trailing slash
const SEARXNG_URL = (() => {
  let u = (process.env.SEARXNG_URL || 'https://mikosearch.up.railway.app').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u; // tahan banting kalau env tanpa skema
  return u.replace(/\/+$/, '');
})();

// Cari via SearXNG JSON API (format=json harus diaktifkan di instance)
async function searchSearxng(q) {
  const params = new URLSearchParams({
    q: q.slice(0, 200),
    format: 'json',
    language: 'id',
    safesearch: '1'
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${SEARXNG_URL}/search?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    if (!r.ok) throw new Error(`SearXNG HTTP ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error('SearXNG tidak mengembalikan JSON (format=json mungkin nonaktif).');
    const data = await r.json();
    const results = (data.results || [])
      .filter(it => it.url && /^https?:\/\//i.test(it.url))
      .slice(0, 6)
      .map(it => ({
        title: (it.title || '').trim(),
        url: it.url,
        snippet: (it.content || it.snippet || '').replace(/\s+/g, ' ').trim()
      }))
      .filter(it => it.title);
    return results;
  } finally {
    clearTimeout(timeout);
  }
}

// Fallback: DuckDuckGo HTML (tanpa API key)
async function searchDuckDuckGo(q) {
  const query = encodeURIComponent(q.slice(0, 200));
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${query}&kl=id-id`;
  const response = await fetch(ddgUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
    }
  });
  if (!response.ok) throw new Error('DuckDuckGo tidak merespons.');
  const html = await response.text();

  const results = [];
  const blockRe = /<div class="result[^"]*"[\s\S]*?(?=<div class="result[^"]*"|$)/g;
  let block;
  while ((block = blockRe.exec(html)) !== null && results.length < 6) {
    const titleMatch = block[0].match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block[0].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;

    let url = titleMatch[1];
    if (url.includes('//duckduckgo.com/l/')) {
      const uddMatch = url.match(/uddg=([^&]+)/);
      if (uddMatch) url = decodeURIComponent(uddMatch[1]);
    }
    if (!url.startsWith('https://')) continue;

    const title = titleMatch[2].replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').trim();
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim() : '';
    if (title && url) results.push({ title, url, snippet });
  }
  return results;
}

app.get('/api/ai/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ success: false, pesan: 'Query wajib diisi.' });

  let sumber = 'searxng';
  try {
    let results = [];
    try {
      results = await searchSearxng(q);
    } catch (e) {
      console.warn('[web search] SearXNG gagal, fallback DuckDuckGo:', e.message);
    }
    // Fallback ke DuckDuckGo jika SearXNG kosong/gagal
    if (!results || results.length === 0) {
      sumber = 'duckduckgo';
      results = await searchDuckDuckGo(q);
    }
    res.json({ success: true, sumber, results });
  } catch (err) {
    console.error('[web search]', err.message);
    res.json({ success: false, pesan: 'Gagal melakukan pencarian web.', results: [] });
  }
});

// Info endpoint
app.get('/api', (req, res) => {
  res.json({
    nama: '🌈 BelajarSeru API (Supabase)',
    versi: '3.0.0',
    status: 'running',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET  /api/auth/profile',
      'POST /api/kelas',
      'POST /api/kelas/join',
      'DELETE /api/kelas/:id/leave',
      'GET  /api/materi',
      'POST /api/materi',
      'GET  /api/soal/quiz',
      'POST /api/soal/quiz/:id/submit',
      'GET  /api/dashboard',
      'GET  /api/dashboard/leaderboard',
      'GET  /api/zepquiz/quiz',
      'POST /api/zepquiz/room',
      'WS   Socket.io /  (zep:create_room, zep:join_room, zep:start_game, zep:jawab)'
    ]
  });
});

app.use((req, res) => res.status(404).json({ success: false, pesan: `Endpoint tidak ditemukan: ${req.method} ${req.path}` }));

// Redaksi field sensitif sebelum disimpan ke error_logs (dibaca guru via
// /api/error-logs). Tanpa ini, password/OTP/token dari body request auth
// ikut tersimpan plaintext → kebocoran data.
const SENSITIVE_KEYS = new Set([
  'password', 'password_baru', 'password_lama', 'otp', 'token', 'reset_token',
  'google_token', 'konfirmasi', 'auth', 'p256dh', 'keys'
]);
function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) out[k] = '[REDACTED]';
    else if (v && typeof v === 'object') out[k] = redactSensitive(v);
    else out[k] = v;
  }
  return out;
}

app.use((err, req, res, next) => {
  console.error('❌', err.message);
  // Simpan error ke Supabase secara async (tidak block response)
  _sb.from('error_logs').insert({
    sumber: 'backend',
    pesan: err.message || String(err),
    stack: err.stack || null,
    url: req.path,
    method: req.method,
    user_id: null,
    user_agent: req.headers['user-agent'] || null,
    extra: JSON.stringify({ body: redactSensitive(req.body), query: redactSensitive(req.query) })
  }).then(() => {}).catch(() => {});
  res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
});


// Jalankan migrasi database sebelum server mulai melayani request
const runMigrations = require('./migration');
(async () => {
  try { await runMigrations(); } catch(e) { console.warn('⚠️  Migrasi startup gagal:', e.message); }
})();

httpServer.listen(PORT, () => {
  console.log('\n🌈 =====================================');
  console.log(`🚀  BelajarSeru API (Supabase) aktif!`);
  console.log(`    http://localhost:${PORT}/api`);
  console.log(`⚡  Socket.io aktif (Zep Quiz Live)`);
  console.log('🌈 =====================================\n');
});

module.exports = app;

// Tambahkan endpoint ini di src/server.js setelah endpoint proxy/fetch yang sudah ada

// ── Proxy: YouTube Transcript via third-party ──
app.get('/api/proxy/youtube-transcript', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.json({ success: false, pesan: 'videoId wajib diisi' });

  // Coba beberapa strategi
  const strategies = [
    // Strategi 1: youtubetranscript.com
    async () => {
      const r = await fetch(`https://api.youtubetranscript.com/?videoID=${videoId}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('Empty');
      return data.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
    },

    // Strategi 2: Fetch langsung halaman YouTube dan parse timedtext
    async () => {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
        }
      });
      const html = await pageRes.text();
      // Cari URL caption dari halaman
      const captionMatch = html.match(/"captionTracks":\[(\{.+?\})\]/);
      if (!captionMatch) throw new Error('No captions');
      const captionData = JSON.parse('[' + captionMatch[1] + ']');
      const caption = captionData.find(c => c.languageCode === 'id') || 
                      captionData.find(c => c.languageCode === 'en') ||
                      captionData[0];
      if (!caption?.baseUrl) throw new Error('No caption URL');
      
      const captionRes = await fetch(caption.baseUrl + '&fmt=json3');
      const captionJson = await captionRes.json();
      const transcript = captionJson.events
        ?.filter(e => e.segs)
        .map(e => e.segs.map(s => s.utf8 || '').join(''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!transcript || transcript.length < 50) throw new Error('Too short');
      return transcript;
    }
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      const transcript = await strategies[i]();
      const truncated = transcript.length > 8000 ? transcript.substring(0, 8000) + '...' : transcript;
      return res.json({ success: true, transcript: truncated, strategi: i + 1 });
    } catch(e) {
      console.log(`YouTube transcript strategi ${i+1} gagal:`, e.message);
    }
  }

  res.json({ success: false, pesan: 'Transcript tidak tersedia untuk video ini' });
});

// ── Cek apakah video YouTube bisa diembed (oEmbed API) ──
app.get('/api/proxy/youtube-check', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{8,12}$/.test(videoId))
    return res.json({ embeddable: true }); // jika tidak tahu, coba saja
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    clearTimeout(timeout);
    // 401 = embedding dinonaktifkan, selain itu anggap embeddable
    res.json({ embeddable: r.status !== 401 });
  } catch {
    res.json({ embeddable: true }); // timeout / network error → coba saja
  }
});