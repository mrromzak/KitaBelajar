const supabase = require('../supabase');
const T = require('../config/badgeThresholds');

// ── Mapping badge ID ke nama konstanta ───────────────────────
const BADGE = {
  // onboarding
  SELAMAT_DATANG:     'b0000000-0000-0000-0000-000000000001',
  LATIHAN_PERDANA:    'b3000000-0000-0000-0000-000000000001',
  PEMULA_HEBAT:       'b1000000-0000-0000-0000-000000000001',
  // streak
  AKTIF:              'b2000000-0000-0000-0000-000000000005',
  PANTANG_MENYERAH:   'b2000000-0000-0000-0000-000000000011',
  DUA_MINGGU:         'b2000000-0000-0000-0000-000000000012',
  BULAN_PENUH:        'b2000000-0000-0000-0000-000000000013',
  TAK_TERHENTIKAN:    'b2000000-0000-0000-0000-000000000019',
  RAJIN_LATIHAN:      'b3000000-0000-0000-0000-000000000002',
  COME_BACK:          'b2000000-0000-0000-0000-000000000024',
  // volume
  SPARTAN_LATIHAN:    'b3000000-0000-0000-0000-000000000003',
  SARJANA_MUDA:       'b2000000-0000-0000-0000-000000000016',
  DIAMOND:            'b2000000-0000-0000-0000-000000000003',
  MULTITASKER:        'b2000000-0000-0000-0000-000000000020',
  ALL_ROUNDER:        'b2000000-0000-0000-0000-000000000025',
  // akurasi
  TEPAT_SASARAN:      'b2000000-0000-0000-0000-000000000009',
  SEMPURNA:           'b1000000-0000-0000-0000-000000000005',
  SHARP:              'b1000000-0000-0000-0000-000000000006',
  // kecepatan
  SPEED_RUNNER:       'b2000000-0000-0000-0000-000000000018',
  // materi
  KUTU_BUKU:          'b2000000-0000-0000-0000-000000000015',
  PEMBURU_ILMU:       'b4000000-0000-0000-0000-000000000001',
  PEMBACA_MATERI:     'b4000000-0000-0000-0000-000000000004',
  PENJELAJAH_MATERI:  'b4000000-0000-0000-0000-000000000003',
  PETUALANG_MATERI:   'b1000000-0000-0000-0000-000000000010',
  AHLI:               'b2000000-0000-0000-0000-000000000010',
  // tier (SKIP — butuh fitur tambahan)
  // xp
  XP_HUNTER:          'b2000000-0000-0000-0000-000000000022',
  XP_BILLIONAIRE:     'b2000000-0000-0000-0000-000000000023',
  // unik
  QUIZ_MANIA:         'b2000000-0000-0000-0000-000000000006',
  LEGENDA_QUIZ:       'b2000000-0000-0000-0000-000000000007',
  PEJUANG:            'b2000000-0000-0000-0000-000000000002',
  MULAI_TUMBUH:       'b2000000-0000-0000-0000-000000000001',
  PELAJAR_AKTIF:      'b1000000-0000-0000-0000-000000000008',
  RAJIN_BELAJAR:      'b1000000-0000-0000-0000-000000000002',
};

// ── Helper: ambil semua badge yg sudah dimiliki murid ────────
async function getOwnedBadgeIds(murid_id) {
  const { data } = await supabase
    .from('murid_badges')
    .select('badge_id')
    .eq('murid_id', murid_id);
  return new Set((data || []).map(r => r.badge_id));
}

// ── Helper: berikan badge ke murid ───────────────────────────
async function awardBadge(murid_id, badge_id) {
  const { error } = await supabase.from('murid_badges').insert({
    murid_id,
    badge_id,
    diperoleh_at: new Date().toISOString()
  });
  if (error && !error.message?.includes('duplicate') && !error.message?.includes('unique')) {
    console.error(`[badgeChecker] award ${badge_id} failed:`, error.message);
    return null;
  }
  if (error) return null; // already owned
  const { data } = await supabase
    .from('badges')
    .select('id, nama, deskripsi, icon')
    .eq('id', badge_id)
    .single();
  return data || null;
}

