// =====================================================
//  src/routes/meeting.js
//  Daily.co video meeting — buat room & token
// =====================================================

const express = require('express');
const router  = express.Router();
const { authMiddleware, guruOnly } = require('../middleware/auth');

const DAILY_BASE = 'https://api.daily.co/v1';

function dailyHeaders() {
  return {
    'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

// POST /api/meeting/buat — Guru buat room, murid tidak bisa akses ini
router.post('/buat', authMiddleware, guruOnly, async (req, res) => {
  try {
    if (!process.env.DAILY_API_KEY)
      return res.status(500).json({ success: false, pesan: 'DAILY_API_KEY belum diset di server.' });

    const { kelas_id } = req.body;
    if (!kelas_id) return res.status(400).json({ success: false, pesan: 'kelas_id wajib.' });

    // Nama room unik per kelas (pakai kelas_id saja agar bisa di-reuse)
    const roomName = 'kb-' + kelas_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 28);

    // Cek apakah room sudah ada
    const checkRes = await fetch(`${DAILY_BASE}/rooms/${roomName}`, { headers: dailyHeaders() });
    let roomUrl;

    if (checkRes.ok) {
      const existing = await checkRes.json();
      roomUrl = existing.url;
    } else {
      // Buat room baru
      const createRes = await fetch(`${DAILY_BASE}/rooms`, {
        method: 'POST',
        headers: dailyHeaders(),
        body: JSON.stringify({
          name: roomName,
          properties: {
            max_participants: 64,
            enable_chat: false,          // chat sudah ada di aplikasi kita
            enable_screenshare: true,
            enable_recording: 'none',
            exp: Math.floor(Date.now() / 1000) + (6 * 60 * 60), // expired 6 jam
            eject_at_room_exp: true,
            start_video_off: false,
            start_audio_off: false,
          }
        })
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error || 'Gagal membuat room Daily.co');
      roomUrl = created.url;
    }

    res.json({ success: true, url: roomUrl });
  } catch(err) {
    console.error('[meeting/buat]', err.message);
    res.status(500).json({ success: false, pesan: err.message });
  }
});

module.exports = router;
