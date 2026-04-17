/**
 * Gamification Utility
 * Dipanggil setiap kali murid menyelesaikan aktivitas (quiz, materi, login)
 */

const supabase = require('../supabase');

// ── Hitung tanggal awal minggu (Senin) ─────────────────────
function getMondayDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Minggu, 1=Senin, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// ── Update stats user (xp, streak, quiz_count, avg_skor) ───
async function updateUserStats(murid_id, { xpDapat = 0, skor = null, tipe = 'quiz' } = {}) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('xp, level, streak, last_active, quiz_count, avg_skor')
      .eq('id', murid_id)
      .single();

    if (!user) return null;

    const today = getTodayDate();
    const lastActive = user.last_active;

    // Hitung streak
    let newStreak = user.streak || 0;
    if (lastActive === today) {
      // Sudah aktif hari ini — streak tidak berubah
    } else if (lastActive) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      newStreak = lastActive === yesterdayStr ? newStreak + 1 : 1;
    } else {
      newStreak = 1;
    }

    // Hitung XP & level
    const newXp    = (user.xp || 0) + xpDapat;
    const newLevel = Math.floor(newXp / 1000) + 1;

    // Hitung quiz_count & avg_skor (hanya untuk aktivitas quiz)
    let newQuizCount = user.quiz_count || 0;
    let newAvgSkor   = parseFloat(user.avg_skor) || 0;
    if (tipe === 'quiz' && skor !== null) {
      newQuizCount += 1;
      newAvgSkor = ((newAvgSkor * (newQuizCount - 1)) + skor) / newQuizCount;
      newAvgSkor = Math.round(newAvgSkor * 10) / 10;
    }

    await supabase.from('users').update({
      xp:          newXp,
      level:       newLevel,
      streak:      newStreak,
      last_active: today,
      quiz_count:  newQuizCount,
      avg_skor:    newAvgSkor
    }).eq('id', murid_id);

    return { newXp, newLevel, newStreak, newQuizCount, newAvgSkor };
  } catch (err) {
    console.error('[gamification] updateUserStats error:', err.message);
    return null;
  }
}