// =============================================================
//  CHECKER FUNCTIONS — masing-masing return badge_id | null
// =============================================================

async function checkSelamatDatang(murid_id, owned) {
  if (owned.has(BADGE.SELAMAT_DATANG)) return null;
  return BADGE.SELAMAT_DATANG;
}

async function checkLatihanPerdana(murid_id, owned) {
  if (owned.has(BADGE.LATIHAN_PERDANA)) return null;
  const { data: user } = await supabase.from('users')
    .select('quiz_count, latihan_count').eq('id', murid_id).single();
  if (!user) return null;
  if ((user.quiz_count || 0) + (user.latihan_count || 0) >= 1) return BADGE.LATIHAN_PERDANA;
  return null;
}

async function checkPemulaHebat(murid_id, owned) {
  if (owned.has(BADGE.PEMULA_HEBAT)) return null;
  const { count } = await supabase.from('hasil_quiz')
    .select('id', { count: 'exact', head: true })
    .eq('murid_id', murid_id)
    .gte('skor', T.PEMULA_HEBAT.minSkor);
  if (count >= T.PEMULA_HEBAT.minSesi) return BADGE.PEMULA_HEBAT;
  return null;
}

async function checkStreakBadge(murid_id, owned, badgeId, needStreak) {
  if (owned.has(badgeId)) return null;
  const { data: user } = await supabase.from('users')
    .select('streak').eq('id', murid_id).single();
  if (user && (user.streak || 0) >= needStreak) return badgeId;
  return null;
}

async function checkRajinLatihan(murid_id, owned) {
  if (owned.has(BADGE.RAJIN_LATIHAN)) return null;
  const since = new Date();
  since.setDate(since.getDate() - T.RAJIN_LATIHAN.rentangHari);
  const { data } = await supabase.from('hasil_quiz')
    .select('selesai_at')
    .eq('murid_id', murid_id)
    .gte('selesai_at', since.toISOString())
    .order('selesai_at', { ascending: false });
  if (!data || data.length === 0) return null;
  const hari = new Set(data.map(r => r.selesai_at?.split('T')[0]));
  if (hari.size >= T.RAJIN_LATIHAN.minHariAktif) return BADGE.RAJIN_LATIHAN;
  return null;
}

async function checkComeback(murid_id, owned) {
  if (owned.has(BADGE.COME_BACK)) return null;
  const { data: user } = await supabase.from('users')
    .select('streak, last_active').eq('id', murid_id).single();
  if (!user) return null;
  if ((user.streak || 0) < T.COME_BACK.streakMin) return null;
  if (!user.last_active) return null;
  const { data: userReg } = await supabase.from('users')
    .select('created_at').eq('id', murid_id).single();
  if (!userReg) return null;
  const regDate = new Date(userReg.created_at).toISOString().split('T')[0];
  if (user.last_active !== regDate && (user.streak || 0) >= 3) return BADGE.COME_BACK;
  return null;
}

async function checkSpartanLatihan(murid_id, owned) {
  if (owned.has(BADGE.SPARTAN_LATIHAN)) return null;
  const { data } = await supabase.from('hasil_quiz')
    .select('total_soal')
    .eq('murid_id', murid_id);
  const total = (data || []).reduce((s, r) => s + (r.total_soal || 0), 0);
  if (total >= T.SPARTAN_LATIHAN.totalSoal) return BADGE.SPARTAN_LATIHAN;
  return null;
}

async function checkSarjanaMuda(murid_id, owned) {
  if (owned.has(BADGE.SARJANA_MUDA)) return null;
  const { count } = await supabase.from('progres_materi')
    .select('id', { count: 'exact', head: true })
    .eq('murid_id', murid_id)
    .eq('selesai', true);
  if (count >= T.SARJANA_MUDA.totalMateriSelesai) return BADGE.SARJANA_MUDA;
  return null;
}

