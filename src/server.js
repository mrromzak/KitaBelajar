require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3001', '*'],
    credentials: true
  }
});

app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3001', '*'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// ── Halaman Utama ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'belajar-seru.html'));
});

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/kelas',     require('./routes/kelas'));
app.use('/api/materi',    require('./routes/materi'));
app.use('/api/soal',      require('./routes/soal'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/zepquiz',   require('./routes/zepquiz'));

const quizRoutes = require('./routes/quiz');
app.use('/api/quiz', quizRoutes);

// Socket.io Zep Quiz handler
require('./socket/zepquiz')(io);

// Socket.io World handler
require('./socket/world')(io);

// ── Proxy: fetch artikel untuk AI Materi ──
const https = require('https');
const http  = require('http');
app.get('/api/proxy/fetch', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ success: false, pesan: 'URL wajib diisi' });

  try {
    // Validasi URL
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.json({ success: false, pesan: 'Protocol tidak valid' });
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KitaBelajar/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 10000
    }, (response) => {
      let html = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { if (html.length < 500000) html += chunk; });
      response.on('end', () => {
        // Strip HTML tags, ambil teks bersih
        let teks = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[\s\S]*?<\/footer>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s{3,}/g, '\n\n')
          .trim();

        // Ambil max 8000 karakter
        if (teks.length > 8000) teks = teks.substring(0, 8000);
        res.json({ success: true, teks, panjang: teks.length });
      });
    });
    request.on('error', (e) => res.json({ success: false, pesan: e.message }));
    request.on('timeout', () => {
      request.destroy();
      res.json({ success: false, pesan: 'Request timeout' });
    });
  } catch(e) {
    res.json({ success: false, pesan: e.message });
  }
});

// ── Proxy: YouTube Transcript via InnerTube API (tanpa package) ──
app.get('/api/proxy/youtube-transcript', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.json({ success: false, pesan: 'videoId wajib diisi' });

  const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const ANDROID_VERSION = '20.10.38';

  // Helper: decode HTML entities
  function decodeEntities(str) {
    return str
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  }

  // Helper: ambil transcript dari URL caption XML
  async function fetchCaptionXml(captionUrl, langCode) {
    const r = await fetch(captionUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) return null;
    const xml = await r.text();

    // Format baru (timedtext v3)
    const segs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let m;
    while ((m = pRegex.exec(xml)) !== null) {
      const inner = m[1];
      const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
      let sm, text = '';
      while ((sm = sRegex.exec(inner)) !== null) text += sm[1];
      if (!text) text = inner.replace(/<[^>]+>/g, '');
      text = decodeEntities(text).trim();
      if (text) segs.push(text);
    }
    if (segs.length > 0) return segs.join(' ');

    // Format lama (text tags)
    const oldSegs = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
      .map(m => decodeEntities(m[1]).trim()).filter(Boolean);
    if (oldSegs.length > 0) return oldSegs.join(' ');

    return null;
  }

  // Strategi 1: InnerTube API (Android client — lebih reliable)
  async function viaInnerTube() {
    const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 14)`
      },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: ANDROID_VERSION } },
        videoId
      })
    });
    if (!r.ok) throw new Error('InnerTube HTTP ' + r.status);
    const data = await r.json();
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) throw new Error('No tracks');

    const track = tracks.find(t => t.languageCode === 'id') ||
                  tracks.find(t => t.languageCode === 'en') ||
                  tracks[0];
    if (!track?.baseUrl) throw new Error('No baseUrl');
    return await fetchCaptionXml(track.baseUrl, track.languageCode);
  }

  // Strategi 2: Parse halaman YouTube langsung
  async function viaWebPage() {
    const r = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' }
    });
    const html = await r.text();
    if (html.includes('class="g-recaptcha"')) throw new Error('Captcha required');

    // Ambil captionTracks dari JSON di halaman
    const jsonStr = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/)?.[1];
    if (!jsonStr) throw new Error('No player response');
    const player = JSON.parse(jsonStr);
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) throw new Error('No tracks');

    const track = tracks.find(t => t.languageCode === 'id') ||
                  tracks.find(t => t.languageCode === 'en') ||
                  tracks[0];
    if (!track?.baseUrl) throw new Error('No baseUrl');
    return await fetchCaptionXml(track.baseUrl, track.languageCode);
  }

  // Coba kedua strategi
  const strategies = [
    { name: 'InnerTube', fn: viaInnerTube },
    { name: 'WebPage',   fn: viaWebPage   }
  ];

  for (const { name, fn } of strategies) {
    try {
      const transcript = await fn();
      if (transcript && transcript.length > 50) {
        const cleaned = transcript.replace(/\s+/g, ' ').trim();
        const truncated = cleaned.length > 8000 ? cleaned.substring(0, 8000) + '...' : cleaned;
        console.log(`✅ YouTube transcript via ${name}: ${truncated.length} chars`);
        return res.json({ success: true, transcript: truncated });
      }
    } catch(e) {
      console.log(`⚠️  YouTube transcript ${name} gagal:`, e.message);
    }
  }

  res.json({ success: false, pesan: 'Transcript tidak tersedia — video mungkin tidak memiliki subtitle/CC' });
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
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(500).json({ success: false, pesan: err.message });
});


httpServer.listen(PORT, () => {
  console.log('\n🌈 =====================================');
  console.log(`🚀  BelajarSeru API (Supabase) aktif!`);
  console.log(`    http://localhost:${PORT}/api`);
  console.log(`⚡  Socket.io aktif (Zep Quiz Live)`);
  console.log('🌈 =====================================\n');
});

module.exports = app;