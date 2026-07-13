// ============================================================
//  ZEP QUIZ — Live Multiplayer
// ============================================================
const ZEP_SERVER = window.location.origin; // auto-detect: Railway URL di production, localhost di dev
let zepSocket = null;
let zepRoom = null;       // { kode_room, quiz, soal[], durasi_per_soal }
let zepIsGuru = false;
let zepIsOnline = false;  // VS Online mode
let zepSkorSaya = 0;
let zepIForfeited = false; // flag: saya yang menyerah (cegah toast/final salah)
let zepSoalIdx = -1;
let zepDurasi = 15;
let zepTimerInterval = null;
let zepTimerSisa = 0;
let zepSudahJawab = false;
let zepSelectedQuizId = null;
let zepWaktuMulaiSoal = 0;

const CIRCUMFERENCE = 2 * Math.PI * 28; // r=28

function zepConnect() {
  if (zepSocket) return; // gunakan socket yang ada, biarkan socket.io handle reconnect otomatis
  zepSocket = io(ZEP_SERVER, {
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 45000
  });

  zepSocket.on('connect', () => {
    console.log('🎯 ZepQuiz connected:', zepSocket.id);
    // Jika sedang dalam game online, langsung rejoin room
    if (zepRoom?.kode && currentUser?.id && zepIsOnline) {
      zepSocket.emit('zep:rejoin', { kode_room: zepRoom.kode, user_id: currentUser.id });
    }
  });

  zepSocket.on('disconnect', (reason) => {
    console.log('🎯 ZepQuiz disconnected:', reason);
    // Tampilkan notif kecil jika sedang dalam game aktif
    const activePage = document.querySelector('.page.active')?.id || '';
    if (activePage.startsWith('page-zep-soal') && zepRoom && zepIsOnline) {
      toast('Koneksi terputus, mencoba sambung ulang...', 'info');
    }
  });

  zepSocket.on('zep:rejoined', (state) => {
    console.log('🎯 ZepQuiz rejoined room:', state.kode);
    zepRoom = { ...zepRoom, ...state, kode: state.kode };
    zepIsOnline = true;
    if (state.mySkor !== undefined) zepSkorSaya = state.mySkor;
    const activePage = document.querySelector('.page.active')?.id || '';
    if (activePage === 'page-zep-wait') renderZepPemainWait(state.pemain || []);
    // Kalau reconnect dari halaman murid (refresh), tapi game masih playing → server akan segera kirim zep:soal
    // Cukup pastikan forfeit btn muncul saat soal tiba
    toast('Tersambung kembali ke game! ✅', 'success');
  });
  zepSocket.on('zep:error', ({ pesan }) => { toast(pesan, 'error'); showLoading(false); });

  // ── MURID events ──
  zepSocket.on('zep:joined', (state) => {
    showLoading(false);
    zepRoom = state; // update dengan data lengkap dari server
    // Kalau online matchmaking (is_online), tetap di halaman matchmaking tunggu soal
    if (state.is_online) return;
    // Kalau join pakai kode, tampilkan lobby wait
    document.getElementById('zep-wait-judul').textContent = state.judul || 'Quiz';
    document.getElementById('zep-wait-kode').textContent = state.kode;
    renderZepPemainWait(state.pemain);
    showPage('page-zep-wait');
  });
  zepSocket.on('zep:pemain_masuk', ({ pemain }) => renderZepPemainWait(pemain));
  zepSocket.on('zep:game_start', () => { /* handled in zep:soal */ });
  zepSocket.on('zep:soal', (data) => zepMuridTampilSoal(data));
  zepSocket.on('zep:hasil_jawab', (data) => zepMuridHasilJawab(data));
  zepSocket.on('zep:hasil_soal', (data) => zepMuridTampilHasil(data));
  zepSocket.on('zep:update_skor', ({ pemain }) => {
    document.getElementById('zep-my-skor').textContent = zepSkorSaya;
    if (document.getElementById('page-zep-hasil-soal').classList.contains('active')) {
      renderZepLB('zep-lb-sementara', pemain);
    }
  });
  zepSocket.on('zep:game_selesai', (data) => {
    if (!zepIsGuru && !zepIForfeited && (zepRoom || zepIsOnline)) zepMuridFinal(data);
  });
  zepSocket.on('zep:room_closed', ({ pesan }) => {
    if (zepIsGuru) return; // guru yang tutup room, sudah handle sendiri via zepGuruTutupRoom
    toast(pesan || 'Room ditutup oleh guru.', 'error');
    showPage('page-murid');
    zepReset();
  });

  // ── GURU events ──
  zepSocket.on('zep:room_created', (state) => {
    showLoading(false);
    zepRoom = state;
    document.getElementById('zep-guru-kode').textContent = state.kode;
    document.getElementById('zep-guru-quiz-label').textContent = state.judul || '';
    document.getElementById('zep-guru-jumlah-pemain').textContent = '0';
    document.getElementById('zep-guru-step1').style.display = 'none';
    document.getElementById('zep-guru-lobby').style.display = 'block';
    document.getElementById('zep-guru-start-btn').style.display = 'inline-block';
    renderZepGuruPemain([]);
  });
  zepSocket.on('zep:pemain_masuk', ({ pemain }) => {
    document.getElementById('zep-guru-jumlah-pemain').textContent = pemain.length;
    renderZepGuruPemain(pemain);
  });
  zepSocket.on('zep:pemain_keluar', ({ userId }) => {
    // update list kalau ada
  });
  zepSocket.on('zep:soal', (data) => {
    if (zepIsGuru) zepGuruUpdateLive(data);
  });
  zepSocket.on('zep:update_skor', ({ pemain }) => {
    if (zepIsGuru) renderZepGuruLB(pemain);
  });
  zepSocket.on('zep:hasil_soal', (data) => {
    if (zepIsGuru) renderZepGuruLB(data.leaderboard);
  });
  zepSocket.on('zep:game_selesai', (data) => {
    if (zepIsGuru) zepGuruFinal(data);
    // murid ditangani oleh handler sebelumnya dengan guard zepIForfeited
  });

  // ── VS ONLINE events ──
  zepSocket.on('zep:public_room_created', (state) => {
    showLoading(false);
    zepRoom = state;
    document.getElementById('zep-wait-judul').textContent = `${state.judul} · Menunggu lawan...`;
    document.getElementById('zep-wait-kode').textContent = state.kode;
    renderZepPemainWait(state.pemain || []);
    showPage('page-zep-wait');
    // Tambah tombol mulai sekarang untuk creator
    const waitPanel = document.getElementById('zep-wait-pemain');
    if (!document.getElementById('online-creator-start')) {
      const startBtn = document.createElement('button');
      startBtn.id = 'online-creator-start';
      startBtn.className = 'zep-btn zep-btn-green zep-btn-lg';
      startBtn.style.cssText = 'margin-top:16px;width:100%';
      startBtn.textContent = '▶ Mulai Sekarang!';
      startBtn.onclick = () => zepSocket.emit('zep:online_start_now', { kode_room: state.kode });
      waitPanel.appendChild(startBtn);
    }
  });
  zepSocket.on('zep:public_rooms_list', ({ rooms }) => {
    const el = document.getElementById('online-rooms-list');
    if (!el) return;
    if (!rooms || !rooms.length) {
      el.innerHTML = '<div style="text-align:center;opacity:.5;font-size:14px;padding:20px">Belum ada room. Buat room baru di atas!</div>';
      return;
    }
    el.innerHTML = rooms.map(r => `
      <div style="background:rgba(255,255,255,0.06);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="flex:1">
          <div style="font-weight:800;font-size:14px;color:white">${r.judul}</div>
          <div style="font-size:12px;opacity:.6">${r.mapel} · ${r.total_soal} soal · ${r.pemain_count} pemain</div>
        </div>
        <button class="zep-btn zep-btn-primary" style="padding:8px 16px;font-size:12px" onclick="zepOnlineJoinRoom('${r.kode}')">Join</button>
      </div>`).join('');
  });
  zepSocket.on('zep:auto_start_countdown', ({ detik }) => {
    const el = document.getElementById('zep-wait-judul');
    if (el) {
      if (detik > 0) {
        el.textContent = `Game mulai dalam ${detik} detik... Siap-siap! 🎯`;
        el.style.color = detik <= 3 ? '#FF6B6B' : '#FFD93D';
      } else {
        el.textContent = 'Mulai!';
      }
    }
  });

  // ── MATCHMAKING events ──
  zepSocket.on('zep:matched', ({ kode_room, lawan, judul, generating }) => {
    clearInterval(mmTimerInterval);
    const info = document.getElementById('online-mm-info');
    const anim = document.getElementById('online-mm-anim');
    if (generating) {
      if (info) info.textContent = `✅ Lawan: ${lawan?.nama || 'Seseorang'} — Menyiapkan soal...`;
      if (anim) anim.textContent = '⚙️';
    } else {
      if (info) info.textContent = `✅ Lawan ditemukan: ${lawan?.nama || 'Seseorang'}!`;
    }
    // Langsung set zepRoom dari event ini — server sudah masukkan player ke room
    // TIDAK perlu emit zep:join_room lagi (server sudah handle di matchmaking)
    zepSkorSaya = 0;
    zepIsOnline = true;
    zepRoom = { kode: kode_room, judul };
    // Simpan ke sessionStorage agar bisa reconnect setelah refresh
    try { sessionStorage.setItem('zep_active_room', JSON.stringify({ kode: kode_room, judul, ts: Date.now() })); } catch(e) {}
  });
  zepSocket.on('zep:matchmaking_waiting', ({ posisi }) => {
    const info = document.getElementById('online-mm-info');
    if (info) info.textContent = `Antrian: ${posisi} orang menunggu lawan...`;
  });

  zepSocket.on('zep:queue_counts', ({ counts }) => {
    queueCounts = counts || {};
    if (onlineJoinMode === 'pilih') {
      renderMapelGrid('online-mapel-grid', 'online');
    }
  });

  zepSocket.on('zep:opponent_disconnected', ({ pesan }) => {
    toast(pesan || 'Lawan terputus dari permainan.', 'info');
  });

  zepSocket.on('zep:opponent_reconnected', () => {
    toast('Lawan kembali terhubung!', 'success');
  });

  zepSocket.on('zep:player_forfeited', ({ pesan }) => {
    // Abaikan jika saya sendiri yang menyerah
    if (zepIForfeited) return;
    toast(pesan || 'Lawan menyerah! Kamu menang! 🏆', 'success');
  });
}

