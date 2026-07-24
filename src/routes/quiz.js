// =====================================================
//  src/routes/quiz.js
//  Tambahkan ke server.js:
//    const quizRoutes = require('./routes/quiz');
//    app.use('/api/quiz', quizRoutes);
//    app.use('/api/hasil-quiz', quizRoutes);  // untuk POST hasil
// =====================================================

const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { decrypt } = require('../utils/crypto');
const { updateUserStats, checkMisi } = require('../utils/gamification');
const { cleanText } = require('../utils/sanitize');
const { validateUpload, EXT_FOR_MIME } = require('../utils/fileType');

// Tipe submission yang benar-benar diizinkan (dicek dari isi file).
const SUBMISSION_ALLOWED_MIME = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword', 'application/zip' // zip mencakup .docx
];

// Multer untuk submission file (10MB max)
const uploadSubmission = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

// Auto-buat bucket "submissions" saat module dimuat (aman jika sudah ada)
supabase.storage.createBucket('submissions', { public: true })
  .then(({ error }) => {
    if (error && !error.message?.includes('already exists') && !error.message?.includes('Duplicate')) {
      console.warn('[storage] Bucket submissions:', error.message);
    } else {
      console.log('[storage] Bucket submissions siap.');
    }
  })
  .catch(() => {});

// Cek tabel tugas_submission ada (ingatkan jika migration belum dijalankan)
supabase.from('tugas_submission').select('id', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) console.warn('[migration] Tabel tugas_submission belum ada! Jalankan migration_submission.sql di Supabase SQL Editor.');
    else console.log('[migration] Tabel tugas_submission siap.');
  })
  .catch(() => {});

// ── Middleware auth (ambil dari server.js milikmu jika berbeda) ──
const jwt = require('jsonwebtoken');
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, pesan: 'Token tidak ada' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ success: false, pesan: 'Token tidak valid' });
  }
}

