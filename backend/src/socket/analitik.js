// =====================================================
//  src/routes/analitik.js
//  Analitik per-murid untuk guru.
//  Mounted di server.js pada prefix '/api/analitik'.
//
//  PRINSIP DESAIN (lihat diskusi produk):
//  - Sinyal ditampilkan TERPISAH, tidak digabung jadi satu skor risiko.
//    Alasan: belum ada data historis untuk memvalidasi bobot yang
//    "benar" — skor gabungan yang bobotnya asal tebak justru
//    menyesatkan guru karena terlihat presisi padahal cuma tebakan.
//  - Threshold aktivitas login pakai perbandingan RELATIF ke pola
//    murid itu sendiri, bukan angka mutlak — karena pola belajar
//    tiap bimbel berbeda (harian vs beberapa kali seminggu).
//  - Setiap sinyal jujur soal keterbatasan datanya (lihat komentar
//    di masing-masing fungsi). Ini bukan "early warning system"
//    yang sudah tervalidasi — ini visibilitas data mentah untuk guru.
// =====================================================

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware, guruOnly } = require('../middleware/auth');

// Anti-IDOR: pastikan kelas ini benar milik guru yang login.
async function guruMemilikiKelas(guruId, kelasId) {
  const { data } = await supabase.from('kelas')
    .select('id').eq('id', kelasId).eq('guru_id', guruId).maybeSingle();
  return !!data;
}

// ── Sinyal: Tren Nilai Quiz ──────────────────────────────────
// Bandingkan rata-rata 3 quiz terakhir vs rata-rata quiz sebelumnya.
// Butuh minimal 2 hasil quiz untuk bisa bicara "tren" sama sekali.
function hitungTrenQuiz(hasilQuizMurid) {
  const diurutkan = [...hasilQuizMurid].sort((a, b) => new Date(a.selesai_at) - new Date(b.selesai_at));
  if (diurutkan.length < 2) {
    return { status: 'data_kurang', pesan: 'Belum cukup data quiz untuk melihat tren.', total_quiz: diurutkan.length };
  }

  // Bandingkan sampai 3 hasil quiz terakhir vs semua hasil sebelumnya.
  const nTerbaru = Math.min(3, diurutkan.length - 1);
  const terbaru = diurutkan.slice(-nTerbaru);
  const sebelumnya = diurutkan.slice(0, diurutkan.length - nTerbaru);
  if (sebelumnya.length === 0) {
    return { status: 'data_kurang', pesan: 'Belum cukup data quiz untuk melihat tren.', total_quiz: diurutkan.length };
  }

  const rataTerbaru = terbaru.reduce((s, h) => s + h.skor, 0) / terbaru.length;
  const rataSebelumnya = sebelumnya.reduce((s, h) => s + h.skor, 0) / sebelumnya.length;
  const selisihPersen = rataSebelumnya > 0 ? Math.round(((rataTerbaru - rataSebelumnya) / rataSebelumnya) * 100) : 0;

  let status = 'stabil';
  if (selisihPersen <= -20) status = 'turun_tajam';
  else if (selisihPersen <= -10) status = 'turun';
  else if (selisihPersen >= 10) status = 'naik';

  return {
    status,
    rata_terbaru: Math.round(rataTerbaru),
    rata_sebelumnya: Math.round(rataSebelumnya),
    selisih_persen: selisihPersen,
    total_quiz: diurutkan.length
  };
}

// ── Sinyal: Ketepatan Tugas ──────────────────────────────────
// Dari tugas (quiz dengan tipe_submission) yang deadline-nya sudah lewat:
// berapa yang dikumpulkan tepat waktu vs telat vs tidak dikumpulkan sama sekali.
function hitungKetepatanTugas(tugasKelas, submisiMurid) {
  const submisiMap = {};
  submisiMurid.forEach(s => { submisiMap[s.quiz_id] = s; });

  const sekarang = new Date();
  const tugasSudahLewatDeadline = tugasKelas.filter(t => t.deadline && new Date(t.deadline) < sekarang);

  if (tugasSudahLewatDeadline.length === 0) {
    return { status: 'data_kurang', pesan: 'Belum ada tugas dengan tenggat yang sudah lewat.', total_tugas: 0 };
  }

  let tepatWaktu = 0, telat = 0, tidakKumpul = 0;
  tugasSudahLewatDeadline.forEach(t => {
    const sub = submisiMap[t.id];
    if (!sub) { tidakKumpul++; return; }
    if (new Date(sub.submitted_at) <= new Date(t.deadline)) tepatWaktu++;
    else telat++;
  });

  const total = tugasSudahLewatDeadline.length;
  const persenBermasalah = Math.round(((telat + tidakKumpul) / total) * 100);

  let status = 'baik';
  if (persenBermasalah >= 50) status = 'perlu_perhatian';
  else if (persenBermasalah >= 25) status = 'agak_terlambat';

  return { status, tepat_waktu: tepatWaktu, telat, tidak_kumpul: tidakKumpul, total_tugas: total, persen_bermasalah: persenBermasalah };
}