// ── MURID: Buka mode selection ────────────────────────────────
function bukaZepQuizMurid() {
  zepIForfeited = false;
  zepConnect();
  zepIsGuru = false;
  showPage('page-zep-mode');
}

function bukaJoinKode() {
  showPage('page-zep-join');
  document.getElementById('zep-join-kode').value = '';
}

// ── MURID: Buka dengan kode langsung (dari notifikasi undangan) ─
function bukaZepQuizDariKode(kode) {
  zepConnect();
  zepIsGuru = false;
  document.getElementById('zep-join-kode').value = kode || '';
  showPage('page-zep-join');
  if (kode) setTimeout(() => zepMuridJoin(), 300);
}

// ============================================================
//  SHARED: Jenjang / Kelas / Mapel Picker
// ============================================================
let selectedJenjang  = { online: 'SD', ai: 'SD' };
let selectedKelas    = { online: 1,    ai: 1    };
let selectedMapel    = { online: null, ai: null };
let onlineJoinMode   = 'random'; // 'random' | 'pilih'
let zepPrevMode      = null;     // 'online' | 'ai' | 'guru' — untuk tombol Sesi Baru
let bankMapelList    = [];
let mmTimerInterval  = null;
let mmElapsed        = 0;
let queueCounts      = {};       // mapel → jumlah orang dalam antrian

const KELAS_MAP   = { SD: [1,2,3,4,5,6], SMP: [7,8,9], SMA: [10,11,12] };
const KELAS_LABEL = { SD: n => `Kelas ${n}`, SMP: n => `Kelas ${n-6}`, SMA: n => `Kelas ${n-9}` };

// Ikon mapel umum
const MAPEL_ICON = {
  'Matematika':'🔢','Bahasa Indonesia':'📝','Bahasa Inggris':'🌐','IPA':'🔬','IPS':'🗺️',
  'Biologi':'🌿','Fisika':'⚛️','Kimia':'🧪','Sejarah':'📜','Geografi':'🌍',
  'Ekonomi':'💹','PKN':'🏛️','Agama':'📖','Seni Budaya':'🎨','PJOK':'⚽',
  'Informatika':'💻','Sosiologi':'👥','Bahasa Jawa':'🗣️'
};
function getMapelIcon(mapel) {
  return MAPEL_ICON[mapel] || '📚';
}

function renderKelasPills(containerId, jenjang, mode) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const klsList = KELAS_MAP[jenjang] || [];
  const cur = selectedKelas[mode];
  const accent = mode === 'online' ? '#4D96FF' : '#C77DFF';
  el.innerHTML = klsList.map(k => `
    <button onclick="pilihKelas(${k},'${mode}')"
      style="padding:7px 14px;border-radius:50px;font-family:Nunito,sans-serif;font-weight:800;font-size:12px;cursor:pointer;border:2px solid ${k===cur?accent:'rgba(255,255,255,0.15)'};background:${k===cur?`rgba(${mode==='online'?'77,150,255':'199,125,255'},0.2)`:'rgba(255,255,255,0.05)'};color:${k===cur?'white':'rgba(255,255,255,0.5)'};transition:all 0.15s"
    >${KELAS_LABEL[jenjang](k)}</button>`).join('');
}

