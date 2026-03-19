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