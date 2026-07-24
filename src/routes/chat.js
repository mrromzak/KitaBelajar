const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const multer = require('multer');
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
const { validateUpload, EXT_FOR_MIME } = require('../utils/fileType');

// GET /api/chat/private/:userId — ambil riwayat chat privat dengan user tertentu
router.get('/private/:userId', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const otherId = req.params.userId;

    // WAJIB UUID — otherId diinterpolasi ke filter .or() PostgREST.
    // Tanpa ini, input non-UUID bisa menyuntik filter (filter injection).
    if (!validator.isUUID(String(otherId)))
      return res.status(400).json({ success: false, pesan: 'ID pengguna tidak valid.' });

    const { data, error } = await supabase
      .from('pesan_private')
      .select('*, pengirim:dari_id(id, nama, avatar, role)')
      .or(`and(dari_id.eq.${myId},ke_id.eq.${otherId}),and(dari_id.eq.${otherId},ke_id.eq.${myId})`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    // Tandai semua pesan dari lawan bicara sebagai dibaca
    await supabase
      .from('pesan_private')
      .update({ dibaca: true })
      .eq('ke_id', myId)
      .eq('dari_id', otherId)
      .eq('dibaca', false);

    const result = (data || []).map(p => ({ ...p, isi: decrypt(p.isi) }));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// POST /api/chat/private/:userId — kirim pesan privat ke user tertentu
router.post('/private/:userId', authMiddleware, async (req, res) => {
  try {
    const { isi } = req.body;
    if (!isi?.trim()) return res.status(400).json({ success: false, pesan: 'Pesan tidak boleh kosong.' });
    if (!validator.isUUID(String(req.params.userId)))
      return res.status(400).json({ success: false, pesan: 'ID pengguna tidak valid.' });

    const plainIsi = isi.trim();
    const id = uuidv4();
    const { error } = await supabase.from('pesan_private').insert({
      id,
      dari_id: req.user.id,
      ke_id: req.params.userId,
      isi: encrypt(plainIsi)
    });
    if (error) throw error;

    // Kirim notifikasi offline ke database untuk penerima
    const senderNama = req.user.nama || 'Seseorang';
    const senderAvatar = req.user.avatar || '🦁';
    await supabase.from('notifikasi').insert({
      id: uuidv4(),
      user_id: req.params.userId,
      judul: '💬 Pesan Privat Baru',
      pesan: `Pesan baru dari "${senderNama}": "${plainIsi.startsWith('[FILE:') ? 'Mengirim lampiran berkas' : (plainIsi.length > 60 ? plainIsi.substring(0, 60) + '...' : plainIsi)}"`,
      tipe: 'private',
      data_extra: JSON.stringify({ dari_id: req.user.id, pengirim_nama: senderNama, pengirim_avatar: senderAvatar })
    }).catch(err => console.warn('[notifikasi chat] gagal simpan:', err.message));

    res.status(201).json({
      success: true,
      data: { id, dari_id: req.user.id, ke_id: req.params.userId, isi: plainIsi, created_at: new Date().toISOString() }
    });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// PUT /api/chat/private/msg/:msgId — edit pesan privat (hanya milik sendiri)
router.put('/private/msg/:msgId', authMiddleware, async (req, res) => {
  try {
    const { isi } = req.body;
    if (!isi?.trim()) return res.status(400).json({ success: false, pesan: 'Pesan tidak boleh kosong.' });

    const { data: msg } = await supabase
      .from('pesan_private')
      .select('id, dari_id, created_at')
      .eq('id', req.params.msgId)
      .single();
    if (!msg) return res.status(404).json({ success: false, pesan: 'Pesan tidak ditemukan.' });
    if (msg.dari_id !== req.user.id) return res.status(403).json({ success: false, pesan: 'Tidak punya akses.' });

    const diffMinutes = (new Date() - new Date(msg.created_at)) / (1000 * 60);
    if (diffMinutes > 5) {
      return res.status(400).json({ success: false, pesan: 'Pesan yang sudah lebih dari 5 menit tidak dapat diubah atau dihapus.' });
    }

    const { data, error } = await supabase
      .from('pesan_private')
      .update({ isi: encrypt(isi.trim()), edited: true })
      .eq('id', req.params.msgId)
      .select().single();
    if (error || !data) return res.status(404).json({ success: false, pesan: 'Pesan tidak ditemukan.' });
    res.json({ success: true, data: { ...data, isi: isi.trim() } });
  } catch(err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// DELETE /api/chat/private/msg/:msgId — hapus pesan privat (hanya milik sendiri)
router.delete('/private/msg/:msgId', authMiddleware, async (req, res) => {
  try {
    const { data: msg } = await supabase
      .from('pesan_private')
      .select('id, dari_id, created_at')
      .eq('id', req.params.msgId)
      .single();
    if (!msg) return res.status(404).json({ success: false, pesan: 'Pesan tidak ditemukan.' });
    if (msg.dari_id !== req.user.id) return res.status(403).json({ success: false, pesan: 'Tidak punya akses.' });

    const diffMinutes = (new Date() - new Date(msg.created_at)) / (1000 * 60);
    if (diffMinutes > 5) {
      return res.status(400).json({ success: false, pesan: 'Pesan yang sudah lebih dari 5 menit tidak dapat diubah atau dihapus.' });
    }

    const { error } = await supabase
      .from('pesan_private')
      .delete()
      .eq('id', req.params.msgId);
    if (error) return res.status(500).json({ success: false, pesan: 'Gagal hapus.' });
    res.json({ success: true });
  } catch(err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan.' });
  }
});

// GET /api/chat/inbox — daftar percakapan (siapa saja yang pernah chat)
router.get('/inbox', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const { data, error } = await supabase
      .from('pesan_private')
      .select('*, pengirim:dari_id(id, nama, avatar, role), penerima:ke_id(id, nama, avatar, role)')
      .or(`dari_id.eq.${myId},ke_id.eq.${myId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by conversation partner
    const seen = new Set();
    const conversations = [];
    for (const p of (data || [])) {
      const partner = p.dari_id === myId ? p.penerima : p.pengirim;
      if (!partner || seen.has(partner.id)) continue;
      seen.add(partner.id);
      const unread = (data || []).filter(m => m.dari_id === partner.id && m.ke_id === myId && !m.dibaca).length;
      conversations.push({ partner, last_message: decrypt(p.isi), last_at: p.created_at, unread });
    }

    res.json({ success: true, data: conversations });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// POST /api/chat/upload — upload file attachment untuk chat
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, pesan: 'Tidak ada file yang diunggah.' });

    const CHAT_ALLOWED_MIME = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'application/zip', 'application/x-zip-compressed'
    ];

    const check = validateUpload(req.file.buffer, CHAT_ALLOWED_MIME);
    if (!check.valid) return res.status(400).json({ success: false, pesan: 'Tipe file tidak didukung.' });

    const ext = EXT_FOR_MIME[check.mime] || 'bin';
    const filename = `chat-attachments/${uuidv4()}.${ext}`;

    const { error } = await supabase.storage
      .from('materi-files')
      .upload(filename, req.file.buffer, { contentType: check.mime, upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from('materi-files').getPublicUrl(filename);
    res.json({ success: true, file_url: data.publicUrl, file_nama: req.file.originalname });
  } catch (err) {
    console.error('[chat-upload]', err.message);
    res.status(500).json({ success: false, pesan: 'Gagal mengunggah berkas.' });
  }
});

module.exports = router;