function renderMapelGrid(containerId, mode) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!bankMapelList.length) {
    el.innerHTML = '<div style="grid-column:1/-1;text-align:center;opacity:.5;font-size:13px;padding:12px">Belum ada soal di bank soal.</div>';
    return;
  }
  const accent = mode === 'online' ? '#4D96FF' : '#C77DFF';
  const accentRgb = mode === 'online' ? '77,150,255' : '199,125,255';
  el.innerHTML = bankMapelList.map(m => {
    const isSel = selectedMapel[mode] === m.mapel;
    const qCount = mode === 'online' ? (queueCounts[m.mapel] || 0) : 0;
    const qBadge = (mode === 'online' && qCount > 0)
      ? `<span style="font-size:10px;background:rgba(255,107,107,0.85);color:white;border-radius:50px;padding:2px 6px;font-weight:800;margin-top:2px">⚔️ ${qCount} nunggu</span>`
      : '';
    return `<button onclick="pilihMapel('${m.mapel.replace(/'/g,"\\'")}','${mode}')"
      style="padding:12px 8px;border-radius:14px;font-family:Nunito,sans-serif;font-weight:800;font-size:12px;cursor:pointer;border:2px solid ${isSel ? accent : 'rgba(255,255,255,0.1)'};background:${isSel ? `rgba(${accentRgb},0.2)` : 'rgba(255,255,255,0.05)'};color:${isSel ? 'white' : 'rgba(255,255,255,0.65)'};transition:all 0.15s;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center"
      data-mapel="${m.mapel}">
      <span style="font-size:22px">${getMapelIcon(m.mapel)}</span>
      <span style="font-size:11px;line-height:1.2">${m.mapel}</span>
      <span style="font-size:10px;opacity:.5">${m.total === null ? '🤖 AI' : ''}</span>
      ${qBadge}
    </button>`;
  }).join('');
}

function pilihJenjang(btn, jenjang, mode) {
  const prefix = mode === 'online' ? 'online' : 'ai';
  document.querySelectorAll(`#${prefix}-jenjang-pills .jenjang-pill`).forEach(b => {
    b.style.background = 'rgba(255,255,255,0.08)';
    b.style.border = '2px solid rgba(255,255,255,0.15)';
    b.style.color = 'rgba(255,255,255,0.6)';
  });
  const accent = mode === 'online' ? 'linear-gradient(135deg,#4D96FF,#2979FF)' : 'linear-gradient(135deg,#C77DFF,#7b2ff7)';
  btn.style.background = accent;
  btn.style.border = 'none';
  btn.style.color = 'white';
  selectedJenjang[mode] = jenjang;
  selectedKelas[mode] = KELAS_MAP[jenjang][0];
  renderKelasPills(`${prefix}-kelas-pills`, jenjang, mode);
  if (mode === 'online') requestQueueCounts();
}

function pilihKelas(kelas, mode) {
  selectedKelas[mode] = kelas;
  renderKelasPills(`${mode === 'online' ? 'online' : 'ai'}-kelas-pills`, selectedJenjang[mode], mode);
  if (mode === 'online') requestQueueCounts();
}

function pilihMapel(mapel, mode) {
  selectedMapel[mode] = mapel;
  renderMapelGrid(`${mode === 'online' ? 'online' : 'ai'}-mapel-grid`, mode);
  if (mode === 'online') {
    document.getElementById('online-cari-btn').disabled = false;
    document.getElementById('online-cari-btn').innerHTML = `🔍 Cari Lawan — ${mapel}`;
  } else {
    document.getElementById('ai-mulai-btn').disabled = false;
  }
}

function setOnlineMode(mode) {
  onlineJoinMode = mode;
  const btnRandom = document.getElementById('online-mode-random');
  const btnPilih  = document.getElementById('online-mode-pilih');
  const mapelWrap = document.getElementById('online-mapel-wrap');
  const randomInfo = document.getElementById('online-random-info');
  const cariBtn   = document.getElementById('online-cari-btn');
  if (mode === 'random') {
    btnRandom.style.borderColor = '#FFD93D';
    btnRandom.style.background  = 'rgba(255,217,61,0.15)';
    btnRandom.style.color       = '#FFD93D';
    btnPilih.style.borderColor  = 'rgba(255,255,255,0.15)';
    btnPilih.style.background   = 'rgba(255,255,255,0.05)';
    btnPilih.style.color        = 'rgba(255,255,255,0.6)';
    mapelWrap.style.display     = 'none';
    randomInfo.style.display    = 'block';
    cariBtn.disabled = false;
    cariBtn.style.background = 'linear-gradient(135deg,#FFD93D,#FFA500)';
    cariBtn.style.color = '#1a1a2e';
    cariBtn.innerHTML = '🎲 Cari Lawan Random';
  } else {
    btnPilih.style.borderColor  = '#4D96FF';
    btnPilih.style.background   = 'rgba(77,150,255,0.15)';
    btnPilih.style.color        = '#4D96FF';
    btnRandom.style.borderColor = 'rgba(255,255,255,0.15)';
    btnRandom.style.background  = 'rgba(255,255,255,0.05)';
    btnRandom.style.color       = 'rgba(255,255,255,0.6)';
    mapelWrap.style.display     = 'block';
    randomInfo.style.display    = 'none';
    cariBtn.disabled = !selectedMapel.online;
    cariBtn.style.background = 'linear-gradient(135deg,#4D96FF,#2979FF)';
    cariBtn.style.color = 'white';
    cariBtn.innerHTML = '🔍 Cari Lawan';
    requestQueueCounts();
  }
}

function requestQueueCounts() {
  if (!zepSocket || onlineJoinMode !== 'pilih') return;
  zepSocket.emit('zep:get_queue_counts', {
    jenjang: selectedJenjang.online,
    kelas: selectedKelas.online
  });
}

function getKategoriKey(mode) {
  if (mode === 'online' && onlineJoinMode === 'random')
    return `random_${selectedJenjang[mode]}`;
  return `${selectedJenjang[mode]}_${selectedKelas[mode]}_${selectedMapel[mode] || 'acak'}`;
}

// Daftar default mata pelajaran yang bisa di-generate AI
const DEFAULT_MAPEL = [
  'Matematika','Bahasa Indonesia','Bahasa Inggris','IPA','IPS',
  'Biologi','Fisika','Kimia','Sejarah','Geografi',
  'Ekonomi','PKN','Seni Budaya','PJOK','Informatika',
  'Sosiologi','Bahasa Jawa','Agama'
];

async function loadBankMapel(mode) {
  try {
    const data = await api('GET', '/zepquiz/bank-mapel');
    const fromBank = (data.data || []).map(m => m.mapel);
    // Gabungkan: dari bank soal + default, deduplikasi
    const all = [...new Set([...fromBank, ...DEFAULT_MAPEL])];
    bankMapelList = all.map(m => ({ mapel: m, total: fromBank.includes(m) ? (data.data.find(x=>x.mapel===m)?.total||0) : null }));
    renderMapelGrid(`${mode === 'online' ? 'online' : 'ai'}-mapel-grid`, mode);
  } catch(e) {
    // Fallback: gunakan daftar default
    bankMapelList = DEFAULT_MAPEL.map(m => ({ mapel: m, total: null }));
    renderMapelGrid(`${mode === 'online' ? 'online' : 'ai'}-mapel-grid`, mode);
  }
}

// ============================================================
//  MODE: VS ONLINE — Matchmaking by Mapel
// ============================================================
async function bukaVSOnline() {
  zepIForfeited = false;
  zepPrevMode = 'online';
  showPage('page-zep-online');
  selectedMapel.online = null;
  onlineJoinMode = 'random';
  document.getElementById('online-matchmaking-status').style.display = 'none';
  document.getElementById('online-cari-btn').style.display = 'block';
  renderKelasPills('online-kelas-pills', selectedJenjang.online, 'online');
  await loadBankMapel('online');
  setOnlineMode('random');
}