// ── Cek & update progres misi, klaim reward jika selesai ───
async function checkMisi(murid_id, { tipe_aktivitas, nilai = 0, xpDapat = 0 } = {}) {
  try {
    const today   = getTodayDate();
    const monday  = getMondayDate();

    // Ambil semua misi aktif
    const { data: templates } = await supabase
      .from('misi_template')
      .select('*')
      .eq('aktif', true);

    if (!templates || templates.length === 0) return [];

    // Ambil stats user terbaru untuk evaluasi achievement
    const { data: user } = await supabase
      .from('users')
      .select('xp, level, streak, quiz_count, avg_skor')
      .eq('id', murid_id)
      .single();

    const completedMisi = [];

    for (const misi of templates) {
      // Tentukan periode berdasarkan tipe misi
      const periode = misi.tipe === 'harian'
        ? today
        : misi.tipe === 'mingguan'
        ? monday
        : null; // achievement = null

      // Ambil atau buat record misi_murid
      // Achievement: periode = null → harus pakai .is() bukan .eq() karena NULL != NULL di SQL
      let existingQuery = supabase
        .from('misi_murid')
        .select('*')
        .eq('murid_id', murid_id)
        .eq('misi_id', misi.id);

      existingQuery = periode === null
        ? existingQuery.is('periode', null)
        : existingQuery.eq('periode', periode);

      const { data: existing } = await existingQuery.maybeSingle();

      // Achievement yang sudah pernah selesai — skip
      if (misi.tipe === 'achievement' && existing?.selesai) continue;

      // Hitung progres tambahan berdasarkan kondisi misi
      let tambahan = 0;
      switch (misi.kondisi_tipe) {
        case 'quiz_count':
          tambahan = tipe_aktivitas === 'quiz' ? 1 : 0;
          break;
        case 'materi_count':
          tambahan = tipe_aktivitas === 'materi' ? 1 : 0;
          break;
        case 'akurasi':
          // Cek sekali: apakah nilai saat ini memenuhi target?
          if (tipe_aktivitas === 'quiz' && nilai >= misi.kondisi_target) tambahan = misi.kondisi_target;
          break;
        case 'xp_gained':
          tambahan = xpDapat;
          break;
        case 'streak':
          // Langsung set ke nilai streak terkini
          if (user) tambahan = (user.streak || 0) - (existing?.progres || 0);
          break;
        case 'level':
          // Langsung set ke level terkini
          if (user) tambahan = (user.level || 1) - (existing?.progres || 0);
          break;
      }

      if (tambahan <= 0 && !['streak', 'level'].includes(misi.kondisi_tipe)) continue;

      const progresLama   = existing?.progres || 0;
      const progresUpdate = misi.kondisi_tipe === 'akurasi'
        ? misi.kondisi_target // akurasi: langsung full jika lolos threshold
        : Math.min(progresLama + tambahan, misi.kondisi_target);

      const sudahSelesai = progresUpdate >= misi.kondisi_target;

      if (existing) {
        if (existing.selesai) continue; // sudah selesai sebelumnya
        await supabase.from('misi_murid').update({
          progres:    progresUpdate,
          selesai:    sudahSelesai,
          selesai_at: sudahSelesai ? new Date().toISOString() : null
        }).eq('id', existing.id);
      } else {
        await supabase.from('misi_murid').insert({
          murid_id,
          misi_id:    misi.id,
          progres:    progresUpdate,
          target:     misi.kondisi_target,
          selesai:    sudahSelesai,
          reward_claimed: false,
          periode,
          selesai_at: sudahSelesai ? new Date().toISOString() : null
        });
      }

      if (sudahSelesai) {
        completedMisi.push({ misi, xp: misi.reward_xp, badge_id: misi.reward_badge_id });
      }
    }

    return completedMisi;
  } catch (err) {
    console.error('[gamification] checkMisi error:', err.message);
    return [];
  }
}

// ── Klaim reward misi (XP bonus + badge) ───────────────────
async function claimMisiReward(murid_id, misi_murid_id) {
  try {
    const { data: record } = await supabase
      .from('misi_murid')
      .select('*, misi:misi_id(*)')
      .eq('id', misi_murid_id)
      .eq('murid_id', murid_id)
      .single();

    if (!record) return { success: false, pesan: 'Misi tidak ditemukan.' };
    if (!record.selesai) return { success: false, pesan: 'Misi belum selesai.' };
    if (record.reward_claimed) return { success: false, pesan: 'Reward sudah diklaim.' };

    const misi = record.misi;

    // Berikan XP bonus
    if (misi.reward_xp > 0) {
      const { data: user } = await supabase.from('users').select('xp').eq('id', murid_id).single();
      const newXp    = (user?.xp || 0) + misi.reward_xp;
      const newLevel = Math.floor(newXp / 1000) + 1;
      await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('id', murid_id);
    }

    // Berikan badge jika ada
    if (misi.reward_badge_id) {
      await supabase.from('murid_badges').upsert({
        murid_id,
        badge_id:     misi.reward_badge_id,
        diperoleh_at: new Date().toISOString()
      }, { onConflict: 'murid_id,badge_id', ignoreDuplicates: true });
    }

    // Tandai sudah diklaim
    await supabase.from('misi_murid').update({ reward_claimed: true }).eq('id', misi_murid_id);

    return {
      success:    true,
      xp_dapat:   misi.reward_xp,
      badge_id:   misi.reward_badge_id,
      misi_judul: misi.judul
    };
  } catch (err) {
    console.error('[gamification] claimMisiReward error:', err.message);
    return { success: false, pesan: 'Terjadi kesalahan.' };
  }
}

module.exports = { updateUserStats, checkMisi, claimMisiReward, getTodayDate, getMondayDate };