async function checkDiamond(murid_id, owned) {
  if (owned.has(BADGE.DIAMOND)) return null;
  // Butuh: semua materi dalam 1 mapel ditandai selesai
  // Cari mapel di mana jumlah materi = jumlah progres_materi selesai
  const { data: mapels } = await supabase.from('materi')
    .select('mapel');
  const semuaMapel = [...new Set((mapels || []).map(m => m.mapel))];
  for (const mapel of semuaMapel) {
    const { count: total } = await supabase.from('materi')
      .select('id', { count: 'exact', head: true })
      .eq('mapel', mapel);
    if (!total || total === 0) continue;
    const { count: selesai } = await supabase.from('progres_materi')
      .select('id', { count: 'exact', head: true })
      .eq('murid_id', murid_id)
      .eq('selesai', true);

    // Filter progres_materi hanya untuk materi di mapel ini
    // Lebih akurat: join
    const { data: materiIds } = await supabase.from('materi')
      .select('id').eq('mapel', mapel);
    const ids = (materiIds || []).map(m => m.id);
    if (ids.length === 0) continue;
    const { count: done } = await supabase.from('progres_materi')
      .select('id', { count: 'exact', head: true })
      .eq('murid_id', murid_id)
      .eq('selesai', true)
      .in('materi_id', ids);
    if (done && done >= ids.length) return BADGE.DIAMOND;
  }
  return null;
}

async function checkMultitasker(murid_id, owned) {
  if (owned.has(BADGE.MULTITASKER)) return null;
  const since = new Date();
  since.setDate(since.getDate() - T.MULTITASKER.rentangHari);
  const sinceStr = since.toISOString();
  const { data } = await supabase.from('hasil_quiz')
    .select('quiz:quiz_id(mapel)')
    .eq('murid_id', murid_id)
    .gte('selesai_at', sinceStr);
  const mapels = new Set((data || []).map(r => r.quiz?.mapel).filter(Boolean));
  if (mapels.size >= T.MULTITASKER.minMapel) return BADGE.MULTITASKER;
  return null;
}

async function checkAllRounder(murid_id, owned) {
  if (owned.has(BADGE.ALL_ROUNDER)) return null;
  const { data: mapels } = await supabase.from('materi').select('mapel');
  const semuaMapel = [...new Set((mapels || []).map(m => m.mapel))];
  for (const mapel of semuaMapel) {
    const { data: materiIds } = await supabase.from('materi')
      .select('id').eq('mapel', mapel);
    const ids = (materiIds || []).map(m => m.id);
    if (ids.length === 0) continue;
    const { count: done } = await supabase.from('progres_materi')
      .select('id', { count: 'exact', head: true })
      .eq('murid_id', murid_id)
      .eq('selesai', true)
      .in('materi_id', ids);
    if (!done || done === 0) return null; // belum selesai di mapel ini
  }
  return semuaMapel.length > 0 ? BADGE.ALL_ROUNDER : null;
}

async function checkTepatSasaran(murid_id, owned) {
  if (owned.has(BADGE.TEPAT_SASARAN)) return null;
  const { count } = await supabase.from('hasil_quiz')
    .select('id', { count: 'exact', head: true })
    .eq('murid_id', murid_id)
    .eq('skor', 100);
  if (count >= T.TEPAT_SASARAN.minQuiz) return BADGE.TEPAT_SASARAN;
  return null;
}

async function checkSempurna(murid_id, owned) {
  if (owned.has(BADGE.SEMPURNA)) return null;
  const { count } = await supabase.from('hasil_quiz')
    .select('id', { count: 'exact', head: true })
    .eq('murid_id', murid_id)
    .eq('skor', 100);
  if (count >= T.SEMPURNA.minQuiz) return BADGE.SEMPURNA;
  return null;
}