async function zepCariLawan() {
  if (onlineJoinMode === 'pilih' && !selectedMapel.online) { toast('Pilih mata pelajaran dulu!', 'error'); return; }
  if (!zepSocket) zepConnect();

  // Cek token — jika tidak ada, minta login ulang
  const tkn = localStorage.getItem('kb_token');
  if (!tkn) { toast('Sesi habis. Silakan refresh halaman.', 'error'); return; }

  const jenjang = selectedJenjang.online;
  const kelas   = selectedKelas.online;

  // Mode random: prioritaskan mapel yang ada di bank soal, acak sisanya
  const daftarRandom = onlineJoinMode === 'random'
    ? [...bankMapelList.filter(m => m.total > 0).map(m => m.mapel),
       ...DEFAULT_MAPEL].filter((v,i,a) => a.indexOf(v) === i) // deduplikasi
    : null;

  let mapel = selectedMapel.online;
  if (onlineJoinMode === 'random') {
    mapel = daftarRandom[Math.floor(Math.random() * daftarRandom.length)];
  }

  const kategori = getKategoriKey('online');

  // Tampilkan status matchmaking
  document.getElementById('online-cari-btn').style.display = 'none';
  document.getElementById('online-matchmaking-status').style.display = 'block';
  const modeLabel = onlineJoinMode === 'random' ? '🎲 Random' : '📖 Pilih Mapel';
  document.getElementById('online-mm-info').textContent = `${getMapelIcon(mapel)} ${mapel} · ${jenjang} · ${modeLabel}`;
  mmElapsed = 0;
  clearInterval(mmTimerInterval);
  mmTimerInterval = setInterval(() => {
    mmElapsed++;
    document.getElementById('online-mm-timer').textContent = mmElapsed + 's';
    const icons = ['⚔️','🎯','🏆','🎮','⚡'];
    document.getElementById('online-mm-anim').textContent = icons[Math.floor(mmElapsed / 2) % icons.length];
  }, 1000);

  zepSocket.emit('zep:matchmaking_join', {
    kategori,
    user:   { id: currentUser.id, nama: currentUser.nama, avatar: currentUser.avatar || '🦁' },
    mapel, jenjang, kelas,
    durasi: 25
  });
}

function zepBatalMatchmaking() {
  clearInterval(mmTimerInterval);
  if (zepSocket) zepSocket.emit('zep:matchmaking_cancel', { user_id: currentUser.id });
  document.getElementById('online-matchmaking-status').style.display = 'none';
  document.getElementById('online-cari-btn').style.display = 'block';
}

// ============================================================
//  MODE: VS AI — pilih mapel dari bank soal
// ============================================================
let aiGameState      = null;
let aiDifficulty     = 'mudah';
let aiSelectedMapel  = null;
let aiTimerInterval  = null;

const AI_ACCURACY = { mudah: 0.40, sedang: 0.65, sulit: 0.85 };
const AI_NAME = 'KikiBot 🤖';
const AI_AVATAR = '🤖';

async function bukaVSAI() {
  zepPrevMode = 'ai';
  showPage('page-zep-ai');
  aiSelectedMapel = null;
  selectedMapel.ai = null;
  document.getElementById('ai-mulai-btn').disabled = true;
  renderKelasPills('ai-kelas-pills', selectedJenjang.ai, 'ai');
  await loadBankMapel('ai');
}

function pilihDiffAI(btn, diff) {
  document.querySelectorAll('.ai-diff-btn').forEach(b => {
    b.style.background = 'rgba(255,255,255,0.05)';
    b.style.borderColor = 'rgba(255,255,255,0.15)';
    b.style.color = 'rgba(255,255,255,0.6)';
  });
  const colors = { mudah: '#6BCB77', sedang: '#FFD93D', sulit: '#FF6B6B' };
  btn.style.background = `rgba(${diff==='mudah'?'107,203,119':diff==='sedang'?'255,211,61':'255,107,107'},0.2)`;
  btn.style.borderColor = colors[diff];
  btn.style.color = colors[diff];
  aiDifficulty = diff;
}

async function zepMulaiVSAI() {
  const mapel   = selectedMapel.ai;
  const jenjang = selectedJenjang.ai;
  const kelas   = selectedKelas.ai;
  if (!mapel) { toast('Pilih mata pelajaran dulu!', 'error'); return; }
  showLoading(true, 'Loading...');
  try {
    let data = await api('GET', `/zepquiz/ai-generate?mapel=${encodeURIComponent(mapel)}&jenjang=${encodeURIComponent(jenjang)}&kelas=${encodeURIComponent(kelas)}&jumlah=10`);
    if (!data.success || !data.soal?.length) {
      // AI gagal/limit — coba bank soal tanpa notif ke user
      data = await api('GET', `/zepquiz/bank-soal?mapel=${encodeURIComponent(mapel)}&jumlah=10`);
    }
    if (!data.success || !data.soal?.length) { toast(`Belum ada soal untuk ${mapel}. Pilih mata pelajaran lain!`, 'error'); showLoading(false); return; }

    aiGameState = {
      soal: data.soal,
      idx: 0,
      skorSaya: 0,
      skorAI: 0,
      totalSoal: data.soal.length,
      durasi: 15,
      aiName: AI_NAME,
      aiJawaban: null, aiBenar: false, aiPoin: 0, aiSudahPilih: false,
      userJawaban: null, userBenar: false, userPoin: 0
    };
    showLoading(false);
    zepVSAITampilSoal();
  } catch(e) { toast('Gagal memuat soal.', 'error'); showLoading(false); }
}