// ============================================================
//  GET /api/quiz?kelas_id=xxx  — daftar kuis per kelas
// ============================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { kelas_id } = req.query;
    let query = supabase
      .from('quiz')
      .select(`
        id, judul, deskripsi, mapel, durasi, tipe, deadline, status, created_at, kelas_id, tipe_submission,
        quiz_soal(count)
      `)
      .eq('status', 'aktif')
      .order('created_at', { ascending: false });

    if (kelas_id) query = query.eq('kelas_id', kelas_id);

    const { data, error } = await query;
    if (error) throw error;

    // Tambahkan total_soal
    const result = (data || []).map(q => ({
      ...q,
      total_soal: q.quiz_soal?.[0]?.count || 0
    }));

    return res.json({ success: true, quiz: result });
  } catch(e) {
    console.error('[GET /quiz]', e.message);
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  GET /api/quiz/:id  — detail kuis + soal-soalnya
//  Guru: soal + jawaban (terdekripsi)
//  Murid: soal tanpa jawaban (validasi dilakukan server-side saat submit)
// ============================================================
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const isGuru = req.user.role === 'guru';

    const { data: quiz, error: qErr } = await supabase
      .from('quiz').select('*').eq('id', id).single();
    if (qErr) throw qErr;

    const { data: qs, error: sErr } = await supabase
      .from('quiz_soal')
      .select('urutan, soal(id, pertanyaan, emoji, mapel, jenis, opsi, jawaban, poin)')
      .eq('quiz_id', id)
      .order('urutan');
    if (sErr) throw sErr;

    const soal = (qs || []).map(r => {
      const s = { ...r.soal };
      if (isGuru) {
        s.jawaban = decrypt(s.jawaban); // guru boleh lihat jawaban (terdekripsi)
      } else {
        delete s.jawaban; // murid tidak menerima jawaban — validasi di server
      }
      return s;
    });

    return res.json({ success: true, quiz: { ...quiz, soal } });
  } catch(e) {
    console.error('[GET /quiz/:id]', e.message);
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  POST /api/quiz  — buat kuis baru
// ============================================================
router.post('/', authMiddleware, async (req, res) => {
  try {
    let { judul, deskripsi, mapel, kelas_id, durasi, tipe, deadline, status, soal_ids, tipe_submission, max_attempt } = req.body;
    if (!judul) return res.status(400).json({ success: false, pesan: 'Judul wajib diisi' });
    judul = cleanText(judul, 150);
    mapel = mapel ? cleanText(mapel, 60) : mapel;
    deskripsi = deskripsi ? cleanText(deskripsi, 500) : deskripsi;

    const guru_id = req.user.id || req.user.userId;

    // Insert quiz
    const { data: quiz, error } = await supabase
      .from('quiz')
      .insert({
        judul,
        deskripsi: deskripsi || null,
        mapel: mapel || 'Umum',
        guru_id,
        kelas_id: kelas_id || null,
        durasi: durasi || 15,
        tipe: tipe || 'fun',
        deadline: deadline || null,
        status: status || 'aktif',
        tipe_submission: tipe_submission || null,
        max_attempt: max_attempt || 1
      })
      .select()
      .single();

    if (error) throw error;

    // Jika ada soal_ids, langsung insert quiz_soal sekalian
    if (soal_ids && soal_ids.length > 0) {
      const rows = soal_ids.map((sid, idx) => ({
        quiz_id: quiz.id,
        soal_id: sid,
        urutan: idx + 1
      }));
      const { error: qsErr } = await supabase.from('quiz_soal').insert(rows);
      if (qsErr) console.warn('[quiz_soal insert]', qsErr.message);
    }

    // Notifikasi ke murid di kelas jika kuis punya kelas_id
    if (kelas_id) {
      const { v4: uuidv4 } = require('uuid');
      const { data: muridList } = await supabase
        .from('kelas_murid').select('murid_id').eq('kelas_id', kelas_id);
      if (muridList?.length) {
        const notifs = muridList.map(m => ({
          id: uuidv4(), user_id: m.murid_id,
          judul: '📝 Kuis Baru!',
          pesan: `Guru membuat kuis baru: "${judul}" (${mapel || 'Umum'})`,
          tipe: 'quiz',
          data_extra: JSON.stringify({ kelas_id })
        }));
        await supabase.from('notifikasi').insert(notifs);
        const io = req.app.get('io');
        if (io) {
          muridList.forEach(m => {
            io.to('user:' + m.murid_id).emit('notif:baru', {
              tipe: 'quiz',
              judul: '📝 Kuis Baru!',
              pesan: `Guru membuat kuis baru: "${judul}" (${mapel || 'Umum'})`,
              created_at: new Date().toISOString()
            });
          });
        }
      }
    }

    return res.status(201).json({ success: true, quiz, pesan: 'Kuis berhasil dibuat' });
  } catch(e) {
    console.error('[POST /quiz]', e.message);
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  POST /api/quiz/:id/soal  — tambah soal ke kuis
// ============================================================
router.post('/:id/soal', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { soal_id, urutan } = req.body;
    if (!soal_id) return res.status(400).json({ success: false, pesan: 'soal_id wajib' });

    const { error } = await supabase.from('quiz_soal').upsert(
      { quiz_id: id, soal_id, urutan: urutan || 1 },
      { onConflict: 'quiz_id,soal_id' }
    );
    if (error) throw error;

    return res.json({ success: true, pesan: 'Soal ditambahkan' });
  } catch(e) {
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  DELETE /api/quiz/:id  — hapus kuis
// ============================================================
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const guru_id = req.user.id || req.user.userId;

    // Pastikan kuis milik guru ini
    const { data: quiz } = await supabase
      .from('quiz').select('id, guru_id, judul').eq('id', id).single();

    if (!quiz) return res.status(404).json({ success: false, pesan: 'Kuis tidak ditemukan' });
    if (quiz.guru_id !== guru_id) return res.status(403).json({ success: false, pesan: 'Bukan hak kamu' });

    // Hapus data turunan dulu agar tugas/kuis yang dihapus tidak tersisa di akun murid.
    await supabase.from('tugas_submission').delete().eq('quiz_id', id);
    await supabase.from('hasil_quiz').delete().eq('quiz_id', id);
    await supabase.from('quiz_soal').delete().eq('quiz_id', id);
    await supabase.from('notifikasi').delete().in('tipe', ['quiz', 'tugas']).ilike('pesan', `%${quiz.judul}%`);

    const { error } = await supabase.from('quiz').delete().eq('id', id).eq('guru_id', guru_id);
    if (error) throw error;

    return res.json({ success: true, pesan: 'Kuis berhasil dihapus' });
  } catch(e) {
    return res.status(500).json({ success: false, pesan: e.message });
  }
});

// ============================================================
//  POST /api/quiz/hasil  — simpan + validasi hasil pengerjaan murid
//  Body: { quiz_id, jawaban: [{soal_id, jawaban_user}], durasi_detik }
//  Scoring dilakukan server-side agar jawaban tidak perlu dikirim ke client
// ============================================================
router.post('/hasil', authMiddleware, async (req, res) => {
  try {
    const { quiz_id, jawaban: jawabanMurid, durasi_detik } = req.body;
    const murid_id = req.user.id || req.user.userId;
    if (!quiz_id) return res.status(400).json({ success: false, pesan: 'quiz_id wajib' });

    // Ambil max_attempt dari quiz
    const { data: quizData } = await supabase
      .from('quiz').select('max_attempt').eq('id', quiz_id).single();
    const maxAttempt = quizData?.max_attempt ?? 1;

    // Cek jumlah percobaan yang sudah dilakukan
    const { data: existing, count: attemptCount } = await supabase
      .from('hasil_quiz').select('id, skor, benar, total_soal', { count: 'exact' })
      .eq('murid_id', murid_id).eq('quiz_id', quiz_id);

    if (existing && existing.length >= maxAttempt) {
      const last = existing[existing.length - 1];
      return res.json({
        success: true, pesan: 'Batas percobaan habis',
        skor: last.skor, benar: last.benar,
        total_soal: last.total_soal, totalPoin: last.skor || 0,
        attempt: existing.length, max_attempt: maxAttempt,
        detail: []
      });
    }

    // Ambil soal quiz dengan jawaban terenkripsi untuk validasi
    const { data: qs, error: sErr } = await supabase
      .from('quiz_soal')
      .select('soal(id, jawaban, poin, jenis)')
      .eq('quiz_id', quiz_id)
      .order('urutan');
    if (sErr) throw sErr;

    const soalList = (qs || []).map(r => r.soal).filter(Boolean);
    const total_soal = soalList.length;
    let benar = 0, totalPoin = 0;
    const detail = [];

    soalList.forEach(q => {
      const jawabanBenar = decrypt(q.jawaban); // dekripsi jawaban dari DB
      const entry = (jawabanMurid || []).find(j => j.soal_id === q.id);
      const jawabanUser = entry?.jawaban_user || null;
      const isBenar = jawabanUser !== null &&
        jawabanUser.trim().toLowerCase() === jawabanBenar.trim().toLowerCase();
      const poinDapat = isBenar ? (q.poin || 100) : 0;
      if (isBenar) { benar++; totalPoin += poinDapat; }
      detail.push({ soal_id: q.id, benar: isBenar, poin_dapat: poinDapat });
    });

    const skor = total_soal > 0 ? Math.round((benar / total_soal) * 100) : 0;

    // Simpan hasil
    const { v4: uuidv4 } = require('uuid');
    const { data: hasil, error } = await supabase
      .from('hasil_quiz')
      .insert({
        id: uuidv4(), murid_id, quiz_id,
        skor, benar, total_soal,
        durasi_detik: durasi_detik || 0
      })
      .select().single();

    if (error) {
      console.error('[POST /quiz/hasil] insert error:', error.message);
      return res.status(500).json({ success: false, pesan: 'Gagal menyimpan hasil: ' + error.message });
    }

    // Update XP + stats + cek misi
    try {
      const xpGain = Math.round(skor / 10);
      await updateUserStats(murid_id, { xpDapat: xpGain, skor, tipe: 'quiz' });
      await checkMisi(murid_id, { tipe_aktivitas: 'quiz', nilai: skor, xpDapat: xpGain });
    } catch(xpErr) { console.warn('[XP update]', xpErr.message); }

    return res.status(201).json({ success: true, pesan: 'Hasil tersimpan!', hasil, skor, benar, total_soal, totalPoin, detail });
  } catch(e) {
    console.error('[POST /quiz/hasil]', e.message);
    return res.status(500).json({ success: false, pesan: 'Gagal menyimpan hasil.' });
  }
});

// ============================================================
//  GET /api/hasil-quiz/cek?quiz_id=xxx  — cek apakah murid sudah kerjakan
// ============================================================
router.get('/hasil/cek', authMiddleware, async (req, res) => {
  try {
    const { quiz_id } = req.query;
    const murid_id = req.user.id || req.user.userId;

    const { data: quizData } = await supabase
      .from('quiz').select('max_attempt').eq('id', quiz_id).single();
    const maxAttempt = quizData?.max_attempt ?? 1;

    const { data, error } = await supabase
      .from('hasil_quiz')
      .select('id, skor, benar, total_soal')
      .eq('murid_id', murid_id)
      .eq('quiz_id', quiz_id)
      .order('selesai_at', { ascending: false });

    if (error) {
      console.error('[GET /quiz/hasil/cek]', error.message);
      return res.json({ success: true, sudah: false, attempt: 0, max_attempt: maxAttempt, hasil: null });
    }
    const hasil = (data && data[0]) || null;
    return res.json({
      success: true, sudah: !!hasil,
      attempt: data?.length || 0, max_attempt: maxAttempt,
      hasil
    });
  } catch(e) {
    console.error('[GET /quiz/hasil/cek catch]', e.message);
    return res.json({ success: true, sudah: false, attempt: 0, max_attempt: 1, hasil: null });
  }
});

// ============================================================
//  POST /api/quiz/:id/submission — murid kumpulkan tugas
//  Tipe: teks/link → JSON body. tipe: file/gambar → multipart
// ============================================================
router.post('/:id/submission', authMiddleware, (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    uploadSubmission.single('file')(req, res, next);
  } else {
    next();
  }
}, async (req, res) => {
  try {
    const quiz_id  = req.params.id;
    const murid_id = req.user.id || req.user.userId;

    // Cek quiz ada & punya tipe_submission
    const { data: quiz } = await supabase.from('quiz').select('id, judul, tipe_submission, deadline, kelas_id').eq('id', quiz_id).single();
    if (!quiz) return res.status(404).json({ success: false, pesan: 'Kuis tidak ditemukan.' });
    if (!quiz.tipe_submission) return res.status(400).json({ success: false, pesan: 'Kuis ini tidak menerima submission.' });
    if (quiz.deadline && new Date(quiz.deadline) < new Date()) return res.status(400).json({ success: false, pesan: 'Tenggat waktu sudah lewat.' });

    // Cek sudah submit sebelumnya
    const { data: existing } = await supabase.from('tugas_submission').select('id').eq('quiz_id', quiz_id).eq('murid_id', murid_id).maybeSingle();
    if (existing) return res.status(400).json({ success: false, pesan: 'Kamu sudah mengumpulkan tugas ini.' });

    const tipe    = req.body.tipe;  // 'file', 'link', 'gambar', 'teks'
    const catatan = req.body.catatan || null;

    if (!['file', 'link', 'gambar', 'teks'].includes(tipe)) {
      return res.status(400).json({ success: false, pesan: 'Tipe submission tidak valid.' });
    }

    let konten   = null;
    let file_url = null;
    let file_nama = null;
    let file_size = null;

    if (tipe === 'teks') {
      konten = (req.body.konten || '').trim();
      if (!konten) return res.status(400).json({ success: false, pesan: 'Isi teks tidak boleh kosong.' });
    } else if (tipe === 'link') {
      konten = (req.body.konten || '').trim();
      if (!konten || !konten.startsWith('http')) return res.status(400).json({ success: false, pesan: 'URL link tidak valid.' });
    } else if (tipe === 'file' || tipe === 'gambar') {
      if (!req.file) return res.status(400).json({ success: false, pesan: 'File tidak ditemukan.' });
      // Validasi isi file (magic bytes), bukan Content-Type kiriman klien.
      const check = validateUpload(req.file.buffer, SUBMISSION_ALLOWED_MIME);
      if (!check.ok)
        return res.status(400).json({ success: false, pesan: 'Isi file tidak cocok dengan format yang diizinkan (PDF/gambar/dokumen).' });
      const ext  = EXT_FOR_MIME[check.mime] || 'bin';
      const filePath = `${quiz_id}/${murid_id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('submissions').upload(filePath, req.file.buffer, { contentType: check.mime, upsert: false });
      if (upErr) {
        console.error('[submission upload]', upErr.message);
        return res.status(500).json({ success: false, pesan: 'Gagal mengupload file. Coba lagi.' });
      }
      const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(filePath);
      file_url  = urlData.publicUrl;
      file_nama = req.file.originalname;
      file_size = req.file.size;
    }

    const { data: sub, error } = await supabase.from('tugas_submission').insert({
      quiz_id, murid_id, tipe, konten, file_url, file_nama, file_size, catatan
    }).select().single();
    if (error) throw error;

    // Notif ke guru
    if (quiz.kelas_id) {
      const { data: kelas } = await supabase.from('kelas').select('guru_id').eq('id', quiz.kelas_id).single();
      if (kelas?.guru_id) {
        await supabase.from('notifikasi').insert({
          id: uuidv4(), user_id: kelas.guru_id,
          judul: '📤 Submission Tugas Baru',
          pesan: `Ada murid yang mengumpulkan tugas "${quiz.judul}"`
        });
        const io = req.app.get('io');
        if (io) io.to('user:' + kelas.guru_id).emit('notif:baru', { tipe: 'submission', judul: '📤 Submission Tugas Baru', pesan: `Ada murid yang mengumpulkan tugas "${quiz.judul}"`, created_at: new Date().toISOString() });
      }
    }

    // Beri XP untuk mengumpulkan tugas
    try {
      await updateUserStats(murid_id, { xpDapat: 25, tipe: 'tugas' });
      await checkMisi(murid_id, { tipe_aktivitas: 'tugas', xpDapat: 25 });
    } catch(xpErr) { console.warn('[XP tugas]', xpErr.message); }

    res.json({ success: true, pesan: 'Tugas berhasil dikumpulkan! +25 XP', data: sub });
  } catch(e) {
    console.error('[POST /quiz/:id/submission]', e.message);
    res.status(500).json({ success: false, pesan: 'Gagal mengumpulkan tugas.' });
  }
});

// ============================================================
//  GET /api/quiz/:id/submissions — guru lihat semua submission
// ============================================================
router.get('/:id/submissions', authMiddleware, async (req, res) => {
  try {
    const quiz_id = req.params.id;
    const { data: quiz } = await supabase.from('quiz').select('guru_id, judul, tipe_submission').eq('id', quiz_id).single();
    if (!quiz) return res.status(404).json({ success: false, pesan: 'Kuis tidak ditemukan.' });
    if (quiz.guru_id !== (req.user.id || req.user.userId)) return res.status(403).json({ success: false, pesan: 'Bukan milik kamu.' });

    const { data, error } = await supabase
      .from('tugas_submission')
      .select('*, murid:murid_id(id, nama, avatar)')
      .eq('quiz_id', quiz_id)
      .order('submitted_at', { ascending: false });
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch(e) {
    console.error('[GET /quiz/:id/submissions]', e.message);
    res.status(500).json({ success: false, pesan: 'Gagal memuat submission.' });
  }
});

// ============================================================
//  PUT /api/quiz/:id/submissions/:sub_id/nilai — guru beri nilai
// ============================================================
router.put('/:id/submissions/:sub_id/nilai', authMiddleware, async (req, res) => {
  try {
    const { nilai, feedback } = req.body;
    if (nilai == null || nilai < 0 || nilai > 100) return res.status(400).json({ success: false, pesan: 'Nilai harus 0-100.' });

    const { data: quiz } = await supabase.from('quiz').select('guru_id').eq('id', req.params.id).single();
    if (!quiz || quiz.guru_id !== (req.user.id || req.user.userId)) return res.status(403).json({ success: false, pesan: 'Tidak diizinkan.' });

    const { data: sub } = await supabase.from('tugas_submission').update({ nilai: parseInt(nilai), feedback: feedback || null, dinilai_at: new Date().toISOString() }).eq('id', req.params.sub_id).select('murid_id').single();

    // Notif ke murid
    if (sub?.murid_id) {
      const { data: qz } = await supabase.from('quiz').select('judul, kelas_id').eq('id', req.params.id).single();
      await supabase.from('notifikasi').insert({
        id: uuidv4(), user_id: sub.murid_id,
        judul: '📊 Tugas Dinilai',
        pesan: `Tugasmu "${qz?.judul}" sudah dinilai: ${nilai}/100`,
        tipe: 'tugas',
        data_extra: qz?.kelas_id ? JSON.stringify({ kelas_id: qz.kelas_id }) : null
      });
      const io = req.app.get('io');
      if (io) io.to('user:' + sub.murid_id).emit('notif:baru', { tipe: 'nilai', judul: '📊 Tugas Dinilai', pesan: `Tugasmu "${qz?.judul}" sudah dinilai: ${nilai}/100`, created_at: new Date().toISOString() });
    }

    res.json({ success: true, pesan: 'Nilai berhasil disimpan.' });
  } catch(e) {
    console.error('[PUT submission/nilai]', e.message);
    res.status(500).json({ success: false, pesan: 'Gagal menyimpan nilai.' });
  }
});

// ============================================================
//  GET /api/quiz/:id/submission/cek — murid cek status submission
// ============================================================
router.get('/:id/submission/cek', authMiddleware, async (req, res) => {
  try {
    const murid_id = req.user.id || req.user.userId;
    const { data } = await supabase.from('tugas_submission').select('id, tipe, submitted_at, nilai, feedback').eq('quiz_id', req.params.id).eq('murid_id', murid_id).maybeSingle();
    res.json({ success: true, sudah: !!data, submission: data || null });
  } catch(e) {
    res.json({ success: true, sudah: false, submission: null });
  }
});

module.exports = router;