async function checkSharp(murid_id, owned) {
  if (owned.has(BADGE.SHARP)) return null;
  // Cek detail jawaban: apakah ada 10 jawaban berturut-turut benar dalam 1 sesi
  const { data: hasil } = await supabase.from('hasil_quiz')
    .select('id, total_soal')
    .eq('murid_id', murid_id)
    .gte('total_soal', T.SHARP.soalBerturutBenar)
    .order('selesai_at', { ascending: false });
  if (!hasil) return null;
  for (const h of hasil) {
    const { data: jawaban } = await supabase.from('detail_jawaban')
      .select('benar')
      .eq('hasil_id', h.id)
      .order('id', { ascending: true });
    if (!jawaban || jawaban.length < T.SHARP.soalBerturutBenar) continue;
    let streak = 0;
    for (const j of jawaban) {
      if (j.benar) { streak++; if (streak >= T.SHARP.soalBerturutBenar) return BADGE.SHARP; }
      else { streak = 0; }
    }
  }
  return null;
}

async function checkSpeedRunner(murid_id, owned) {
  if (owned.has(BADGE.SPEED_RUNNER)) return null;
  // Hitung median durasi per soal (durasi_detik / total_soal) untuk soal sejenis
  const { data: hasil } = await supabase.from('hasil_quiz')
    .select('id, durasi_detik, total_soal, quiz:quiz_id(mapel)')
    .eq('murid_id', murid_id)
    .not('durasi_detik', 'is', null)
    .gt('total_soal', 0);
  if (!hasil || hasil.length < 3) return null;
  for (const h of hasil) {
    const detikPerSoal = (h.durasi_detik || 0) / (h.total_soal || 1);
    // Cari median waktu untuk mapel yang sama
    const sejenis = hasil.filter(r => r.quiz?.mapel === h.quiz?.mapel && r.id !== h.id);
    if (sejenis.length < 2) continue;
    const times = sejenis.map(r => (r.durasi_detik || 0) / (r.total_soal || 1)).sort((a, b) => a - b);
    const median = times.length % 2 === 0
      ? (times[times.length / 2 - 1] + times[times.length / 2]) / 2
      : times[Math.floor(times.length / 2)];
    if (detikPerSoal <= median * (T.SPEED_RUNNER.persenMedian / 100)) return BADGE.SPEED_RUNNER;
  }
  return null;
}

async function checkKutuBuku(murid_id, owned) {
  if (owned.has(BADGE.KUTU_BUKU)) return null;
  const { count } = await supabase.from('progres_materi')
    .select('id', { count: 'exact', head: true })
    .eq('murid_id', murid_id)
    .eq('selesai', true);
  if (count >= T.KUTU_BUKU.totalMateriPenuh) return BADGE.KUTU_BUKU;
  return null;
}

async function checkPemburuIlmu(murid_id, owned) {
  if (owned.has(BADGE.PEMBURU_ILMU)) return null;
  const { data: user } = await supabase.from('users')
    .select('total_waktu_belajar_detik')
    .eq('id', murid_id)
    .maybeSingle();
  if (!user || user.total_waktu_belajar_detik < T.PEMBURU_ILMU.totalWaktuBelajarDetik) return null;
  return { badge_id: BADGE.PEMBURU_ILMU, progress: 1, selesai: true };
}

async function checkPembacaMateri(murid_id, owned) {
  if (owned.has(BADGE.PEMBACA_MATERI)) return null;
  const since = new Date();
  since.setDate(since.getDate() - T.PEMBACA_MATERI.rentangHari);
  const { data } = await supabase.from('progres_materi')
    .select('updated_at')
    .eq('murid_id', murid_id)
    .gte('updated_at', since.toISOString())
    .order('updated_at', { ascending: false });
  if (!data) return null;
  const hari = new Set(data.map(r => r.updated_at?.split('T')[0]));
  if (hari.size >= T.PEMBACA_MATERI.hariBerbeda) return BADGE.PEMBACA_MATERI;
  return null;
}