function zepVSAITampilSoal() {
  if (!aiGameState) return;
  const { soal, idx, totalSoal, durasi } = aiGameState;
  const s = soal[idx];
  clearInterval(aiTimerInterval);

  document.getElementById('zep-soal-num-nav').textContent = `Soal ${idx+1}/${totalSoal}`;
  document.getElementById('zep-my-skor').textContent = aiGameState.skorSaya;
  document.getElementById('zep-soal-progress').style.width = (idx/totalSoal*100)+'%';
  document.getElementById('zep-soal-emoji').textContent = s.emoji || '❓';
  document.getElementById('zep-soal-text').textContent = s.pertanyaan;

  const opsiKode = ['A','B','C','D'];
  document.getElementById('zep-opsi-container').innerHTML = `<div class="zep-opsi-grid">
    ${(s.opsi||[]).map((o,i)=>`
      <button class="zep-opsi zep-opsi-${opsiKode[i]}"
        onclick="zepVSAIJawab('${String(o).replace(/'/g,"\\'")}',this)"
        data-jawaban="${String(o).replace(/"/g,'&quot;')}">${o}</button>`).join('')}
  </div>`;
  // Reset pilihan AI untuk soal ini
  aiGameState.aiJawaban   = null;
  aiGameState.aiBenar     = false;
  aiGameState.aiPoin      = 0;
  aiGameState.aiSudahPilih = false;

  document.getElementById('zep-hasil-feedback').style.display = 'none';
  showPage('page-zep-soal');
  zepStartTimer(durasi);

  // AI diam-diam memilih setelah delay random
  const acc = AI_ACCURACY[aiDifficulty] || 0.65;
  const delay = 1500 + Math.random() * 5000;
  setTimeout(() => {
    if (!aiGameState || aiGameState.idx !== idx) return;
    const benar = Math.random() < acc;
    const salahOpsi = (s.opsi||[]).filter(o => String(o).trim().toLowerCase() !== String(s.jawaban).trim().toLowerCase());
    const jawabanAI = benar ? s.jawaban : (salahOpsi[Math.floor(Math.random()*salahOpsi.length)] || s.opsi[0]);
    const waktuSisa = zepTimerSisa;
    const poinAI = benar ? Math.round((s.poin||100)*(0.5+0.5*(waktuSisa/aiGameState.durasi))) : 0;
    // Simpan pilihan AI — akan ditampilkan saat user menjawab atau waktu habis
    aiGameState.aiJawaban    = jawabanAI;
    aiGameState.aiBenar      = benar;
    aiGameState.aiPoin       = poinAI;
    aiGameState.aiSudahPilih = true;
    // Jika user sudah menjawab duluan, tampilkan komparasi sekarang
    if (zepSudahJawab) zepVSAITampilKomparasi();
  }, delay);
}

function zepVSAIJawab(jawaban, btnEl) {
  if (!aiGameState) return;
  if (zepSudahJawab) return;
  zepSudahJawab = true;
  clearInterval(zepTimerInterval);
  document.querySelectorAll('.zep-opsi').forEach(b => b.classList.add('disabled'));

  const s    = aiGameState.soal[aiGameState.idx];
  const idx  = aiGameState.idx;
  const benar = String(jawaban).trim().toLowerCase() === String(s.jawaban).trim().toLowerCase();
  const waktuSisa = zepTimerSisa;
  const poin = benar ? Math.round((s.poin||100)*(0.5+0.5*(waktuSisa/aiGameState.durasi))) : 0;

  // Simpan pilihan user
  aiGameState.userJawaban = jawaban;
  aiGameState.userBenar   = benar;
  aiGameState.userPoin    = poin;

  // Jika AI sudah memilih → langsung tampilkan komparasi
  // Jika belum → tunggu sampai AI memilih (handled di timeout AI di atas)
  if (aiGameState.aiSudahPilih) {
    zepVSAITampilKomparasi();
  } else {
    // Tampil animasi menunggu AI
    const feedback = document.getElementById('zep-hasil-feedback');
    feedback.style.display = 'block';
    feedback.innerHTML = `<div class="zep-sudah-jawab" style="opacity:.7">🤖 KikiBot sedang berpikir...</div>`;
  }
}

function zepVSAITampilKomparasi() {
  if (!aiGameState) return;
  const s   = aiGameState.soal[aiGameState.idx];
  const idx = aiGameState.idx;

  const jawabanSaya = aiGameState.userJawaban;
  const benarSaya   = aiGameState.userBenar;
  const poinSaya    = aiGameState.userPoin;
  const jawabanAI   = aiGameState.aiJawaban;
  const benarAI     = aiGameState.aiBenar;
  const poinAI      = aiGameState.aiPoin;

  // Tambah ke skor total
  aiGameState.skorSaya += poinSaya;
  aiGameState.skorAI   += poinAI;
  zepSkorSaya = aiGameState.skorSaya;

  // Reset agar tidak ditambahkan dua kali
  aiGameState.userJawaban  = null;
  aiGameState.userBenar    = false;
  aiGameState.userPoin     = 0;
  aiGameState.aiJawaban    = null;
  aiGameState.aiBenar      = false;
  aiGameState.aiPoin       = 0;
  aiGameState.aiSudahPilih = false;

  // Highlight tombol opsi
  document.querySelectorAll('.zep-opsi').forEach(b => {
    const val = String(b.getAttribute('data-jawaban')).trim().toLowerCase();
    if (val === String(s.jawaban).trim().toLowerCase()) b.classList.add('reveal-benar');
    else if (jawabanSaya && val === String(jawabanSaya).trim().toLowerCase() && !benarSaya) b.classList.add('reveal-salah');
  });

  const feedback = document.getElementById('zep-hasil-feedback');
  feedback.style.display = 'block';
  feedback.innerHTML = `
    <div style="display:flex;gap:10px;align-items:stretch;margin-bottom:8px">
      <div style="flex:1;background:${benarSaya?'rgba(107,203,119,0.18)':'rgba(255,107,157,0.18)'};border:2px solid ${benarSaya?'#6BCB77':'#FF6B9D'};border-radius:14px;padding:10px 8px;text-align:center">
        <div style="font-size:10px;font-weight:800;opacity:.65;margin-bottom:5px;letter-spacing:.5px">KAMU</div>
        <div style="font-size:12px;font-weight:800;color:white;word-break:break-word;line-height:1.3;min-height:32px;display:flex;align-items:center;justify-content:center">${jawabanSaya || '—'}</div>
        <div style="font-size:20px;margin:5px 0">${benarSaya ? '✅' : '❌'}</div>
        <div style="font-size:12px;font-weight:800;color:${benarSaya?'#6BCB77':'#FF6B9D'}">${benarSaya ? '+'+poinSaya+' poin' : 'Salah'}</div>
      </div>
      <div style="flex:1;background:${benarAI?'rgba(107,203,119,0.18)':'rgba(255,107,157,0.18)'};border:2px solid ${benarAI?'#6BCB77':'#FF6B9D'};border-radius:14px;padding:10px 8px;text-align:center">
        <div style="font-size:10px;font-weight:800;opacity:.65;margin-bottom:5px;letter-spacing:.5px">🤖 KIKIBOT</div>
        <div style="font-size:12px;font-weight:800;color:white;word-break:break-word;line-height:1.3;min-height:32px;display:flex;align-items:center;justify-content:center">${jawabanAI || '—'}</div>
        <div style="font-size:20px;margin:5px 0">${benarAI ? '✅' : '❌'}</div>
        <div style="font-size:12px;font-weight:800;color:${benarAI?'#6BCB77':'#FF6B9D'}">${benarAI ? '+'+poinAI+' poin' : 'Salah'}</div>
      </div>
    </div>
    <div style="text-align:center;font-size:12px;opacity:.6">Jawaban benar: <strong style="color:#FFD93D">${s.jawaban}</strong></div>
  `;

  // Lanjut ke soal berikutnya setelah 3.5 detik
  setTimeout(() => {
    if (!aiGameState || aiGameState.idx !== idx) return;
    const next = idx + 1;
    if (next < aiGameState.totalSoal) {
      aiGameState.idx = next;
      zepSudahJawab = false;
      zepVSAITampilSoal();
    } else {
      zepVSAISelesai();
    }
  }, 3500);
}

function zepVSAISelesai() {
  clearInterval(aiTimerInterval);
  clearInterval(zepTimerInterval);
  const { skorSaya, skorAI, totalSoal, aiName } = aiGameState;
  const menang = skorSaya > skorAI;
  const seri = skorSaya === skorAI;

  const lb = [
    { id: currentUser.id, nama: currentUser.nama, avatar: currentUser.avatar || '🦁', skor: skorSaya },
    { id: 'ai-bot', nama: aiName, avatar: AI_AVATAR, skor: skorAI }
  ].sort((a,b) => b.skor - a.skor);

  document.getElementById('zep-final-judul').textContent = menang ? '🎉 Kamu Menang!' : seri ? '🤝 Seri!' : '😤 KikiBot Menang!';
  document.getElementById('zep-final-posisi').textContent = `Kamu: ${skorSaya} poin · KikiBot: ${skorAI} poin`;
  document.getElementById('zep-final-skor').textContent = skorSaya + ' poin';
  renderPodium('zep-podium', lb);
  renderZepLB('zep-final-lb', lb);
  showPage('page-zep-final');
  aiGameState = null;
}

// ============================================================
//  GURU: Kirim undangan ke kelas
// ============================================================
async function zepGuruInviteKelas() {
  if (!zepRoom) return;
  const kode = zepRoom.kode || zepRoom.kode_room;
  const kelas = currentKelas;
  if (!kelas?.id) {
    toast('Buka halaman kelas dulu sebelum invite!', 'error');
    return;
  }
  const btn = document.getElementById('zep-invite-btn');
  const status = document.getElementById('zep-invite-status');
  btn.disabled = true;
  btn.textContent = '📤 Mengirim...';
  try {
    await api('POST', `/notifikasi/kelas/${kelas.id}`, {
      judul: '🎯 Undangan Quiz Live!',
      pesan: `${currentUser.nama} mengundang kamu untuk join Kita Quiz "${zepRoom.judul || ''}"! Kode Room: ${kode}`,
      tipe: 'quiz_invite',
      data_extra: { kode_room: kode }
    });
    btn.textContent = '✅ Undangan Terkirim!';
    status.textContent = `Kode ${kode} dikirim ke semua murid di kelas ${kelas.nama}`;
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '📢 Kirim Undangan ke Kelas';
      status.textContent = '';
    }, 10000);
  } catch(e) {
    toast('Gagal kirim undangan', 'error');
    btn.disabled = false;
    btn.textContent = '📢 Kirim Undangan ke Kelas';
  }
}

async function zepMuridJoin() {
  const kode = document.getElementById('zep-join-kode').value.trim().toUpperCase();
  if (kode.length < 4) { toast('Masukkan kode room dengan benar!', 'error'); return; }
  showLoading(true);
  zepSkorSaya = 0;
  zepSocket.emit('zep:join_room', {
    kode_room: kode,
    user: { id: currentUser.id, nama: currentUser.nama, avatar: currentUser.avatar || '🦁' }
  });
}

function zepMuridKeluar() {
  if (zepRoom) zepSocket.emit('zep:close_room', { kode_room: zepRoom.kode });
  zepReset();
  showPage('page-murid');
}

function renderZepPemainWait(pemain) {
  const g = document.getElementById('zep-wait-pemain-grid');
  if (!pemain || !pemain.length) {
    g.innerHTML = '<div class="zep-waiting">⏳ Belum ada pemain lain...</div>';
    return;
  }
  g.innerHTML = pemain.map(p => `
    <div class="zep-pemain-card">
      <div class="zep-pemain-avatar">${chatAvatarHtml(p.avatar || '🦁')}</div>
      <div class="zep-pemain-nama">${p.nama}</div>
    </div>`).join('');
}

// ── MURID: Tampilkan soal ───────────────────────────────────
function zepMuridTampilSoal({ idx, totalSoal, soal, durasi }) {
  zepSoalIdx = idx;
  zepDurasi = durasi || 15;
  zepSudahJawab = false;
  zepWaktuMulaiSoal = Date.now();

  // Update header
  document.getElementById('zep-soal-num-nav').textContent = `Soal ${idx + 1}/${totalSoal}`;
  document.getElementById('zep-my-skor').textContent = zepSkorSaya;
  const pct = ((idx) / totalSoal) * 100;
  document.getElementById('zep-soal-progress').style.width = pct + '%';

  // Soal card
  document.getElementById('zep-soal-emoji').textContent = soal.emoji || '❓';
  document.getElementById('zep-soal-text').textContent = soal.pertanyaan;

  // Opsi
  const opsiKode = ['A', 'B', 'C', 'D'];
  const opsiContainer = document.getElementById('zep-opsi-container');
  opsiContainer.innerHTML = `<div class="zep-opsi-grid">
    ${(soal.opsi || []).map((o, i) => `
      <button class="zep-opsi zep-opsi-${opsiKode[i]}"
        onclick="zepMuridJawab('${String(o).replace(/'/g,"\\'")}', this)"
        data-jawaban="${String(o).replace(/"/g,'&quot;')}">
        <span style="font-size:12px;opacity:.6;margin-bottom:4px;display:block">${opsiKode[i]}</span>
        ${o}
      </button>`).join('')}
  </div>`;

  document.getElementById('zep-hasil-feedback').style.display = 'none';
  // Tampilkan tombol forfeit hanya di VS Player online (bukan VS AI, bukan guru-hosted)
  const forfeitBtn = document.getElementById('zep-forfeit-btn');
  if (forfeitBtn) forfeitBtn.style.display = zepIsOnline ? 'flex' : 'none';
  showPage('page-zep-soal');

  // Timer
  zepStartTimer(durasi);
}

function zepStartTimer(detik) {
  clearInterval(zepTimerInterval);
  zepTimerSisa = detik;

  function update() {
    const circle = document.getElementById('zep-timer-circle');
    const numEl = document.getElementById('zep-timer-num');
    if (!circle || !numEl) return;
    const ratio = zepTimerSisa / detik;
    circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - ratio);
    numEl.textContent = zepTimerSisa;
    if (zepTimerSisa <= 5) {
      circle.style.stroke = '#FF4757';
      numEl.style.color = '#FF4757';
    } else {
      circle.style.stroke = '#FFD93D';
      numEl.style.color = '#FFD93D';
    }
  }
  update();
  zepTimerInterval = setInterval(() => {
    zepTimerSisa--;
    update();
    if (zepTimerSisa <= 0) {
      clearInterval(zepTimerInterval);
      if (!zepSudahJawab) {
        document.querySelectorAll('.zep-opsi').forEach(b => b.classList.add('disabled'));
        // VS AI: waktu habis — user dianggap tidak menjawab, tampilkan komparasi
        if (aiGameState) {
          zepSudahJawab = true;
          const s = aiGameState.soal[aiGameState.idx];
          // Pastikan AI sudah memilih (jika belum, putuskan sekarang)
          if (!aiGameState.aiSudahPilih) {
            const acc = AI_ACCURACY[aiDifficulty] || 0.65;
            const benarAI = Math.random() < acc;
            const salahOpsi = (s.opsi||[]).filter(o => String(o).trim().toLowerCase() !== String(s.jawaban).trim().toLowerCase());
            aiGameState.aiJawaban    = benarAI ? s.jawaban : (salahOpsi[Math.floor(Math.random()*salahOpsi.length)] || s.opsi[0]);
            aiGameState.aiBenar      = benarAI;
            aiGameState.aiPoin       = benarAI ? Math.round((s.poin||100)*0.5) : 0;
            aiGameState.aiSudahPilih = true;
          }
          // User tidak menjawab
          aiGameState.userJawaban = null;
          aiGameState.userBenar   = false;
          aiGameState.userPoin    = 0;
          zepVSAITampilKomparasi();
        }
      }
    }
  }, 1000);
}

function zepMuridJawab(jawaban, btnEl) {
  if (zepSudahJawab) return;
  if (!zepRoom || !zepRoom.kode) {
    toast('Koneksi bermasalah. Coba refresh halaman.', 'error');
    return;
  }
  zepSudahJawab = true;
  clearInterval(zepTimerInterval);

  const waktuSisa = zepTimerSisa;
  document.querySelectorAll('.zep-opsi').forEach(b => b.classList.add('disabled'));

  if (!zepSocket) {
    toast('Tidak terhubung ke server. Silakan refresh halaman.', 'error');
    zepSudahJawab = false;
    return;
  }

  // Kirim jawaban — socket.io otomatis buffer & kirim ulang jika sedang reconnect
  zepSocket.emit('zep:jawab', {
    kode_room: zepRoom.kode,
    soalIdx: zepSoalIdx,
    jawaban,
    waktuSisa
  });

  // Tampilkan animasi menunggu
  const feedback = document.getElementById('zep-hasil-feedback');
  if (feedback) {
    feedback.style.display = 'block';
    feedback.innerHTML = '<div class="zep-sudah-jawab">✅ Jawaban terkirim! Tunggu ya...</div>';
  }
}

function zepMuridHasilJawab({ benar, poinDapat, jawabanBenar, totalSkor }) {
  zepSkorSaya = totalSkor;
  document.getElementById('zep-my-skor').textContent = totalSkor;

  // Highlight opsi benar/salah
  document.querySelectorAll('.zep-opsi').forEach(btn => {
    const jawBtn = btn.getAttribute('data-jawaban');
    if (String(jawBtn).trim().toLowerCase() === String(jawabanBenar).trim().toLowerCase()) {
      btn.classList.add('reveal-benar');
    }
  });

  const feedback = document.getElementById('zep-hasil-feedback');
  feedback.style.display = 'block';
  if (benar) {
    feedback.innerHTML = `<div class="zep-sudah-jawab">🎉 Benar! +${poinDapat} poin</div>`;
  } else {
    feedback.innerHTML = `<div class="zep-sudah-jawab" style="color:#FF6B9D">❌ Salah. Jawaban: ${jawabanBenar}</div>`;
  }
}

function zepMuridTampilHasil({ idx, jawabanBenar, leaderboard }) {
  clearInterval(zepTimerInterval);
  document.getElementById('zep-hasil-skor-nav').textContent = zepSkorSaya;

  // Cari posisi saya
  const posSaya = leaderboard.findIndex(p => p.id === currentUser.id);
  const dataBenar = leaderboard.find(p => p.id === currentUser.id);

  const content = document.getElementById('zep-hasil-soal-content');
  if (dataBenar?.benar) {
    content.innerHTML = `<div style="font-size:56px;margin-bottom:8px">🎉</div>
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#6BCB77">+${dataBenar.poin} Poin!</div>
      <div style="opacity:.6;margin-top:6px">Jawaban Benar ✅</div>`;
  } else {
    content.innerHTML = `<div style="font-size:56px;margin-bottom:8px">😅</div>
      <div style="font-family:'Fredoka One',cursive;font-size:24px;color:#FF6B9D">Jawaban: ${jawabanBenar}</div>
      <div style="opacity:.6;margin-top:6px">Semangat soal berikutnya!</div>`;
  }

  renderZepLB('zep-lb-sementara', leaderboard);
  showPage('page-zep-hasil-soal');
}

function zepMuridFinal({ leaderboard, judul }) {
  clearInterval(zepTimerInterval);
  const posSaya = leaderboard.findIndex(p => p.id === currentUser.id) + 1;
  const medals = ['🥇', '🥈', '🥉'];

  // Ambil skor dari leaderboard server (lebih akurat dari client-side zepSkorSaya)
  const mySelf = leaderboard.find(p => p.id === currentUser.id);
  const mySkor = mySelf?.skor ?? zepSkorSaya;

  document.getElementById('zep-final-judul').textContent = judul + ' — Selesai!';
  document.getElementById('zep-final-skor').textContent = mySkor + ' poin';
  document.getElementById('zep-final-posisi').textContent = `Kamu di posisi #${posSaya} dari ${leaderboard.length} pemain`;

  renderPodium('zep-podium', leaderboard);
  renderZepLB('zep-final-lb', leaderboard);
  showPage('page-zep-final');
  zepReset();
}

