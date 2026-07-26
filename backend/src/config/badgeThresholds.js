module.exports = {
  // ── 1. Onboarding & Milestone Pertama ──────────────────────
  LATIHAN_PERDANA: {}, // first-time, no threshold
  PEMULA_HEBAT: { minSesi: 5, minSkor: 60 },

  // ── 2. Konsistensi / Streak ───────────────────────────────
  AKTIF:              { streak: 3 },
  PANTANG_MENYERAH:   { streak: 7 },
  DUA_MINGGU:         { streak: 14 },
  BULAN_PENUH:        { streak: 30 },
  TAK_TERHENTIKAN:    { streak: 60 },
  RAJIN_LATIHAN:      { minHariAktif: 5, rentangHari: 7 },
  COME_BACK:          { gapMinHari: 3, streakMin: 3 },

  // ── 3. Volume Latihan / Soal ──────────────────────────────
  SPARTAN_LATIHAN:    { totalSoal: 100 },
  SARJANA_MUDA:       { totalMateriSelesai: 10 },
  DIAMOND:            {}, // seluruh modul 1 mapel — logic di code
  MULTITASKER:        { minMapel: 3, rentangHari: 7 },
  ALL_ROUNDER:        {}, // semua mapel — logic di code

  // ── 4. Akurasi / Kualitas Jawaban ─────────────────────────
  TEPAT_SASARAN:      { skor: 100, minQuiz: 1 },
  SEMPURNA:           { skor: 100, minQuiz: 5 },
  SHARP:              { soalBerturutBenar: 10 },

  // ── 5. Kecepatan ──────────────────────────────────────────
  SPEED_RUNNER:       { persenMedian: 50 },

  // ── 6. Penguasaan Materi / Bacaan ─────────────────────────
  KUTU_BUKU:          { totalMateriPenuh: 10 },
  PEMBURU_ILMU:       { totalWaktuBelajarDetik: 5 * 3600 },
  PEMBACA_MATERI:     { hariBerbeda: 5, rentangHari: 14 },
  PENJELAJAH_MATERI:  { topikBerbeda: 5 },
  PETUALANG_MATERI:   { mapelBerbeda: 3 },
  AHLI:               { minSkor: 85, minLatihan: 5 },

  // ── 7. Tier Keahlian / Ranking ────────────────────────────
  // SKIP — butuh fitur leaderboard / challenge / kelas

  // ── 8. XP & Poin ──────────────────────────────────────────
  XP_HUNTER:          { xp: 1000 },
  XP_BILLIONAIRE:     { xp: 100000 },

  // ── 9. Tema Unik ──────────────────────────────────────────
  QUIZ_MANIA:         { minQuiz: 20, rentangHari: 7 },
  LEGENDA_QUIZ:       { totalQuiz: 100 },
  PEJUANG:            { gagalMin: 3, mapelSama: true },
  MULAI_TUMBUH:       { tingkat: 'mudah' },
  PELAJAR_AKTIF:      { hariBerbeda: 4, rentangHari: 7 },
  RAJIN_BELAJAR:      { totalWaktuBelajarJam: 20 },
};