async function checkPenjelajahMateri(murid_id, owned) {
  if (owned.has(BADGE.PENJELAJAH_MATERI)) return null;
  const { data } = await supabase.from('progres_materi')
    .select('materi:materi_id(judul)')
    .eq('murid_id', murid_id);
  const judul = new Set((data || []).map(r => r.materi?.judul).filter(Boolean));
  if (judul.size >= T.PENJELAJAH_MATERI.topikBerbeda) return BADGE.PENJELAJAH_MATERI;
  return null;
}

async function checkPetualangMateri(murid_id, owned) {
  if (owned.has(BADGE.PETUALANG_MATERI)) return null;
  const { data } = await supabase.from('progres_materi')
    .select('materi:materi_id(mapel)')
    .eq('murid_id', murid_id);
  const mapels = new Set((data || []).map(r => r.materi?.mapel).filter(Boolean));
  if (mapels.size >= T.PETUALANG_MATERI.mapelBerbeda) return BADGE.PETUALANG_MATERI;
  return null;
}

async function checkAhli(murid_id, owned) {
  if (owned.has(BADGE.AHLI)) return null;
  // Rata-rata skor ≥85% dalam 1 topik, min 5 latihan di topik itu
  // Approximasi: dari avg_skor di user
  const { data: user } = await supabase.from('users')
    .select('avg_skor, quiz_count').eq('id', murid_id).single();
  if (!user) return null;
  if ((user.quiz_count || 0) >= T.AHLI.minLatihan && parseFloat(user.avg_skor || 0) >= T.AHLI.minSkor) {
    return BADGE.AHLI;
  }
  return null;
}

async function checkXpHunter(murid_id, owned) {
  if (owned.has(BADGE.XP_HUNTER)) return null;
  const { data: user } = await supabase.from('users')
    .select('xp').eq('id', murid_id).single();
  if (user && (user.xp || 0) >= T.XP_HUNTER.xp) return BADGE.XP_HUNTER;
  return null;
}

async function checkXpBillionaire(murid_id, owned) {
  if (owned.has(BADGE.XP_BILLIONAIRE)) return null;
  const { data: user } = await supabase.from('users')
    .select('xp').eq('id', murid_id).single();
  if (user && (user.xp || 0) >= T.XP_BILLIONAIRE.xp) return BADGE.XP_BILLIONAIRE;
  return null;
}

async function checkQuizMania(murid_id, owned) {
  if (owned.has(BADGE.QUIZ_MANIA)) return null;
  const since = new Date();
  since.setDate(since.getDate() - T.QUIZ_MANIA.rentangHari);
  const { count } = await supabase.from('hasil_quiz')
    .select('id', { count: 'exact', head: true })
    .eq('murid_id', murid_id)
    .gte('selesai_at', since.toISOString());
  if (count >= T.QUIZ_MANIA.minQuiz) return BADGE.QUIZ_MANIA;
  return null;
}

async function checkLegendaQuiz(murid_id, owned) {
  if (owned.has(BADGE.LEGENDA_QUIZ)) return null;
  const { data: user } = await supabase.from('users')
    .select('quiz_count').eq('id', murid_id).single();
  if (user && (user.quiz_count || 0) >= T.LEGENDA_QUIZ.totalQuiz) return BADGE.LEGENDA_QUIZ;
  return null;
}

async function checkPejuang(murid_id, owned) {
  if (owned.has(BADGE.PEJUANG)) return null;
  // Tentukan gagal: skor < 60, minimal 3x di mapel sama, lalu ada skor ≥60 di mapel itu
  const { data: results } = await supabase.from('hasil_quiz')
    .select('skor, quiz:quiz_id(mapel)')
    .eq('murid_id', murid_id)
    .order('selesai_at', { ascending: true });
  if (!results || results.length < 4) return null;
  const perMapel = {};
  for (const r of results) {
    const mapel = r.quiz?.mapel || 'unknown';
    if (!perMapel[mapel]) perMapel[mapel] = { gagal: 0, lulus: false };
    if (r.skor < 60) perMapel[mapel].gagal++;
    else if (r.skor >= 60) perMapel[mapel].lulus = true;
    if (perMapel[mapel].gagal >= T.PEJUANG.gagalMin && perMapel[mapel].lulus) return BADGE.PEJUANG;
  }
  return null;
}

