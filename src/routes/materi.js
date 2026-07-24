const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const supabase = require('../supabase');
const { authMiddleware, guruOnly } = require('../middleware/auth');
const { updateUserStats, checkMisi } = require('../utils/gamification');
const { cleanText } = require('../utils/sanitize');
const { validateUpload, EXT_FOR_MIME } = require('../utils/fileType');

// Tipe yang benar-benar diizinkan untuk materi (dicek dari isi file).
const MATERI_ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MATERI_MIME_BY_JENIS = {
  pdf: ['application/pdf'],
  gambar: ['image/jpeg', 'image/png', 'image/webp']
};

// Cek kepemilikan kelas (anti mass-assignment kelas_id milik guru lain).
async function guruMemilikiKelas(guruId, kelasId) {
  const { data } = await supabase.from('kelas')
    .select('id').eq('id', kelasId).eq('guru_id', guruId).maybeSingle();
  return !!data;
}

// Multer – simpan di memory dulu, lalu upload ke Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (MATERI_ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format file tidak didukung.'));
  }
});

// Helper: upload file ke Supabase Storage.
// Ekstensi & contentType diambil dari MIME yang TERDETEKSI dari isi file,
// bukan dari nama/Content-Type kiriman klien (anti-spoof).
async function uploadToStorage(file, folder, detectedMime) {
  const ext = EXT_FOR_MIME[detectedMime] || 'bin';
  const filename = `${folder}/${uuidv4()}.${ext}`;

  const { error } = await supabase.storage
    .from('materi-files')
    .upload(filename, file.buffer, { contentType: detectedMime, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('materi-files').getPublicUrl(filename);
  return data.publicUrl;
}

// =====================================================
// POST /api/materi/upload – Upload file PDF/gambar
// =====================================================
router.post('/upload', authMiddleware, guruOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, pesan: 'File tidak ditemukan.' });

    let { judul, deskripsi, mapel, jenis, kelas_id, status } = req.body;
    jenis = jenis || 'pdf';
    const allowedMime = MATERI_MIME_BY_JENIS[jenis];
    if (!allowedMime) return res.status(400).json({ success: false, pesan: 'Jenis upload tidak valid.' });

    // Validasi isi file (magic bytes), bukan sekadar Content-Type yang bisa dipalsukan.
    const check = validateUpload(req.file.buffer, allowedMime);
    if (!check.ok)
      return res.status(400).json({ success: false, pesan: jenis === 'gambar' ? 'Gambar harus berupa PNG, JPEG, atau WebP.' : 'File harus berupa PDF.' });

    if (!judul || !mapel) return res.status(400).json({ success: false, pesan: 'Judul dan mapel wajib diisi.' });
    // KEAMANAN: cegah guru menempel materi ke kelas milik guru lain.
    if (kelas_id && !(await guruMemilikiKelas(req.user.id, kelas_id)))
      return res.status(403).json({ success: false, pesan: 'Kelas itu bukan milikmu.' });
    judul = cleanText(judul, 150);
    mapel = cleanText(mapel, 60);
    deskripsi = deskripsi ? cleanText(deskripsi, 500) : null;

    const file_url = await uploadToStorage(req.file, (mapel || 'umum').toLowerCase().replace(/\s+/g, '-'), check.mime);

    const id = uuidv4();
    const { error } = await supabase.from('materi').insert({
      id,
      judul,
      deskripsi: deskripsi || null,
      mapel,
      jenis,
      konten: file_url,
      file_url,
      guru_id: req.user.id,
      kelas_id: kelas_id || null,
      status: status || 'aktif',
      views: 0
    });
    if (error) throw error;

    // Notifikasi ke murid di kelas
    if (kelas_id) {
      const { data: muridList } = await supabase
        .from('kelas_murid').select('murid_id').eq('kelas_id', kelas_id);
      if (muridList?.length) {
        const notifs = muridList.map(m => ({
          id: uuidv4(), user_id: m.murid_id,
          judul: '📚 Materi Baru!',
          pesan: `Guru menambahkan materi baru: "${judul}" (${mapel})`,
          tipe: 'materi',
          data_extra: JSON.stringify({ kelas_id })
        }));
        await supabase.from('notifikasi').insert(notifs);
        // Emit real-time socket ke setiap murid
        const io = req.app.get('io');
        if (io) {
          muridList.forEach(m => {
            io.to('user:' + m.murid_id).emit('notif:baru', {
              tipe: 'materi',
              judul: '📚 Materi Baru!',
              pesan: `Guru menambahkan materi baru: "${judul}" (${mapel})`,
              created_at: new Date().toISOString()
            });
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      pesan: `File "${judul}" berhasil diupload!`,
      data: { id, judul, mapel, jenis, file_url }
    });
  } catch (err) {
    console.error('Upload error:', err.message);
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// POST /api/materi – Tambah materi teks/video/gambar
// =====================================================
router.post('/', authMiddleware, guruOnly, async (req, res) => {
  try {
    let { judul, deskripsi, mapel, jenis, konten, file_url, kelas_id, status } = req.body;
    if (!judul || !mapel || !jenis)
      return res.status(400).json({ success: false, pesan: 'Judul, mapel, dan jenis wajib diisi.' });
    // KEAMANAN: cegah guru menempel materi ke kelas milik guru lain.
    if (kelas_id && !(await guruMemilikiKelas(req.user.id, kelas_id)))
      return res.status(403).json({ success: false, pesan: 'Kelas itu bukan milikmu.' });
    judul = cleanText(judul, 150);
    mapel = cleanText(mapel, 60);
    deskripsi = deskripsi ? cleanText(deskripsi, 500) : null;
    // Catatan: `konten` (isi teks/markdown atau URL) TIDAK di-cleanText agar
    // konten panjang/kode tidak rusak — dirender aman via escapeHtml (src) / renderMarkdown.

    const id = uuidv4();
    const { error } = await supabase.from('materi').insert({
      id, judul,
      deskripsi: deskripsi || null,
      mapel, jenis,
      konten: konten || null,
      file_url: file_url || null,
      guru_id: req.user.id,
      kelas_id: kelas_id || null,
      status: status || 'aktif',
      views: 0
    });
    if (error) throw error;

    // Notifikasi ke murid di kelas
    if (kelas_id) {
      const { data: muridList } = await supabase
        .from('kelas_murid').select('murid_id').eq('kelas_id', kelas_id);
      if (muridList?.length) {
        const notifs = muridList.map(m => ({
          id: uuidv4(), user_id: m.murid_id,
          judul: '📚 Materi Baru!',
          pesan: `Guru menambahkan materi baru: "${judul}" (${mapel})`,
          tipe: 'materi',
          data_extra: JSON.stringify({ kelas_id })
        }));
        await supabase.from('notifikasi').insert(notifs);
        const io = req.app.get('io');
        if (io) {
          muridList.forEach(m => {
            io.to('user:' + m.murid_id).emit('notif:baru', {
              tipe: 'materi',
              judul: '📚 Materi Baru!',
              pesan: `Guru menambahkan materi baru: "${judul}" (${mapel})`,
              created_at: new Date().toISOString()
            });
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      pesan: `Materi "${judul}" berhasil ditambahkan!`,
      data: { id, judul, mapel, jenis, file_url }
    });
  } catch (err) {
    console.error('Materi error:', err.message);
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// =====================================================
// GET /api/materi – List materi
// =====================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { mapel, kelas_id, status, search } = req.query;
    let query = supabase.from('materi').select('*, guru:guru_id(nama)');

    if (req.user.role === 'guru') {
      query = query.eq('guru_id', req.user.id);
      if (status) query = query.eq('status', status);
    } else {
      query = query.eq('status', 'aktif');
    }

    if (mapel) query = query.eq('mapel', mapel);
    if (kelas_id) query = query.eq('kelas_id', kelas_id);
    if (search) query = query.ilike('judul', `%${search}%`);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // Tambah info progres murid
    if (req.user.role === 'murid' && data?.length) {
      const { data: progres } = await supabase
        .from('progres_materi').select('materi_id, selesai').eq('murid_id', req.user.id);
      const progresMap = {};
      progres?.forEach(p => { progresMap[p.materi_id] = p.selesai; });
      data.forEach(m => { m.sudah_dibaca = progresMap[m.id] === true; });
    }

    // Return dengan key 'materi' supaya frontend bisa baca
    res.json({ success: true, materi: data || [], data: data || [], total: data?.length || 0 });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// GET /api/materi/:id – Detail materi
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: materi, error } = await supabase
      .from('materi').select('*, guru:guru_id(nama)').eq('id', req.params.id).single();
    if (!materi || error) return res.status(404).json({ success: false, pesan: 'Materi tidak ditemukan.' });

    // Anti-IDOR: murid hanya boleh materi 'aktif' (draft milik guru tak boleh bocor);
    // guru hanya boleh materi miliknya sendiri.
    if (req.user.role === 'murid' && materi.status !== 'aktif')
      return res.status(404).json({ success: false, pesan: 'Materi tidak ditemukan.' });
    if (req.user.role === 'guru' && materi.guru_id !== req.user.id)
      return res.status(403).json({ success: false, pesan: 'Bukan materi milikmu.' });

    await supabase.from('materi').update({ views: (materi.views || 0) + 1 }).eq('id', req.params.id);

    res.json({ success: true, data: materi });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// PUT /api/materi/:id
router.put('/:id', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { judul, deskripsi, mapel, konten, status } = req.body;
    const updates = {};
    if (judul) updates.judul = judul;
    if (deskripsi) updates.deskripsi = deskripsi;
    if (mapel) updates.mapel = mapel;
    if (konten) updates.konten = konten;
    if (status) updates.status = status;

    const { error } = await supabase.from('materi')
      .update(updates).eq('id', req.params.id).eq('guru_id', req.user.id);
    if (error) throw error;

    res.json({ success: true, pesan: 'Materi berhasil diperbarui.' });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// DELETE /api/materi/:id
router.delete('/:id', authMiddleware, guruOnly, async (req, res) => {
  try {
    const { data: materi } = await supabase
      .from('materi').select('judul, kelas_id').eq('id', req.params.id).eq('guru_id', req.user.id).single();
    if (!materi) return res.status(404).json({ success: false, pesan: 'Materi tidak ditemukan.' });

    const materiId = req.params.id;

    // Bersihkan jejak murid terlebih dahulu agar materi yang dihapus tidak muncul dari progres/notifikasi lama.
    await supabase.from('progres_materi').delete().eq('materi_id', materiId);
    await supabase.from('notifikasi').delete().eq('tipe', 'materi').ilike('pesan', `%${materi.judul}%`);

    const { error } = await supabase.from('materi').delete().eq('id', materiId).eq('guru_id', req.user.id);
    if (error) throw error;

    res.json({ success: true, pesan: `Materi "${materi.judul}" berhasil dihapus.` });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// POST /api/materi/:id/selesai – Murid tandai selesai, dapat +20 XP
router.post('/:id/selesai', authMiddleware, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('progres_materi').select('selesai')
      .eq('murid_id', req.user.id).eq('materi_id', req.params.id).single();

    if (existing?.selesai)
      return res.json({ success: true, pesan: 'Materi sudah pernah diselesaikan.', xp_dapat: 0, selesai: true });

    await supabase.from('progres_materi').upsert({
      murid_id: req.user.id, materi_id: req.params.id, selesai: true
    });

    const statsResult = await updateUserStats(req.user.id, { xpDapat: 20, tipe: 'materi' });
    await checkMisi(req.user.id, { tipe_aktivitas: 'materi', xpDapat: 20 });

    res.json({ success: true, pesan: '+20 XP! Materi berhasil diselesaikan.', xp_dapat: 20, total_xp: statsResult?.newXp || 0, selesai: true });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

// DELETE /api/materi/:id/selesai – Murid batal tandai selesai
router.delete('/:id/selesai', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('progres_materi')
      .delete()
      .eq('murid_id', req.user.id)
      .eq('materi_id', req.params.id);
    if (error) throw error;

    res.json({ success: true, pesan: 'Materi ditandai belum dibaca.', selesai: false });
  } catch (err) {
    console.error(err.message); res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;