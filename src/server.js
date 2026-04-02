require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Allowed origins: dari .env (CORS_ORIGIN) + localhost dev
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3001',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [])
];

function corsOriginFn(origin, callback) {
  // Izinkan request tanpa origin (curl, server-to-server)
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error('CORS: origin tidak diizinkan — ' + origin));
}

// Socket.io setup — io di-expose ke routes via app.set('io', io)
const io = new Server(httpServer, {
  cors: { origin: corsOriginFn, credentials: true }
});

app.set('io', io); // Expose io ke routes (req.app.get('io'))

app.use(cors({ origin: corsOriginFn, credentials: true }));
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
app.use('/api/chat',      require('./routes/chat'));
app.use('/api/notifikasi', require('./routes/notifikasi'));

const quizRoutes = require('./routes/quiz');
app.use('/api/quiz', quizRoutes);

// ── Fix: POST /api/hasil-quiz — simpan hasil kuis murid ──
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const _sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);
app.post('/api/hasil-quiz', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, pesan: 'Token tidak ada' });
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const { quiz_id, skor, jawaban, waktu_selesai } = req.body;
    if (!quiz_id) return res.status(400).json({ success: false, pesan: 'quiz_id wajib' });

    // Cek apakah sudah ada hasil sebelumnya
    const { data: existing } = await _sb.from('hasil_quiz')
      .select('id, skor').eq('quiz_id', quiz_id).eq('murid_id', user.id).single();

    if (existing) {
      // Update jika skor lebih baik
      if (skor > existing.skor) {
        await _sb.from('hasil_quiz').update({ skor, jawaban: JSON.stringify(jawaban || {}), waktu_selesai: waktu_selesai || new Date().toISOString() })
          .eq('id', existing.id);
      }
      return res.json({ success: true, pesan: 'Hasil diperbarui', skor_lama: existing.skor, skor_baru: skor });
    }

    // Insert hasil baru
    const { v4: uuidv4 } = require('uuid');
    const { error } = await _sb.from('hasil_quiz').insert({
      id: uuidv4(), quiz_id, murid_id: user.id, skor: skor || 0,
      jawaban: JSON.stringify(jawaban || {}),
      waktu_selesai: waktu_selesai || new Date().toISOString()
    });
    if (error) throw error;

    // Update XP murid (increment)
    const xpGain = Math.round((skor || 0) / 10);
    if (xpGain > 0) {
      const { data: userData } = await _sb.from('users').select('xp, level').eq('id', user.id).single();
      if (userData) {
        const newXp = (userData.xp || 0) + xpGain;
        const newLevel = Math.floor(newXp / 1000) + 1;
        await _sb.from('users').update({ xp: newXp, level: newLevel }).eq('id', user.id);
      }
    }

    res.json({ success: true, pesan: 'Hasil disimpan!', xp_gained: xpGain });
  } catch(err) {
    console.error('[POST /hasil-quiz]', err.message);
    res.status(500).json({ success: false, pesan: err.message });
  }
});

// Socket.io Zep Quiz handler
require('./socket/zepquiz')(io);

// Socket.io World handler
require('./socket/world')(io);

// Socket.io Kelas (chat + online/offline)
require('./socket/kelas')(io);

// Socket.io Video Call — Daily.co (signaling notifikasi meeting)
require('./socket/videocall')(io);

// ── Proxy: Groq AI (agar API key tidak terekspos di frontend) ──
app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY)
      return res.status(500).json({ success: false, pesan: 'GROQ_API_KEY belum diset di server.' });

    const { messages, max_tokens } = req.body;
    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ success: false, pesan: 'messages wajib berupa array.' });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        max_tokens: max_tokens || 1024,
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq API error');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, pesan: err.message });
  }
});

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