async function checkMulaiTumbuh(murid_id, owned) {
  if (owned.has(BADGE.MULAI_TUMBUH)) return null;
  // Soal dengan tingkat 'mudah' — cek apakah ada soal mudah di quiz yang dikerjakan
  const { data } = await supabase.from('hasil_quiz')
    .select('quiz:quiz_id(id)')
    .eq('murid_id', murid_id)
    .limit(1);
  if (!data || data.length === 0) return null;
  const quizId = data[0].quiz?.id;
  if (!quizId) return null;
  const { data: soal } = await supabase.from('quiz_soal')
    .select('soal:soal_id(tingkat)')
    .eq('quiz_id', quizId)
    .limit(1);
  if (soal && soal.length > 0 && soal[0]?.soal?.tingkat === 'mudah') return BADGE.MULAI_TUMBUH;
  return null;
}

async function checkPelajarAktif(murid_id, owned) {
  if (owned.has(BADGE.PELAJAR_AKTIF)) return null;
  const since = new Date();
  since.setDate(since.getDate() - T.PELAJAR_AKTIF.rentangHari);
  const sinceStr = since.toISOString();
  // Quiz activity
  const { data: quizDays } = await supabase.from('hasil_quiz')
    .select('selesai_at')
    .eq('murid_id', murid_id)
    .gte('selesai_at', sinceStr);
  // Materi activity
  const { data: materiDays } = await supabase.from('progres_materi')
    .select('updated_at')
    .eq('murid_id', murid_id)
    .gte('updated_at', sinceStr);
  const hari = new Set();
  (quizDays || []).forEach(r => hari.add(r.selesai_at?.split('T')[0]));
  (materiDays || []).forEach(r => hari.add(r.updated_at?.split('T')[0]));
  if (hari.size >= T.PELAJAR_AKTIF.hariBerbeda) return BADGE.PELAJAR_AKTIF;
  return null;
}

async function checkRajinBelajar(murid_id, owned) {
  if (owned.has(BADGE.RAJIN_BELAJAR)) return null;
  // Waktu belajar tidak langsung di-track. Approximasi:
  // rata-rata quiz 5 menit, rata-rata materi 10 menit
  const { data: user } = await supabase.from('users')
    .select('quiz_count, latihan_count').eq('id', murid_id).single();
  if (!user) return null;
  const { count: materiSelesai } = await supabase.from('progres_materi')
    .select('id', { count: 'exact', head: true })
    .eq('murid_id', murid_id)
    .eq('selesai', true);
  // Estimasi: 5 menit per quiz, 10 menit per materi
  const estJam = ((user.quiz_count || 0) * 5 + (materiSelesai || 0) * 10) / 60;
  if (estJam >= T.RAJIN_BELAJAR.totalWaktuBelajarJam) return BADGE.RAJIN_BELAJAR;
  return null;
}

// =============================================================
//  ORCHESTRATOR
// =============================================================