// ── GURU: Buka halaman host ─────────────────────────────────
async function bukaZepQuizGuru() {
  zepConnect();
  zepIsGuru = true;
  zepSelectedQuizId = null;
  document.getElementById('zep-guru-step1').style.display = 'block';
  document.getElementById('zep-guru-lobby').style.display = 'none';
  document.getElementById('zep-guru-live').style.display = 'none';
  document.getElementById('zep-guru-final').style.display = 'none';
  document.getElementById('zep-guru-start-btn').style.display = 'none';
  document.getElementById('zep-buat-room-btn').style.display = 'none';
  showPage('page-zep-guru');
  showLoading(true);
  try {
    const data = await api('GET', '/zepquiz/quiz');
    const list = data.quiz || [];
    const grid = document.getElementById('zep-quiz-list');
    if (!list.length) {
      grid.innerHTML = '<div style="opacity:.5;font-size:14px;grid-column:1/-1">Belum ada quiz aktif yang punya soal. Buat quiz di menu Soal dulu ya!</div>';
    } else {
      grid.innerHTML = list.map(q => `
        <div class="zep-quiz-item" onclick="zepGuruPilihQuiz('${q.id}', this)">
          <h4>${q.judul}</h4>
          <p>${q.mapel}</p>
          <span class="zep-quiz-badge">📝 ${q.total_soal} soal · ⏱ ${q.durasi}s/soal</span>
        </div>`).join('');
    }
  } catch(e) {
    toast('Gagal memuat quiz', 'error');
  }
  showLoading(false);
}