// ── Sinyal: Aktivitas Login ───────────────────────────────────
// PENTING: last_login_at baru mulai tercatat sejak migration dijalankan.
// Untuk murid yang belum pernah login sejak itu, nilainya NULL —
// bukan berarti "tidak aktif", tapi "belum ada data".
function hitungAktivitasLogin(lastLoginAt) {
  if (!lastLoginAt) {
    return { status: 'belum_ada_data', pesan: 'Login terakhir belum tercatat (mulai terekam sejak fitur ini aktif).' };
  }
  const hariSejakLogin = Math.floor((Date.now() - new Date(lastLoginAt).getTime()) / (1000 * 60 * 60 * 24));

  // Belum ada cukup histori untuk threshold RELATIF per murid (butuh
  // beberapa minggu data). Untuk sementara pakai angka tetap yang longgar,
  // dan ini ditandai eksplisit di response sebagai 'sementara'.
  let status = 'aktif';
  if (hariSejakLogin >= 10) status = 'tidak_aktif';
  else if (hariSejakLogin >= 5) status = 'mulai_jarang';

  return { status, hari_sejak_login: hariSejakLogin, metode: 'sementara_threshold_tetap' };
}

// =====================================================
//  GET /api/analitik/kelas/:id — sinyal per murid di satu kelas
// =====================================================
router.get('/kelas/:id', authMiddleware, guruOnly, async (req, res) => {
  try {
    const kelasId = req.params.id;
    if (!(await guruMemilikiKelas(req.user.id, kelasId)))
      return res.status(403).json({ success: false, pesan: 'Kelas ini bukan milikmu.' });

    const [
      { data: muridRows },
      { data: quizKelas },
      { data: tugasKelas }
    ] = await Promise.all([
      supabase.from('kelas_murid').select('murid:murid_id(id, nama, avatar, xp, level, last_login_at)').eq('kelas_id', kelasId),
      supabase.from('quiz').select('id').eq('kelas_id', kelasId),
      supabase.from('quiz').select('id, judul, deadline').eq('kelas_id', kelasId).not('deadline', 'is', null)
    ]);

    const murid = (muridRows || []).map(m => m.murid).filter(Boolean);
    if (murid.length === 0) return res.json({ success: true, data: [] });

    const muridIds = murid.map(m => m.id);
    const quizIds = (quizKelas || []).map(q => q.id);

    const [{ data: hasilQuizSemua }, { data: submisiSemua }] = await Promise.all([
      quizIds.length
        ? supabase.from('hasil_quiz').select('murid_id, skor, selesai_at').in('murid_id', muridIds).in('quiz_id', quizIds)
        : Promise.resolve({ data: [] }),
      tugasKelas?.length
        ? supabase.from('tugas_submission').select('murid_id, quiz_id, submitted_at').in('murid_id', muridIds).in('quiz_id', tugasKelas.map(t => t.id))
        : Promise.resolve({ data: [] })
    ]);

    const hasilPerMurid = {};
    (hasilQuizSemua || []).forEach(h => {
      (hasilPerMurid[h.murid_id] ||= []).push(h);
    });
    const submisiPerMurid = {};
    (submisiSemua || []).forEach(s => {
      (submisiPerMurid[s.murid_id] ||= []).push(s);
    });

    const result = murid.map(m => {
      const trenQuiz = hitungTrenQuiz(hasilPerMurid[m.id] || []);
      const ketepatanTugas = hitungKetepatanTugas(tugasKelas || [], submisiPerMurid[m.id] || []);
      const aktivitasLogin = hitungAktivitasLogin(m.last_login_at);

      // Hitung jumlah sinyal yang "perlu diperhatikan" — dipakai untuk
      // SORTING saja, bukan skor gabungan. Guru tetap melihat rincian
      // tiap sinyal, bukan satu angka hasil kalkulasi.
      let jumlahPerluDiperhatikan = 0;
      if (trenQuiz.status === 'turun' || trenQuiz.status === 'turun_tajam') jumlahPerluDiperhatikan++;
      if (ketepatanTugas.status === 'agak_terlambat' || ketepatanTugas.status === 'perlu_perhatian') jumlahPerluDiperhatikan++;
      if (aktivitasLogin.status === 'mulai_jarang' || aktivitasLogin.status === 'tidak_aktif') jumlahPerluDiperhatikan++;

      return {
        murid: { id: m.id, nama: m.nama, avatar: m.avatar, xp: m.xp, level: m.level },
        tren_quiz: trenQuiz,
        ketepatan_tugas: ketepatanTugas,
        aktivitas_login: aktivitasLogin,
        jumlah_perlu_diperhatikan: jumlahPerluDiperhatikan
      };
    });

    // Urutkan: yang paling banyak sinyal "perlu diperhatikan" di atas.
    result.sort((a, b) => b.jumlah_perlu_diperhatikan - a.jumlah_perlu_diperhatikan);

    res.json({
      success: true,
      data: result,
      catatan: 'Sinyal ditampilkan apa adanya, tidak digabung jadi satu skor risiko. Aktivitas login memakai threshold sementara karena data historisnya baru mulai terkumpul.'
    });
  } catch (err) {
    console.error('[GET /analitik/kelas/:id]', err.message);
    res.status(500).json({ success: false, pesan: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
});

module.exports = router;