const CHECKERS = {
  // Selamat Datang handled separately in misi.js
  LATIHAN_PERDANA:   { fn: checkLatihanPerdana,   trigger: ['quiz', 'latihan'] },
  PEMULA_HEBAT:      { fn: checkPemulaHebat,      trigger: ['quiz'] },
  AKTIF:             { fn: (m, o) => checkStreakBadge(m, o, BADGE.AKTIF, T.AKTIF.streak), trigger: ['quiz', 'latihan', 'belajar'] },
  PANTANG_MENYERAH:  { fn: (m, o) => checkStreakBadge(m, o, BADGE.PANTANG_MENYERAH, T.PANTANG_MENYERAH.streak), trigger: ['quiz', 'latihan', 'belajar'] },
  DUA_MINGGU:        { fn: (m, o) => checkStreakBadge(m, o, BADGE.DUA_MINGGU, T.DUA_MINGGU.streak), trigger: ['quiz', 'latihan', 'belajar'] },
  BULAN_PENUH:       { fn: (m, o) => checkStreakBadge(m, o, BADGE.BULAN_PENUH, T.BULAN_PENUH.streak), trigger: ['quiz', 'latihan', 'belajar'] },
  TAK_TERHENTIKAN:   { fn: (m, o) => checkStreakBadge(m, o, BADGE.TAK_TERHENTIKAN, T.TAK_TERHENTIKAN.streak), trigger: ['quiz', 'latihan', 'belajar'] },
  RAJIN_LATIHAN:     { fn: checkRajinLatihan,     trigger: ['latihan'] },
  COMEBACK:          { fn: checkComeback,          trigger: ['quiz', 'latihan', 'belajar'] },
  SPARTAN_LATIHAN:   { fn: checkSpartanLatihan,   trigger: ['latihan'] },
  SARJANA_MUDA:      { fn: checkSarjanaMuda,      trigger: ['belajar'] },
  DIAMOND:           { fn: checkDiamond,           trigger: ['belajar'] },
  MULTITASKER:       { fn: checkMultitasker,       trigger: ['quiz'] },
  ALL_ROUNDER:       { fn: checkAllRounder,       trigger: ['belajar'] },
  TEPAT_SASARAN:     { fn: checkTepatSasaran,     trigger: ['quiz'] },
  SEMPURNA:          { fn: checkSempurna,          trigger: ['quiz'] },
  SHARP:             { fn: checkSharp,             trigger: ['quiz'] },
  SPEED_RUNNER:      { fn: checkSpeedRunner,      trigger: ['quiz'] },
  KUTU_BUKU:         { fn: checkKutuBuku,         trigger: ['belajar'] },
  PEMBURU_ILMU:      { fn: checkPemburuIlmu,      trigger: ['belajar'] },
  PEMBACA_MATERI:    { fn: checkPembacaMateri,    trigger: ['belajar'] },
  PENJELAJAH_MATERI: { fn: checkPenjelajahMateri, trigger: ['belajar'] },
  PETUALANG_MATERI:  { fn: checkPetualangMateri,  trigger: ['belajar'] },
  AHLI:              { fn: checkAhli,              trigger: ['quiz'] },
  XP_HUNTER:         { fn: checkXpHunter,         trigger: ['quiz', 'latihan'] },
  XP_BILLIONAIRE:    { fn: checkXpBillionaire,    trigger: ['quiz', 'latihan'] },
  QUIZ_MANIA:        { fn: checkQuizMania,        trigger: ['quiz'] },
  LEGENDA_QUIZ:      { fn: checkLegendaQuiz,      trigger: ['quiz'] },
  PEJUANG:           { fn: checkPejuang,           trigger: ['quiz'] },
  MULAI_TUMBUH:      { fn: checkMulaiTumbuh,      trigger: ['quiz'] },
  PELAJAR_AKTIF:     { fn: checkPelajarAktif,     trigger: ['quiz', 'latihan', 'belajar'] },
  RAJIN_BELAJAR:     { fn: checkRajinBelajar,     trigger: ['quiz', 'latihan', 'belajar'] },
};

async function checkBadges(murid_id, trigger) {
  try {
    const owned = await getOwnedBadgeIds(murid_id);
    const awarded = [];
    for (const [name, cfg] of Object.entries(CHECKERS)) {
      if (!cfg.trigger.includes(trigger)) continue;
      const badgeId = await cfg.fn(murid_id, owned);
      if (badgeId) {
        const result = await awardBadge(murid_id, badgeId);
        if (result) {
          awarded.push(result);
          owned.add(badgeId);
        }
      }
    }
    return awarded;
  } catch (err) {
    console.error('[badgeChecker] error:', err.message);
    return [];
  }
}

module.exports = { checkBadges, BADGE };