function zepGuruPilihQuiz(quizId, el) {
  document.querySelectorAll('.zep-quiz-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  zepSelectedQuizId = quizId;
  document.getElementById('zep-buat-room-btn').style.display = 'inline-block';
}

async function zepGuruBuatRoom() {
  if (!zepSelectedQuizId) { toast('Pilih quiz dulu!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/zepquiz/room', { quiz_id: zepSelectedQuizId });
    if (!data.success) { toast(data.pesan || 'Gagal buat room', 'error'); showLoading(false); return; }
    zepRoom = data.room;
    zepSocket.emit('zep:create_room', {
      kode_room: data.room.kode_room,
      quiz: { judul: data.room.judul, mapel: data.room.mapel, durasi_per_soal: data.room.durasi_per_soal, kelas_id: data.room.kelas_id || null },
      soal: data.room.soal,
      guru: { id: currentUser.id, nama: currentUser.nama }
    });
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
    showLoading(false);
  }
}

function zepGuruMulai() {
  if (!zepRoom) return;
  const pemainCount = document.getElementById('zep-guru-jumlah-pemain').textContent;
  if (parseInt(pemainCount) === 0) {
    if (!confirm('Belum ada murid yang join. Mulai quand sekarang?')) return;
  }
  document.getElementById('zep-guru-start-btn').style.display = 'none';
  document.getElementById('zep-guru-lobby').style.display = 'none';
  document.getElementById('zep-guru-live').style.display = 'block';
  zepSocket.emit('zep:start_game', { kode_room: zepRoom.kode_room || zepRoom.kode });
}

function zepGuruUpdateLive({ idx, totalSoal, soal, durasi }) {
  document.getElementById('zep-guru-live-soal').textContent = `Soal ${idx + 1}/${totalSoal}`;
  document.getElementById('zep-guru-live-pertanyaan').textContent = soal.pertanyaan;
  // Timer display
  let t = durasi;
  clearInterval(zepTimerInterval);
  zepTimerInterval = setInterval(() => {
    t--;
    document.getElementById('zep-guru-live-timer').textContent = `⏱ ${t}`;
    if (t <= 0) clearInterval(zepTimerInterval);
  }, 1000);
  document.getElementById('zep-guru-live-timer').textContent = `⏱ ${durasi}`;
}

function renderZepGuruPemain(pemain) {
  const g = document.getElementById('zep-guru-pemain-grid');
  if (!pemain || !pemain.length) {
    g.innerHTML = '<div class="zep-waiting">⏳ Menunggu murid bergabung...</div>';
    return;
  }
  g.innerHTML = pemain.map(p => `
    <div class="zep-pemain-card">
      <div class="zep-pemain-avatar">${chatAvatarHtml(p.avatar || '🦁')}</div>
      <div class="zep-pemain-nama">${p.nama}</div>
    </div>`).join('');
}

function renderZepGuruLB(pemain) {
  renderZepLB('zep-guru-lb', pemain);
}

function zepGuruFinal({ leaderboard, judul }) {
  clearInterval(zepTimerInterval);
  document.getElementById('zep-guru-live').style.display = 'none';
  document.getElementById('zep-guru-final').style.display = 'block';
  document.getElementById('zep-guru-final-judul').textContent = (judul || 'Quiz') + ' — Selesai!';
  renderPodium('zep-guru-podium', leaderboard);
  renderZepLB('zep-guru-final-lb', leaderboard);
}

function zepGuruTutupRoom() {
  if (zepRoom) {
    zepSocket.emit('zep:close_room', { kode_room: zepRoom.kode_room || zepRoom.kode });
  }
  zepReset();
  showPage('page-guru');
}

function zepGuruReset() {
  zepReset();
  bukaZepQuizGuru();
}

// ── Helpers ─────────────────────────────────────────────────
function renderZepLB(containerId, pemain) {
  const medals = ['🥇', '🥈', '🥉'];
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!pemain || !pemain.length) { el.innerHTML = '<div style="opacity:.4;text-align:center;padding:12px">Belum ada data</div>'; return; }
  el.innerHTML = pemain.map((p, i) => `
    <div class="zep-lb-row">
      <div class="zep-lb-rank">${medals[i] || (i + 1)}</div>
      <div class="zep-lb-avatar">${chatAvatarHtml(p.avatar || '🦁')}</div>
      <div class="zep-lb-nama">${p.nama}</div>
      ${'benar' in p ? `<div class="zep-lb-benar">${p.benar ? '✅' : '❌'}</div>` : ''}
      <div class="zep-lb-skor">${p.skor}</div>
    </div>`).join('');
}

function renderPodium(containerId, leaderboard) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const medals = ['🥇', '🥈', '🥉'];
  const order = [1, 0, 2]; // posisi visual: 2nd, 1st, 3rd
  const top3 = leaderboard.slice(0, 3);
  el.innerHTML = order.map(i => {
    const p = top3[i];
    if (!p) return '';
    return `<div class="zep-podium-item zep-podium-${i + 1}">
      <div class="zep-podium-avatar">${chatAvatarHtml(p.avatar || '🦁')}</div>
      <div class="zep-podium-nama">${p.nama}</div>
      <div class="zep-podium-skor">${p.skor} poin</div>
      <div class="zep-podium-bar">${medals[i]}</div>
    </div>`;
  }).join('');
}

// ── Reconnect setelah refresh ─────────────────────────────
function zepCekReconnect() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('zep_active_room') || 'null');
    if (!saved) return;
    // Hanya relevan dalam 10 menit
    if (Date.now() - saved.ts > 10 * 60 * 1000) {
      sessionStorage.removeItem('zep_active_room');
      return;
    }
    // Tampilkan banner
    const banner = document.getElementById('zep-reconnect-banner');
    if (banner) banner.style.display = 'flex';
    window._zepReconnectKode = saved.kode;
  } catch(e) {}
}

function zepDoReconnect() {
  const banner = document.getElementById('zep-reconnect-banner');
  if (banner) banner.style.display = 'none';
  const kode = window._zepReconnectKode;
  if (!kode || !currentUser?.id) return;
  zepConnect();
  zepIsOnline = true;
  zepRoom = { kode };
  zepSocket.emit('zep:rejoin', { kode_room: kode, user_id: currentUser.id });
  toast('Mencoba menyambung ulang ke game...', 'info');
}

function zepAbaikanReconnect() {
  const banner = document.getElementById('zep-reconnect-banner');
  if (banner) banner.style.display = 'none';
  try { sessionStorage.removeItem('zep_active_room'); } catch(e) {}
}

function zepKonfirmasiForfeit() {
  const modal = document.getElementById('modal-forfeit');
  if (modal) { modal.style.display = 'flex'; }
}
function closeForfeitModal() {
  const modal = document.getElementById('modal-forfeit');
  if (modal) { modal.style.display = 'none'; }
}
function zepDoForfeit() {
  closeForfeitModal();
  if (zepSocket && zepRoom?.kode) {
    zepSocket.emit('zep:forfeit', { kode_room: zepRoom.kode, user_id: currentUser?.id });
  }
  clearInterval(zepTimerInterval);
  zepReset();
  zepIForfeited = true; // set SETELAH zepReset agar tidak langsung di-clear
  showPage('page-zep-mode');
  toast('Kamu menyerah dari permainan.', 'info');
}

function zepReset() {
  clearInterval(zepTimerInterval);
  zepRoom = null;
  zepSkorSaya = 0;
  zepSoalIdx = -1;
  zepSudahJawab = false;
  zepSelectedQuizId = null;
  zepIsOnline = false;
  // zepIForfeited TIDAK di-clear di sini — di-clear saat sesi baru (bukaVSOnline / bukaZepQuizMurid)
  // Sembunyikan tombol forfeit
  const forfeitBtn = document.getElementById('zep-forfeit-btn');
  if (forfeitBtn) forfeitBtn.style.display = 'none';
  // Bersihkan sesi reconnect
  try { sessionStorage.removeItem('zep_active_room'); } catch(e) {}
}

function zepSesiBaru() {
  // Langsung ke mode yang sama tanpa menunggu lawan
  if (zepPrevMode === 'online') bukaVSOnline();
  else if (zepPrevMode === 'ai')  bukaVSAI();
  else bukaZepQuizMurid();
}
