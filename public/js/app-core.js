// ============================================================
//  CONFIG
// ============================================================
const API = window.location.origin + '/api';
let token = localStorage.getItem('kb_token') || null;
const socket = io(window.location.origin, {
  auth: { token }
});
let currentUser = JSON.parse(localStorage.getItem('kb_user') || 'null');
let currentRole = 'murid'; // for login page
let currentRegRole = 'murid';

// ── DARK MODE FUNCTIONS ──────────────────────────────────────
function toggleGlobalDarkMode() {
  const mode = document.body.classList.toggle('dark-mode');
  localStorage.setItem('kb_dark_mode', mode);
  document.querySelectorAll('.dark-mode-toggle').forEach(btn => {
    btn.textContent = mode ? '☀️' : '🌙';
  });
}

function initGlobalDarkMode() {
  const isDarkMode = localStorage.getItem('kb_dark_mode') === 'true';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  document.querySelectorAll('.dark-mode-toggle').forEach(btn => {
    btn.textContent = isDarkMode ? '☀️' : '🌙';
  });
}

function kembaliKeDashboardUtama() {
  if (currentUser) {
    if (currentUser.role === 'guru') showPage('page-guru');
    else if (currentUser.role === 'orangtua') showPage('page-orangtua');
    else showPage('page-murid');
  } else {
    showPage('page-landing');
  }
}

// ============================================================
//  MATA PELAJARAN MANAGEMENT
// ============================================================
// Mapel per akun guru — disimpan dengan key unik per user ID
function getMapelStorageKey() {
  const userId = currentUser?.id || 'guest';
  return 'kb_mapel_' + userId;
}

const MAPEL_ACCENT_COLORS = ['#FF6B35','#4D96FF','#6BCB77','#C77DFF','#FF6B9D','#FFD93D','#FF4757','#2ED573','#FFA502','#1E90FF','#A29BFE','#00CEC9'];
const QUICK_EMOJIS = ['\uD83C\uDFC3','\uD83C\uDFB5','\uD83D\uDDA5\uFE0F','\uD83E\uDDEA','\uD83C\uDF0D','\uD83C\uDFAD','\uD83D\uDCD0','\uD83D\uDD2C','\uD83D\uDD2D','\uD83C\uDFDB\uFE0F','\uD83E\uDDEE','\uD83C\uDFAF','\u26BD','\uD83C\uDFBB','\u271D\uFE0F','\u262A\uFE0F','\uD83C\uDF3A','\uD83C\uDFCB\uFE0F','\uD83D\uDCBB','\uD83E\uDDE0','\uD83D\uDCF8','\uD83D\uDDFF'];

function getMapelList() {
  const key = getMapelStorageKey();
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }
  return [];
}

function saveMapelList(list) {
  const key = getMapelStorageKey();
  localStorage.removeItem('kb_mapel_list'); // hapus key lama yang shared
  localStorage.setItem(key, JSON.stringify(list));
}

function populateMapelSelects() {
  const list = getMapelList();
  const opts = list.length
    ? list.map(m => `<option value="${m.nama}">${m.emoji} ${m.nama}</option>`).join('')
    : '<option value="">-- Belum ada mapel --</option>';
  ['m-mapel', 'edit-m-mapel', 's-mapel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

function renderMuridMapelGrid() {
  const grid = document.getElementById('murid-mapel-grid');
  if (!grid) return;
  const list = getMapelList();
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📭</div><p>Guru belum menambahkan mata pelajaran</p></div>';
    return;
  }
  const progressColors = MAPEL_ACCENT_COLORS;
  grid.innerHTML = list.map((m, i) => {
    const color = progressColors[i % progressColors.length];
    return `<div class="mapel-card" onclick="loadMateri('${m.nama.replace(/'/g,"\\'")}',this)">
      <div class="mapel-icon">${m.emoji}</div>
      <h4>${m.nama}</h4>
      <div class="progress-mini"><div class="progress-fill" style="width:0%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

function renderGuruMapelPanel() {
  const el = document.getElementById('guru-mapel-list');
  if (!el) return;
  const list = getMapelList();
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Belum ada mata pelajaran. Tambahkan yang pertama!</p></div>';
    return;
  }
  el.innerHTML = list.map((m, i) => {
    const color = MAPEL_ACCENT_COLORS[i % MAPEL_ACCENT_COLORS.length];
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F5F5F5">
      <div style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:${color}22;flex-shrink:0">${m.emoji}</div>
      <div style="flex:1;font-weight:700;font-size:14px">${m.nama}</div>
      <button class="btn-icon btn-delete" onclick="hapusMapel('${m.nama.replace(/'/g,"\\'")}','${m.emoji}')" title="Hapus">🗑️</button>
    </div>`;
  }).join('');
}

function openTambahMapel() {
  document.getElementById('mapel-nama').value = '';
  document.getElementById('mapel-emoji').value = '📌';
  document.getElementById('emoji-preview').textContent = '📌';
  document.getElementById('emoji-quick').innerHTML = QUICK_EMOJIS.map(e =>
    `<span onclick="pickMapelEmoji('${e}')" title="${e}" style="font-size:26px;cursor:pointer;padding:5px;border-radius:8px;border:2px solid transparent;transition:all 0.15s;display:inline-flex;align-items:center;justify-content:center" onmouseover="this.style.background='#F5F5F5';this.style.borderColor='#ddd'" onmouseout="this.style.background='';this.style.borderColor='transparent'">${e}</span>`
  ).join('');
  openModal('modal-tambah-mapel');
}

function pickMapelEmoji(e) {
  document.getElementById('mapel-emoji').value = e;
  document.getElementById('emoji-preview').textContent = e;
}

function submitTambahMapel() {
  const nama  = document.getElementById('mapel-nama').value.trim();
  const emoji = document.getElementById('mapel-emoji').value.trim() || '📌';
  if (!nama) { toast('Nama mata pelajaran harus diisi! 😊', 'error'); return; }
  if (nama.length > 40) { toast('Nama terlalu panjang! Maksimal 40 karakter.', 'error'); return; }

  let list = getMapelList();
  if (list.find(m => m.nama.toLowerCase() === nama.toLowerCase())) {
    toast('Mata pelajaran itu sudah ada! 🤔', 'error'); return;
  }

  list.push({ nama, emoji });
  saveMapelList(list);
  renderGuruMapelPanel();
  populateMapelSelects();
  closeModal('modal-tambah-mapel');
  toast(`"${nama}" berhasil ditambahkan! 🎉`, 'success');
}

function hapusMapel(nama, emoji) {
  if (!confirm(`Hapus mata pelajaran "${emoji} ${nama}"?\n\nMateri dan soal yang sudah dibuat dengan mapel ini tidak akan terhapus.`)) return;
  let list = getMapelList().filter(m => m.nama !== nama);
  saveMapelList(list);
  renderGuruMapelPanel();
  populateMapelSelects();
  toast(`"${nama}" dihapus dari daftar mapel.`, 'success');
}

// ============================================================
//  UTILS
// ============================================================
// ============================================================
//  MARKDOWN RENDERER
// ============================================================
function renderMarkdown(text) {
  if (!text) return '';
  // Escape HTML dulu agar tag mentah dari input (mis. <script>, <img onerror>)
  // menjadi teks inert. Tag markdown di bawah ditambahkan SETELAH escape,
  // jadi tetap berfungsi. Link hanya cocok https?:// (tak bisa javascript:).
  return escapeHtml(text)
    // Headings
    .replace(/^### (.+)$/gm, '<h4 style="font-weight:800;font-size:15px;margin:14px 0 6px;color:var(--text)">$1</h4>')
    .replace(/^## (.+)$/gm,  '<h3 style="font-weight:800;font-size:17px;margin:16px 0 8px;color:var(--text)">$1</h3>')
    .replace(/^# (.+)$/gm,   '<h2 style="font-weight:900;font-size:20px;margin:18px 0 10px;color:var(--text)">$1</h2>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    // Markdown links [teks](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:700;text-decoration:underline">$1</a>')
    // Plain URLs (http/https) not already inside an href
    .replace(/(?<!href=["'])(?<![">])(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-weight:700;text-decoration:underline">$1</a>')
    // Bullet list
    .replace(/^\* (.+)$/gm,   '<li style="margin-left:18px;margin-bottom:4px">$1</li>')
    .replace(/^- (.+)$/gm,    '<li style="margin-left:18px;margin-bottom:4px">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, match => `<ul style="margin:8px 0;padding-left:4px">${match}</ul>`)
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p style="margin:8px 0;font-size:14px;line-height:1.8">')
    // Single newline
    .replace(/\n/g, '<br>')
    // Wrap in paragraph
    .replace(/^/, '<p style="margin:0;font-size:14px;line-height:1.8">')
    .replace(/$/, '</p>');
}

function toggleMateri(postId, btn) {
  const el = document.getElementById(postId + '-content');
  const isCollapsed = el.style.maxHeight === '160px';
  if (isCollapsed) {
    el.style.maxHeight = '';
    el.style.overflow = '';
    el.style.position = '';
    el.querySelector('div[style*="linear-gradient"]')?.remove();
    btn.textContent = '🔼 Sembunyikan';
  } else {
    el.style.maxHeight = '160px';
    el.style.overflow = 'hidden';
    el.style.position = 'relative';
    const fade = document.createElement('div');
    fade.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(transparent,white)';
    el.appendChild(fade);
    btn.textContent = '📖 Baca Selengkapnya';
  }
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// Klik logo di navbar -> kembali ke "beranda" yang sesuai peran user.
// Belum login -> landing. Sudah login -> dashboard sesuai role.
function goHome() {
  if (currentUser && currentUser.role === 'guru') return showPage('page-guru');
  if (currentUser && currentUser.role === 'murid') return showPage('page-murid');
  if (currentUser && currentUser.role === 'orangtua') return showPage('page-orangtua');
  showPage('page-landing');
}

// Validasi format email dasar (dipakai di login & register).
// Menolak input seperti "fno@nog" (tanpa domain TLD).
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function showLoading(v, msg) {
  document.getElementById('loading').classList.toggle('show', v);
  const txtEl = document.getElementById('loading-text');
  if (txtEl) txtEl.textContent = v && msg ? msg : 'Memuat...';
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = type ? `show ${type}` : 'show';
  setTimeout(() => el.className = '', 2800);
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (res.status === 401 || res.status === 403) {
    // Coba parse dulu — 403 bisa juga dari role restriction, bukan hanya token expired
    let body = {};
    try { body = await res.clone().json(); } catch(e) {}
    const pesanBawah = (body.pesan || '').toLowerCase();
    const isTokenError = pesanBawah.includes('token') || pesanBawah.includes('kadaluarsa') || pesanBawah.includes('login') || res.status === 401;
    if (isTokenError) {
      localStorage.removeItem('kb_token');
      token = null;
      toast('Sesi habis. Silakan login ulang.', 'error');
      setTimeout(() => showPage('page-login'), 1500);
      return { success: false, _authExpired: true };
    }
  }
  return res.json();
}

function openModal(id) {
  if (id === 'modal-buat-kelas') {
    const mapelList = getMapelList();
    if (!mapelList || mapelList.length === 0) {
      toast('Buat mata pelajaran dulu sebelum membuat kelas! 📖', 'error');
      setTimeout(() => openTambahMapel(), 300);
      return;
    }
  }
  document.getElementById(id).classList.add('open');
  if (id === 'modal-ai-materi') populateAIMapel();
  if (id === 'modal-buat-kelas') populateBuatKelasMapel();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Feature card modal data
const featureData = {
  materi: {
    icon: '📚',
    title: 'Materi Lengkap',
    content: `
      <p>KitaBelajar menyediakan <strong>materi lengkap</strong> untuk semua jenjang pendidikan:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li><strong>SD (Kelas 1-6)</strong> — Matematika, IPA, Bahasa Indonesia, IPS, Bahasa Inggris</li>
        <li><strong>SMP (Kelas 7-9)</strong> — Matematika, IPA, Bahasa Indonesia, Sejarah, Geografi, Ekonomi</li>
        <li><strong>SMA (Kelas 10-12)</strong> — Matematika Lanjutan, Fisika, Kimia, Biologi, Sosiologi, Ekonomi</li>
      </ul>
      <p>Setiap materi dilengkapi dengan:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li>📝 Penjelasan lengkap dengan bahasa yang mudah dipahami</li>
        <li>🎯 Ringkasan poin penting di setiap bab</li>
        <li>🔗 Link ke latihan soal dan video pendukung</li>
        <li>🤖 Fitur AI untuk tanya-jawab materi secara interaktif</li>
      </ul>
    `
  },
  latihan: {
    icon: '✏️',
    title: 'Latihan Soal',
    content: `
      <p>Ribuan soal latihan siap membantu kamu menguasai setiap mata pelajaran:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li><strong>Bank Soal Lengkap</strong> — Ribuan soal dari berbagai jenjang dan mata pelajaran</li>
        <li><strong>Level Kesulitan</strong> — Mudah, Sedang, Sulit — sesuaikan dengan kemampuanmu</li>
        <li><strong>Soal Acak</strong> — Urutan soal diacak setiap sesi agar tidak bosan</li>
        <li><strong>Pembahasan</strong> — Setiap soal dilengkapi pembahasan lengkap</li>
        <li><strong>Progress Tracking</strong> — Pantau perkembangan belajarmu</li>
      </ul>
      <p>Soal-soal ini dirancang oleh guru-guru berpengalaman dan disesuaikan dengan kurikulum terbaru.</p>
    `
  },
  games: {
    icon: '🎮',
    title: 'Games Edukatif',
    content: `
      <p>Belajar jadi lebih seru dengan berbagai permainan edukatif:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li><strong>Quiz Interaktif</strong> — Uji pengetahuanmu dengan quiz yang menyenangkan</li>
        <li><strong>Puzzle Matematika</strong> — Latih logika dengan puzzle yang menantang</li>
        <li><strong>Flashcard</strong> — Hafal konsep penting dengan kartu flash yang efektif</li>
        <li><strong>Word Scramble</strong> — Susun kata untuk mengingat istilah penting</li>
        <li><strong>Memory Game</strong> — Latih daya ingat dengan permainan memori</li>
        <li><strong>Math Race</strong> — Balapan hitung cepat untuk melatih kecepatan berpikir</li>
      </ul>
      <p>Setiap permainan memberikan XP dan badge sebagai reward atas pencapaianmu! 🏆</p>
    `
  },
  poin: {
    icon: '🏆',
    title: 'Sistem Poin & Gamifikasi',
    content: `
      <p>Sistem gamifikasi membuat belajarmu semakin seru dan memotivasi:</p>
      <ul style="text-align:left;line-height:2;margin:16px 0;padding-left:20px">
        <li><strong>XP (Experience Points)</strong> — Dapatkan XP dari setiap aktivitas belajar</li>
        <li><strong>Level Up</strong> — Naik level seiring bertambahnya XP</li>
        <li><strong>Leaderboard</strong> — Bersaing dengan teman sekelas untuk peringkat tertinggi</li>
        <li><strong>Badge & Achievement</strong> — Kumpulkan badge untuk pencapaian tertentu</li>
        <li><strong>Daily Streak</strong> — Login setiap hari untuk menjaga streak dan bonus XP</li>
        <li><strong>Referral Bonus</strong> — Ajak teman dan dapatkan bonus XP</li>
      </ul>
      <p>Setiap poin yang kamu kumpulkan menunjukkan progress belajarmu. Semakin tinggi levelmu, semakin banyak tantangan yang terbuka! 🚀</p>
    `
  }
};

function openFeatureModal(key) {
  const data = featureData[key];
  if (!data) return;
  document.getElementById('feature-modal-icon').textContent = data.icon;
  document.getElementById('feature-modal-title').textContent = data.title;
  document.getElementById('feature-modal-content').innerHTML = data.content;
  const overlay = document.getElementById('modal-feature-detail');
  const slide = document.getElementById('modal-feature-slide');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    slide.classList.add('open');
  });
}

function closeFeatureModal() {
  const overlay = document.getElementById('modal-feature-detail');
  const slide = document.getElementById('modal-feature-slide');
  slide.classList.remove('open');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 400);
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ============================================================
//  AUTH
// ============================================================
// Login terpadu (SSO-like): satu pintu untuk semua peran.
// Role tidak lagi dipilih user — backend mengembalikan role & kita arahkan otomatis.
function showLogin() {
  showPage('page-login');
}

// Dipertahankan untuk kompatibilitas bila masih ada pemanggil lama; kini no-op aman.
function switchRole(role) {
  currentRole = role;
}

function showRegister() {
  showPage('page-register');
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { toast('Isi email dan password dulu ya! 😊', 'error'); return; }
  if (!isValidEmail(email)) { toast('Format email tidak valid. Contoh: nama@email.com', 'error'); return; }

  showLoading(true);
  try {
    const data = await api('POST', '/auth/login', { email, password });
    if (data.success) {
      // Login terpadu: peran ditentukan backend, langsung diarahkan ke dashboard yang sesuai.
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('kb_token', token);
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      // Bersihkan key mapel lama yang shared (migrasi ke per-user)
      localStorage.removeItem('kb_mapel_list');
      joinPrivateChannel();
      loadBellNotifications();
      // Aktifkan push notification (minta izin jika belum)
      setTimeout(() => subscribePush(), 2000);
      toast(`Selamat datang, ${currentUser.nama}! 🎉`, 'success');
      if (currentUser.role === 'guru') {
        loadGuruDashboard();
        remindDataDiriIfNeeded();
      } else if (currentUser.role === 'kepala_sekolah') {
        window.location.href = '/portal-kepala.html';
      } else if (currentUser.role === 'orangtua') {
        loadOrangtuaDashboard();
      } else {
        loadMuridDashboard();
        remindDataDiriIfNeeded();
      }
    } else {
      toast(data.pesan || 'Login gagal. Cek email & password kamu!', 'error');
    }
  } catch (e) {
    toast('Tidak bisa terhubung ke server 😢', 'error');
  }
  showLoading(false);
}

let _pendingRegEmail = null;

async function doRegister() {
  const nama = document.getElementById('reg-nama').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const kelas = document.getElementById('reg-kelas').value.trim();
  if (!nama || !email || !password) { toast('Lengkapi semua data ya! 😊', 'error'); return; }
  if (!isValidEmail(email)) { toast('Format email tidak valid. Contoh: nama@email.com', 'error'); return; }
  if (password.length < 8) { toast('Password minimal 8 karakter ya! 🔒', 'error'); return; }

  showLoading(true);
  try {
    const body = { nama, email, password, role: 'murid' };
    if (kelas) body.kelas = kelas;
    const data = await api('POST', '/auth/send-otp', body);
    if (data.success) {
      _pendingRegEmail = email;
      document.getElementById('otp-email-hint').textContent = email;
      document.getElementById('otp-input').value = '';
      openModal('modal-otp-register');
    } else {
      toast(data.pesan || 'Pendaftaran gagal.', 'error');
    }
  } catch (e) {
    toast('Tidak bisa terhubung ke server 😢', 'error');
  }
  showLoading(false);
}

async function doVerifyOTP() {
  const otp = document.getElementById('otp-input').value.trim();
  if (!otp || otp.length !== 6) { toast('Masukkan 6 digit kode OTP!', 'error'); return; }

  showLoading(true);
  try {
    const data = await api('POST', '/auth/register', { email: _pendingRegEmail, otp });
    if (data.success) {
      closeModal('modal-otp-register');
      _pendingRegEmail = null;
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('kb_token', token);
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      joinPrivateChannel();
      loadBellNotifications();
      setTimeout(() => subscribePush(), 2000);
      toast(`Akun berhasil dibuat! Selamat datang ${currentUser.nama}! 🎉`, 'success');
      // Tampilkan info akun orangtua jika murid
      if (data.parent_info && currentUser.role === 'murid') {
        setTimeout(() => {
          const { parentEmail, parentPassword } = data.parent_info;
          const msg = `👨‍👩‍👧 Akun orangtua sudah dibuat!\nEmail: ${parentEmail}\nPassword: ${parentPassword}\n\nKredensial ini juga tersimpan di notifikasi 🔔 & dikirim ke emailmu. Screenshot ini untuk disimpan!`;
          alert(msg);
        }, 1500);
      }
      if (currentUser.role === 'guru') loadGuruDashboard();
      else if (currentUser.role === 'orangtua') loadOrangtuaDashboard();
      else {
        loadMuridDashboard();
        // Murid baru: minta lengkapi data diri lewat popup (boleh skip sekali)
        if (!currentUser.profil_lengkap) setTimeout(() => openDataDiriModal(true), 1800);
      }
    } else {
      toast(data.pesan || 'Kode OTP salah atau kedaluwarsa.', 'error');
    }
  } catch (e) {
    toast('Tidak bisa terhubung ke server 😢', 'error');
  }
  showLoading(false);
}

async function doResendOTP() {
  if (!_pendingRegEmail) return;
  showLoading(true);
  // Ambil data dari form yang masih terisi
  const nama = document.getElementById('reg-nama').value.trim();
  const password = document.getElementById('reg-password').value;
  const kelas = document.getElementById('reg-kelas').value.trim();
  try {
    const body = { nama, email: _pendingRegEmail, password, role: currentRegRole };
    if (currentRegRole === 'murid' && kelas) body.kelas = kelas;
    if (currentRegRole === 'guru') {
      body.alamat = document.getElementById('reg-alamat').value.trim();
      body.umur = document.getElementById('reg-umur').value.trim();
      body.asal_sekolah = document.getElementById('reg-asal-sekolah').value.trim();
    }
    const data = await api('POST', '/auth/send-otp', body);
    if (data.success) toast('Kode OTP baru sudah dikirim!', 'success');
    else toast(data.pesan || 'Gagal kirim ulang.', 'error');
  } catch (e) { toast('Tidak bisa terhubung ke server 😢', 'error'); }
  showLoading(false);
}

// ============================================================
//  LENGKAPI DATA DIRI (popup murid setelah daftar)
// ============================================================
function openDataDiriModal(allowSkip = true) {
  // Prefill dari currentUser jika ada
  document.getElementById('dd-alamat').value = currentUser?.alamat || '';
  document.getElementById('dd-umur').value = currentUser?.umur || '';
  document.getElementById('dd-asal-sekolah').value = currentUser?.asal_sekolah || '';
  document.getElementById('dd-skip-btn').style.display = allowSkip ? 'block' : 'none';
  // Reward hanya untuk murid; sesuaikan teks untuk guru
  const isGuru = currentUser?.role === 'guru';
  document.getElementById('dd-reward-badge').style.display = isGuru ? 'none' : 'inline-block';
  document.getElementById('dd-subtitle').textContent = isGuru
    ? 'Lengkapi data dirimu sebagai pengajar 😊'
    : 'Isi data dirimu supaya gurumu mengenalmu lebih baik 😊';
  document.getElementById('dd-asal-sekolah').placeholder = isGuru ? 'Nama sekolah tempat mengajar' : 'Nama sekolahmu';
  openModal('modal-data-diri');
}

async function doSubmitDataDiri() {
  const alamat = document.getElementById('dd-alamat').value.trim();
  const umur = document.getElementById('dd-umur').value.trim();
  const asal_sekolah = document.getElementById('dd-asal-sekolah').value.trim();
  if (!alamat || !umur || !asal_sekolah) { toast('Lengkapi semua data ya! 😊', 'error'); return; }

  showLoading(true);
  try {
    const data = await api('PUT', '/auth/data-diri', { alamat, umur, asal_sekolah });
    if (data.success) {
      if (currentUser) {
        currentUser.alamat = alamat; currentUser.umur = parseInt(umur, 10);
        currentUser.asal_sekolah = asal_sekolah; currentUser.profil_lengkap = true;
        if (data.reward) { currentUser.xp = data.reward.new_xp; currentUser.level = data.reward.new_level; }
        localStorage.setItem('kb_user', JSON.stringify(currentUser));
      }
      closeModal('modal-data-diri');
      if (data.reward) {
        showDataDiriReward(data.reward);
        if (currentUser?.role === 'murid') loadMuridDashboard();
      } else {
        toast('Data diri tersimpan! Terima kasih 🎉', 'success');
      }
    } else {
      toast(data.pesan || 'Gagal menyimpan data diri.', 'error');
    }
  } catch (e) { toast('Tidak bisa terhubung ke server 😢', 'error'); }
  showLoading(false);
}

function skipDataDiri() {
  closeModal('modal-data-diri');
  toast('Jangan lupa lengkapi data dirimu lewat menu Profil ya! 😊', 'info');
}

// ============================================================
//  HAPUS AKUN
// ============================================================
function bukaHapusAkun() {
  const inp = document.getElementById('hapus-akun-konfirmasi');
  if (inp) inp.value = '';
  cekKonfirmasiHapus();
  openModal('modal-hapus-akun');
}

function cekKonfirmasiHapus() {
  const val = (document.getElementById('hapus-akun-konfirmasi').value || '').trim().toUpperCase();
  const btn = document.getElementById('hapus-akun-btn');
  const ok = val === 'HAPUS AKUN';
  btn.style.opacity = ok ? '1' : '.5';
  btn.style.pointerEvents = ok ? 'auto' : 'none';
}

async function doHapusAkun() {
  const konfirmasi = (document.getElementById('hapus-akun-konfirmasi').value || '').trim();
  if (konfirmasi.toUpperCase() !== 'HAPUS AKUN') { toast('Ketik "HAPUS AKUN" untuk konfirmasi.', 'error'); return; }

  showLoading(true);
  try {
    const data = await api('DELETE', '/auth/account', { konfirmasi });
    if (data.success) {
      closeModal('modal-hapus-akun');
      toast('Akun kamu telah dihapus. Sampai jumpa! 👋', 'success');
      setTimeout(() => doLogout(), 1200);
    } else {
      toast(data.pesan || 'Gagal menghapus akun.', 'error');
    }
  } catch (e) { toast('Tidak bisa terhubung ke server 😢', 'error'); }
  showLoading(false);
}

// Popup perayaan reward setelah data diri lengkap
function showDataDiriReward(reward) {
  const xp = reward?.xp || 0;
  let el = document.getElementById('datadiri-reward-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'datadiri-reward-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(3px)';
    document.body.appendChild(el);
  }
  const levelLine = reward?.leveled_up ? `<div style="font-size:15px;font-weight:800;color:#7b2ff7;margin-top:6px">⭐ Naik ke Level ${reward.new_level}!</div>` : '';
  el.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:32px 28px;max-width:340px;width:88%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:ddPop .4s cubic-bezier(.18,.89,.32,1.28)">
      <div style="font-size:64px;line-height:1;margin-bottom:8px;animation:ddBounce 1s ease infinite">🎁</div>
      <h3 style="margin:0 0 6px;font-size:22px;color:#333">Hadiah Didapat!</h3>
      <p style="color:#666;font-size:14px;margin:0 0 14px">Terima kasih sudah melengkapi data diri 😊</p>
      <div style="background:linear-gradient(135deg,#FF6B35,#ff9a6c);color:#fff;border-radius:16px;padding:16px;font-weight:900;font-size:30px;letter-spacing:1px">+${xp} XP</div>
      ${levelLine}
      <button onclick="document.getElementById('datadiri-reward-overlay').remove()" style="margin-top:18px;width:100%;padding:13px;background:var(--orange,#FF6B35);color:#fff;border:none;border-radius:14px;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer">Asyik! 🎉</button>
    </div>
    <style>@keyframes ddPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}@keyframes ddBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}</style>`;
  // tutup otomatis kalau klik latar
  el.onclick = (e) => { if (e.target === el) el.remove(); };
}

// Ingatkan murid/guru yang belum lengkap data diri saat login (boleh skip)
function remindDataDiriIfNeeded() {
  if (!['murid', 'guru'].includes(currentUser?.role) || currentUser?.profil_lengkap) return;
  // Jangan ingatkan tiap login. Cukup sekali per 2 hari per user (disimpan lokal).
  const REMIND_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 hari
  const key = 'kb_datadiri_reminder_' + (currentUser?.id || '');
  const last = parseInt(localStorage.getItem(key) || '0', 10);
  if (Date.now() - last < REMIND_INTERVAL_MS) return; // belum waktunya ingatkan lagi
  localStorage.setItem(key, String(Date.now()));
  setTimeout(() => openDataDiriModal(true), 2500);
}

// ============================================================
//  LUPA SANDI & RESET SANDI — 3-step OTP flow
// ============================================================
let _forgotEmail = null;
let _resetToken = null;

async function doForgotPassword(resend = false) {
  const email = resend ? _forgotEmail : document.getElementById('forgot-email').value.trim();
  if (!email) { toast('Masukkan email kamu!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/auth/forgot-password', { email });
    if (data.success) {
      _forgotEmail = email;
      document.getElementById('forgot-step-1').style.display = 'none';
      document.getElementById('forgot-step-2').style.display = 'block';
      document.getElementById('forgot-step-3').style.display = 'none';
      document.getElementById('forgot-otp-email-label').textContent = email;
      document.getElementById('forgot-otp').value = '';
      if (!resend) toast('✅ Kode OTP dikirim! Cek email kamu.', 'success');
      else toast('🔄 Kode OTP baru sudah dikirim!', 'success');
    } else {
      toast(data.pesan || 'Gagal mengirim OTP.', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server.', 'error'); }
  showLoading(false);
}

async function doVerifyResetOtp() {
  const otp = document.getElementById('forgot-otp').value.trim();
  if (!otp || otp.length !== 6) { toast('Masukkan kode OTP 6 digit!', 'error'); return; }
  if (!_forgotEmail) { toast('Mulai dari awal, email tidak ditemukan.', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/auth/verify-reset-otp', { email: _forgotEmail, otp });
    if (data.success) {
      _resetToken = data.reset_token;
      document.getElementById('forgot-step-1').style.display = 'none';
      document.getElementById('forgot-step-2').style.display = 'none';
      document.getElementById('forgot-step-3').style.display = 'block';
      toast('✅ OTP valid! Buat sandi baru kamu.', 'success');
    } else {
      toast(data.pesan || 'Kode OTP salah.', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server.', 'error'); }
  showLoading(false);
}

async function doResetPasswordStep3() {
  const pw1 = document.getElementById('forgot-pw-baru').value;
  const pw2 = document.getElementById('forgot-pw-konfirm').value;
  if (!pw1 || pw1 !== pw2) { toast('Sandi tidak cocok!', 'error'); return; }
  if (!_resetToken) { toast('Sesi habis. Mulai dari awal.', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/auth/reset-password', { token: _resetToken, password_baru: pw1 });
    if (data.success) {
      toast('🎉 Sandi berhasil diubah! Silakan login.', 'success');
      _resetToken = null;
      _forgotEmail = null;
      // Reset form ke step 1
      document.getElementById('forgot-step-1').style.display = 'block';
      document.getElementById('forgot-step-2').style.display = 'none';
      document.getElementById('forgot-step-3').style.display = 'none';
      document.getElementById('forgot-email').value = '';
      showPage('page-login');
    } else {
      toast(data.pesan || 'Gagal reset sandi.', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server.', 'error'); }
  showLoading(false);
}

// Legacy reset-password via URL token (kompatibilitas link lama)
async function doResetPassword() {
  const pw1 = document.getElementById('reset-password').value;
  const pw2 = document.getElementById('reset-password2').value;
  if (!pw1 || pw1 !== pw2) { toast('Sandi tidak cocok!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/auth/reset-password', { token: _resetToken, password_baru: pw1 });
    if (data.success) {
      toast('Sandi berhasil diubah! Silakan login. ✅', 'success');
      _resetToken = null;
      showPage('page-login');
    } else {
      toast(data.pesan || 'Gagal reset sandi.', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server.', 'error'); }
  showLoading(false);
}

// ============================================================
//  GOOGLE LOGIN — Google Identity Services
// ============================================================
const GOOGLE_CLIENT_ID = '1090565500817-q17ik5t91fssrv3ncj215oqh1atfcpmm.apps.googleusercontent.com';

let _pendingGoogleToken = null;
let _pendingGoogleGuruToken = null; // Token Google yang menunggu verifikasi kode undangan guru

async function _handleGoogleCredential(response) {
  showLoading(true);
  try {
    const isRegisterPage = document.getElementById('page-register') && document.getElementById('page-register').classList.contains('active');
    const mode = isRegisterPage ? 'register' : 'login';
    const data = await api('POST', '/auth/google', { google_token: response.credential, mode });
    if (data.success) {
      if (data.needs_kode_guru) {
        // Akun guru terdeteksi — minta kode undangan dari kepala sekolah
        _pendingGoogleGuruToken = data.google_token || response.credential;
        const namaEl = document.getElementById('google-guru-kode-nama');
        if (namaEl) namaEl.textContent = data.nama || data.email || '';
        const inputEl = document.getElementById('google-guru-kode-input');
        if (inputEl) inputEl.value = '';
        showLoading(false);
        openModal('modal-google-guru-kode');
        setTimeout(() => { if (inputEl) inputEl.focus(); }, 300);
        return;
      }
      if (data.is_new) {
        // User baru — simpan token Google, minta pilih role
        _pendingGoogleToken = data.google_token;
        document.getElementById('google-role-nama').textContent = data.nama || data.email || '';
        showLoading(false);
        openModal('modal-google-role');
        return;
      }
      // User lama — langsung login
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('kb_token', token);
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      joinPrivateChannel();
      loadBellNotifications();
      setTimeout(() => subscribePush(), 2000);
      toast(`Selamat datang, ${currentUser.nama}! 🎉`, 'success');
      if (currentUser.role === 'guru') { loadGuruDashboard(); remindDataDiriIfNeeded(); }
      else if (currentUser.role === 'kepala_sekolah') loadKepalaSekolahDashboard();
      else if (currentUser.role === 'orangtua') loadOrangtuaDashboard();
      else { loadMuridDashboard(); remindDataDiriIfNeeded(); }
    } else {
      toast(data.pesan || 'Login Google gagal.', 'error');
    }
  } catch(e) { toast('Login Google gagal.', 'error'); }
  showLoading(false);
}

// Dipanggil dari modal-google-guru-kode setelah user memasukkan kode undangan
async function completeGoogleGuruKode() {
  if (!_pendingGoogleGuruToken) return;
  const inputEl = document.getElementById('google-guru-kode-input');
  const kode = inputEl ? inputEl.value.trim().toUpperCase() : '';
  if (!kode) { toast('Masukkan kode undangan dari kepala sekolah.', 'error'); return; }

  closeModal('modal-google-guru-kode');
  showLoading(true);
  try {
    const data = await api('POST', '/auth/google', {
      google_token: _pendingGoogleGuruToken,
      kode_guru_login: kode
    });
    if (data.success && data.token) {
      _pendingGoogleGuruToken = null;
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('kb_token', token);
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      localStorage.removeItem('kb_mapel_list');
      joinPrivateChannel();
      loadBellNotifications();
      setTimeout(() => subscribePush(), 2000);
      toast(`Selamat datang, ${currentUser.nama}! 🎉`, 'success');
      loadGuruDashboard();
      remindDataDiriIfNeeded();
      if (!currentUser.profil_lengkap) setTimeout(() => openDataDiriModal(true), 1500);
    } else if (data.needs_kode_guru) {
      // Kode salah — buka kembali modal
      openModal('modal-google-guru-kode');
      toast(data.pesan || 'Kode undangan tidak valid.', 'error');
    } else {
      _pendingGoogleGuruToken = null;
      toast(data.pesan || 'Verifikasi kode guru gagal.', 'error');
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server 😢', 'error');
    openModal('modal-google-guru-kode');
  }
  showLoading(false);
}

async function completeGoogleRegister(role) {
  if (!_pendingGoogleToken) return;
  closeModal('modal-google-role');
  showLoading(true);
  try {
    const data = await api('POST', '/auth/google', { google_token: _pendingGoogleToken, role });
    _pendingGoogleToken = null;
    if (data.needs_kode_guru) {
      // User memilih role guru saat registrasi Google → minta kode undangan
      _pendingGoogleGuruToken = data.google_token;
      const namaEl = document.getElementById('google-guru-kode-nama');
      if (namaEl) namaEl.textContent = data.nama || data.email || '';
      const inputEl = document.getElementById('google-guru-kode-input');
      if (inputEl) inputEl.value = '';
      showLoading(false);
      openModal('modal-google-guru-kode');
      setTimeout(() => { if (inputEl) inputEl.focus(); }, 300);
      return;
    }
    if (data.success && data.token) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('kb_token', token);
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      joinPrivateChannel();
      loadBellNotifications();
      setTimeout(() => subscribePush(), 2000);
      toast(`Selamat datang, ${currentUser.nama}! 🎉`, 'success');
      if (currentUser.role === 'guru') {
        loadGuruDashboard();
        // Akun guru baru via Google → minta lengkapi data diri (boleh skip)
        if (!currentUser.profil_lengkap) setTimeout(() => openDataDiriModal(true), 1500);
      }
      else if (currentUser.role === 'orangtua') loadOrangtuaDashboard();
      else {
        loadMuridDashboard();
        // Akun murid baru via Google → minta lengkapi data diri (boleh skip)
        if (!currentUser.profil_lengkap) setTimeout(() => openDataDiriModal(true), 1500);
      }
    } else {
      toast(data.pesan || 'Registrasi Google gagal.', 'error');
    }
  } catch(e) { toast('Registrasi Google gagal.', 'error'); }
  showLoading(false);
}

let _googleInited = false;
function _initGoogle() {
  if (_googleInited || typeof google === 'undefined' || !google.accounts) return;
  _googleInited = true;
  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: _handleGoogleCredential,
      ux_mode: 'popup',
      itp_support: true
    });
  } catch (e) {
    console.error('[Google Sign-In] initialize gagal:', e);
  }
  ['google-btn-container', 'google-btn-container-reg'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      google.accounts.id.renderButton(el, {
        theme: 'outline', size: 'large', width: 320,
        text: 'signin_with', locale: 'id'
      });
    } catch (e) {
      console.error('[Google Sign-In] renderButton gagal:', e);
    }
    setTimeout(() => {
      if (el.childElementCount === 0) {
        console.warn(
          '[Google Sign-In] Tombol belum ter-render setelah 8 detik. Bila menetap, cek apakah origin "' +
          location.origin + '" sudah ada di Authorized JavaScript origins (Google Cloud Console).'
        );
      }
    }, 8000);
  });
}

function doGoogleLogin() { /* tidak dipakai, tombol render langsung oleh Google */ }

// ============================================================
//  PROFILE & SETTINGS
// ============================================================
function bukaProfileMurid() {
  if (!currentUser) return;
  setAvatarEl(document.getElementById('pm-avatar-display'), currentUser.avatar || '🦁');
  document.getElementById('pm-nama-display').textContent   = currentUser.nama;
  document.getElementById('pm-email-display').textContent  = currentUser.email;
  document.getElementById('pm-nama-input').value  = currentUser.nama;
  document.getElementById('pm-kelas-input').value = currentUser.kelas || '';
  document.getElementById('pm-alamat-input').value = currentUser.alamat || '';
  document.getElementById('pm-umur-input').value = currentUser.umur || '';
  document.getElementById('pm-asal-sekolah-input').value = currentUser.asal_sekolah || '';
  document.getElementById('pm-xp-badge').textContent    = (currentUser.xp || 0) + ' XP';
  document.getElementById('pm-level-badge').textContent  = 'Level ' + (currentUser.level || 1);
  document.getElementById('pm-avatar-picker').style.display = 'none';
  // Load rank + data diri dari server (sumber kebenaran)
  api('GET', '/auth/profile').then(data => {
    if (data.success) {
      const d = data.data || {};
      const rank = d.rank;
      document.getElementById('pm-rank-badge').textContent = rank ? '🏆 Rank #' + rank : '🏆 Rank #–';
      document.getElementById('pm-alamat-input').value = d.alamat || '';
      document.getElementById('pm-umur-input').value = d.umur || '';
      document.getElementById('pm-asal-sekolah-input').value = d.asal_sekolah || '';
      // Sinkronkan currentUser
      currentUser.alamat = d.alamat; currentUser.umur = d.umur;
      currentUser.asal_sekolah = d.asal_sekolah; currentUser.profil_lengkap = d.profil_lengkap;
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
    }
  }).catch(() => {});
  showPage('page-profile-murid');
}

function bukaProfileGuru() {
  if (!currentUser) return;
  setAvatarEl(document.getElementById('pg-avatar-display'), currentUser.avatar || '👩‍🏫');
  document.getElementById('pg-nama-display').textContent   = currentUser.nama;
  document.getElementById('pg-email-display').textContent  = currentUser.email;
  document.getElementById('pg-nama-input').value = currentUser.nama;
  document.getElementById('pg-alamat-input').value = currentUser.alamat || '';
  document.getElementById('pg-umur-input').value = currentUser.umur || '';
  document.getElementById('pg-asal-sekolah-input').value = currentUser.asal_sekolah || '';
  document.getElementById('pg-avatar-picker').style.display = 'none';
  // Sinkronkan data diri dari server (sumber kebenaran)
  api('GET', '/auth/profile').then(data => {
    if (data.success) {
      const d = data.data || {};
      document.getElementById('pg-alamat-input').value = d.alamat || '';
      document.getElementById('pg-umur-input').value = d.umur || '';
      document.getElementById('pg-asal-sekolah-input').value = d.asal_sekolah || '';
      currentUser.alamat = d.alamat; currentUser.umur = d.umur;
      currentUser.asal_sekolah = d.asal_sekolah; currentUser.profil_lengkap = d.profil_lengkap;
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
    }
  }).catch(() => {});
  // Load statistik dari dashboard
  api('GET', '/dashboard').then(data => {
    if (data.success) {
      const s = data.data?.stats || {};
      document.getElementById('pg-stat-murid').textContent  = s.total_murid  ?? '0';
      document.getElementById('pg-stat-kelas').textContent  = s.total_kelas  ?? '0';
      document.getElementById('pg-stat-materi').textContent = s.total_materi ?? '0';
      document.getElementById('pg-stat-soal').textContent   = s.total_soal   ?? '0';
    }
  }).catch(() => {});
  showPage('page-profile-guru');
}

const AVATAR_MURID = ['🦁','🐯','🐻','🦊','🐺','🐸','🐼','🐨','🦝','🦄','🐲','🦋','🐬','🦅','🐙','🦈','🐘','🦒','🦓','🐧','🦜','🐊'];
const AVATAR_GURU  = ['👩‍🏫','👨‍🏫','👩‍💼','👨‍💼','🧑‍🏫','👩‍🔬','👨‍🔬','👩‍🎓','👨‍🎓','🧑‍💻','👩‍🎨','👨‍🎨','🧙‍♀️','🧙‍♂️','🦸‍♀️','🦸‍♂️'];

function bukaGantiAvatar(role) {
  const pickerId = role === 'guru' ? 'pg-avatar-picker' : 'pm-avatar-picker';
  const listId   = role === 'guru' ? 'pg-avatar-list'   : 'pm-avatar-list';
  const picker = document.getElementById(pickerId);
  const isOpen = picker.style.display !== 'none';
  picker.style.display = isOpen ? 'none' : '';

  if (!isOpen) {
    // Render avatar grid
    const avatars = role === 'guru' ? AVATAR_GURU : AVATAR_MURID;
    const accent  = role === 'guru' ? 'var(--blue)' : 'var(--orange)';
    const current = currentUser?.avatar || '';
    document.getElementById(listId).innerHTML = avatars.map(a => {
      const isActive = a === current;
      return `<div onclick="pilihAvatar('${a}','${role}')"
        style="font-size:32px;cursor:pointer;padding:8px;border-radius:10px;
               border:2px solid ${isActive ? accent : '#eee'};
               background:${isActive ? '#FFF3E8' : 'white'};
               transition:all 0.2s"
        onmouseover="this.style.borderColor='${accent}';this.style.transform='scale(1.1)'"
        onmouseout="this.style.borderColor='${isActive ? accent : '#eee'}';this.style.transform=''"
        title="${a}">${a}</div>`;
    }).join('');
  }
}

// Helper: cek apakah avatar adalah foto (bukan emoji)
function isFotoAvatar(a) { return a && (a.startsWith('data:') || a.startsWith('http')); }

// Helper: render avatar ke elemen — otomatis handle emoji vs foto
// size: 'big' (banner, profil), 'nav' (kecil di nav bar)
function setAvatarEl(el, avatarStr, size) {
  if (!el) return;
  if (isFotoAvatar(avatarStr)) {
    const dim = size === 'nav' ? '28px' : '100%';
    el.style.fontSize = '0';
    el.innerHTML = `<img src="${avatarStr}" style="width:${dim};height:${dim};object-fit:cover;border-radius:50%;display:block">`;
  } else {
    el.innerHTML = '';
    el.style.fontSize = '';
    el.textContent = avatarStr || '🦁';
  }
}

// Update semua elemen avatar sesuai role sekaligus
function syncAvatarUI(avatarStr, role) {
  const isPhoto = isFotoAvatar(avatarStr);
  if (role === 'murid') {
    setAvatarEl(document.getElementById('murid-avatar'), avatarStr, 'big');
    setAvatarEl(document.getElementById('murid-nav-avatar'), avatarStr, 'nav');
  } else if (role === 'guru') {
    setAvatarEl(document.getElementById('guru-banner-avatar'), avatarStr, 'big');
    setAvatarEl(document.getElementById('guru-nav-avatar'), avatarStr, 'nav');
    // Greeting: jangan tampilkan foto sebagai teks
    const grEl = document.getElementById('guru-greeting');
    if (grEl) grEl.textContent = `Selamat Datang, ${currentUser?.nama || ''}!${isPhoto ? '' : ' ' + (avatarStr || '👩‍🏫')}`;
  }
}

async function pilihAvatar(avatar, role) {
  try {
    const data = await api('PUT', '/auth/profile', { avatar });
    if (data.success) {
      currentUser.avatar = avatar;
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      if (role === 'murid') {
        setAvatarEl(document.getElementById('pm-avatar-display'), avatar);
        document.getElementById('pm-avatar-picker').style.display = 'none';
        syncAvatarUI(avatar, 'murid');
      } else {
        setAvatarEl(document.getElementById('pg-avatar-display'), avatar);
        document.getElementById('pg-avatar-picker').style.display = 'none';
        syncAvatarUI(avatar, 'guru');
      }
      toast('Avatar berhasil diganti! ' + avatar, 'success');
    } else toast(data.pesan || 'Gagal ganti avatar', 'error');
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
}

// Kompres gambar ke max 120x120 dan simpan sebagai avatar
function uploadFotoProfil(role) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Foto terlalu besar. Maksimal 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxSize = 120;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        showLoading(true);
        try {
          const data = await api('PUT', '/auth/profile', { avatar: dataUrl });
          if (data.success) {
            currentUser.avatar = dataUrl;
            localStorage.setItem('kb_user', JSON.stringify(currentUser));
            if (role === 'murid') {
              setAvatarEl(document.getElementById('pm-avatar-display'), dataUrl);
              document.getElementById('pm-avatar-picker').style.display = 'none';
              syncAvatarUI(dataUrl, 'murid');
            } else {
              setAvatarEl(document.getElementById('pg-avatar-display'), dataUrl);
              document.getElementById('pg-avatar-picker').style.display = 'none';
              syncAvatarUI(dataUrl, 'guru');
            }
            toast('Foto profil berhasil diubah! 📸', 'success');
          } else toast(data.pesan || 'Gagal upload foto', 'error');
        } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
        showLoading(false);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function simpanProfilMurid() {
  const nama = document.getElementById('pm-nama-input').value.trim();
  const kelas = document.getElementById('pm-kelas-input').value.trim();
  const alamat = document.getElementById('pm-alamat-input').value.trim();
  const umur = document.getElementById('pm-umur-input').value.trim();
  const asal_sekolah = document.getElementById('pm-asal-sekolah-input').value.trim();
  if (!nama) { toast('Nama tidak boleh kosong!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('PUT', '/auth/profile', {
      nama, kelas: kelas || undefined,
      alamat: alamat || undefined, umur: umur || undefined, asal_sekolah: asal_sekolah || undefined
    });
    if (data.success) {
      currentUser.nama  = nama;
      currentUser.kelas = kelas;
      if (alamat) currentUser.alamat = alamat;
      if (umur) currentUser.umur = parseInt(umur, 10);
      if (asal_sekolah) currentUser.asal_sekolah = asal_sekolah;
      if (alamat && umur && asal_sekolah) currentUser.profil_lengkap = true;
      if (data.reward) { currentUser.xp = data.reward.new_xp; currentUser.level = data.reward.new_level; }
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      document.getElementById('pm-nama-display').textContent = nama;
      document.getElementById('murid-nav-name').textContent  = nama;
      if (data.reward) showDataDiriReward(data.reward);
      else toast('Profil berhasil diperbarui! ✅', 'success');
    } else toast(data.pesan || 'Gagal simpan profil', 'error');
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

async function simpanProfilGuru() {
  const nama = document.getElementById('pg-nama-input').value.trim();
  const alamat = document.getElementById('pg-alamat-input').value.trim();
  const umur = document.getElementById('pg-umur-input').value.trim();
  const asal_sekolah = document.getElementById('pg-asal-sekolah-input').value.trim();
  if (!nama) { toast('Nama tidak boleh kosong!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('PUT', '/auth/profile', {
      nama,
      alamat: alamat || undefined, umur: umur || undefined, asal_sekolah: asal_sekolah || undefined
    });
    if (data.success) {
      currentUser.nama = nama;
      if (alamat) currentUser.alamat = alamat;
      if (umur) currentUser.umur = parseInt(umur, 10);
      if (asal_sekolah) currentUser.asal_sekolah = asal_sekolah;
      if (alamat && umur && asal_sekolah) currentUser.profil_lengkap = true;
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      document.getElementById('pg-nama-display').textContent = nama;
      document.getElementById('guru-nav-name').textContent   = nama.split(' ')[0];
      syncAvatarUI(currentUser.avatar || '👩‍🏫', 'guru');
      toast('Profil berhasil diperbarui! ✅', 'success');
    } else toast(data.pesan || 'Gagal simpan profil', 'error');
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

// ── Code Guru: Lihat Code Guru dengan verifikasi OTP ──
async function lihatCodeGuru() {
  showLoading(true);
  try {
    const data = await api('GET', '/auth/profile');
    if (data.success && data.data && data.data.has_code_guru) {
      // Tampilkan form OTP
      document.getElementById('pg-cg-placeholder').style.display = 'none';
      document.getElementById('pg-cg-otp-form').style.display = 'block';
      document.getElementById('pg-cg-result').style.display = 'none';
      document.getElementById('pg-cg-otp-input').value = '';
      // Kirim OTP ke email
      const otpData = await api('POST', '/auth/send-code-guru-otp');
      if (otpData.success) {
        toast('Kode OTP dikirim ke email kamu. Cek email ya!', 'success');
      } else {
        toast(otpData.pesan || 'Gagal kirim OTP', 'error');
      }
    } else {
      toast('Code Guru belum tersedia.', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

async function verifikasiCodeGuru() {
  const otp = document.getElementById('pg-cg-otp-input').value.trim();
  if (!otp) { toast('Masukkan kode OTP!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/auth/verify-code-guru-otp', { otp });
    if (data.success) {
      // Tampilkan code_guru
      document.getElementById('pg-cg-otp-form').style.display = 'none';
      document.getElementById('pg-cg-result').style.display = 'block';
      document.getElementById('pg-cg-code-display').textContent = data.data.code_guru;
      toast('Verifikasi berhasil! Code Guru ditampilkan.', 'success');
    } else {
      toast(data.pesan || 'Gagal verifikasi OTP', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

function copyCodeGuru() {
  const code = document.getElementById('pg-cg-code-display').textContent;
  navigator.clipboard.writeText(code).then(() => {
    toast('Code Guru berhasil disalin!', 'success');
  }).catch(() => {
    toast('Gagal menyalin code', 'error');
  });
}

function tutupCodeGuru() {
  document.getElementById('pg-cg-placeholder').style.display = 'block';
  document.getElementById('pg-cg-otp-form').style.display = 'none';
  document.getElementById('pg-cg-result').style.display = 'none';
}

async function gantiPasswordMurid() {
  const lama = document.getElementById('pm-pw-lama').value;
  const baru = document.getElementById('pm-pw-baru').value;
  const konfirm = document.getElementById('pm-pw-konfirm').value;
  if (!lama || !baru) { toast('Isi semua field password!', 'error'); return; }
  if (baru.length < 6) { toast('Password baru minimal 8 karakter!', 'error'); return; }
  if (baru !== konfirm) { toast('Konfirmasi password tidak cocok!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('PUT', '/auth/profile', { password_lama: lama, password_baru: baru });
    if (data.success) {
      document.getElementById('pm-pw-lama').value = '';
      document.getElementById('pm-pw-baru').value = '';
      document.getElementById('pm-pw-konfirm').value = '';
      toast('Password berhasil diganti! 🔒', 'success');
    } else toast(data.pesan || 'Gagal ganti password', 'error');
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

async function gantiPasswordGuru() {
  const lama = document.getElementById('pg-pw-lama').value;
  const baru = document.getElementById('pg-pw-baru').value;
  const konfirm = document.getElementById('pg-pw-konfirm').value;
  if (!lama || !baru) { toast('Isi semua field password!', 'error'); return; }
  if (baru.length < 6) { toast('Password baru minimal 8 karakter!', 'error'); return; }
  if (baru !== konfirm) { toast('Konfirmasi password tidak cocok!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('PUT', '/auth/profile', { password_lama: lama, password_baru: baru });
    if (data.success) {
      document.getElementById('pg-pw-lama').value = '';
      document.getElementById('pg-pw-baru').value = '';
      document.getElementById('pg-pw-konfirm').value = '';
      toast('Password berhasil diganti! 🔒', 'success');
    } else toast(data.pesan || 'Gagal ganti password', 'error');
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

function doLogout() {
  token = null; currentUser = null;
  localStorage.removeItem('kb_token');
  localStorage.removeItem('kb_user');
  onGuruPageHidden();
  showPage('page-landing');
  toast('Sampai jumpa! 👋');
}

// ============================================================
//  DASHBOARD KEPALA SEKOLAH
// ============================================================

// ============================================================
//  DASHBOARD ORANGTUA
// ============================================================
async function loadOrangtuaDashboard() {
  if (!currentUser || currentUser.role !== 'orangtua') return;
  showPage('page-orangtua');
  const navName = document.getElementById('ot-nav-name');
  if (navName) navName.textContent = currentUser.nama;
  const el = document.getElementById('ot-anak-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat data anak...</div>';
  try {
    const data = await api('GET', '/orangtua/anak');
    const anakList = data.data || [];
    if (anakList.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)"><div style="font-size:48px;margin-bottom:12px">👶</div><p>Belum ada data anak yang terhubung.</p></div>';
      return;
    }
    el.innerHTML = `
      <div style="font-weight:800;font-size:16px;margin-bottom:16px">👦👧 Progres Penilaian Anak</div>
      ${anakList.map(anak => `
        <div style="background:white;border-radius:16px;padding:20px;box-shadow:var(--shadow);margin-bottom:12px;display:flex;align-items:center;gap:16px;cursor:pointer"
             onclick="loadAktivitasAnak('${anak.id}','${anak.nama.replace(/'/g,"\\'")}')">
          <div style="font-size:44px;width:56px;height:56px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#F3F4F6">${chatAvatarHtml(anak.avatar || '🦁')}</div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:16px">${anak.nama}</div>
            <div style="font-size:13px;color:var(--muted)">${anak.email}</div>
            <div style="display:flex;gap:12px;margin-top:6px">
              <span style="font-size:12px;background:#EEF5FF;color:var(--blue);padding:3px 10px;border-radius:50px;font-weight:700">⭐ ${anak.xp || 0} XP</span>
              <span style="font-size:12px;background:#F0FFF4;color:var(--green);padding:3px 10px;border-radius:50px;font-weight:700">🏅 Level ${anak.level || 1}</span>
            </div>
          </div>
          <div style="color:var(--muted);font-size:20px">→</div>
        </div>`).join('')}`;
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Gagal memuat data.</div>';
  }
}

async function loadAktivitasAnak(muridId, namaMurid) {
  showPage('page-orangtua-detail');
  const el = document.getElementById('ot-detail-content');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Memuat aktivitas...</div>';
  try {
    const data = await api('GET', `/orangtua/aktivitas/${muridId}`);
    if (!data.success) throw new Error(data.pesan);
    const { murid, kelas, hasil_quiz, tugas_submission, materi_selesai, total_materi_selesai } = data.data;
    const rataQuiz = hasil_quiz.length > 0
      ? Math.round(hasil_quiz.reduce((s, h) => s + (h.skor || 0), 0) / hasil_quiz.length)
      : null;
    const rataTugas = (tugas_submission || []).filter(t => t.nilai != null).length > 0
      ? Math.round((tugas_submission || []).filter(t => t.nilai != null).reduce((s,t) => s + t.nilai, 0) / (tugas_submission || []).filter(t => t.nilai != null).length)
      : null;

    el.innerHTML = `
      <!-- Profil Anak -->
      <div style="background:linear-gradient(135deg,#7C3AED,#A78BFA);border-radius:20px;padding:24px;margin-bottom:20px;color:white;display:flex;align-items:center;gap:20px">
        <div style="font-size:56px;width:72px;height:72px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.2)">${chatAvatarHtml(murid.avatar || '🦁')}</div>
        <div>
          <div style="font-size:22px;font-weight:900">${murid.nama}</div>
          <div style="font-size:13px;opacity:0.8">${murid.email}</div>
          <div style="display:flex;gap:10px;margin-top:8px">
            <span style="background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:50px;font-size:12px;font-weight:700">⭐ ${murid.xp || 0} XP</span>
            <span style="background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:50px;font-size:12px;font-weight:700">🏅 Level ${murid.level || 1}</span>
            <span style="background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:50px;font-size:12px;font-weight:700">🏆 Rank #${murid.rank || '–'}</span>
          </div>
        </div>
      </div>

      <!-- Statistik Ringkas -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
        <div style="background:white;border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow)">
          <div style="font-size:28px;font-weight:900;color:var(--blue)">${kelas.length}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">Kelas</div>
        </div>
        <div style="background:white;border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow)">
          <div style="font-size:28px;font-weight:900;color:var(--orange)">${hasil_quiz.length}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">Quiz</div>
        </div>
        <div style="background:white;border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow)">
          <div style="font-size:28px;font-weight:900;color:#7C3AED">${(tugas_submission||[]).length}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">Tugas</div>
        </div>
        <div style="background:white;border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow)">
          <div style="font-size:28px;font-weight:900;color:var(--green)">${rataQuiz !== null ? rataQuiz : rataTugas !== null ? rataTugas : '–'}</div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">Rata-rata</div>
        </div>
      </div>

      <!-- Kelas -->
      ${kelas.length > 0 ? `
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">🏫 Kelas yang Diikuti</div>
          ${kelas.map(k => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F5F5F5">
              <span style="font-size:20px">📚</span>
              <div>
                <div style="font-weight:700">${k.nama}</div>
                <div style="font-size:12px;color:var(--muted)">${k.mapel || ''} · ${k.tahun_ajar} · Guru: ${k.guru?.nama || '–'}</div>
              </div>
            </div>`).join('')}
        </div>` : ''}

      <!-- Hasil Quiz Terbaru -->
      ${hasil_quiz.length > 0 ? `
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">📝 Quiz Terbaru</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="color:var(--muted);border-bottom:1px solid #eee">
              <th style="text-align:left;padding:8px 0;font-weight:700">Quiz</th>
              <th style="text-align:center;padding:8px 0;font-weight:700">Skor</th>
              <th style="text-align:right;padding:8px 0;font-weight:700">Tanggal</th>
            </tr></thead>
            <tbody>
              ${hasil_quiz.map(h => `
                <tr style="border-bottom:1px solid #f5f5f5">
                  <td style="padding:8px 0">
                    <div style="font-weight:700">${h.quiz?.judul || '–'}</div>
                    <div style="font-size:11px;color:var(--muted)">${h.quiz?.mapel || ''} · ${h.quiz?.tipe === 'pr' ? '📝 PR' : '🎮 Fun'}</div>
                  </td>
                  <td style="text-align:center;padding:8px 0">
                    <span style="background:${h.skor >= 80 ? 'var(--green)' : h.skor >= 60 ? 'var(--yellow)' : 'var(--red)'};color:white;padding:3px 12px;border-radius:50px;font-weight:800">${h.skor}</span>
                  </td>
                  <td style="text-align:right;padding:8px 0;color:var(--muted);font-size:12px">
                    ${h.selesai_at ? new Date(h.selesai_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) : '–'}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      <!-- Tugas Submission -->
      ${(tugas_submission||[]).length > 0 ? `
        <div style="background:white;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:var(--shadow)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">📋 Tugas yang Dikumpulkan</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="color:var(--muted);border-bottom:1px solid #eee">
              <th style="text-align:left;padding:8px 0;font-weight:700">Tugas</th>
              <th style="text-align:center;padding:8px 0;font-weight:700">Tipe</th>
              <th style="text-align:center;padding:8px 0;font-weight:700">Nilai</th>
              <th style="text-align:right;padding:8px 0;font-weight:700">Dikumpulkan</th>
            </tr></thead>
            <tbody>
              ${(tugas_submission||[]).map(t => {
                const tipeIcon = {'file':'📄','gambar':'🖼️','link':'🔗','teks':'✏️','semua':'📤'}[t.tipe] || '📤';
                const nilaiColor = t.nilai == null ? 'var(--muted)' : t.nilai >= 80 ? 'var(--green)' : t.nilai >= 60 ? 'var(--yellow)' : 'var(--red)';
                return `<tr style="border-bottom:1px solid #f5f5f5">
                  <td style="padding:8px 0">
                    <div style="font-weight:700">${t.quiz?.judul || '–'}</div>
                    <div style="font-size:11px;color:var(--muted)">${t.quiz?.mapel || ''}</div>
                  </td>
                  <td style="text-align:center;padding:8px 0">${tipeIcon}</td>
                  <td style="text-align:center;padding:8px 0">
                    ${t.nilai != null
                      ? `<span style="background:${nilaiColor};color:white;padding:3px 12px;border-radius:50px;font-weight:800">${t.nilai}</span>`
                      : `<span style="color:var(--muted);font-size:12px;font-weight:700">Belum dinilai</span>`}
                  </td>
                  <td style="text-align:right;padding:8px 0;color:var(--muted);font-size:12px">
                    ${t.submitted_at ? new Date(t.submitted_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) : '–'}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : ''}

      <!-- Materi Selesai -->
      ${total_materi_selesai > 0 ? `
        <div style="background:white;border-radius:16px;padding:20px;box-shadow:var(--shadow)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">✅ Materi Sudah Dipelajari (${total_materi_selesai})</div>
          ${materi_selesai.slice(0,5).map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F5F5F5">
              <span style="color:var(--green)">✅</span>
              <div>
                <div style="font-weight:700;font-size:13px">${m.judul || '–'}</div>
                <div style="font-size:11px;color:var(--muted)">${m.mapel || ''}</div>
              </div>
            </div>`).join('')}
          ${total_materi_selesai > 5 ? `<div style="text-align:center;font-size:12px;color:var(--muted);margin-top:8px">+${total_materi_selesai-5} materi lainnya</div>` : ''}
        </div>` : ''}`;
  } catch(e) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">Gagal memuat data aktivitas.</div>`;
  }
}

// ============================================================
//  DASHBOARD MURID
// ============================================================
async function loadMuridDashboard() {
  showPage('page-murid');
  onGuruPageHidden();
  if (!currentUser) return;
  // Cek apakah ada game online yang belum selesai sebelum refresh
  setTimeout(zepCekReconnect, 500);

  document.getElementById('murid-nav-name').textContent = currentUser.nama;
  document.getElementById('murid-greeting').textContent = `Halo, ${currentUser.nama}! 👋`;
  syncAvatarUI(currentUser.avatar || '🦁', 'murid');

  const xp = currentUser.xp || 0;
  const xpNeeded = (currentUser.level || 1) * 1000;
  document.getElementById('murid-xp-label').textContent = `${xp} / ${xpNeeded} XP menuju Level ${(currentUser.level || 1) + 1}`;
  document.getElementById('murid-xp-fill').style.width = Math.min(100, (xp / xpNeeded) * 100) + '%';
  document.getElementById('murid-streak').textContent = `Level ${currentUser.level || 1} · ${xp} XP 🔥`;

  showLoading(true);
  try {
    // Satu request menggantikan 15+ request sequential sebelumnya
    const init = await api('GET', '/dashboard/murid-init');
    if (init.success) {
      _muridInitCache = init; // simpan cache untuk digunakan fungsi lain
      renderMuridKelas(init.kelas || []);
      tampilDeadlineAlert(init.deadlines || []);
    }
  } catch(e) {
    // Fallback jika endpoint gagal
    await loadMuridKelas();
    await loadDeadlineAlertDashboard();
  }
  showLoading(false);
}

let _muridInitCache = null;

// Fallback: dipanggil hanya jika endpoint murid-init gagal
async function loadDeadlineAlertDashboard() {
  try {
    const kelasData = await api('GET', '/kelas');
    const kelasList = kelasData.kelas || kelasData.data || [];
    const quizPromises = kelasList.slice(0, 5).map(k =>
      api('GET', `/quiz?kelas_id=${k.id}`)
        .then(d => (d.quiz || d.data || []).map(q => ({ ...q, kelas_id: k.id, kelas_nama: k.nama })))
        .catch(() => [])
    );
    const allQuizArrays = await Promise.all(quizPromises);
    const allQuiz = allQuizArrays.flat();
    const prQuiz = allQuiz.filter(q => q.tipe === 'pr' && q.deadline);
    const cekPromises = prQuiz.map(q => {
      // Submission-type pakai endpoint berbeda
      const url = q.tipe_submission
        ? `/quiz/${q.id}/submission/cek`
        : `/quiz/hasil/cek?quiz_id=${q.id}`;
      return api('GET', url)
        .then(cek => { q.sudah_dikerjakan = cek.sudah || false; })
        .catch(() => { q.sudah_dikerjakan = false; });
    });
    await Promise.all(cekPromises);
    tampilDeadlineAlert(allQuiz);
  } catch(e) {}
}

// Fallback: dipanggil hanya jika endpoint murid-init gagal
async function loadMuridKelas() {
  const grid = document.getElementById('murid-kelas-grid');
  grid.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat kelas...</div>';
  try {
    const data = await api('GET', '/kelas');
    const list = data.kelas || data.data || data.list || [];
    renderMuridKelas(Array.isArray(list) ? list : []);
  } catch(e) { renderMuridKelas([]); }
}

function renderMuridKelas(list) {
  window._kelasList = list;
  const grid = document.getElementById('murid-kelas-grid');
  if (!grid) return;
  if (list.length > 0) {
    grid.innerHTML = list.map((k, i) => renderKelasCard(k, i, 'murid')).join('');
  } else {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🏫</div>
      <p>Kamu belum bergabung ke kelas manapun.<br>Minta kode ke gurumu dan klik <strong>Gabung Kelas</strong>!</p>
    </div>`;
  }
}

function tampilDeadlineAlert(kuisList) {
  const alertBox = document.getElementById('deadline-alert');
  const alertList = document.getElementById('deadline-alert-list');
  if (!alertBox || !alertList) return;

  const now = new Date();
  const urgent = kuisList.filter(q => {
    if (!q.deadline || q.tipe === 'fun' || q.sudah_dikerjakan) return false;
    const diff = new Date(q.deadline) - now;
    return diff > 0 && diff < 86400000 * 2; // 2 hari ke depan
  }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  if (urgent.length === 0) { alertBox.style.display = 'none'; return; }

  alertBox.style.display = 'block';
  alertList.innerHTML = urgent.map(q => {
    const diff = new Date(q.deadline) - now;
    const isUrgent = diff < 3600000 * 6; // kurang dari 6 jam
    const label = diff < 3600000
      ? `⏰ ${Math.floor(diff/60000)} menit lagi!`
      : diff < 86400000
      ? `⚠️ ${Math.floor(diff/3600000)} jam lagi`
      : `📅 ${Math.floor(diff/86400000)} hari lagi`;

    // Cari kelas_id untuk navigasi
    const kelasId = q.kelas_id || '';
    return `<div class="deadline-item" onclick="bukaKelasUntukKuis('${kelasId}','${q.id}')">
      <div class="deadline-item-icon" style="background:${isUrgent ? '#FFF0F0' : '#FFF8E1'}">📝</div>
      <div class="deadline-item-info">
        <h4>${escapeHtml(q.judul)}</h4>
        <p>${escapeHtml(q.mapel || 'Tugas')} · ${q.total_soal || '?'} soal</p>
      </div>
      <div class="deadline-badge ${isUrgent ? 'urgent' : 'soon'}">${label}</div>
    </div>`;
  }).join('');
}

async function bukaKelasUntukKuis(kelasId, quizId) {
  if (!kelasId) { mulaiKuisKelas(quizId); return; }
  await openKelas(kelasId, 0);
  setTimeout(() => {
    switchKelasTab('kuis');
    setTimeout(() => mulaiKuisKelas(quizId), 300);
  }, 600);
}

// ═══════════════════════════════════════════════════
//  LEADERBOARD + MISI + BADGES
// ═══════════════════════════════════════════════════
let _lbMode    = 'kelas';   // 'kelas' | 'global'
let _lbPeriode = 'all';     // 'all'   | 'minggu'
let _lbTab     = 'lb';      // 'lb'    | 'misi' | 'badges'

function loadLeaderboardPage() {
  showPage('page-leaderboard');
  switchLbTab('lb');
  loadLeaderboard();
}

function switchLbTab(tab) {
  _lbTab = tab;
  ['lb','misi','badges'].forEach(t => {
    document.getElementById(`lb-tab-${t}`)?.classList.toggle('active', t === tab);
    const panel = document.getElementById(`lb-panel-${t}`);
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'misi')   { loadDailyReward(); loadMisi(); }
  if (tab === 'badges') loadBadges();
}

function setLbMode(mode) {
  _lbMode = mode;
  document.getElementById('lb-mode-kelas')?.classList.toggle('active', mode === 'kelas');
  document.getElementById('lb-mode-global')?.classList.toggle('active', mode === 'global');
  loadLeaderboard();
}

function setLbPeriode(periode) {
  _lbPeriode = periode;
  document.getElementById('lb-periode-all')?.classList.toggle('active', periode === 'all');
  document.getElementById('lb-periode-minggu')?.classList.toggle('active', periode === 'minggu');
  loadLeaderboard();
}

async function loadLeaderboard() {
  const token = localStorage.getItem('kb_token') || '';
  const params = new URLSearchParams({ mode: _lbMode });
  if (_lbPeriode === 'minggu') params.set('periode', 'minggu');

  document.getElementById('lb-podium').innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px;width:100%">Memuat...</div>';
  document.getElementById('lb-list').innerHTML   = '';

  try {
    const res  = await fetch(`/api/dashboard/leaderboard?${params}`, { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (!json.success) { toast('Gagal memuat leaderboard.'); return; }

    renderPodiumLb(json.data.slice(0, 3));
    // Top-3 sudah tampil di podium — list mulai dari peringkat #4 agar tidak dobel
    renderListLb(json.data.slice(3));

    const posSaya = json.posisi_saya;
    const elPos   = document.getElementById('lb-posisi-saya');
    if (posSaya && elPos) {
      elPos.style.display = '';
      document.getElementById('lb-posisi-angka').textContent = `#${posSaya} dari ${json.data.length} murid`;
    } else if (elPos) {
      elPos.style.display = 'none';
    }
  } catch(e) {
    toast('Gagal memuat leaderboard.');
  }
}

// Avatar bisa berupa URL atau emoji — render sesuai jenisnya
function renderAvatar(avatar, size = 48, extraStyle = '') {
  const isUrl = avatar && (avatar.startsWith('http') || avatar.startsWith('/') || avatar.startsWith('data:'));
  if (isUrl) {
    return `<img src="${avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;${extraStyle}">`;
  }
  const isi = avatar || '👤';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#E8E0FF;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.45)}px;flex-shrink:0;${extraStyle}">${isi}</div>`;
}

function renderPodiumLb(top3) {
  const el = document.getElementById('lb-podium');
  if (!top3 || top3.length === 0) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;width:100%">Belum ada data</div>'; return; }

  const medals  = ['🥇','🥈','🥉'];
  const heights = ['90px','70px','60px'];
  const order   = [1, 0, 2]; // tampil: #2, #1, #3

  const cols = order.map(i => {
    const u = top3[i];
    if (!u) return '';
    const av = renderAvatar(u.avatar, 48, 'border:3px solid #fff;');
    return `
      <div class="lb-podium-col" style="flex:1">
        <div style="text-align:center;margin-bottom:6px">
          ${av}
          <div style="font-size:20px;margin-top:2px">${medals[i]}</div>
          <div style="font-size:12px;font-weight:800;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0 auto">${u.nama}</div>
          <div style="font-size:11px;color:#7b2ff7;font-weight:700">${u.xp} XP</div>
        </div>
        <div style="width:100%;height:${heights[i]};background:${i===0?'linear-gradient(180deg,#FFD700,#FFA500)':i===1?'linear-gradient(180deg,#C0C0C0,#A0A0A0)':'linear-gradient(180deg,#CD7F32,#A0522D)'};border-radius:8px 8px 0 0"></div>
      </div>`;
  });

  el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:8px;width:100%;padding:0 8px">${cols.join('')}</div>`;
}

function renderListLb(data) {
  const el = document.getElementById('lb-list');
  // Kosong = semua peserta sudah tampil di podium (≤3 orang). Cukup kosongkan list.
  if (!data || data.length === 0) { el.innerHTML = ''; return; }

  const myId   = currentUser?.id || '';
  const topMap = { 1: 'top1', 2: 'top2', 3: 'top3' };

  el.innerHTML = data.map(u => {
    const cls    = u.id === myId ? 'saya' : (topMap[u.peringkat] || '');
    const av     = renderAvatar(u.avatar, 40, 'flex-shrink:0;');
    const streak = u.streak > 0 ? `🔥${u.streak} ` : '';
    const avg    = u.avg_skor > 0 ? `avg ${parseFloat(u.avg_skor).toFixed(0)}%` : '';
    return `
      <div class="lb-item ${cls}">
        <div class="lb-rank">${u.peringkat <= 3 ? ['🥇','🥈','🥉'][u.peringkat-1] : u.peringkat}</div>
        ${av}
        <div class="lb-info">
          <div class="lb-nama">${u.nama}${u.id === myId ? ' <span style="color:#7b2ff7;font-size:11px">(Kamu)</span>' : ''}</div>
          <div class="lb-meta">${streak}${avg} · Lv.${u.level || 1}</div>
        </div>
        <div class="lb-xp">${u.xp} XP</div>
      </div>`;
  }).join('');
}

// ── DAILY REWARD ────────────────────────────────────
async function loadDailyReward() {
  const token = localStorage.getItem('kb_token') || '';
  try {
    const res  = await fetch('/api/misi/daily-reward', { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (!json.success) return;

    const { sudah_klaim, hari_ke, xp_reward, ada_badge, rewards } = json.data;
    const card = document.getElementById('daily-reward-card');

    const daysHtml = rewards.map((r, i) => {
      const dayNum = i + 1;
      const isDone = dayNum < hari_ke || (dayNum === hari_ke && sudah_klaim);
      const isNow  = dayNum === hari_ke && !sudah_klaim;

      let circleStyle, circleLabel;
      if (isDone) {
        circleStyle = 'background:rgba(255,255,255,0.25);opacity:0.55';
        circleLabel = '✓';
      } else if (isNow) {
        circleStyle = 'background:#fff;color:#7b2ff7;box-shadow:0 0 0 3px rgba(255,255,255,0.5)';
        circleLabel = `+${r.xp}`;
      } else {
        circleStyle = 'background:rgba(255,255,255,0.15)';
        circleLabel = `+${r.xp}`;
      }

      return `
        <div style="text-align:center;flex:1;min-width:0">
          <div style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;margin:0 auto 4px;${circleStyle}">${circleLabel}</div>
          <div style="font-size:9px;opacity:0.8;white-space:nowrap">H${dayNum}${r.badge_id ? '🌟' : ''}</div>
        </div>`;
    }).join('');

    const btnHtml = sudah_klaim
      ? `<div style="text-align:center;margin-top:14px;padding:11px;background:rgba(255,255,255,0.18);border-radius:12px;font-weight:800;font-size:13px">✅ Sudah Diklaim Hari Ini</div>`
      : `<button onclick="klaimDailyReward(this)" style="width:100%;margin-top:14px;padding:12px;background:#fff;color:#7b2ff7;border:none;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;transition:opacity .15s">🎁 Klaim Hadiah Harian! (+${xp_reward} XP${ada_badge ? ' + 🌟' : ''})</button>`;

    card.innerHTML = `
      <div style="font-size:11px;font-weight:800;opacity:0.75;letter-spacing:.5px;margin-bottom:10px">HARI KE-${hari_ke} DARI 7</div>
      <div style="display:flex;gap:4px;justify-content:space-between;align-items:flex-start">${daysHtml}</div>
      ${btnHtml}`;
  } catch(e) { console.error('loadDailyReward', e); }
}

async function klaimDailyReward(btn) {
  const token = localStorage.getItem('kb_token') || '';
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.textContent = 'Memproses...';
  try {
    const res  = await fetch('/api/misi/daily-reward/klaim', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (json.success) {
      toast(`🎁 +${json.xp_dapat} XP! Hadiah hari ke-${json.hari_ke} diklaim!`);
      if (json.badge) showBadgeCelebration([json.badge]);
      loadDailyReward();
    } else {
      toast(json.pesan || 'Gagal klaim.');
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = '🎁 Klaim Hadiah Harian!';
    }
  } catch(e) {
    toast('Gagal klaim hadiah harian.');
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = '🎁 Klaim Hadiah Harian!';
  }
}

// ── MISI ───────────────────────────────────────────
async function loadMisi() {
  const token = localStorage.getItem('kb_token') || '';
  ['harian','mingguan','achievement'].forEach(t =>
    document.getElementById(`misi-${t}-list`).innerHTML = '<div style="color:var(--muted);font-size:13px;padding:10px">Memuat...</div>'
  );

  try {
    const res  = await fetch('/api/misi', { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (!json.success) return;

    renderMisiGroup('harian',      json.data.harian);
    renderMisiGroup('mingguan',    json.data.mingguan);
    renderMisiGroup('achievement', json.data.achievement);

    // Tampilkan notif jika ada XP dari auto-claim
    if (json.auto_xp && json.auto_xp > 0) {
      toast(`⚡ +${json.auto_xp} XP dari misi yang selesai!`);
    }

    // Tampilkan perayaan badge baru
    if (json.badge_baru && json.badge_baru.length > 0) {
      showBadgeCelebration(json.badge_baru);
    }
  } catch(e) { toast('Gagal memuat misi.'); }
}

// Filter kategori misi: 'semua' | 'harian' | 'mingguan' | 'achievement'.
// User memilih ingin menampilkan kategori apa; sisanya disembunyikan.
function setMisiFilter(cat) {
  document.querySelectorAll('.misi-filter').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('.misi-sec').forEach(sec => {
    sec.style.display = (cat === 'semua' || sec.dataset.cat === cat) ? '' : 'none';
  });
}

// ── Tampilkan modal perayaan badge baru ──────────────────
function showBadgeCelebration(badges) {
  if (!badges || badges.length === 0) return;

  let idx = 0;

  function showNext() {
    const b = badges[idx];
    if (!b) return;

    // Hapus overlay lama jika ada
    const existing = document.getElementById('badge-celebration-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'badge-modal-overlay';
    overlay.id = 'badge-celebration-overlay';

    const isLast = idx === badges.length - 1;
    const btnLabel = isLast ? 'Sip, Terima Kasih! 🎉' : `Selanjutnya (${idx+1}/${badges.length})`;

    overlay.innerHTML = `
      <div class="badge-modal-box">
        <div style="font-size:13px;font-weight:800;color:#aaa;letter-spacing:1px;margin-bottom:8px">BADGE BARU DIRAIH!</div>
        <div class="badge-modal-icon">${b.icon || '🏅'}</div>
        <div class="badge-modal-title">${b.nama}</div>
        <div class="badge-modal-desc">${b.deskripsi || ''}</div>
        <button class="badge-modal-btn" onclick="badgeCelebrationNext()">
          ${btnLabel}
        </button>
      </div>`;

    document.body.appendChild(overlay);

    // Tap anywhere on overlay background to close
    overlay.addEventListener('click', e => {
      if (e.target === overlay) badgeCelebrationNext();
    });
  }

  window._badgeCelebQueue  = badges;
  window._badgeCelebIdx    = 0;

  window.badgeCelebrationNext = function() {
    window._badgeCelebIdx++;
    if (window._badgeCelebIdx < window._badgeCelebQueue.length) {
      const overlay = document.getElementById('badge-celebration-overlay');
      if (overlay) overlay.remove();
      // Show next after short delay
      setTimeout(() => {
        const b    = window._badgeCelebQueue[window._badgeCelebIdx];
        const isLast = window._badgeCelebIdx === window._badgeCelebQueue.length - 1;
        const btnLabel = isLast ? 'Sip, Terima Kasih! 🎉' : `Selanjutnya (${window._badgeCelebIdx+1}/${window._badgeCelebQueue.length})`;
        const newOverlay = document.createElement('div');
        newOverlay.className = 'badge-modal-overlay';
        newOverlay.id = 'badge-celebration-overlay';
        newOverlay.innerHTML = `
          <div class="badge-modal-box">
            <div style="font-size:13px;font-weight:800;color:#aaa;letter-spacing:1px;margin-bottom:8px">BADGE BARU DIRAIH!</div>
            <div class="badge-modal-icon">${b.icon || '🏅'}</div>
            <div class="badge-modal-title">${b.nama}</div>
            <div class="badge-modal-desc">${b.deskripsi || ''}</div>
            <button class="badge-modal-btn" onclick="badgeCelebrationNext()">${btnLabel}</button>
          </div>`;
        newOverlay.addEventListener('click', e => { if (e.target === newOverlay) badgeCelebrationNext(); });
        document.body.appendChild(newOverlay);
      }, 150);
    } else {
      const overlay = document.getElementById('badge-celebration-overlay');
      if (overlay) overlay.remove();
      // Refresh badges tab if visible
      loadBadges();
    }
  };

  showNext();
}

// Mapping kondisi_tipe → fungsi navigasi
const MISI_AKSI = {
  quiz_count:    { label: 'Mulai Quiz ⚡',      fn: () => { showPage('page-murid'); setTimeout(startQuiz, 100); } },
  akurasi:       { label: 'Mulai Quiz 🎯',      fn: () => { showPage('page-murid'); setTimeout(startQuiz, 100); } },
  xp_gained:     { label: 'Mulai Quiz ⭐',      fn: () => { showPage('page-murid'); setTimeout(startQuiz, 100); } },
  materi_count:  { label: 'Buka Materi 📖',     fn: () => bukaKelasUntukMateri() },
  streak:        { label: 'Tetap Aktif 🔥',     fn: () => toast('Login setiap hari untuk menjaga streak kamu! 🔥') },
  level:         { label: 'Naikkan Level 📈',   fn: () => { showPage('page-murid'); setTimeout(startQuiz, 100); } },
  latihan_count: { label: 'Buka Kita Latihan 🚀', fn: () => { window.location.href = 'kita-latihan.html'; } },
  belajar_count: { label: 'Buka AyoBelajar 📚',   fn: () => { window.location.href = 'kita-materi.html'; } },
};

function renderMisiGroup(tipe, list) {
  const el = document.getElementById(`misi-${tipe}-list`);
  if (!list || list.length === 0) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:10px">Tidak ada misi.</div>'; return; }

  el.innerHTML = list.map((m, idx) => {
    const pct    = Math.min(100, Math.round((m.progres / m.target) * 100));
    const cls    = m.reward_claimed ? 'claimed' : m.selesai ? 'selesai' : '';
    const badge  = m.reward_badge ? ` + badge ${m.reward_badge.icon}` : '';
    const reward = m.reward_xp > 0 ? `+${m.reward_xp} XP${badge}` : badge.trim() || '';

    // Tombol kanan: claimed / klaim / mulai
    let rightEl = '';
    if (m.reward_claimed) {
      rightEl = `<span style="font-size:11px;font-weight:800;color:#aaa;flex-shrink:0">✓ Diklaim</span>`;
    } else if (m.selesai && m.id) {
      rightEl = `<button class="btn-klaim" onclick="klaimMisi('${m.id}', this)">Klaim! 🎁</button>`;
    } else if (!m.selesai) {
      const aksi = MISI_AKSI[m.kondisi_tipe];
      if (aksi) rightEl = `<button class="btn-mulai-misi" onclick="jalankanMisiAksi('${m.kondisi_tipe}')">${aksi.label}</button>`;
    }

    const progresText = tipe === 'achievement' && m.selesai
      ? `<span style="color:#00C851;font-size:11px;font-weight:800">✅ Selesai</span>`
      : `<span style="color:var(--muted);font-size:11px;font-weight:700">${m.progres}/${m.target}</span>`;

    return `
      <div class="misi-card ${cls}" id="misi-card-${m.id || m.misi_id}">
        <div class="misi-icon">${m.icon}</div>
        <div class="misi-info">
          <div class="misi-judul">${m.judul}</div>
          <div class="misi-progres-bar">
            <div class="misi-progres-fill" style="width:${pct}%"></div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
            ${progresText}
            ${reward ? `<div class="misi-reward">${reward}</div>` : ''}
          </div>
        </div>
        <div style="flex-shrink:0;margin-left:8px">${rightEl}</div>
      </div>`;
  }).join('');
}

function jalankanMisiAksi(kondisiTipe) {
  const aksi = MISI_AKSI[kondisiTipe];
  if (aksi) aksi.fn();
}

// Buka kelas pertama yang diikuti murid, langsung ke tab Materi
async function bukaKelasUntukMateri() {
  try {
    const token = localStorage.getItem('kb_token') || '';
    const res   = await fetch('/api/kelas', { headers: { Authorization: 'Bearer ' + token } });
    const json  = await res.json();
    const list  = json.data || json.kelas || [];
    if (list.length === 0) {
      toast('Kamu belum bergabung di kelas manapun. Join kelas dulu!');
      showPage('page-murid');
      return;
    }
    // Buka kelas pertama langsung ke tab Materi
    const k = list[0];
    await openKelas(k.id, 0);
    switchKelasTab('materi');
  } catch(e) {
    // Fallback: buka halaman kelas biasa
    showPage('page-murid');
    toast('Buka halaman kelas dan pilih tab Materi.');
  }
}

async function klaimMisi(misiMuridId, btn) {
  const token = localStorage.getItem('kb_token') || '';
  btn.disabled   = true;
  btn.textContent = '...';
  try {
    const res  = await fetch(`/api/misi/${misiMuridId}/klaim`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (json.success) {
      if (json.xp_dapat > 0) toast(`🎉 +${json.xp_dapat} XP! "${json.misi_judul}" selesai!`);
      else toast(`🎉 "${json.misi_judul}" selesai!`);
      loadMisi(); // refresh — badge_baru will be shown via loadMisi response
    } else {
      toast(json.pesan || 'Gagal klaim.');
      btn.disabled = false;
      btn.textContent = 'Klaim!';
    }
  } catch(e) {
    toast('Gagal klaim reward.');
    btn.disabled = false;
    btn.textContent = 'Klaim!';
  }
}

// ── BADGES ─────────────────────────────────────────
async function loadBadges() {
  const token = localStorage.getItem('kb_token') || '';
  try {
    const res  = await fetch('/api/misi/badges/semua', { headers: { Authorization: 'Bearer ' + token } });
    const json = await res.json();
    if (!json.success) return;

    const dimiliki = json.data.filter(b => b.dimiliki);
    const semua    = json.data;

    const elDimiliki = document.getElementById('badges-dimiliki-list');
    const elSemua    = document.getElementById('badges-semua-list');

    if (dimiliki.length === 0) {
      elDimiliki.innerHTML = '<div style="color:var(--muted);font-size:13px">Belum punya badge. Selesaikan misi untuk dapat badge!</div>';
    } else {
      elDimiliki.innerHTML = dimiliki.map(b => `
        <div class="badge-card dimiliki" title="${b.deskripsi}">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-nama">${b.nama}</div>
        </div>`).join('');
    }

    elSemua.innerHTML = semua.map(b => `
      <div class="badge-card ${b.dimiliki ? 'dimiliki' : 'locked'}" title="${b.deskripsi}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-nama">${b.nama}</div>
      </div>`).join('');
  } catch(e) { toast('Gagal memuat badge.'); }
}

// ============================================================
//  KELAS CARD RENDERER
// ============================================================
const KELAS_COLORS = ['bg-c1','bg-c2','bg-c3','bg-c4','bg-c5','bg-c6','bg-c7','bg-c8'];
const KELAS_EMOJIS = ['📐','🔬','📖','🗺️','🎨','🏃','🎵','💻'];

function kelasHashIdx(id) {
  let h = 0;
  const s = id || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

function renderKelasCard(k, i, role) {
  const idx = kelasHashIdx(k.id);
  const colorClass = KELAS_COLORS[idx % KELAS_COLORS.length];
  // Cari emoji dari mapel kelas: cek custom mapel user dulu, lalu fuzzy match, lalu fallback
  let emoji = KELAS_EMOJIS[idx % KELAS_EMOJIS.length];
  if (k.mapel) {
    const customMapel = getMapelList().find(m => m.nama.toLowerCase() === k.mapel.toLowerCase());
    if (customMapel?.emoji) {
      emoji = customMapel.emoji;
    } else {
      const fuzzy = getMapelEmoji(k.mapel);
      if (fuzzy && fuzzy !== '📚') emoji = fuzzy;
    }
  }
  const isGuru = role === 'guru';
  return `<div class="kelas-card" onclick="openKelas('${k.id}',${idx % KELAS_COLORS.length})">
    <div class="kelas-card-header ${colorClass}">
      <div class="kelas-emoji">${emoji}</div>
      ${k.mapel ? `<div class="kelas-mapel-tag">${k.mapel}</div><br>` : ''}
      <div class="kelas-name">${escapeHtml(k.nama)}</div>
      <div class="kelas-guru-name">${isGuru ? (k.tahun_ajar || '') : ('Guru: ' + (k.guru_nama || k.guru?.nama || '–'))}</div>
    </div>
    <div class="kelas-card-footer">
      ${isGuru ? `
        <div class="kelas-code-wrap">
          <span class="kelas-code-label">Kode:</span>
          <span class="kelas-code">${k.kode_akses || '–'}</span>
          <button class="kelas-copy-btn" onclick="event.stopPropagation();copyToClipboard('${k.kode_akses}')" title="Salin kode">📋</button>
        </div>
      ` : `<div class="kelas-stat">👨‍🏫 ${k.guru_nama || k.guru?.nama || 'Guru'}</div>`}
      <div style="display:flex;align-items:center;gap:8px">
        <div class="kelas-stat">📚 ${k.total_materi || 0} materi</div>
        ${isGuru
          ? `<button class="btn-icon btn-delete" onclick="event.stopPropagation();konfirmasiHapusKelas('${k.id}','${k.nama.replace(/'/g,"\\'")}')" title="Hapus kelas" style="width:28px;height:28px;font-size:13px">🗑️</button>`
          : `<button class="btn-icon" onclick="event.stopPropagation();konfirmasiKeluarKelas('${k.id}','${k.nama.replace(/'/g,"\\'")}')" title="Keluar dari kelas" style="width:28px;height:28px;font-size:13px;background:#FFF0F5;color:var(--pink)">🚪</button>`
        }
      </div>
    </div>
  </div>`;
}

// ============================================================
//  BUKA DETAIL KELAS
// ============================================================
let currentKelas = null;

async function openKelas(kelasId, colorIdx) {
  showLoading(true);
  try {
    // Pakai data card yang sudah ada sebagai tampilan awal
    const cached = (window._kelasList || []).find(x => x.id === kelasId);
    let k = cached || { id: kelasId, nama: 'Kelas', mapel: '', guru_nama: '–', kode_akses: '–', total_materi: 0, total_murid: 0 };
    const resolvedColorIdx = kelasHashIdx(kelasId) % KELAS_COLORS.length;
    currentKelas = { ...k, id: kelasId, colorIdx: resolvedColorIdx };

    const colorClass = KELAS_COLORS[resolvedColorIdx];
    const isGuru = currentUser?.role === 'guru';

    document.getElementById('kelas-detail-title').textContent = k.nama;
    document.getElementById('kelas-banner-title').textContent = k.nama;
    document.getElementById('kelas-banner-mapel').textContent = k.mapel || 'Kelas';
    document.getElementById('kelas-banner-guru').textContent = isGuru ? `Tahun Ajaran: ${k.tahun_ajar || '–'}` : `Guru: ${k.guru_nama || k.guru?.nama || '–'}`;
    document.getElementById('kelas-banner-bg').className = `kelas-banner-content ${colorClass}`;
    document.getElementById('kelas-code-display').textContent = k.kode_akses || '–';
    document.getElementById('kelas-add-materi-btn').style.display = isGuru ? 'inline-flex' : 'none';
    document.getElementById('kelas-add-kuis-btn').style.display = isGuru ? 'inline-flex' : 'none';
    document.getElementById('kelas-code-card').style.display = isGuru ? 'block' : 'none';
    document.getElementById('tab-murid-btn').style.display = '';
    document.getElementById('tab-penilaian-btn').style.display = isGuru ? '' : 'none';

    document.getElementById('kelas-info-sidebar').innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Mapel</span><span style="font-weight:700">${k.mapel || '–'}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Total Materi</span><span style="font-weight:700">${k.total_materi || 0}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Murid</span><span style="font-weight:700">${k.total_murid || 0} orang</span></div>
    `;

    const aksiCard = document.getElementById('kelas-aksi-card');
    if (isGuru) {
      aksiCard.innerHTML = `<div class="sidebar-card" style="display:flex;flex-direction:column;gap:10px">
        <button id="vc-meeting-btn" class="btn-meeting" onclick="vcMulaiMeeting()">
          📹 Mulai Meeting
        </button>
        <button onclick="konfirmasiHapusKelas('${k.id || kelasId}','${(k.nama||'').replace(/'/g,"\\'")}')"
          style="width:100%;padding:12px;border-radius:12px;border:none;background:#FFF0F0;color:var(--red);font-family:Nunito,sans-serif;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s"
          onmouseover="this.style.background='var(--red)';this.style.color='white'"
          onmouseout="this.style.background='#FFF0F0';this.style.color='var(--red)'">
          🗑️ Hapus Kelas
        </button>
      </div>`;
    } else {
      const guruNama = k.guru?.nama || k.guru_nama || 'Guru';
      const guruId = k.guru_id || '';
      aksiCard.innerHTML = `<div class="sidebar-card" style="display:flex;flex-direction:column;gap:10px">
        <button id="vc-meeting-btn" class="btn-meeting" onclick="vcJoinMeeting()" style="display:none">
          📹 Gabung Meeting
        </button>
        <button onclick="chatDenganGuru()"
          style="width:100%;padding:12px;border-radius:12px;border:none;background:#EEF5FF;color:var(--blue);font-family:Nunito,sans-serif;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s"
          onmouseover="this.style.background='var(--blue)';this.style.color='white'"
          onmouseout="this.style.background='#EEF5FF';this.style.color='var(--blue)'">
          💬 Chat dengan Guru
        </button>
        <button onclick="konfirmasiKeluarKelas('${k.id || kelasId}','${(k.nama||'').replace(/'/g,"\\'")}')"
          style="width:100%;padding:12px;border-radius:12px;border:none;background:#FFF0F5;color:var(--pink);font-family:Nunito,sans-serif;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s"
          onmouseover="this.style.background='var(--pink)';this.style.color='white'"
          onmouseout="this.style.background='#FFF0F5';this.style.color='var(--pink)'">
          🚪 Keluar dari Kelas
        </button>
      </div>`;
    }

    showPage('page-kelas');
    switchKelasTab('materi');
    showLoading(false);

    // Muat detail + semua tab secara paralel — tidak ada yang blocking
    api('GET', `/kelas/${kelasId}`).then(data => {
      const detail = data.kelas || data.data || data;
      if (detail && detail.nama) {
        currentKelas = { ...detail, id: kelasId, colorIdx: resolvedColorIdx };
        // Update sidebar info dengan data lengkap
        document.getElementById('kelas-code-display').textContent = detail.kode_akses || '–';
        document.getElementById('kelas-info-sidebar').innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Mapel</span><span style="font-weight:700">${detail.mapel || '–'}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Total Materi</span><span style="font-weight:700">${detail.total_materi || 0}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted);font-weight:600">Murid</span><span style="font-weight:700">${detail.total_murid || 0} orang</span></div>
        `;
      }
    }).catch(() => {});
    loadKelasStream(kelasId);
    loadKelasKuis(kelasId);
    loadKelasChatHistory(kelasId);
    // Bergabung ke socket room kelas
    if (currentUser) {
      socket.emit('kelas:join', {
        kelasId,
        userId: currentUser.id,
        nama: currentUser.nama,
        avatar: currentUser.avatar || '🦁',
        role: currentUser.role
      });
    }
    vcCurrentKelasId = kelasId;

    // Restore banner jika meeting masih aktif (setelah refresh)
    hideMeetingBanner();
    const savedMeeting = localStorage.getItem('kb_meeting_' + kelasId);
    if (savedMeeting) {
      try {
        const m = JSON.parse(savedMeeting);
        // Abaikan jika lebih dari 8 jam (meeting sudah lama)
        if (Date.now() - (m.ts || 0) < 8 * 60 * 60 * 1000) {
          if (currentUser?.role === 'guru') {
            // Guru restore overlay panel dari localStorage
            // (server tidak mengirim meeting_banner ke guru)
            setTimeout(() => {
              const roomName = vcGetRoomName(kelasId);
              vcMeetingTabUrl = m.roomUrl;
              vcShowMeetingPanel(roomName);
            }, 300);
          }
          // Murid: TIDAK restore dari localStorage — biarkan server yang menentukan
          // status meeting via kelas:meeting_banner atau kelas:meeting_ended
        } else {
          localStorage.removeItem('kb_meeting_' + kelasId);
        }
      } catch(e) { localStorage.removeItem('kb_meeting_' + kelasId); }
    }
  } catch(e) {
    showLoading(false);
    toast('Gagal membuka kelas', 'error');
  }
}

// Dipanggil dari tombol "Chat dengan Guru" di halaman kelas murid
function chatDenganGuru() {
  const k = currentKelas;
  if (!k) return;
  const guruId   = k.guru_id || '';
  const guruNama = k.guru?.nama || k.guru_nama || 'Guru';
  const guruAva  = k.guru?.avatar || '👩‍🏫';
  if (!guruId) { toast('Tidak bisa membuka chat', 'error'); return; }
  bukaPrivateChat(guruId, guruNama, guruAva);
}

async function loadKelasStream(kelasId) {
  const stream = document.getElementById('kelas-stream');
  stream.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat materi...</div>';
  try {
    const data = await api('GET', `/materi?kelas_id=${kelasId}`);
    const list = data.materi || data.data || [];
    const isGuru = currentUser?.role === 'guru';

    if (list.length === 0) {
      if (isGuru) {
        stream.innerHTML = `<div style="padding:8px 0">
          <div onclick="document.getElementById('kelas-add-materi-btn')?.click()"
            style="border:2.5px dashed #C8B8F5;border-radius:18px;padding:36px 24px;text-align:center;cursor:pointer;transition:all 0.2s;background:#FAFAFF"
            onmouseover="this.style.borderColor='var(--purple)';this.style.background='#F3EEFF'"
            onmouseout="this.style.borderColor='#C8B8F5';this.style.background='#FAFAFF'">
            <div style="font-size:44px;margin-bottom:12px">📚</div>
            <div style="font-weight:800;font-size:15px;color:var(--purple);margin-bottom:6px">Belum ada materi</div>
            <div style="font-size:13px;color:var(--muted)">Klik di sini untuk menambahkan materi pertama</div>
          </div>
        </div>`;
      } else {
        stream.innerHTML = `<div style="text-align:center;padding:48px 24px">
          <div style="font-size:56px;margin-bottom:16px">📭</div>
          <p style="font-weight:700;font-size:16px;color:var(--text);margin-bottom:8px">Belum ada materi</p>
          <p style="font-size:14px;color:var(--muted)">Gurumu belum menambahkan materi. Tunggu ya!</p>
        </div>`;
      }
      return;
    }

    // Progress bar materi untuk murid
    if (!isGuru) {
      const total    = list.length;
      const selesai  = list.filter(m => m.sudah_dibaca).length;
      const pct      = total > 0 ? Math.round((selesai / total) * 100) : 0;
      const pctColor = pct === 100 ? '#00C851' : pct >= 50 ? '#7b2ff7' : '#4D96FF';
      stream.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:14px 18px;margin-bottom:16px;box-shadow:0 2px 10px rgba(0,0,0,.06);border:2px solid #F0E8FF">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-weight:800;font-size:13px;color:#444">📚 Progress Materi</span>
            <span id="materi-prog-label" style="font-weight:900;font-size:13px;color:${pctColor}">${selesai}/${total} selesai</span>
          </div>
          <div style="height:8px;background:#F0E8FF;border-radius:50px;overflow:hidden">
            <div id="materi-prog-bar" style="height:100%;width:${pct}%;background:linear-gradient(90deg,#7b2ff7,#4D96FF);border-radius:50px;transition:width .4s"></div>
          </div>
          ${pct === 100 ? '<div style="text-align:center;margin-top:8px;font-size:12px;font-weight:800;color:#00C851">🎉 Semua materi sudah selesai!</div>' : ''}
        </div>`;
    } else {
      stream.innerHTML = '';
    }

    stream.innerHTML += list.map(m => {
      const icon = m.jenis === 'video' ? '🎬' : m.jenis === 'pdf' ? '📄' : m.jenis === 'gambar' ? '🖼️' : '📝';
      const iconBg = m.jenis === 'video' ? '#FFF0F5' : m.jenis === 'pdf' ? '#FFF3E8' : m.jenis === 'gambar' ? '#F0FFF4' : '#EEF5FF';
      const tgl = new Date(m.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
      let bodyHtml = '';

      if (m.jenis === 'video' && m.konten) {
        const ytMatch = m.konten.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([^?&]+)/);
        const videoId = ytMatch ? ytMatch[1] : null;
        const embedUrl = videoId
          ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`
          : m.konten;
        const watchUrl = videoId
          ? `https://www.youtube.com/watch?v=${videoId}`
          : (m.file_url || m.konten);
        const thumbUrl = videoId
          ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          : '';

        if (videoId) {
          // Tampilkan thumbnail dulu — klik baru load iframe (menghindari Error 153 yang tampil jelek)
          bodyHtml = `<div id="yt-wrap-${m.id}" style="position:relative;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden;background:#000;cursor:pointer" onclick="ytPlayClick('${m.id}','${embedUrl}','${watchUrl}')">
            <img src="${thumbUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:12px" onerror="this.style.background='#111'">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:68px;height:48px;background:#FF0000;border-radius:12px;display:flex;align-items:center;justify-content:center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>`;
        } else {
          // Non-YouTube: langsung iframe
          bodyHtml = `<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden">
            <iframe src="${escapeHtml(m.konten)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe>
          </div>`;
        }
      } else if (m.jenis === 'pdf' && m.file_url) {
        bodyHtml = `<a href="${escapeHtml(m.file_url)}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:var(--orange);color:white;padding:10px 20px;border-radius:50px;font-weight:700;font-size:14px;text-decoration:none">📄 Buka / Download PDF</a>
        ${m.deskripsi ? `<p style="margin-top:12px;font-size:14px;color:var(--muted)">${escapeHtml(m.deskripsi)}</p>` : ''}`;
      } else if (m.jenis === 'gambar' && m.konten) {
        bodyHtml = `<img src="${escapeHtml(m.konten)}" style="max-width:100%;border-radius:12px" onerror="this.style.display='none'">`;
      } else {
        const raw = m.konten || '';
        const rendered = renderMarkdown(raw);
        const postId = 'post-' + (m.id || Math.random().toString(36).slice(2));
        const isLong = raw.length > 400;
        bodyHtml = `
          <div id="${postId}-content" class="stream-post-body-text markdown-body" style="${isLong ? 'max-height:160px;overflow:hidden;position:relative;' : ''}">${rendered}${isLong ? `<div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(transparent,white)"></div>` : ''}</div>
          ${isLong ? `<button class="stream-toggle" onclick="toggleMateri('${postId}', this)" style="margin-top:8px">📖 Baca Selengkapnya</button>` : ''}
        `;
      }

      const sudah = m.sudah_dibaca;

      // Footer ceklis — hanya untuk murid
      const ceklisHtml = !isGuru ? `
        <div class="materi-ceklis-footer" id="ceklis-footer-${m.id}">
          <button
            class="materi-ceklis-btn ${sudah ? 'done' : ''}"
            id="ceklis-btn-${m.id}"
            onclick="tandaiMateriSelesai('${m.id}', '${(m.judul||'').replace(/'/g,"\\'")}', this)"
            ${sudah ? 'disabled' : ''}
            title="${sudah ? 'Sudah selesai dibaca' : 'Tandai sudah dibaca'}">
            <span class="ceklis-box">${sudah ? '✓' : ''}</span>
            <span class="ceklis-label">${sudah ? 'Sudah dibaca' : 'Tandai sudah dibaca'}</span>
            ${sudah ? '' : '<span class="ceklis-xp">+20 XP</span>'}
          </button>
        </div>` : '';

      return `<div class="stream-post ${sudah && !isGuru ? 'materi-done' : ''}" id="stream-post-${m.id}">
        <div class="stream-post-header">
          <div class="stream-post-icon" style="background:${iconBg}">${icon}</div>
          <div class="stream-post-meta">
            <h4>${escapeHtml(m.judul)}</h4>
            <p>${m.mapel || ''} · ${tgl}</p>
          </div>
          ${isGuru ? `<div class="stream-post-actions">
            <button class="btn-icon btn-edit" data-id="${m.id}" data-judul="${m.judul.replace(/"/g,'&quot;')}" data-mapel="${m.mapel}" data-jenis="${m.jenis}" data-status="${m.status}" onclick="editMateriBtn(this)" title="Edit">✏️</button>
            <button class="btn-icon btn-delete" data-id="${m.id}" data-judul="${m.judul.replace(/"/g,'&quot;')}" onclick="deleteMateriBtn(this)" title="Hapus">🗑️</button>
          </div>` : (!isGuru && sudah ? '<span style="font-size:18px;color:#00C851;flex-shrink:0">✅</span>' : '')}
        </div>
        ${m.deskripsi ? `<div style="padding:0 20px 10px;font-size:13px;color:var(--muted);line-height:1.5">${m.deskripsi}</div>` : ''}
        <div class="stream-post-body">
          ${bodyHtml}
        </div>
        ${ceklisHtml}
      </div>`;
    }).join('');
  } catch(e) {
    stream.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat materi</p></div>';
  }
}

function kembaliDashboard() {
  if (currentKelas?.id) socket.emit('kelas:leave', { kelasId: currentKelas.id });
  currentKelas = null;
  if (currentUser?.role === 'guru') loadGuruDashboard();
  else if (currentUser?.role === 'orangtua') loadOrangtuaDashboard();
  else loadMuridDashboard();
}

// ── Tandai materi sudah dibaca (ceklis) ────────────────────
async function tandaiMateriSelesai(materiId, judulMateri, btnEl) {
  if (btnEl.classList.contains('done') || btnEl.disabled) return;

  btnEl.classList.add('loading');
  btnEl.querySelector('.ceklis-label').textContent = 'Menyimpan...';

  try {
    const token = localStorage.getItem('kb_token') || '';
    const res   = await fetch(`/api/materi/${materiId}/selesai`, {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + token }
    });
    const json = await res.json();

    if (json.success) {
      // Update tombol → done
      btnEl.classList.remove('loading');
      btnEl.classList.add('done');
      btnEl.disabled = true;
      btnEl.querySelector('.ceklis-box').textContent  = '✓';
      btnEl.querySelector('.ceklis-label').textContent = 'Sudah dibaca';
      const xpEl = btnEl.querySelector('.ceklis-xp');
      if (xpEl) xpEl.remove();

      // Update kartu → border hijau
      const card = document.getElementById(`stream-post-${materiId}`);
      if (card) {
        card.classList.add('materi-done');
        // Tambah ikon ✅ di header kalau belum ada
        const header = card.querySelector('.stream-post-header');
        if (header && !header.querySelector('.materi-done-icon')) {
          const badge = document.createElement('span');
          badge.className = 'materi-done-icon';
          badge.style.cssText = 'font-size:18px;color:#00C851;flex-shrink:0';
          badge.textContent = '✅';
          header.appendChild(badge);
        }
      }

      // Toast XP
      const xp = json.xp_dapat || 20;
      toast(`✅ "${judulMateri}" selesai! +${xp} XP`);

      // Update progress bar di atas stream
      updateMateriProgressBar();
    } else if (json.pesan?.includes('sudah pernah')) {
      // Materi sudah pernah diselesaikan — update UI saja
      btnEl.classList.remove('loading');
      btnEl.classList.add('done');
      btnEl.disabled = true;
      btnEl.querySelector('.ceklis-box').textContent  = '✓';
      btnEl.querySelector('.ceklis-label').textContent = 'Sudah dibaca';
    } else {
      btnEl.classList.remove('loading');
      btnEl.querySelector('.ceklis-label').textContent = 'Tandai sudah dibaca';
      toast('Gagal menyimpan. Coba lagi.');
    }
  } catch(e) {
    btnEl.classList.remove('loading');
    btnEl.querySelector('.ceklis-label').textContent = 'Tandai sudah dibaca';
    toast('Gagal terhubung ke server.');
  }
}

// Update angka progress bar materi tanpa reload seluruh stream
function updateMateriProgressBar() {
  const stream   = document.getElementById('kelas-stream');
  if (!stream) return;
  const allCards = stream.querySelectorAll('[id^="stream-post-"]');
  const total    = allCards.length;
  const selesai  = stream.querySelectorAll('.stream-post.materi-done').length;
  const pct      = total > 0 ? Math.round((selesai / total) * 100) : 0;
  const pctColor = pct === 100 ? '#00C851' : pct >= 50 ? '#7b2ff7' : '#4D96FF';

  const barEl    = stream.querySelector('[id="materi-prog-bar"]') ||
                   stream.querySelector('div > div[style*="height:8px"]');
  const labelEl  = stream.querySelector('[id="materi-prog-label"]');

  if (barEl)   barEl.style.width    = pct + '%';
  if (labelEl) labelEl.textContent  = `${selesai}/${total} selesai`;

  if (pct === 100) toast('🎉 Semua materi sudah selesai!');
}

function copyKodeKelas() {
  const kode = document.getElementById('kelas-code-display').textContent.trim();
  copyToClipboard(kode);
}

// ============================================================
//  LIST MURID KELAS + ONLINE/OFFLINE
// ============================================================
let kelasOnlineUsers = []; // diupdate via socket

async function loadKelasMurid(kelasId) {
  const el = document.getElementById('kelas-murid-stream');
  el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat daftar murid...</div>';
  try {
    const data = await api('GET', `/kelas/${kelasId}`);
    const muridList = data.data?.murid || [];
    renderMuridList(muridList);
  } catch(e) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat murid</p></div>';
  }
}

function renderMuridList(muridList) {
  const el = document.getElementById('kelas-murid-stream');
  if (!muridList.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>Belum ada murid yang bergabung</p></div>';
    return;
  }
  const onlineIds = new Set(kelasOnlineUsers.filter(u => u.role === 'murid').map(u => u.userId));
  const onlineMuridCount = muridList.filter(m => onlineIds.has(m.id)).length;
  const sortedList = [...muridList].sort((a, b) => {
    const aOnline = onlineIds.has(a.id) ? 0 : 1;
    const bOnline = onlineIds.has(b.id) ? 0 : 1;
    return aOnline - bOnline;
  });
  el.innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--muted);font-weight:700">
      ${muridList.length} murid · <span style="color:#22C55E">● ${onlineMuridCount} online</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${(() => {
        window._muridAvatarMap = window._muridAvatarMap || {};
        return sortedList.map(m => {
          window._muridAvatarMap[m.id] = m.avatar || '🦁';
          const isOnline = onlineIds.has(m.id);
          return `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:white;border-radius:14px;border:2px solid ${isOnline ? '#D1FAE5' : '#F3F4F6'};transition:all 0.2s">
          <div style="position:relative;flex-shrink:0">
            <div style="width:40px;height:40px;border-radius:12px;background:${isOnline ? '#D1FAE5' : '#F3F4F6'};display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden">${chatAvatarHtml(m.avatar || '🦁')}</div>
            <div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:${isOnline ? '#22C55E' : '#9CA3AF'};border:2px solid white"></div>
          </div>
          <div style="flex:1">
            <div style="font-weight:800;font-size:14px">${m.nama}</div>
            <div style="font-size:12px;color:${isOnline ? '#16A34A' : 'var(--muted)'};font-weight:600">${isOnline ? '● Online' : '○ Offline'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="text-align:right">
              <div style="font-size:12px;color:var(--muted);font-weight:700">Lv.${m.level || 1}</div>
              <div style="font-size:11px;color:var(--orange);font-weight:700">${m.xp || 0} XP</div>
            </div>
            ${currentUser?.role === 'guru' ? `<button onclick="bukaPrivateChat('${m.id}','${m.nama.replace(/'/g,"\\'")}',window._muridAvatarMap['${m.id}']||'🦁')"
              style="background:var(--blue);color:white;border:none;padding:7px 12px;border-radius:50px;font-family:Nunito,sans-serif;font-weight:800;font-size:12px;cursor:pointer;flex-shrink:0"
              title="Chat privat dengan ${m.nama}">💬</button>` : ''}
          </div>
        </div>`;
        }).join('');
      })()}
    </div>`;
}

// ============================================================
//  CHAT KELAS
// ============================================================
let kelasChatKelasId = null;

async function loadKelasChatHistory(kelasId) {
  kelasChatKelasId = kelasId;
  const box = document.getElementById('kelas-chat-messages');
  box.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">Memuat pesan...</div>';
  try {
    const data = await api('GET', `/kelas/${kelasId}/chat`);
    const pesanList = data.data || [];
    box.innerHTML = '';
    pesanList.forEach(p => appendChatMessage(p));
    scrollChatToBottom();
  } catch(e) {
    box.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">Gagal memuat chat</div>';
  }
}

// Render avatar di dalam chat (emoji atau foto kecil)
function chatAvatarHtml(avatarStr) {
  if (avatarStr && (avatarStr.startsWith('data:') || avatarStr.startsWith('http'))) {
    return `<img src="${escapeHtml(avatarStr)}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;vertical-align:middle;display:inline-block;flex-shrink:0">`;
  }
  return `<span>${escapeHtml(avatarStr || '🦁')}</span>`;
}

function appendChatMessage(p) {
  const box = document.getElementById('kelas-chat-messages');
  if (!box) return;
  const isSelf = p.pengirim?.id === currentUser?.id || p.pengirim_id === currentUser?.id;
  const isGuruUser = currentUser?.role === 'guru';
  const canEdit = isSelf || isGuruUser;
  const pengirim = p.pengirim || { nama: 'Pengguna', avatar: '🦁', role: 'murid' };
  const waktu = new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const isGuru = pengirim.role === 'guru';
  const msgId = p.id || '';
  const div = document.createElement('div');
  div.id = 'msg-' + msgId;
  div.style.cssText = `display:flex;flex-direction:column;align-items:${isSelf ? 'flex-end' : 'flex-start'};gap:2px`;
  const actionBtns = canEdit && msgId ? `
    <span style="display:inline-flex;gap:4px;opacity:0.6">
      ${isSelf ? `<button onclick="editPesanKelas('${msgId}')" title="Edit" style="background:none;border:none;cursor:pointer;font-size:11px;padding:2px 4px;border-radius:6px;color:inherit">✏️</button>` : ''}
      <button onclick="hapusPesanKelas('${msgId}')" title="Hapus" style="background:none;border:none;cursor:pointer;font-size:11px;padding:2px 4px;border-radius:6px;color:inherit">🗑️</button>
    </span>` : '';
  div.innerHTML = `
    ${!isSelf ? `<div style="font-size:11px;color:var(--muted);font-weight:700;padding:0 8px;display:flex;align-items:center;gap:4px">${chatAvatarHtml(pengirim.avatar)} ${escapeHtml(pengirim.nama)}${isGuru ? ' 👩‍🏫' : ''}</div>` : ''}
    <div id="msg-bubble-${msgId}" data-isi="${escapeHtml(p.isi)}" style="max-width:75%;padding:10px 14px;border-radius:${isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};background:${isSelf ? 'var(--orange)' : 'white'};color:${isSelf ? 'white' : 'var(--text)'};font-size:14px;font-weight:600;border:${isSelf ? 'none' : '1.5px solid #E8E8E8'};word-break:break-word">${escapeHtml(p.isi)}</div>
    <div style="display:flex;align-items:center;gap:6px;padding:0 8px">
      <span style="font-size:10px;color:var(--muted)">${waktu}</span>
      ${actionBtns}
    </div>`;
  box.appendChild(div);
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/`/g,'&#96;');
}

function scrollChatToBottom() {
  const box = document.getElementById('kelas-chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

async function editPesanKelas(msgId) {
  const bubble = document.getElementById('msg-bubble-' + msgId);
  if (!bubble || bubble.querySelector('textarea')) return;

  const originalHTML = bubble.innerHTML;
  const originalIsi = bubble.dataset.isi || '';
  const currentText = originalIsi || bubble.textContent.replace(/\s*[\u270F\uFE0F]+\s*$/, '').trim();

  // Simpan semua inline styles yang relevan agar bisa di-restore persis
  const origStyle = {
    padding:   bubble.style.padding,
    maxWidth:  bubble.style.maxWidth,
    minWidth:  bubble.style.minWidth,
    width:     bubble.style.width
  };

  function applyOrigStyle(html, isi) {
    bubble.innerHTML = html;
    bubble.dataset.isi = isi;
    bubble.style.padding  = origStyle.padding;
    bubble.style.maxWidth = origStyle.maxWidth;
    bubble.style.minWidth = origStyle.minWidth;
    bubble.style.width    = origStyle.width;
  }

  const restore = () => applyOrigStyle(originalHTML, originalIsi);

  // Mode edit: expand sedikit agar textarea nyaman, tapi JANGAN set width tetap
  bubble.style.padding  = '8px';
  bubble.style.maxWidth = '85%';
  bubble.style.minWidth = '180px';
  bubble.style.width    = 'auto';
  bubble.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.value = currentText;
  ta.style.cssText = 'width:100%;box-sizing:border-box;border:none;border-radius:8px;padding:6px 8px;font-family:Nunito,sans-serif;font-size:14px;font-weight:600;resize:none;background:rgba(255,255,255,0.15);color:inherit;outline:none;display:block;overflow:hidden';

  // Auto-resize textarea sesuai isi
  const autoResize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.addEventListener('input', autoResize);
  setTimeout(autoResize, 0);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-top:6px';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '✓ Simpan';
  saveBtn.style.cssText = 'background:rgba(255,255,255,0.9);color:var(--blue);border:none;border-radius:8px;padding:4px 14px;font-size:12px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:800';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕ Batal';
  cancelBtn.style.cssText = 'background:rgba(255,255,255,0.2);color:inherit;border:none;border-radius:8px;padding:4px 14px;font-size:12px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:800';

  cancelBtn.onclick = restore;
  saveBtn.onclick = async () => {
    const newText = ta.value.trim();
    if (!newText) return;
    if (newText === currentText) { restore(); return; }
    saveBtn.disabled = true; saveBtn.textContent = '...';
    try {
      const data = await api('PUT', `/kelas/${kelasChatKelasId}/chat/${msgId}`, { isi: newText });
      if (data.success) {
        const newHTML = escapeHtml(newText) + ' <span style="font-size:11px;opacity:0.7">✏️</span>';
        applyOrigStyle(newHTML, newText);
        socket.emit('kelas:edit_pesan', { kelasId: kelasChatKelasId, msgId, isi: newText });
      } else { toast('Gagal mengedit pesan', 'error'); restore(); }
    } catch(e) { toast('Gagal mengedit pesan', 'error'); restore(); }
  };

  btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
  bubble.appendChild(ta); bubble.appendChild(btnRow);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}

async function hapusPesanKelas(msgId) {
  showConfirmHapusPesan(msgId);
}

async function _eksekusiHapusPesan(msgId) {
  closeModal('modal-hapus-pesan');
  try {
    const data = await api('DELETE', `/kelas/${kelasChatKelasId}/chat/${msgId}`);
    if (data.success) {
      const el = document.getElementById('msg-' + msgId);
      if (el) el.remove();
      socket.emit('kelas:hapus_pesan', { kelasId: kelasChatKelasId, msgId });
    }
  } catch(e) {
    toast('Gagal menghapus pesan', 'error');
  }
}

function showConfirmHapusPesan(msgId) {
  document.getElementById('btn-hapus-pesan-ok').onclick = () => _eksekusiHapusPesan(msgId);
  openModal('modal-hapus-pesan');
}

async function kirimPesanKelas() {
  const input = document.getElementById('kelas-chat-input');
  const isi = input.value.trim();
  if (!isi || !kelasChatKelasId) return;
  input.value = '';
  try {
    const data = await api('POST', `/kelas/${kelasChatKelasId}/chat`, { isi });
    if (data.success) {
      // Kirim via socket untuk real-time ke user lain (sertakan DB id agar hapus/edit sinkron)
      socket.emit('kelas:chat', {
        kelasId: kelasChatKelasId,
        id: data.data.id,
        isi,
        pengirim: { id: currentUser.id, nama: currentUser.nama, avatar: currentUser.avatar, role: currentUser.role }
      });
      // Tampilkan langsung di sisi pengirim
      appendChatMessage({ ...data.data, pengirim: currentUser });
      scrollChatToBottom();
    }
  } catch(e) {
    toast('Gagal mengirim pesan', 'error');
    input.value = isi;
  }
}

// Socket listeners untuk kelas
socket.on('kelas:online_list', (list) => {
  kelasOnlineUsers = list;
  if (currentKelasTab === 'murid' && currentKelas) {
    // Re-render list murid dengan status online terbaru
    api('GET', `/kelas/${currentKelas.id}`).then(data => {
      const muridList = data.data?.murid || [];
      renderMuridList(muridList);
    }).catch(() => {});
  }
});

socket.on('kelas:pesan_baru', (pesan) => {
  // Jangan duplikat pesan yang dikirim sendiri (sudah di-append oleh kirimPesanKelas)
  if (pesan.pengirim?.id === currentUser?.id) return;
  appendChatMessage(pesan);
  scrollChatToBottom();
  // Notifikasi jika tidak sedang di tab chat
  if (currentKelasTab !== 'chat') {
    const btn = document.getElementById('tab-chat-btn');
    if (btn) btn.textContent = '💬 Chat 🔴';
  }
  // Tambah ke bell notification
  addBellNotif({
    id: 'kelas_' + (pesan.id || Date.now()),
    tipe: 'kelas',
    judul: `${pesan.pengirim?.nama || 'Seseorang'} — ${currentKelas?.nama || 'Kelas'}`,
    pesan: pesan.isi || '',
    created_at: pesan.created_at || new Date().toISOString(),
    dibaca: false,
    kelas_id: pesan.kelas_id
  });
});

socket.on('kelas:pesan_diedit', ({ msgId, isi }) => {
  const bubble = document.getElementById('msg-bubble-' + msgId);
  if (!bubble) return;
  if (bubble.querySelector('textarea')) return; // jangan timpa textarea yang sedang terbuka
  bubble.dataset.isi = isi;
  bubble.innerHTML = escapeHtml(isi) + ' <span style="font-size:11px;opacity:0.7">✏️</span>';
});

socket.on('kelas:pesan_dihapus', ({ msgId }) => {
  const el = document.getElementById('msg-' + msgId);
  if (el) el.remove();
});

// ============================================================
//  VIDEO CALL — Daily.co (iframe embed, maks 64 peserta)
// ============================================================

let vcCurrentKelasId = null;

// ── Jitsi Meeting (External API — auto login nama akun) ───────
let vcJitsiApi    = null;
let vcCurrentRoomUrl = null;
let vcJitsiWindow = null; // referensi tab Jitsi yang dibuka

function vcGetRoomName(kelasId) {
  return 'kitabelajar-' + kelasId.replace(/-/g, '').slice(0, 16);
}

// ── Guru: mulai meeting ───────────────────────────────────────
function vcMulaiMeeting() {
  const kelasId = currentKelas?.id;
  if (!kelasId) return;
  const roomName = vcGetRoomName(kelasId);
  const roomUrl  = 'https://meet.ffmuc.net/' + roomName;
  vcCurrentKelasId = kelasId;
  vcStartJitsi(roomName);
  // Broadcast banner ke semua murid di kelas
  socket.emit('kelas:meeting_banner', { kelasId, roomUrl, nama: currentKelas?.nama || 'Kelas' });
  // Simpan ke localStorage agar overlay bisa di-restore setelah refresh
  localStorage.setItem('kb_meeting_' + kelasId, JSON.stringify({ roomUrl, ts: Date.now() }));
  // Ubah tombol sidebar → Akhiri Meeting
  const btn = document.getElementById('vc-meeting-btn');
  if (btn) {
    btn.textContent = '📵 Akhiri Meeting';
    btn.onclick = () => vcLeave();
    btn.style.background = 'var(--red)';
  }
}

// ── Murid: join meeting ───────────────────────────────────────
function vcJoinMeeting() {
  const kelasId = currentKelas?.id;
  if (!kelasId) { toast('Buka kelas dulu', 'error'); return; }
  const roomName = vcGetRoomName(kelasId);
  vcCurrentKelasId = kelasId;
  vcStartJitsi(roomName);
}

// ── Buka Jitsi di tab baru dengan nama akun yang login ────────
function vcStartJitsi(roomName) {
  const displayName = encodeURIComponent(
    (currentUser?.nama || 'Peserta') + (currentUser?.role === 'guru' ? ' 👩‍🏫' : '')
  );
  // Parameter #config & #userInfo dikirim lewat fragment URL — didukung meet.ffmuc.net dan Jitsi lainnya
  const url = `https://meet.ffmuc.net/${roomName}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.defaultLanguage="id"`;
  vcJitsiWindow = window.open(url, '_blank');
  // Tampilkan panel info di halaman (bukan overlay)
  vcShowMeetingPanel(roomName);
}

// ── Tampilkan panel info meeting ──────────────────────────────
let vcMeetingTabUrl = null;

function vcShowMeetingPanel(roomName) {
  const url = 'https://meet.ffmuc.net/' + roomName;
  vcMeetingTabUrl = url;
  document.getElementById('vc-panel-title').textContent = '📹 ' + (currentKelas?.nama || 'Meeting Aktif');
  document.getElementById('vc-panel-url').textContent = url;
  document.getElementById('vc-overlay').classList.add('active');
}

// ── Buka ulang tab meeting ────────────────────────────────────
function vcReopenTab() {
  if (vcMeetingTabUrl) {
    const displayName = encodeURIComponent(
      (currentUser?.nama || 'Peserta') + (currentUser?.role === 'guru' ? ' 👩‍🏫' : '')
    );
    const url = vcMeetingTabUrl + `#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false`;
    window.open(url, '_blank');
  }
}

// ── Salin & bagikan link ke chat kelas ───────────────────────
function vcShareLink() {
  const kelasId = vcCurrentKelasId || currentKelas?.id;
  if (!kelasId) return;
  const url = 'https://meet.ffmuc.net/' + vcGetRoomName(kelasId);

  // Copy clipboard — fallback ke select+copy jika API gagal
  function copyToClipboardFallback(text) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(el);
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => copyToClipboardFallback(url));
  } else {
    copyToClipboardFallback(url);
  }
  toast('🔗 Link meeting disalin!', 'info');

  // Kirim ke chat kelas
  const chatKelasId = kelasChatKelasId || kelasId;
  api('POST', `/kelas/${chatKelasId}/chat`, {
    isi: `📹 Bergabung ke meeting kelas: ${url}`
  }).then(data => {
    if (data.success) {
      socket.emit('kelas:chat', {
        kelasId: chatKelasId,
        isi: `📹 Bergabung ke meeting kelas: ${url}`,
        pengirim: { id: currentUser.id, nama: currentUser.nama, avatar: currentUser.avatar, role: currentUser.role }
      });
      toast('✅ Link dikirim ke chat kelas!', 'info');
    } else {
      toast('🔗 Link disalin! (Chat gagal terkirim)', 'info');
    }
  }).catch(() => {
    toast('🔗 Link disalin! (Chat gagal terkirim)', 'info');
  });
}

function vcLeave() {
  const kelasId = vcCurrentKelasId || currentKelas?.id;
  if (kelasId) {
    // Broadcast ke semua (termasuk guru sendiri via io.to di server)
    socket.emit('kelas:meeting_ended', { kelasId });
    localStorage.removeItem('kb_meeting_' + kelasId);
  }
  // Tutup tab Jitsi jika masih buka
  if (vcJitsiWindow && !vcJitsiWindow.closed) {
    try { vcJitsiWindow.close(); } catch(e) {}
  }
  vcJitsiWindow = null;
  // UI cleanup langsung (tidak tunggu socket bounce-back)
  vcJitsiApi = null;
  vcMeetingTabUrl = null;
  vcCurrentKelasId = null;
  document.getElementById('vc-overlay').classList.remove('active');
  hideMeetingBanner();
  // Reset tombol sidebar guru
  const btn = document.getElementById('vc-meeting-btn');
  if (btn && currentUser?.role === 'guru') {
    btn.textContent = '📹 Mulai Meeting';
    btn.onclick = () => vcMulaiMeeting();
    btn.style.background = '';
  }
}

// ── Meeting Banner helpers ────────────────────────────────────
function showMeetingBanner(roomUrl) {
  const banner = document.getElementById('kelas-meeting-banner');
  if (!banner) return;
  const link = document.getElementById('kelas-meeting-banner-link');
  if (link && roomUrl) {
    const displayName = encodeURIComponent(currentUser?.nama || 'Peserta');
    link.href = `${roomUrl}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false&config.defaultLanguage="id"`;
  }
  banner.style.display = 'block';
}

function hideMeetingBanner() {
  const banner = document.getElementById('kelas-meeting-banner');
  if (banner) banner.style.display = 'none';
}

// Murid terima banner meeting dari guru
socket.on('kelas:meeting_banner', ({ kelasId, roomUrl }) => {
  if (currentUser?.role !== 'murid') return;
  if (currentKelas?.id !== kelasId) return;
  // Simpan ke localStorage agar banner tetap muncul setelah refresh
  localStorage.setItem('kb_meeting_' + kelasId, JSON.stringify({ roomUrl, ts: Date.now() }));
  showMeetingBanner(roomUrl);
  // Tampilkan juga tombol join di sidebar
  const btn = document.getElementById('vc-meeting-btn');
  if (btn) { btn.style.display = 'flex'; btn.textContent = '📹 Gabung Meeting'; }
  toast('📹 Guru memulai meeting! Lihat banner di atas untuk bergabung.', 'info');
});

// Guru akhiri meeting → semua orang (termasuk guru) tutup overlay & banner
socket.on('kelas:meeting_ended', ({ kelasId }) => {
  // Cek apakah murid memang sedang/pernah ada di meeting SEBELUM dihapus
  const sedangDiMeeting = !!localStorage.getItem('kb_meeting_' + kelasId);
  // Selalu hapus localStorage, terlepas dari halaman yang sedang dibuka
  localStorage.removeItem('kb_meeting_' + kelasId);
  if (currentKelas?.id !== kelasId) return;

  const bannerAktif = document.getElementById('kelas-meeting-banner')?.style.display === 'block';
  hideMeetingBanner();

  // Tutup tab Jitsi jika masih terbuka
  if (vcJitsiWindow && !vcJitsiWindow.closed) {
    try { vcJitsiWindow.close(); } catch(e) {}
    vcJitsiWindow = null;
  }
  // Tutup vc-overlay untuk semua role
  const overlay = document.getElementById('vc-overlay');
  if (overlay && overlay.classList.contains('active')) {
    overlay.classList.remove('active');
    vcCurrentKelasId = null;
    vcJitsiApi = null;
    vcMeetingTabUrl = null;
  }
  const btn = document.getElementById('vc-meeting-btn');
  if (btn) {
    if (currentUser?.role === 'murid') {
      btn.style.display = 'none';
    } else if (currentUser?.role === 'guru') {
      btn.textContent = '📹 Mulai Meeting';
      btn.onclick = () => vcMulaiMeeting();
      btn.style.background = '';
    }
  }
  // Tampilkan toast HANYA jika murid memang sedang ada di meeting (banner aktif atau localStorage ada)
  if (currentUser?.role !== 'guru' && (bannerAktif || sedangDiMeeting)) {
    toast('⏹️ Guru telah mengakhiri meeting.', 'info');
  }
});

// ============================================================
//  PRIVATE CHAT
// ============================================================
let privateChatTargetId = null;
let privateChatTargetNama = '';
let privateChatTargetAvatar = '';

// Bergabung ke channel private — dipanggil setelah login berhasil
function joinPrivateChannel() {
  if (currentUser?.id) socket.emit('private:join', { userId: currentUser.id });
}
// Jika socket reconnect (misal setelah internet terputus), join ulang
socket.on('connect', () => { joinPrivateChannel(); });

// ============================================================
//  PUSH NOTIFICATION — Service Worker + Browser Notifications
// ============================================================
let _swRegistration = null;
let _pushEnabled = false;

async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    _swRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('[SW] Service worker terdaftar.');
  } catch(e) {
    console.warn('[SW] Gagal daftar service worker:', e.message);
  }
}

async function requestPushPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function subscribePush() {
  if (!currentUser) return;
  const granted = await requestPushPermission();
  if (!granted) return;
  if (!_swRegistration) return;

  try {
    // Gunakan VAPID public key dari server jika ada, fallback ke browser notification
    let sub = await _swRegistration.pushManager.getSubscription();
    if (!sub) {
      // Coba subscribe dengan dummy key jika VAPID tidak dikonfigurasi
      // Server akan abaikan jika tidak ada web-push
      try {
        const vapidPublicKey = await fetch('/api/push/vapid-key').then(r => r.json()).then(d => d.key).catch(() => null);
        if (vapidPublicKey) {
          const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
          sub = await _swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });
        }
      } catch(e) {
        console.warn('[Push] Subscribe gagal:', e.message);
      }
    }

    if (sub) {
      const subData = sub.toJSON();
      await api('POST', '/push/subscribe', {
        endpoint: subData.endpoint,
        keys: subData.keys
      }).catch(() => {});
      _pushEnabled = true;
    }
  } catch(e) {
    console.warn('[Push] Error subscribe:', e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// Tampilkan browser notification saat halaman di background
function showBrowserNotif(judul, pesan, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // tab aktif, tidak perlu notif
  try {
    if (_swRegistration) {
      _swRegistration.showNotification(judul, {
        body: pesan,
        icon: '/assets/icon-192.png',
        tag: tag || 'kb-notif',
        vibrate: [200, 100, 200]
      });
    } else {
      new Notification(judul, { body: pesan });
    }
  } catch(e) {}
}

// Init SW saat halaman load
initServiceWorker();

let _notifPrivateChatData = null;
let _notifPrivateChatTimer = null;

socket.on('private:receive', (pesan) => {
  const modalOpen = document.getElementById('modal-private-chat')?.classList.contains('open');
  if (modalOpen && privateChatTargetId === pesan.dari_id) {
    // Modal sudah terbuka dengan pengirim ini — langsung tampilkan
    appendPrivateMessage(pesan, false);
    scrollPrivateChatToBottom();
  } else {
    // Simpan data untuk tombol "Balas"
    _notifPrivateChatData = pesan;
    tampilkanNotifPrivateChat(pesan);
  }
  // Selalu tambah ke bell notification (private = prioritas tinggi)
  addBellNotif({
    id: 'priv_' + (pesan.id || Date.now()),
    tipe: 'private',
    judul: pesan.pengirim_nama || 'Pesan Privat',
    pesan: pesan.isi || '',
    created_at: new Date().toISOString(),
    dibaca: false,
    dari_id: pesan.dari_id,
    pengirim_nama: pesan.pengirim_nama,
    pengirim_avatar: pesan.pengirim_avatar
  });
  // Tampilkan browser notification jika tab tidak aktif
  showBrowserNotif(
    `💬 Pesan dari ${pesan.pengirim_nama || 'Seseorang'}`,
    pesan.isi || 'Pesan baru',
    'private-' + pesan.dari_id
  );
});

function tampilkanNotifPrivateChat(pesan) {
  const nama = pesan.pengirim_nama || 'Seseorang';
  const ava  = pesan.pengirim_avatar || '🦁';
  const isi  = pesan.isi || '';

  setAvatarEl(document.getElementById('notif-pc-avatar'), ava, 'nav');
  document.getElementById('notif-pc-nama').textContent   = nama;
  document.getElementById('notif-pc-isi').textContent    = isi.length > 50 ? isi.substring(0, 50) + '…' : isi;

  const el = document.getElementById('notif-private-chat');
  el.style.display = 'flex';

  // Auto-hilang setelah 6 detik
  if (_notifPrivateChatTimer) clearTimeout(_notifPrivateChatTimer);
  _notifPrivateChatTimer = setTimeout(tutupNotifPrivateChat, 6000);
}

function tutupNotifPrivateChat() {
  document.getElementById('notif-private-chat').style.display = 'none';
  if (_notifPrivateChatTimer) clearTimeout(_notifPrivateChatTimer);
}

function bukaNotifPrivateChat() {
  tutupNotifPrivateChat();
  if (!_notifPrivateChatData) return;
  const p = _notifPrivateChatData;
  bukaPrivateChat(
    p.dari_id,
    p.pengirim_nama || 'Seseorang',
    p.pengirim_avatar || '🦁'
  );
}

// ============================================================
//  NOTIFICATION BELL
// ============================================================
let bellNotifs = [];
let bellUnreadCount = 0;

function addBellNotif(notif) {
  if (notif.id && bellNotifs.find(n => n.id === notif.id)) return; // cegah duplikat
  bellNotifs.unshift(notif);
  if (bellNotifs.length > 50) bellNotifs.pop();
  if (!notif.dibaca) {
    bellUnreadCount++;
    updateBellBadge();
  }
  if (document.getElementById('bell-dropdown').classList.contains('open')) {
    renderBellDropdown();
  }
}

function updateBellBadge() {
  const count = bellUnreadCount > 0 ? (bellUnreadCount > 99 ? '99+' : String(bellUnreadCount)) : '';
  document.querySelectorAll('.bell-badge').forEach(b => {
    b.textContent = count;
    if (bellUnreadCount > 0) b.classList.add('show');
    else b.classList.remove('show');
  });
}

function toggleBellDropdown() {
  const dd = document.getElementById('bell-dropdown');
  if (dd.classList.contains('open')) {
    dd.classList.remove('open');
  } else {
    renderBellDropdown();
    dd.classList.add('open');
  }
}

function closeBellDropdown() {
  document.getElementById('bell-dropdown')?.classList.remove('open');
}

function renderBellDropdown() {
  const list = document.getElementById('bell-list');
  if (!list) return;
  if (bellNotifs.length === 0) {
    list.innerHTML = '<div class="bell-empty">🔔<br>Belum ada notifikasi</div>';
    return;
  }
  list.innerHTML = bellNotifs.slice(0, 30).map(n => {
    const icon = { private: '💬', kelas: '🏫', materi: '📚', quiz: '📝', quiz_invite: '🎯' }[n.tipe] || '🔔';
    const timeStr = n.created_at ? formatBellTime(new Date(n.created_at)) : '';
    const safe_id     = escapeHtml(n.id || '');
    const safe_tipe   = escapeHtml(n.tipe || '');
    const safe_dariId = escapeHtml(n.dari_id || '');
    const safe_nama   = (n.pengirim_nama || '').replace(/'/g, '&apos;');
    const safe_ava    = (n.pengirim_avatar || '').replace(/'/g, '&apos;');
    const safe_kelas  = escapeHtml(n.kelas_id || '');
    return `<div class="bell-notif-item type-${safe_tipe}${n.dibaca ? '' : ' unread'}"
      onclick="klikBellNotif('${safe_id}','${safe_tipe}','${safe_dariId}','${safe_nama}','${safe_ava}','${safe_kelas}')">
      <div class="bell-notif-icon">${icon}</div>
      <div class="bell-notif-body">
        <div class="bell-notif-judul">${escapeHtml(n.judul || '')}</div>
        <div class="bell-notif-isi">${escapeHtml(n.pesan || '')}</div>
        <div class="bell-notif-time">${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

function formatBellTime(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

async function klikBellNotif(id, tipe, dariId, namaPengirim, avatarPengirim, kelasId) {
  closeBellDropdown();
  const notif = bellNotifs.find(n => n.id === id);
  if (notif && !notif.dibaca) {
    notif.dibaca = true;
    bellUnreadCount = Math.max(0, bellUnreadCount - 1);
    updateBellBadge();
  }

  // Private chat → buka chat langsung
  if (tipe === 'private' && dariId) {
    bukaPrivateChat(dariId, namaPengirim || 'Seseorang', avatarPengirim || '🦁');
    return;
  }

  // Quiz invite → buka quiz langsung
  if (tipe === 'quiz_invite' && notif) {
    let kode = null;
    try {
      const extra = typeof notif.data_extra === 'string' ? JSON.parse(notif.data_extra) : notif.data_extra;
      kode = extra?.kode_room;
    } catch(e) {}
    if (kode) {
      bukaZepQuizDariKode(kode);
    } else {
      bukaZepQuizMurid();
    }
    return;
  }

  // Kelas (materi, kuis/tugas) → buka kelas yang benar
  if (kelasId) {
    try {
      await openKelas(kelasId, 0);
      // Tunggu halaman kelas terbuka, lalu switch tab sesuai tipe
      setTimeout(() => {
        if (tipe === 'materi') {
          switchKelasTab('materi');
        } else if (tipe === 'quiz' || tipe === 'kuis' || tipe === 'tugas' || tipe === 'tugas_baru') {
          switchKelasTab('kuis');
        } else {
          switchKelasTab('materi');
        }
      }, 400);
    } catch(e) {
      toast('Gagal membuka kelas terkait.', 'error');
    }
    return;
  }

  // Fallback: buka halaman sesuai role
  if (currentUser) {
    showPage(currentUser.role === 'guru' ? 'page-guru' : 'page-murid');
  }
}

async function bellTandaiSemuaDibaca() {
  bellNotifs.forEach(n => { n.dibaca = true; });
  bellUnreadCount = 0;
  updateBellBadge();
  renderBellDropdown();
  try { await api('PATCH', '/notifikasi/baca-semua'); } catch(e) {}
}

async function loadBellNotifications() {
  if (!currentUser) return;
  bellNotifs = [];
  bellUnreadCount = 0;
  try {
    const data = await api('GET', '/notifikasi');
    (data.data || []).forEach(n => {
      const tipe = n.judul?.includes('Materi') ? 'materi'
                 : (n.judul?.includes('Kuis') || n.judul?.includes('Quiz')) ? 'quiz'
                 : 'notif';
      bellNotifs.push({ id: n.id, tipe, judul: n.judul, pesan: n.pesan, created_at: n.created_at, dibaca: n.dibaca });
      if (!n.dibaca) bellUnreadCount++;
    });
    updateBellBadge();
  } catch(e) {}
}

// Tutup dropdown jika klik di luar
document.addEventListener('click', (e) => {
  const dd = document.getElementById('bell-dropdown');
  if (dd?.classList.contains('open') && !dd.contains(e.target) && !e.target.closest('.bell-btn')) {
    closeBellDropdown();
  }
});

// Socket: notifikasi materi/quiz dari backend
socket.on('notif:baru', (notif) => {
  addBellNotif({
    id: 'n_' + Date.now() + '_' + Math.random(),
    tipe: notif.tipe || 'notif',
    judul: notif.judul,
    pesan: notif.pesan,
    created_at: notif.created_at || new Date().toISOString(),
    dibaca: false
  });
  // Browser notification saat tab tidak aktif
  showBrowserNotif(notif.judul || 'KitaBelajar', notif.pesan || '', 'notif-' + (notif.tipe || 'umum'));
});

async function bukaPrivateChat(userId, nama, avatar) {
  if (!userId) { toast('Tidak bisa membuka chat', 'error'); return; }
  privateChatTargetId = userId;
  privateChatTargetNama = nama;
  privateChatTargetAvatar = avatar;

  setAvatarEl(document.getElementById('pc-avatar'), avatar, 'nav');
  document.getElementById('pc-nama').textContent = nama;
  document.getElementById('pc-status').textContent = 'Chat Privat';
  document.getElementById('pc-messages').innerHTML =
    '<div style="text-align:center;color:var(--muted);font-size:13px;padding:24px">Memuat pesan...</div>';

  openModal('modal-private-chat');

  try {
    const data = await api('GET', `/chat/private/${userId}`);
    const box = document.getElementById('pc-messages');
    box.innerHTML = '';
    (data.data || []).forEach(p => appendPrivateMessage(p, p.dari_id === currentUser.id));
    scrollPrivateChatToBottom();
  } catch(e) {
    document.getElementById('pc-messages').innerHTML =
      '<div style="text-align:center;color:var(--muted);font-size:13px;padding:24px">Gagal memuat pesan</div>';
  }
}

function appendPrivateMessage(p, isSelf) {
  const box = document.getElementById('pc-messages');
  if (!box) return;
  const waktu = new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const ava = isSelf ? (currentUser?.avatar || '🦁') : privateChatTargetAvatar;
  const msgId = p.id || '';
  const div = document.createElement('div');
  div.dataset.msgId = msgId;
  div.style.cssText = `display:flex;flex-direction:column;align-items:${isSelf ? 'flex-end' : 'flex-start'};gap:2px`;
  const editedLabel = p.edited ? '<span style="font-size:10px;opacity:0.7;font-style:italic"> (diedit)</span>' : '';
  const selfActions = isSelf && msgId ? `
    <div class="pc-msg-actions" style="display:none;gap:4px;margin-top:2px">
      <button onclick="editPesanPrivat('${msgId}',this)" style="background:none;border:1px solid #ddd;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:700;color:var(--blue)">✏️ Edit</button>
      <button onclick="hapusPesanPrivat('${msgId}',this)" style="background:none;border:1px solid #ddd;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:700;color:var(--red)">🗑️ Hapus</button>
    </div>` : '';
  div.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:6px;flex-direction:${isSelf ? 'row-reverse' : 'row'}"
         onmouseenter="${isSelf && msgId ? `this.querySelector('.pc-msg-actions')&&(this.querySelector('.pc-msg-actions').style.display='flex')` : ''}"
         onmouseleave="${isSelf && msgId ? `this.querySelector('.pc-msg-actions')&&(this.querySelector('.pc-msg-actions').style.display='none')` : ''}">
      <div style="font-size:18px;flex-shrink:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%">${chatAvatarHtml(ava)}</div>
      <div style="max-width:78%">
        <div class="pc-msg-bubble" style="padding:10px 14px;border-radius:${isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};background:${isSelf ? 'var(--blue)' : 'white'};color:${isSelf ? 'white' : 'var(--text)'};font-size:14px;font-weight:600;border:${isSelf ? 'none' : '1.5px solid #E8E8E8'};word-break:break-word">${escapeHtml(p.isi)}${editedLabel}</div>
        ${selfActions}
      </div>
    </div>
    <div style="font-size:10px;color:var(--muted);padding:0 32px">${waktu}</div>`;
  box.appendChild(div);
}

async function editPesanPrivat(msgId, btn) {
  const div = btn.closest('[data-msg-id]');
  const bubble = div?.querySelector('.pc-msg-bubble');
  if (!bubble || bubble.querySelector('textarea')) return;
  const originalHTML = bubble.innerHTML;
  const currentText = bubble.textContent.replace(/\s*\(diedit\)\s*$/, '').trim();

  const restore = () => { bubble.innerHTML = originalHTML; };

  bubble.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.value = currentText;
  ta.style.cssText = 'width:100%;box-sizing:border-box;border:none;border-radius:8px;padding:6px 8px;font-family:Nunito,sans-serif;font-size:14px;font-weight:600;resize:none;min-height:56px;background:rgba(255,255,255,0.15);color:white;outline:none';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;margin-top:4px';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '✓ Simpan';
  saveBtn.style.cssText = 'background:rgba(255,255,255,0.9);color:var(--blue);border:none;border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:800';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕ Batal';
  cancelBtn.style.cssText = 'background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;padding:4px 12px;font-size:12px;cursor:pointer;font-family:Nunito,sans-serif;font-weight:800';

  cancelBtn.onclick = restore;
  saveBtn.onclick = async () => {
    const newText = ta.value.trim();
    if (!newText) return;
    if (newText === currentText) { restore(); return; }
    saveBtn.disabled = true; saveBtn.textContent = '...';
    try {
      const data = await api('PUT', `/chat/private/msg/${msgId}`, { isi: newText });
      if (data.success) {
        bubble.innerHTML = escapeHtml(newText) + '<span style="font-size:10px;opacity:0.7;font-style:italic"> (diedit)</span>';
      } else { toast('Gagal edit pesan', 'error'); restore(); }
    } catch(e) { toast('Gagal edit pesan', 'error'); restore(); }
  };

  btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
  bubble.appendChild(ta); bubble.appendChild(btnRow);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}

async function hapusPesanPrivat(msgId, btn) {
  document.getElementById('btn-hapus-pesan-ok').onclick = async () => {
    closeModal('modal-hapus-pesan');
    try {
      const data = await api('DELETE', `/chat/private/msg/${msgId}`);
      if (data.success) {
        const div = btn.closest('[data-msg-id]');
        if (div) div.remove();
      }
    } catch(e) { toast('Gagal hapus pesan', 'error'); }
  };
  openModal('modal-hapus-pesan');
}

function scrollPrivateChatToBottom() {
  const box = document.getElementById('pc-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

async function kirimPrivateChat() {
  const input = document.getElementById('pc-input');
  const isi = input.value.trim();
  if (!isi || !privateChatTargetId) return;
  input.value = '';
  try {
    const data = await api('POST', `/chat/private/${privateChatTargetId}`, { isi });
    if (data.success) {
      const msgId = data.data?.id;
      socket.emit('private:send', {
        toUserId: privateChatTargetId,
        isi,
        dari_id: currentUser.id,
        pengirim_nama: currentUser.nama,
        pengirim_avatar: currentUser.avatar,
        created_at: new Date().toISOString()
      });
      appendPrivateMessage({ id: msgId, isi, created_at: new Date().toISOString() }, true);
      scrollPrivateChatToBottom();
    }
  } catch(e) {
    toast('Gagal mengirim pesan', 'error');
    input.value = isi;
  }
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => toast(`Kode "${text}" disalin! 📋`, 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast(`Kode "${text}" disalin! 📋`, 'success');
    });
}

// ============================================================
//  HAPUS KELAS (GURU)
// ============================================================
let hapusKelasId = null;

function konfirmasiHapusKelas(id, nama) {
  hapusKelasId = id;
  document.getElementById('hapus-kelas-pesan').textContent = `Kelas "${nama}" akan dihapus permanen.`;
  openModal('modal-hapus-kelas');
}

async function eksekusiHapusKelas() {
  if (!hapusKelasId) return;
  closeModal('modal-hapus-kelas');
  showLoading(true);
  try {
    const data = await api('DELETE', `/kelas/${hapusKelasId}`);
    hapusKelasId = null;
    if (data.success || data.pesan?.toLowerCase().includes('berhasil') || data.pesan?.toLowerCase().includes('dihapus')) {
      toast('Kelas berhasil dihapus! 🗑️', 'success');
      // Kalau sedang di halaman detail kelas, kembali ke dashboard
      const isInDetail = document.getElementById('page-kelas').classList.contains('active');
      currentKelas = null;
      loadGuruDashboard();
    } else {
      toast(data.pesan || 'Gagal menghapus kelas', 'error');
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

// ============================================================
//  KELUAR KELAS (MURID)
// ============================================================
let keluarKelasId = null;

function konfirmasiKeluarKelas(id, nama) {
  keluarKelasId = id;
  document.getElementById('keluar-kelas-pesan').textContent = `Kamu akan keluar dari kelas "${nama}". Kamu bisa bergabung lagi nanti dengan kode yang sama.`;
  openModal('modal-keluar-kelas');
}

async function eksekusiKeluarKelas() {
  if (!keluarKelasId) return;
  closeModal('modal-keluar-kelas');
  showLoading(true);
  try {
    // Coba berbagai endpoint leave sesuai kemungkinan backend
    let success = false;
    const endpoints = [
      { method: 'DELETE', path: `/kelas/${keluarKelasId}/leave` },
      { method: 'DELETE', path: `/kelas/${keluarKelasId}/murid` },
      { method: 'POST',   path: `/kelas/${keluarKelasId}/leave` },
      { method: 'POST',   path: `/kelas/leave` },
    ];
    for (const ep of endpoints) {
      try {
        const data = await api(ep.method, ep.path, ep.method === 'POST' ? { kelas_id: keluarKelasId } : undefined);
        if (data.success || data.pesan?.toLowerCase().includes('keluar') || data.pesan?.toLowerCase().includes('berhasil')) {
          success = true; break;
        }
      } catch(e) {}
    }
    keluarKelasId = null;
    currentKelas = null;
    if (success) {
      toast('Berhasil keluar dari kelas 🚪', 'success');
      await loadMuridDashboard();
    } else {
      toast('Gagal keluar dari kelas. Coba lagi! ❌', 'error');
      await loadMuridDashboard(); // tetap reload agar data sinkron
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

function openTambahMateriKelas() {
  if (!currentKelas) return;
  document.getElementById('m-kelas-id').value = currentKelas.id;
  // Set mapel sesuai kelas
  const mapelSel = document.getElementById('m-mapel');
  if (currentKelas.mapel) {
    for (let opt of mapelSel.options) {
      if (opt.value === currentKelas.mapel) { opt.selected = true; break; }
    }
  }
  resetMateriForm();
  document.getElementById('m-kelas-id').value = currentKelas.id;
  openModal('modal-materi');
}

// ============================================================
//  BUAT KELAS (GURU)
// ============================================================
async function submitBuatKelas() {
  const nama = document.getElementById('bk-nama').value.trim();
  const mapel = document.getElementById('bk-mapel').value;
  const tahun = document.getElementById('bk-tahun').value.trim() || '2024/2025';
  if (!nama) { toast('Nama kelas harus diisi!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/kelas', { nama, mapel, tahun_ajar: tahun });
    if (data.success) {
      toast(`Kelas "${nama}" berhasil dibuat! Kode: ${data.data?.kode_akses || ''} 🎉`, 'success');
      closeModal('modal-buat-kelas');
      document.getElementById('bk-nama').value = '';
      loadGuruDashboard();
    } else {
      toast(data.pesan || 'Gagal membuat kelas', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

// ============================================================
//  JOIN KELAS (MURID)
// ============================================================
async function submitJoinKelas() {
  const kode = document.getElementById('join-kode').value.trim().toUpperCase();
  if (!kode) { toast('Masukkan kode kelas dulu!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('POST', '/kelas/join', { kode_akses: kode });
    const pesan = data.pesan || '';
    // Anggap sukses juga kalau backend bilang sudah bergabung
    const sudahBergabung = pesan.toLowerCase().includes('sudah') || pesan.toLowerCase().includes('already');
    if (data.success || sudahBergabung) {
      toast(sudahBergabung ? 'Kamu sudah ada di kelas ini! ✅' : 'Berhasil bergabung ke kelas! 🎉', 'success');
      closeModal('modal-join-kelas');
      document.getElementById('join-kode').value = '';
      loadMuridDashboard();
    } else {
      toast(pesan || 'Kode kelas tidak ditemukan', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

// ============================================================
//  DASHBOARD GURU
// ============================================================
// Email akun developer yang boleh lihat error log
const DEV_EMAILS = ['mrromzak@gmail.com'];

async function loadGuruDashboard() {
  showPage('page-guru');
  onGuruPageShown();
  if (!currentUser) return;

  // Tampilkan tombol error log hanya untuk developer
  const btnLog = document.getElementById('btn-error-log');
  if (btnLog) btnLog.style.display = DEV_EMAILS.includes(currentUser.email) ? 'inline-block' : 'none';

  document.getElementById('guru-nav-name').textContent = currentUser.nama.split(' ')[0];
  syncAvatarUI(currentUser.avatar || '👩‍🏫', 'guru');

  showLoading(true);
  try {
    const [dashData, kelasData] = await Promise.all([
      api('GET', '/dashboard'),
      api('GET', '/kelas').catch(() => ({}))
    ]);

    if (dashData.success) {
      const s = dashData.data?.stats || {};
      document.getElementById('stat-murid').textContent = s.total_murid ?? '–';
      document.getElementById('stat-materi').textContent = s.total_materi ?? '–';
      document.getElementById('stat-soal').textContent = s.total_soal ?? '–';
      document.getElementById('stat-nilai').textContent = s.rata_rata_nilai != null ? s.rata_rata_nilai + '%' : '–%';
      document.getElementById('guru-info').textContent = `${s.total_murid || 0} murid aktif · ${s.total_materi || 0} materi`;
    }

    const grid = document.getElementById('guru-kelas-grid');
    const list = kelasData.kelas || kelasData.data || kelasData.list || dashData.kelas || [];
    window._kelasList = list;
    if (list.length > 0) {
      grid.innerHTML = list.map((k, i) => renderKelasCard(k, i, 'guru')).join('');
    } else {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🏫</div><p>Belum ada kelas. Klik <strong>Buat Kelas</strong> untuk mulai!</p></div>';
    }
  } catch(e) {
    toast('Gagal memuat data dashboard', 'error');
  }
  showLoading(false);

  populateMapelSelects();
  renderGuruMapelPanel();
  populateBuatKelasMapel();
  loadGuruSoalPreview();
  loadPenilaian();
}

function renderQuizPenilaianCard(q) {
  const tipeLabel = q.tipe === 'pr' ? '📝 PR' : '🎮 Fun Quiz';
  const headerGrad = q.tipe === 'pr'
    ? 'linear-gradient(135deg,#7C3AED,#A78BFA)'
    : 'linear-gradient(135deg,#4D96FF,#6AADFF)';
  const deadlineInfo = q.deadline
    ? `<div style="font-size:11px;color:rgba(255,255,255,0.8)">⏰ Deadline: ${new Date(q.deadline).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</div>`
    : '';
  const totalMurid = q.total_murid || 0;
  const sudah = q.total_pengerjaan || 0;
  const progressPct = totalMurid > 0 ? Math.round((sudah / totalMurid) * 100) : 0;
  const belum = q.belum_mengerjakan || [];

  return `
    <div style="margin-bottom:16px;border:2px solid #eee;border-radius:16px;overflow:hidden">
      <div style="background:${headerGrad};padding:14px 18px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="background:rgba(255,255,255,0.25);color:white;font-size:10px;font-weight:800;padding:2px 8px;border-radius:50px">${tipeLabel}</span>
            </div>
            <div style="font-weight:800;font-size:15px;color:white;margin-bottom:2px">${q.judul}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.8)">${q.mapel}</div>
            ${deadlineInfo}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:26px;font-weight:900;color:white;line-height:1">${q.rata_rata !== null ? q.rata_rata : '–'}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.8);margin-bottom:6px">Rata-rata</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.9);font-weight:700">${sudah}${totalMurid > 0 ? '/' + totalMurid : ''} murid</div>
          </div>
        </div>
        ${totalMurid > 0 ? `
        <div style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,0.75);font-weight:700;margin-bottom:4px">
            <span>Progress pengerjaan</span><span>${progressPct}%</span>
          </div>
          <div style="background:rgba(255,255,255,0.2);border-radius:50px;height:6px;overflow:hidden">
            <div style="height:100%;width:${progressPct}%;background:white;border-radius:50px;transition:width 0.4s"></div>
          </div>
        </div>` : ''}
      </div>
      ${q.hasil.length > 0 ? `
      <div style="padding:12px 18px">
        <div style="font-size:11px;font-weight:800;color:var(--green);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">✅ Sudah ${q.tipe_submission ? 'Mengumpulkan' : 'Mengerjakan'} (${sudah})</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="color:var(--muted);border-bottom:1px solid #eee">
              <th style="text-align:left;padding:6px 0;font-weight:700">Murid</th>
              <th style="text-align:center;padding:6px 0;font-weight:700">${q.tipe_submission ? 'Nilai' : 'Skor'}</th>
              ${!q.tipe_submission ? `<th style="text-align:center;padding:6px 0;font-weight:700">Benar</th>` : ''}
              <th style="text-align:right;padding:6px 0;font-weight:700">${q.tipe_submission ? 'Dikumpulkan' : 'Waktu'}</th>
            </tr>
          </thead>
          <tbody>
            ${q.hasil.map(h => `
              <tr style="border-bottom:1px solid #f5f5f5">
                <td style="padding:7px 0">
                  <span style="margin-right:6px;display:inline-flex;width:20px;height:20px;border-radius:50%;overflow:hidden;align-items:center;justify-content:center;font-size:14px;vertical-align:middle;background:#eee">${chatAvatarHtml(h.avatar||'🦁')}</span>
                  <span style="font-weight:700">${h.nama}</span>
                </td>
                <td style="text-align:center;padding:7px 0">
                  ${h.skor != null
                    ? `<span style="background:${h.skor >= 80 ? 'var(--green)' : h.skor >= 60 ? '#E6A817' : 'var(--red)'};color:white;padding:3px 10px;border-radius:50px;font-weight:800;font-size:13px">${h.skor}</span>`
                    : `<span style="background:#F5F5F5;color:var(--muted);padding:3px 10px;border-radius:50px;font-weight:700;font-size:12px">Belum dinilai</span>`}
                </td>
                ${!q.tipe_submission ? `<td style="text-align:center;padding:7px 0;color:var(--muted);font-size:12px;font-weight:700">${h.benar != null && h.total_soal ? h.benar + '/' + h.total_soal : '–'}</td>` : ''}
                <td style="text-align:right;padding:7px 0;color:var(--muted);font-size:12px">
                  ${h.waktu_selesai ? new Date(h.waktu_selesai).toLocaleDateString('id-ID', {day:'numeric',month:'short'}) + ' ' + new Date(h.waktu_selesai).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}) : '–'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${belum.length > 0 ? `
        <div style="margin-top:14px;padding-top:12px;border-top:1px dashed #eee">
          <div style="font-size:11px;font-weight:800;color:var(--red);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">⏳ Belum ${q.tipe_submission ? 'Mengumpulkan' : 'Mengerjakan'} (${belum.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${belum.map(m => `<span style="background:#FFF0F0;color:var(--red);border-radius:50px;padding:4px 12px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px"><span style="width:16px;height:16px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${chatAvatarHtml(m.avatar||'🦁')}</span>${m.nama}</span>`).join('')}
          </div>
        </div>` : (totalMurid > 0 ? `<div style="margin-top:10px;padding:8px 12px;background:#F0FFF4;border-radius:10px;font-size:13px;font-weight:700;color:var(--green)">✅ Semua murid sudah ${q.tipe_submission ? 'mengumpulkan' : 'mengerjakan'}!</div>` : '')}
      </div>` : `
      <div style="padding:14px 18px">
        <div style="color:var(--muted);font-size:13px;margin-bottom:${belum.length > 0 ? '10px' : '0'}">Belum ada murid yang ${q.tipe_submission ? 'mengumpulkan' : 'mengerjakan'}.</div>
        ${belum.length > 0 ? `
        <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">⏳ Belum ${q.tipe_submission ? 'Mengumpulkan' : 'Mengerjakan'} (${belum.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${belum.map(m => `<span style="background:#F5F5F5;color:var(--muted);border-radius:50px;padding:4px 12px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px"><span style="width:16px;height:16px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">${chatAvatarHtml(m.avatar||'🦁')}</span>${m.nama}</span>`).join('')}
        </div>` : ''}
      </div>`}
    </div>`;
}

async function loadPenilaianKelas(kelasId) {
  const el = document.getElementById('kelas-penilaian-stream');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:14px">Memuat data penilaian...</div>';
  try {
    const data = await api('GET', `/dashboard/penilaian?kelas_id=${kelasId}`);
    if (!data.success || !data.data || data.data.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px"><div style="font-size:40px;margin-bottom:12px">📊</div><div>Belum ada data penilaian untuk kelas ini.</div><div style="font-size:13px;margin-top:6px">Murid perlu mengerjakan soal terlebih dahulu.</div></div>';
      return;
    }
    const byKelas = data.by_kelas || [];
    const klsData = byKelas[0];
    if (!klsData) { el.innerHTML = data.data.map(q => renderQuizPenilaianCard(q)).join(''); return; }
    const hasFun = klsData.fun_quiz && klsData.fun_quiz.length > 0;
    const hasPR = klsData.pr && klsData.pr.length > 0;
    if (!hasFun && !hasPR) {
      el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px"><div style="font-size:40px;margin-bottom:12px">📊</div><div>Belum ada data penilaian untuk kelas ini.</div></div>';
      return;
    }
    // Hitung rata-rata kelas
    const quizDenganHasil = data.data.filter(q => q.rata_rata !== null);
    const rataKelas = quizDenganHasil.length > 0
      ? Math.round(quizDenganHasil.reduce((s, q) => s + q.rata_rata, 0) / quizDenganHasil.length)
      : null;
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div style="font-size:13px;color:var(--muted);font-weight:700">Total: ${data.data.length} kuis/tugas</div>
        ${rataKelas !== null ? `<div style="background:var(--green);color:white;padding:6px 16px;border-radius:50px;font-weight:800;font-size:14px">Rata-rata: ${rataKelas}</div>` : ''}
      </div>
      ${hasFun ? `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:800;color:#FF6B35;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🎮 Fun Quiz (${klsData.fun_quiz.length})</div>
          ${klsData.fun_quiz.map(q => renderQuizPenilaianCard(q)).join('')}
        </div>` : ''}
      ${hasPR ? `
        <div>
          <div style="font-size:12px;font-weight:800;color:#7C3AED;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">📝 PR / Tugas (${klsData.pr.length})</div>
          ${klsData.pr.map(q => renderQuizPenilaianCard(q)).join('')}
        </div>` : ''}`;
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Gagal memuat data penilaian.</div>';
  }
}

async function loadPenilaian() {
  const el = document.getElementById('guru-penilaian-list');
  if (!el) return;
  try {
    const data = await api('GET', '/dashboard/penilaian');
    if (!data.success || !data.data || data.data.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:14px">Belum ada data penilaian. Murid perlu mengerjakan soal terlebih dahulu.</div>';
      document.getElementById('stat-nilai').textContent = '–%';
      return;
    }

    // Hitung rata-rata keseluruhan
    const quizDenganHasil = data.data.filter(q => q.rata_rata !== null);
    const rataKeseluruhan = quizDenganHasil.length > 0
      ? Math.round(quizDenganHasil.reduce((s, q) => s + q.rata_rata, 0) / quizDenganHasil.length)
      : null;
    document.getElementById('stat-nilai').textContent = rataKeseluruhan !== null ? rataKeseluruhan + '%' : '–%';

    // Tampilkan per kelas, dipisah fun quiz dan PR
    const byKelas = data.by_kelas || [];
    if (byKelas.length === 0) {
      el.innerHTML = data.data.map(q => renderQuizPenilaianCard(q)).join('');
      return;
    }

    el.innerHTML = byKelas.map(kls => {
      const hasFun = kls.fun_quiz && kls.fun_quiz.length > 0;
      const hasPR = kls.pr && kls.pr.length > 0;
      if (!hasFun && !hasPR) return '';
      return `
        <div style="margin-bottom:28px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <div style="width:4px;height:24px;background:var(--blue);border-radius:4px"></div>
            <div>
              <div style="font-weight:800;font-size:16px">${kls.kelas_nama}</div>
              ${kls.kelas_mapel ? `<div style="font-size:12px;color:var(--muted);font-weight:600">📖 ${kls.kelas_mapel}</div>` : ''}
            </div>
          </div>
          ${hasFun ? `
            <div style="margin-bottom:10px">
              <div style="font-size:12px;font-weight:800;color:#FF6B35;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🎮 Fun Quiz (${kls.fun_quiz.length})</div>
              ${kls.fun_quiz.map(q => renderQuizPenilaianCard(q)).join('')}
            </div>` : ''}
          ${hasPR ? `
            <div>
              <div style="font-size:12px;font-weight:800;color:#7C3AED;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">📝 PR / Tugas (${kls.pr.length})</div>
              ${kls.pr.map(q => renderQuizPenilaianCard(q)).join('')}
            </div>` : ''}
        </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Gagal memuat data penilaian.</div>';
  }
}

async function loadGuruSoalPreview() {
  const el = document.getElementById('guru-soal-preview');
  if (!el) return;
  try {
    const data = await api('GET', '/soal');
    const soalList = data.soal || data.data || [];
    if (soalList.length === 0) {
      el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted)">
        <div style="font-size:36px;margin-bottom:8px">📭</div>
        <p style="font-size:13px">Belum ada soal. Klik <strong>＋ Buat Soal</strong> untuk mulai!</p>
      </div>`;
      return;
    }
    // Tampilkan max 5 soal terbaru + tombol lihat semua
    const tampil = soalList.slice(0, 5);
    // Simpan data soal ke cache global agar bisa diakses via ID
    window._soalCache = window._soalCache || {};
    tampil.forEach(s => { window._soalCache[s.id] = s; });
    el.innerHTML = tampil.map(s => {
      const jenis = s.jenis === 'pilihan_ganda' ? '🔵 PG' : s.jenis === 'isian' ? '✍️ Essay' : '✅ B/S';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F5F5F5">
        <div style="font-size:20px">${s.emoji || '❓'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.pertanyaan}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${jenis} · ${s.mapel || '–'} · ${s.poin || 100} poin</div>
        </div>
        <button onclick="editSoalDashboard(window._soalCache['${s.id}'])" title="Edit" style="background:none;border:none;cursor:pointer;font-size:14px;opacity:0.4;flex-shrink:0;padding:4px;transition:opacity 0.2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">✏️</button>
        <button onclick="hapusSoalDashboard('${s.id}', this)" title="Hapus" style="background:none;border:none;cursor:pointer;font-size:14px;opacity:0.35;flex-shrink:0;padding:4px;transition:opacity 0.2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.35'">🗑️</button>
      </div>`;
    }).join('') +
    (soalList.length > 5 ? `<div style="text-align:center;margin-top:12px;font-size:13px;color:var(--muted);font-weight:700">+${soalList.length - 5} soal lainnya · Total <strong>${soalList.length} soal</strong></div>` : `<div style="text-align:right;margin-top:8px;font-size:12px;color:var(--muted)">Total <strong>${soalList.length} soal</strong></div>`);
  } catch(e) {
    if (el) el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--muted);font-size:13px">Gagal memuat soal</div>';
  }
}

async function hapusSoalDashboard(id, btn) {
  if (!confirm('Hapus soal ini?')) return;
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const data = await api('DELETE', `/soal/${id}`);
    if (data.success || data.pesan?.toLowerCase().includes('berhasil')) {
      btn.closest('div[style*="border-bottom"]').remove();
      toast('Soal dihapus! 🗑️', 'success');
      loadGuruSoalPreview();
    } else {
      toast(data.pesan || 'Gagal hapus', 'error');
      btn.disabled = false; btn.textContent = '🗑️';
    }
  } catch(e) { toast('Gagal terhubung', 'error'); btn.disabled = false; btn.textContent = '🗑️'; }
}

function editSoalDashboard(s) {
  // s adalah objek soal lengkap dari loadGuruSoalPreview
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch(e) { return; } }
  const opsi = typeof s.opsi === 'string' ? JSON.parse(s.opsi || '[]') : (s.opsi || []);
  const tipe = s.jenis || 'pilihan_ganda';
  let jawabanIdx = null;
  if (tipe === 'pilihan_ganda') {
    jawabanIdx = opsi.findIndex(o => o === s.jawaban);
    if (jawabanIdx < 0) jawabanIdx = null;
  }
  sbFromKuis = false;
  sbSoalList = [{
    id: Date.now(),
    tipe,
    pertanyaan: s.pertanyaan || '',
    opsi: opsi.length ? opsi : ['', '', '', ''],
    jawabanIdx,
    jawaban: s.jawaban || '',
    mapel: s.mapel || 'Umum',
    poin: s.poin || 100,
    tingkat: s.tingkat || 'sedang',
    dbId: s.id  // existing ID → PUT saat simpan
  }];
  sbAktifIdx = 0;
  sbPopulateMapel();
  document.getElementById('sb-judul-label').textContent = 'Edit Soal';
  showPage('page-soal-builder');
  sbMuatSoal(0);
  sbUpdateCount();
  setTimeout(sbCheckMobile, 50);
}

function populateBuatKelasMapel() {
  const list = getMapelList();
  const el = document.getElementById('bk-mapel');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(m => `<option value="${m.nama}">${m.emoji} ${m.nama}</option>`).join('')
    : '<option value="">– Belum ada mapel –</option>';
}

// ============================================================
//  MATERI HELPERS
// ============================================================
let selectedPdfFile = null;

// ============================================================
//  AI MATERI — PDF, Artikel, YouTube
// ============================================================
// GROQ_API_KEY_MATERI dihapus — semua AI call dilakukan via backend proxy /api/ai/
let aiSumberAktif = null;
let aiPdfFile = null;
let aiHasilMateri = null;
let aiHasilSoal = [];

function pilihSumberAI(tipe) {
  aiSumberAktif = tipe;
  ['pdf','artikel','youtube'].forEach(t => {
    document.getElementById('ai-src-' + t)?.classList.toggle('active', t === tipe);
    const el = document.getElementById('ai-input-' + t);
    if (el) el.style.display = t === tipe ? 'block' : 'none';
  });
}

function handleAIPdfSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('File terlalu besar! Maks 10MB', 'error'); return; }
  aiPdfFile = file;
  document.getElementById('ai-pdf-label').textContent = '✅ ' + file.name;
  document.getElementById('ai-pdf-dropzone').style.borderColor = '#7b2ff7';
}

// Populate mapel select di modal AI
function populateAIMapel() {
  const list = getMapelList();
  const el = document.getElementById('ai-m-mapel');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map(m => `<option value="${m.nama}">${m.emoji} ${m.nama}</option>`).join('')
    : '<option value="Umum">📚 Umum</option>';
}

function setAIStatus(msg, pct) {
  document.getElementById('ai-proses-status').textContent = msg;
  document.getElementById('ai-proses-bar').style.width = pct + '%';
}

async function prosesAIMateri() {
  if (!aiSumberAktif) { toast('Pilih sumber materi dulu!', 'error'); return; }

  const mapel = document.getElementById('ai-m-mapel').value || 'Umum';
  const target = document.getElementById('ai-m-target').value;
  const genSoal = document.getElementById('ai-gen-kuis-check').checked;
  const jumlahSoal = document.getElementById('ai-jumlah-soal').value;

  document.getElementById('ai-materi-step1').style.display = 'none';
  document.getElementById('ai-materi-step2').style.display = 'block';
  document.getElementById('ai-hasil-preview').style.display = 'none';

  let kontenSumber = '';
  let judulSumber = '';

  try {
    // ── 1. Ambil konten sumber ──────────────────────────────
    if (aiSumberAktif === 'pdf') {
      if (!aiPdfFile) { toast('Pilih file PDF dulu!', 'error'); aiMateriReset(); return; }
      setAIStatus('Membaca file PDF...', 20);
      kontenSumber = await bacaPDF(aiPdfFile);
      judulSumber = aiPdfFile.name.replace('.pdf','');

    } else if (aiSumberAktif === 'artikel') {
      const url = document.getElementById('ai-artikel-url').value.trim();
      if (!url) { toast('Masukkan URL artikel!', 'error'); aiMateriReset(); return; }
      setAIStatus('Mengambil konten artikel...', 20);
      kontenSumber = await fetchArtikel(url);
      judulSumber = url;

    } else if (aiSumberAktif === 'youtube') {
      const url = document.getElementById('ai-youtube-url').value.trim();
      if (!url) { toast('Masukkan URL video YouTube!', 'error'); aiMateriReset(); return; }
      setAIStatus('Mengambil transkrip YouTube...', 20);
      const videoIdMatch = url.match(/(?:v=|youtu\.be\/)([^&?]+)/);
      const videoId = videoIdMatch?.[1];
      if (!videoId) { toast('URL YouTube tidak valid!', 'error'); aiMateriReset(); return; }
      try {
        const res = await fetch(`${API}/proxy/youtube-transcript?videoId=${videoId}`);
        const data = await res.json();
        if (data.success && data.transcript) {
          kontenSumber = data.transcript;
        } else {
          toast('Transkrip tidak tersedia untuk video ini. Coba video lain.', 'error');
          aiMateriReset(); return;
        }
      } catch(e) {
        toast('Gagal mengambil transkrip YouTube.', 'error');
        aiMateriReset(); return;
      }
      judulSumber = url;

    }

    if (!kontenSumber || kontenSumber.length < 50) {
      toast('Konten sumber terlalu pendek atau gagal diambil', 'error');
      aiMateriReset(); return;
    }

    // Potong konten jika terlalu panjang (Groq limit)
    if (kontenSumber.length > 8000) kontenSumber = kontenSumber.substring(0, 8000) + '...';

    // ── 2. Generate materi dengan AI ───────────────────────
    setAIStatus('AI sedang membuat materi...', 50);

    const resMateri = await fetch(`${API}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        max_tokens: 1500,
        messages: [{
          role: 'system',
          content: `Kamu adalah guru ${mapel} berpengalaman yang ahli membuat materi pelajaran menarik dan mudah dipahami untuk siswa Indonesia.
Tugas kamu: ubah sumber menjadi materi pembelajaran yang engaging, sistematis, dan memotivasi siswa untuk belajar lebih dalam.
Gunakan analogi, contoh nyata dari kehidupan sehari-hari, dan bahasa yang ramah untuk usia ${target}.`
        }, {
          role: 'user',
          content: `Buat materi pelajaran ${mapel} yang menarik untuk siswa ${target} dari sumber berikut:

SUMBER:
${kontenSumber}

Gunakan format ini PERSIS:
## [Judul Kreatif & Menarik yang Menggugah Rasa Ingin Tahu]

**🎯 Yang Akan Kamu Pelajari:**
- [Tujuan 1 — spesifik dan terukur]
- [Tujuan 2]
- [Tujuan 3]

**📖 Penjelasan Lengkap:**
[3-5 paragraf penjelasan mendalam. Gunakan sub-judul ### jika perlu. Sertakan contoh nyata, analogi menarik, dan hubungan dengan kehidupan sehari-hari siswa ${target}.]

**💡 Poin-Poin Kunci:**
- [Poin penting 1]
- [Poin penting 2]
- [Poin penting 3]
- [Poin penting 4]

**🤩 Tahukah Kamu?**
[1-2 fakta mengejutkan atau menarik yang bikin siswa penasaran dan ingin tahu lebih]

**🔗 Hubungan dengan Kehidupan Nyata:**
[Jelaskan 1-2 contoh konkret bagaimana materi ini berguna di kehidupan sehari-hari]

Tulis dalam Bahasa Indonesia yang hidup, hangat, dan mudah dipahami siswa ${target}.`
        }]
      })
    });
    const resMateriJson = await resMateri.json();
    if (!resMateriJson.success) throw new Error(resMateriJson.pesan || 'AI error');
    const materiTeks = resMateriJson.data?.choices?.[0]?.message?.content || '';

    // Ekstrak judul dari hasil AI
    const judulMatch = materiTeks.match(/##\s+(.+)/);
    const judulFinal = judulMatch ? judulMatch[1].trim() : judulSumber;
    const kontenFinal = materiTeks.replace(/##\s+.+\n/, '').trim();

    aiHasilMateri = { judul: judulFinal, konten: kontenFinal, mapel };

    // ── 3. Generate soal (opsional) ────────────────────────
    if (genSoal) {
      setAIStatus('Membuat soal latihan...', 75);
      try {
        const resSoal = await fetch(`${API}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            max_tokens: 1600,
            messages: [{
              role: 'system',
              content: `Kamu ahli pembuat soal ujian profesional untuk siswa Indonesia.
Aturan KETAT:
1. Balas HANYA JSON object: {"soal":[...]} tanpa teks lain.
2. Buat CAMPURAN tipe: sekitar 70% pilihan_ganda, 30% benar_salah.
3. Untuk pilihan_ganda: field "jawaban" HARUS teks PERSIS SAMA dengan salah satu item di "opsi".
4. Untuk benar_salah: "opsi" HARUS ["Benar","Salah"], "jawaban" HARUS "Benar" atau "Salah".
5. Semua opsi pilihan ganda harus masuk akal, bukan jawaban yang terlalu jelas salah.
6. Verifikasi sendiri: pastikan jawaban yang dipilih BENAR secara fakta.`
            }, {
              role: 'user',
              content: `Buat ${jumlahSoal} soal untuk materi berikut, tingkat ${target}:

${kontenFinal.substring(0, 3000)}

Format JSON (campur pilihan_ganda dan benar_salah):
{"soal":[
  {"jenis":"pilihan_ganda","pertanyaan":"...?","emoji":"📚","opsi":["A lengkap","B lengkap","C lengkap","D lengkap"],"jawaban":"teks persis sama dgn opsi","poin":100},
  {"jenis":"benar_salah","pertanyaan":"Pernyataan yang bisa benar atau salah...","emoji":"✅","opsi":["Benar","Salah"],"jawaban":"Benar","poin":75}
]}`
            }],
            response_format: { type: 'json_object' }
          })
        });
        const dataSoalJson = await resSoal.json();
        let rawContent = dataSoalJson.data?.choices?.[0]?.message?.content || '{}';
        // Bersihkan markdown code block jika AI membalut JSON dengan ```json ... ```
        rawContent = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        const rawSoal = JSON.parse(rawContent);
        aiHasilSoal = (rawSoal.soal || rawSoal.questions || []).map(s => {
          if (s.jenis === 'benar_salah') {
            s.opsi = ['Benar', 'Salah'];
            if (!['Benar','Salah'].includes(s.jawaban)) s.jawaban = 'Benar';
          } else {
            s.jenis = 'pilihan_ganda';
            const cocok = (s.opsi||[]).find(o => o.trim().toLowerCase() === s.jawaban?.trim().toLowerCase());
            s.jawaban = cocok || s.opsi?.[0] || '';
          }
          return s;
        }).filter(s => s.pertanyaan && s.opsi?.length >= 2);
      } catch(e) {
        aiHasilSoal = [];
        console.warn('Gagal generate soal:', e);
      }
    } else {
      aiHasilSoal = [];
    }

    // ── 4. Tampilkan hasil ─────────────────────────────────
    setAIStatus('Selesai! ✅', 100);
    document.getElementById('ai-hasil-judul').value = judulFinal;
    document.getElementById('ai-hasil-konten').value = kontenFinal;

    if (aiHasilSoal.length > 0) {
      const preview = aiHasilSoal.map((s,i) => {
        const label = s.jenis === 'benar_salah' ? '[B/S]' : '[PG]';
        const opsiStr = s.jenis === 'benar_salah' ? '   Benar / Salah' : `   A.${s.opsi[0]}  B.${s.opsi[1]}  C.${s.opsi[2]}  D.${s.opsi[3]}`;
        return `${i+1}. ${label} ${s.emoji} ${s.pertanyaan}\n${opsiStr}\n   ✅ ${s.jawaban}`;
      }).join('\n\n');
      document.getElementById('ai-soal-hasil-list').textContent = preview;
      document.getElementById('ai-soal-hasil-wrap').style.display = 'block';
    }

    setTimeout(() => {
      document.getElementById('ai-hasil-preview').style.display = 'block';
    }, 500);

  } catch(e) {
    if (e.message !== 'STOP') {
      toast('Error: ' + e.message, 'error');
      console.error(e);
      aiMateriReset();
    }
  }
}

// ── Baca PDF di browser dengan pdf.js ──────────────────────
async function bacaPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Load pdf.js dari CDN kalau belum ada
        if (!window.pdfjsLib) {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const pdf = await window.pdfjsLib.getDocument({ data: e.target.result }).promise;
        let teks = '';
        const maxHalaman = Math.min(pdf.numPages, 15); // max 15 halaman
        for (let i = 1; i <= maxHalaman; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          teks += content.items.map(item => item.str).join(' ') + '\n';
        }
        resolve(teks.trim());
      } catch(err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Fetch artikel via proxy backend ────────────────────────
async function fetchArtikel(url) {
  try {
    const token = localStorage.getItem('kb_token');
    const res = await fetch(`${API}/proxy/fetch?url=${encodeURIComponent(url)}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const data = await res.json();
    if (data.success) return data.teks;
    throw new Error(data.pesan || 'Gagal fetch artikel');
  } catch(e) {
    throw new Error('Gagal mengambil artikel. Pastikan URL dari domain yang diizinkan (Wikipedia, Kemdikbud, dll).');
  }
}

// ── Ambil info YouTube via oEmbed ───────────────────────────

// ── Simpan hasil AI ke database ─────────────────────────────
async function simpanAIMateri() {
  const judul = document.getElementById('ai-hasil-judul').value.trim();
  const konten = document.getElementById('ai-hasil-konten').value.trim();
  const mapel = aiHasilMateri?.mapel || document.getElementById('ai-m-mapel').value;
  const kelasId = document.getElementById('m-kelas-id').value;

  if (!judul || !konten) { toast('Judul dan konten tidak boleh kosong!', 'error'); return; }

  showLoading(true);
  try {
    // Simpan materi
    const dataMateri = await api('POST', '/materi', {
      judul, mapel, jenis: 'teks', konten,
      deskripsi: konten.substring(0, 200),
      status: 'aktif',
      kelas_id: kelasId || undefined
    });

    if (!dataMateri.success) throw new Error(dataMateri.pesan || 'Gagal simpan materi');

    // Simpan soal kalau ada
    let soalBerhasil = 0;
    for (const s of aiHasilSoal) {
      try {
        const r = await api('POST', '/soal', {
          pertanyaan: s.pertanyaan, emoji: s.emoji || '❓',
          mapel, jenis: 'pilihan_ganda',
          opsi: JSON.stringify(s.opsi), jawaban: s.jawaban,
          poin: s.poin || 100, tingkat: 'sedang'
        });
        if (r.success) soalBerhasil++;
      } catch(e) {}
    }

    toast(`✅ Materi berhasil disimpan!${soalBerhasil > 0 ? ` + ${soalBerhasil} soal ke bank soal` : ''}`, 'success');
    closeModal('modal-ai-materi');
    aiMateriReset();
    if (currentKelas) await loadKelasStream(currentKelas.id);
    else loadGuruDashboard();
  } catch(e) {
    toast('Gagal menyimpan: ' + e.message, 'error');
  }
  showLoading(false);
}

function aiMateriReset() {
  aiSumberAktif = null;
  aiPdfFile = null;
  aiHasilMateri = null;
  aiHasilSoal = [];
  const step1 = document.getElementById('ai-materi-step1');
  const step2 = document.getElementById('ai-materi-step2');
  const hasilPreview = document.getElementById('ai-hasil-preview');
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
  if (hasilPreview) hasilPreview.style.display = 'none';
  ['pdf','artikel','youtube'].forEach(t => {
    document.getElementById('ai-src-' + t)?.classList.remove('active');
    const el = document.getElementById('ai-input-' + t);
    if (el) el.style.display = 'none';
  });
  const pdfLabel = document.getElementById('ai-pdf-label');
  const pdfZone  = document.getElementById('ai-pdf-dropzone');
  const artUrl   = document.getElementById('ai-artikel-url');
  const soalWrap = document.getElementById('ai-soal-hasil-wrap');
  if (pdfLabel) pdfLabel.textContent = 'Klik untuk pilih file PDF';
  if (pdfZone)  pdfZone.style.borderColor = '#D8BBFF';
  if (artUrl)   artUrl.value = '';
  if (soalWrap) soalWrap.style.display = 'none';
  try { setAIStatus('Membaca sumber...', 10); } catch(e) {}
}

// Helper: load script dinamis
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Patch openTambahMateriKelas untuk populate AI mapel juga
const _origOpenTambahMateriKelas = window.openTambahMateriKelas;

// Buka modal AI materi langsung
function openAIMateriModal() {
  populateAIMapel();
  aiMateriReset();
  openModal('modal-ai-materi');
}

function toggleMateriInput() {
  const jenis = document.getElementById('m-jenis').value;
  document.getElementById('input-teks').style.display   = jenis === 'teks'   ? 'block' : 'none';
  document.getElementById('input-video').style.display  = jenis === 'video'  ? 'block' : 'none';
  document.getElementById('input-pdf').style.display    = jenis === 'pdf'    ? 'block' : 'none';
  document.getElementById('input-gambar').style.display = jenis === 'gambar' ? 'block' : 'none';
}

function handlePdfSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('File terlalu besar! Maksimal 10MB', 'error'); return; }
  selectedPdfFile = file;
  document.getElementById('pdf-label').textContent = '✅ ' + file.name;
  document.getElementById('pdf-dropzone').style.borderColor = 'var(--green)';
}

function setUploadProgress(pct, label) {
  document.getElementById('upload-progress').style.display = pct < 100 ? 'block' : 'none';
  document.getElementById('upload-bar').style.width = pct + '%';
  document.getElementById('upload-label').textContent = label;
}

// ============================================================
//  SUBMIT MATERI (GURU)
// ============================================================
async function submitMateri() {
  const judul = document.getElementById('m-judul').value.trim();
  const mapel = document.getElementById('m-mapel').value;
  const jenis = document.getElementById('m-jenis').value;
  const deskripsi = document.getElementById('m-deskripsi').value.trim();
  if (!judul) { toast('Judul materi harus diisi!', 'error'); return; }

  showLoading(true);
  document.getElementById('btn-simpan-materi').disabled = true;

  try {
    let konten = '';
    let file_url = '';

    if (jenis === 'teks') {
      konten = document.getElementById('m-konten').value.trim();
      if (!konten) { toast('Isi materi harus diisi!', 'error'); showLoading(false); document.getElementById('btn-simpan-materi').disabled = false; return; }

    } else if (jenis === 'video') {
      const url = document.getElementById('m-video-url').value.trim();
      if (!url) { toast('URL video harus diisi!', 'error'); showLoading(false); document.getElementById('btn-simpan-materi').disabled = false; return; }
      // Convert YouTube URL to embed
      konten = convertYoutubeUrl(url);
      file_url = url;

    } else if (jenis === 'pdf') {
      if (!selectedPdfFile) { toast('Pilih file PDF dulu!', 'error'); showLoading(false); document.getElementById('btn-simpan-materi').disabled = false; return; }
      // Upload PDF ke Supabase Storage via backend
      setUploadProgress(30, 'Mengupload PDF...');
      const formData = new FormData();
      formData.append('file', selectedPdfFile);
      formData.append('judul', judul);
      formData.append('mapel', mapel);
      formData.append('jenis', jenis);
      formData.append('deskripsi', deskripsi);
      formData.append('status', 'aktif');
      const kelasIdVal = document.getElementById('m-kelas-id').value;
      if (kelasIdVal) formData.append('kelas_id', kelasIdVal);

      const res = await fetch(`${API}/materi/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      setUploadProgress(90, 'Menyimpan...');
      const data = await res.json();
      setUploadProgress(100, 'Selesai!');

      if (data.success) {
        toast('PDF berhasil diupload! 📄', 'success');
        resetMateriForm();
        closeModal('modal-materi');
        loadGuruDashboard();
      } else {
        toast(data.pesan || 'Gagal upload PDF', 'error');
      }
      showLoading(false);
      document.getElementById('btn-simpan-materi').disabled = false;
      return;

    } else if (jenis === 'gambar') {
      file_url = document.getElementById('m-gambar-url').value.trim();
      konten = file_url;
      if (!file_url) { toast('URL gambar harus diisi!', 'error'); showLoading(false); document.getElementById('btn-simpan-materi').disabled = false; return; }
    }

    const data = await api('POST', '/materi', { judul, mapel, jenis, konten, file_url, deskripsi: deskripsi || konten, status: 'aktif', kelas_id: document.getElementById('m-kelas-id').value || undefined });
    if (data.success) {
      toast('Materi berhasil ditambahkan! 📚', 'success');
      resetMateriForm();
      closeModal('modal-materi');
      // Refresh: kalau di dalam kelas detail, reload stream-nya
      if (currentKelas) {
        await loadKelasStream(currentKelas.id);
      } else {
        loadGuruDashboard();
      }
    } else {
      toast(data.pesan || 'Gagal menyimpan materi', 'error');
    }
  } catch (e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
  document.getElementById('btn-simpan-materi').disabled = false;
}

// ── YouTube: klik thumbnail → load iframe langsung ──
function ytPlayClick(id, embedUrl, watchUrl) {
  const wrap = document.getElementById('yt-wrap-' + id);
  if (!wrap) return;
  wrap.onclick = null;
  wrap.style.cursor = 'default';
  wrap.innerHTML = `
    <iframe src="${embedUrl}"
      style="position:absolute;top:0;left:0;width:100%;height:100%;border:none"
      allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
}


function convertYoutubeUrl(url) {
  // Convert berbagai format YouTube URL ke embed
  let videoId = '';
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) { videoId = m[1]; break; }
  }
  if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  return url;
}

function resetMateriForm() {
  document.getElementById('m-judul').value = '';
  document.getElementById('m-konten').value = '';
  document.getElementById('m-deskripsi').value = '';
  document.getElementById('m-video-url').value = '';
  document.getElementById('m-gambar-url').value = '';
  document.getElementById('m-jenis').value = 'teks';
  document.getElementById('m-pdf-file').value = '';
  document.getElementById('pdf-label').textContent = 'Klik untuk pilih file PDF';
  document.getElementById('pdf-dropzone').style.borderColor = '#ddd';
  document.getElementById('upload-progress').style.display = 'none';
  selectedPdfFile = null;
  toggleMateriInput();
}

// ============================================================
//  SOAL HELPERS
// ============================================================
let currentTipeSoal = 'pilihan_ganda';
let selectedBS = '';

function switchTipeSoal(tipe) {
  currentTipeSoal = tipe;
  // Reset semua tipe card
  ['pg','essay','bs'].forEach(t => {
    const el = document.getElementById('tipe-' + t);
    el.style.border = '2.5px solid #eee';
    el.style.background = 'white';
    el.querySelector('div:last-child').style.color = 'var(--muted)';
  });
  // Highlight yang dipilih
  const map = { pilihan_ganda: 'pg', essay: 'essay', benar_salah: 'bs' };
  const active = document.getElementById('tipe-' + map[tipe]);
  active.style.border = '2.5px solid var(--orange)';
  active.style.background = '#FFF3E8';
  active.querySelector('div:last-child').style.color = 'var(--orange)';
  // Show/hide section
  document.getElementById('soal-pg-section').style.display    = tipe === 'pilihan_ganda' ? 'block' : 'none';
  document.getElementById('soal-essay-section').style.display = tipe === 'essay'         ? 'block' : 'none';
  document.getElementById('soal-bs-section').style.display    = tipe === 'benar_salah'   ? 'block' : 'none';
}

function selectBS(val) {
  selectedBS = val;
  document.getElementById('s-jawaban-bs').value = val;
  document.getElementById('bs-benar').style.border = val === 'Benar' ? '2.5px solid var(--green)' : '2.5px solid #eee';
  document.getElementById('bs-benar').style.background = val === 'Benar' ? '#F0FFF4' : 'white';
  document.getElementById('bs-salah').style.border = val === 'Salah' ? '2.5px solid var(--red)' : '2.5px solid #eee';
  document.getElementById('bs-salah').style.background = val === 'Salah' ? '#FFF0F0' : 'white';
}

function resetSoalForm() {
  document.getElementById('s-pertanyaan').value = '';
  document.getElementById('s-emoji').value = '❓';
  document.getElementById('s-poin').value = '100';
  document.getElementById('s-jawaban-essay').value = '';
  document.getElementById('s-jawaban-bs').value = '';
  selectedBS = '';
  switchTipeSoal('pilihan_ganda');
  selectBS('');

  // Reset opsi ke 4 pilihan default
  const list = document.getElementById('opsi-list');
  list.innerHTML = '';
  const defaultColors = ['var(--blue)','var(--green)','var(--orange)','var(--purple)'];
  ['A','B','C','D'].forEach((h, i) => {
    const showHapus = i >= 2; // A dan B tidak bisa dihapus (min 2)
    const div = document.createElement('div');
    div.className = 'opsi-row';
    div.style.cssText = 'display:flex;align-items:center;gap:8px';
    div.innerHTML = `
      <div class="opsi-label" style="width:28px;height:28px;border-radius:50%;background:${defaultColors[i]};color:white;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${h}</div>
      <input type="text" class="opsi-input" placeholder="Pilihan ${h}" style="flex:1;padding:10px 12px;border:2px solid #eee;border-radius:10px;font-family:Nunito,sans-serif;font-size:14px;outline:none" oninput="updateJawabanPG()">
      <button onclick="hapusOpsi(this)" style="background:none;border:none;cursor:pointer;font-size:16px;opacity:0.4;padding:4px;${showHapus ? '' : 'display:none'}" title="Hapus pilihan">✕</button>
    `;
    list.appendChild(div);
  });
  document.getElementById('btn-tambah-opsi').style.display = '';
  updateJawabanPG();
}

// ============================================================
//  SUBMIT SOAL (GURU)
// ============================================================
// ============================================================
//  OPSI DINAMIS (tambah/hapus pilihan jawaban)
// ============================================================
const OPSI_COLORS = ['var(--blue)','var(--green)','var(--orange)','var(--purple)','#FF6B9D','#00CEC9'];
const OPSI_HURUF  = ['A','B','C','D','E','F'];

function tambahOpsi() {
  const list = document.getElementById('opsi-list');
  const rows = list.querySelectorAll('.opsi-row');
  if (rows.length >= 6) { toast('Maksimal 6 pilihan jawaban!', 'error'); return; }

  const idx = rows.length;
  const huruf = OPSI_HURUF[idx];
  const warna = OPSI_COLORS[idx];

  const div = document.createElement('div');
  div.className = 'opsi-row';
  div.style.cssText = 'display:flex;align-items:center;gap:8px';
  div.innerHTML = `
    <div class="opsi-label" style="width:28px;height:28px;border-radius:50%;background:${warna};color:white;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${huruf}</div>
    <input type="text" class="opsi-input" placeholder="Pilihan ${huruf}" style="flex:1;padding:10px 12px;border:2px solid #eee;border-radius:10px;font-family:Nunito,sans-serif;font-size:14px;outline:none" oninput="updateJawabanPG()">
    <button onclick="hapusOpsi(this)" style="background:none;border:none;cursor:pointer;font-size:16px;opacity:0.4;padding:4px;transition:opacity 0.2s" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'" title="Hapus pilihan">✕</button>
  `;
  list.appendChild(div);

  // Sembunyikan tombol tambah jika sudah 6
  if (rows.length + 1 >= 6) document.getElementById('btn-tambah-opsi').style.display = 'none';

  // Tampilkan tombol hapus di semua row (min harus selalu 2)
  updateHapusBtnVisibility();
  updateJawabanPG();
}

function hapusOpsi(btn) {
  const list = document.getElementById('opsi-list');
  const rows = list.querySelectorAll('.opsi-row');
  if (rows.length <= 2) { toast('Minimal 2 pilihan jawaban!', 'error'); return; }

  btn.closest('.opsi-row').remove();
  updateOpsiLabels();
  updateJawabanPG();
  updateHapusBtnVisibility();
  // Tampilkan kembali tombol tambah
  document.getElementById('btn-tambah-opsi').style.display = '';
}

function updateOpsiLabels() {
  const rows = document.querySelectorAll('#opsi-list .opsi-row');
  rows.forEach((row, i) => {
    const label = row.querySelector('.opsi-label');
    const input = row.querySelector('.opsi-input');
    if (label) { label.textContent = OPSI_HURUF[i]; label.style.background = OPSI_COLORS[i]; }
    if (input) input.placeholder = `Pilihan ${OPSI_HURUF[i]}`;
  });
}

function updateHapusBtnVisibility() {
  const rows = document.querySelectorAll('#opsi-list .opsi-row');
  rows.forEach((row, i) => {
    const btn = row.querySelector('button');
    if (btn) btn.style.display = rows.length > 2 ? '' : 'none';
  });
}

function updateJawabanPG() {
  const inputs = document.querySelectorAll('#opsi-list .opsi-input');
  const select = document.getElementById('s-jawaban-pg');
  if (!select) return;
  const prev = select.value;
  select.innerHTML = '<option value="">-- Pilih jawaban yang benar --</option>';
  inputs.forEach((inp, i) => {
    const teks = inp.value.trim() || OPSI_HURUF[i];
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${OPSI_HURUF[i]}. ${teks}`;
    select.appendChild(opt);
  });
  // Restore pilihan sebelumnya jika masih valid
  if (prev !== '' && prev < inputs.length) select.value = prev;
}

// ============================================================
//  SOAL BUILDER (Zep-style)
// ============================================================
let sbSoalList = [];       // [{id, tipe, pertanyaan, opsi, jawaban, mapel, poin, tingkat, dbId}]
let sbAktifIdx = 0;        // index soal yang sedang diedit
let sbFromKuis  = false;   // dibuka dari modal buat kuis?
const SB_OPSI_COLORS = ['#4D96FF','#6BCB77','#FF6B35','#C77DFF','#FF6B9D','#00CEC9'];
const SB_HURUF = ['A','B','C','D','E','F'];

function bukaSoalBuilder(fromKuis = false) {
  sbFromKuis = fromKuis;
  sbSoalList = [];
  sbAktifIdx = 0;
  sbTambahSoal('pilihan_ganda', false);
  sbPopulateMapel();
  document.getElementById('sb-judul-label').textContent = fromKuis ? 'Tambah Soal ke Kuis' : 'Bank Soal';
  showPage('page-soal-builder');
  setTimeout(sbCheckMobile, 50);
}

function tutupSoalBuilder() {
  sbSoalList = [];
  sbAktifIdx = 0;
  if (sbFromKuis) {
    sbFromKuis = false;
    showPage('page-kelas');
    setTimeout(() => {
      openModal('modal-buat-kuis');
      loadBankSoal();
      switchKuisSoalTab('bank');
    }, 100);
  } else {
    sbFromKuis = false;
    showPage('page-guru');
    loadGuruSoalPreview();
  }
}

async function tutupSoalBuilderDenganKonfirmasi() {
  sbSimpanStateAktif();
  const adaSoalBelumSimpan = sbSoalList.some(s => s.pertanyaan.trim() && !s.dbId);
  if (adaSoalBelumSimpan) {
    // Gunakan custom confirm karena lebih jelas
    const pilih = confirm(`Ada ${sbSoalList.filter(s=>s.pertanyaan.trim()&&!s.dbId).length} soal belum disimpan.\n\nOK = Simpan & Keluar\nBatal = Keluar tanpa simpan`);
    if (pilih) {
      await sbSimpanSemua();
      return;
    }
  }
  tutupSoalBuilder();
}

function sbPopulateMapel() {
  const list = getMapelList();
  const sel = document.getElementById('sb-mapel');
  if (!sel) return;
  sel.innerHTML = list.length
    ? list.map(m => `<option value="${m.nama}">${m.emoji} ${m.nama}</option>`).join('')
    : '<option value="Umum">📚 Umum</option>';
  if (currentKelas?.mapel) {
    for (let o of sel.options) if (o.value === currentKelas.mapel) { o.selected = true; break; }
  }
}

function sbTambahSoal(tipe = 'pilihan_ganda', navigasi = true) {
  // Simpan state soal aktif dulu sebelum tambah
  if (sbSoalList.length > 0) sbSimpanStateAktif();

  const soal = {
    id: Date.now() + Math.random(),
    tipe,
    pertanyaan: '',
    opsi: tipe === 'pilihan_ganda' ? ['', '', '', ''] : [],
    jawabanIdx: null,
    jawaban: '',
    mapel: document.getElementById('sb-mapel')?.value || 'Umum',
    poin: 100,
    tingkat: 'sedang',
    dbId: null
  };
  sbSoalList.push(soal);
  sbAktifIdx = sbSoalList.length - 1;
  sbRenderSidebar();
  if (navigasi) {
    sbMuatSoal(sbAktifIdx);
    // Tutup sidebar otomatis di mobile setelah tambah soal baru
    if (window.innerWidth <= 640) {
      const sidebar = document.getElementById('sb-sidebar');
      const overlay = document.getElementById('sb-overlay');
      if (sidebar) sidebar.classList.remove('sb-sidebar-open');
      if (overlay) overlay.style.display = 'none';
    }
  }
  sbUpdateCount();
}

function sbSimpanStateAktif() {
  const s = sbSoalList[sbAktifIdx];
  if (!s) return;
  s.pertanyaan = document.getElementById('sb-pertanyaan')?.value || '';
  s.tipe = document.getElementById('sb-tipe-soal')?.value || 'pilihan_ganda';
  s.mapel = document.getElementById('sb-mapel')?.value || 'Umum';
  s.poin = parseInt(document.getElementById('sb-poin')?.value) || 100;
  s.tingkat = document.getElementById('sb-tingkat')?.value || 'sedang';

  if (s.tipe === 'pilihan_ganda') {
    s.opsi = Array.from(document.querySelectorAll('.sb-opsi-input')).map(i => i.value.trim());
    // Cari radio yang dicentang
    let idx = -1;
    document.querySelectorAll('input[name="sb-jawaban"]').forEach((r, i) => {
      if (r.checked) idx = i;
    });
    s.jawabanIdx = idx;
    s.jawaban = idx >= 0 && s.opsi[idx] ? s.opsi[idx] : '';
  } else if (s.tipe === 'isian') {
    s.jawaban = document.getElementById('sb-jawaban-isian')?.value || '';
  } else if (s.tipe === 'benar_salah') {
    s.jawaban = document.getElementById('sb-jawaban-bs')?.value || '';
    s.opsi = ['Benar', 'Salah'];
  }
}

function sbMuatSoal(idx) {
  sbAktifIdx = idx;
  const s = sbSoalList[idx];
  if (!s) return;

  document.getElementById('sb-pertanyaan').value = s.pertanyaan;
  document.getElementById('sb-soal-nomor').textContent = `#${idx + 1}`;
  document.getElementById('sb-tipe-soal').value = s.tipe;
  document.getElementById('sb-poin').value = s.poin;
  document.getElementById('sb-tingkat').value = s.tingkat;

  // Set mapel
  sbPopulateMapel();
  const mapelSel = document.getElementById('sb-mapel');
  if (mapelSel && s.mapel) {
    for (let o of mapelSel.options) if (o.value === s.mapel) { o.selected = true; break; }
  }

  sbGantiTipe(s.tipe, s);
  sbRenderSidebar();
  document.getElementById('sb-pertanyaan').focus();
}

function sbGantiTipe(tipe, soalData = null) {
  document.getElementById('sb-tipe-soal').value = tipe;
  document.getElementById('sb-pg-section').style.display   = tipe === 'pilihan_ganda' ? '' : 'none';
  document.getElementById('sb-isian-section').style.display = tipe === 'isian' ? '' : 'none';
  document.getElementById('sb-bs-section').style.display   = tipe === 'benar_salah' ? '' : 'none';

  if (tipe === 'pilihan_ganda') {
    sbRenderOpsi(soalData?.opsi || ['','','',''], soalData?.jawabanIdx ?? null);
    const maxOpsi = (soalData?.opsi?.length || 4);
    document.getElementById('sb-btn-tambah-opsi').style.display = maxOpsi >= 6 ? 'none' : '';
  } else if (tipe === 'isian') {
    document.getElementById('sb-jawaban-isian').value = soalData?.jawaban || '';
  } else if (tipe === 'benar_salah') {
    sbPilihBS(soalData?.jawaban || '');
  }
  sbAutoSave();
}

function sbRenderOpsi(opsiArr, jawabanIdx) {
  const el = document.getElementById('sb-opsi-list');
  el.innerHTML = opsiArr.map((val, i) => `
    <div class="sb-opsi-row" style="display:flex;align-items:center;gap:10px">
      <input type="radio" name="sb-jawaban" id="sb-radio-${i}" ${jawabanIdx === i ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--green);cursor:pointer;flex-shrink:0">
      <div style="width:30px;height:30px;border-radius:50%;background:${SB_OPSI_COLORS[i]};color:white;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${SB_HURUF[i]}</div>
      <input type="text" class="sb-opsi-input" value="${val}" placeholder="Pilihan ${SB_HURUF[i]}"
        style="flex:1;padding:11px 14px;border:2px solid #eee;border-radius:10px;font-family:Nunito,sans-serif;font-size:14px;outline:none;transition:border 0.2s"
        onfocus="this.style.borderColor='var(--orange)'" onblur="this.style.borderColor='#eee'"
        oninput="sbAutoSave()">
      <button onclick="sbHapusOpsi(${i})" style="background:none;border:none;cursor:pointer;font-size:15px;opacity:${opsiArr.length > 2 ? '0.35' : '0.1'};padding:4px;transition:opacity 0.2s;pointer-events:${opsiArr.length > 2 ? 'auto' : 'none'}" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.35'">✕</button>
    </div>
  `).join('');
}

function sbTambahOpsi() {
  sbSimpanStateAktif();
  const s = sbSoalList[sbAktifIdx];
  if (s.opsi.length >= 6) return;
  s.opsi.push('');
  sbRenderOpsi(s.opsi, s.jawabanIdx);
  if (s.opsi.length >= 6) document.getElementById('sb-btn-tambah-opsi').style.display = 'none';
  // Focus ke opsi baru
  const inputs = document.querySelectorAll('.sb-opsi-input');
  inputs[inputs.length - 1]?.focus();
}

function sbHapusOpsi(idx) {
  sbSimpanStateAktif();
  const s = sbSoalList[sbAktifIdx];
  if (s.opsi.length <= 2) { toast('Minimal 2 pilihan!', 'error'); return; }
  s.opsi.splice(idx, 1);
  if (s.jawabanIdx === idx) s.jawabanIdx = null;
  else if (s.jawabanIdx > idx) s.jawabanIdx--;
  sbRenderOpsi(s.opsi, s.jawabanIdx);
  document.getElementById('sb-btn-tambah-opsi').style.display = '';
}

function sbPilihBS(val) {
  document.getElementById('sb-jawaban-bs').value = val;
  const benarEl = document.getElementById('sb-bs-benar');
  const salahEl = document.getElementById('sb-bs-salah');
  if (benarEl) benarEl.style.cssText = `border:3px solid ${val==='Benar'?'var(--green)':'#eee'};border-radius:14px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;background:${val==='Benar'?'#F0FFF4':'white'}`;
  if (salahEl) salahEl.style.cssText = `border:3px solid ${val==='Salah'?'var(--red)':'#eee'};border-radius:14px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;background:${val==='Salah'?'#FFF0F0':'white'}`;
  sbAutoSave();
}

function sbAutoSave() {
  sbSimpanStateAktif();
  sbRenderSidebar();
}

function sbRenderSidebar() {
  const el = document.getElementById('sb-soal-list');
  el.innerHTML = sbSoalList.map((s, i) => {
    const isAktif = i === sbAktifIdx;
    const icon = s.tipe === 'pilihan_ganda' ? '✅' : s.tipe === 'isian' ? '✍️' : '⭕';
    const preview = s.pertanyaan ? (s.pertanyaan.length > 30 ? s.pertanyaan.slice(0,30)+'…' : s.pertanyaan) : 'Pertanyaan kosong...';
    return `<div onclick="sbPilihSoal(${i})" style="padding:10px 12px;border-radius:10px;cursor:pointer;margin-bottom:4px;background:${isAktif?'rgba(255,107,53,0.2)':'transparent'};border:2px solid ${isAktif?'var(--orange)':'transparent'};transition:all 0.15s">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="background:${isAktif?'var(--orange)':'rgba(255,255,255,0.15)'};color:white;font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px">${i+1}</span>
        <span style="font-size:13px">${icon}</span>
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,${isAktif?'0.9':'0.45'});margin-top:6px;line-height:1.4">${preview}</div>
    </div>`;
  }).join('');
}

function sbPilihSoal(idx) {
  sbSimpanStateAktif();
  sbMuatSoal(idx);
  // Tutup sidebar otomatis di mobile setelah pilih soal
  if (window.innerWidth <= 640) {
    const sidebar = document.getElementById('sb-sidebar');
    const overlay = document.getElementById('sb-overlay');
    sidebar.classList.remove('sb-sidebar-open');
    if (overlay) overlay.style.display = 'none';
  }
}

function sbUpdateCount() {
  const el = document.getElementById('sb-count-label');
  if (el) el.textContent = `${sbSoalList.length} soal`;
}

function sbToggleSidebar() {
  const sidebar = document.getElementById('sb-sidebar');
  const overlay = document.getElementById('sb-overlay');
  const isOpen = sidebar.classList.contains('sb-sidebar-open');
  if (isOpen) {
    sidebar.classList.remove('sb-sidebar-open');
    overlay.style.display = 'none';
  } else {
    sidebar.classList.add('sb-sidebar-open');
    overlay.style.display = 'block';
  }
}

function sbCheckMobile() {
  const toggleBtn = document.getElementById('sb-toggle-btn');
  const sidebar = document.getElementById('sb-sidebar');
  const overlay = document.getElementById('sb-overlay');
  if (!toggleBtn) return;
  if (window.innerWidth <= 640) {
    toggleBtn.style.display = 'flex';
    // On mobile, sidebar starts hidden
    if (!sidebar.classList.contains('sb-sidebar-open')) {
      overlay.style.display = 'none';
    }
  } else {
    toggleBtn.style.display = 'none';
    sidebar.classList.remove('sb-sidebar-open');
    overlay.style.display = 'none';
  }
}

window.addEventListener('resize', sbCheckMobile);

function sbHapusSoalAktif() {
  if (sbSoalList.length <= 1) { toast('Minimal harus ada 1 soal!', 'error'); return; }
  if (!confirm(`Hapus soal #${sbAktifIdx + 1}?`)) return;
  sbSoalList.splice(sbAktifIdx, 1);
  sbAktifIdx = Math.min(sbAktifIdx, sbSoalList.length - 1);
  sbMuatSoal(sbAktifIdx);
  sbUpdateCount();
  toast('Soal dihapus!', 'success');
}

function sbDuplikasiSoal() {
  sbSimpanStateAktif();
  const kopi = JSON.parse(JSON.stringify(sbSoalList[sbAktifIdx]));
  kopi.id = Date.now();
  kopi.dbId = null;
  kopi.pertanyaan = kopi.pertanyaan ? kopi.pertanyaan + ' (copy)' : '';
  sbSoalList.splice(sbAktifIdx + 1, 0, kopi);
  sbAktifIdx++;
  sbMuatSoal(sbAktifIdx);
  sbUpdateCount();
  toast('Soal diduplikat! ⧉', 'success');
}

async function sbSimpanSemua() {
  sbSimpanStateAktif();
  const btn = document.getElementById('sb-btn-simpan');
  btn.disabled = true;
  btn.textContent = '⏳ Menyimpan...';

  let berhasil = 0, gagal = 0;
  const idsBaru = [];

  for (const s of sbSoalList) {
    if (!s.pertanyaan.trim()) { gagal++; continue; }

    let opsi = s.opsi, jawaban = s.jawaban, jenis = s.tipe;
    if (jenis === 'pilihan_ganda') {
      opsi = s.opsi.filter(Boolean);
      if (opsi.length < 2 || !jawaban) { gagal++; continue; }
    } else if (jenis === 'isian') {
      if (!jawaban) { gagal++; continue; }
      opsi = [];
    } else if (jenis === 'benar_salah') {
      if (!jawaban) { gagal++; continue; }
      opsi = ['Benar', 'Salah'];
    }

    try {
      if (s.dbId) {
        // Edit mode: update soal yang sudah ada
        const data = await api('PUT', `/soal/${s.dbId}`, {
          pertanyaan: s.pertanyaan, emoji: '❓', mapel: s.mapel,
          jenis, opsi: JSON.stringify(opsi), jawaban, poin: s.poin, tingkat: s.tingkat
        });
        if (data.success) berhasil++; else gagal++;
      } else {
        // Create mode: soal baru
        const data = await api('POST', '/soal', {
          pertanyaan: s.pertanyaan, emoji: '❓', mapel: s.mapel,
          jenis, opsi: JSON.stringify(opsi), jawaban, poin: s.poin, tingkat: s.tingkat
        });
        if (data.success && data.data?.id) {
          s.dbId = data.data.id;
          idsBaru.push(data.data.id);
          berhasil++;
        } else gagal++;
      }
    } catch(e) { gagal++; }
  }

  btn.disabled = false;
  btn.textContent = '💾 Simpan Semua';

  if (berhasil > 0) {
    toast(`✅ ${berhasil} soal tersimpan!${gagal > 0 ? ' (' + gagal + ' soal dilewati)' : ''}`, 'success');

    if (sbFromKuis) {
      sbFromKuis = false;
      sbSoalList = [];
      showPage('page-kelas');
      setTimeout(async () => {
        openModal('modal-buat-kuis');
        await loadBankSoal();
        switchKuisSoalTab('bank');
        // Auto-centang soal yang baru disimpan
        setTimeout(() => {
          idsBaru.forEach(id => {
            const cb = document.querySelector('.soal-check[value="' + id + '"]');
            if (cb) cb.checked = true;
          });
          updateSoalCount();
          if (idsBaru.length > 0) {
            toast(idsBaru.length + ' soal baru sudah dicentang otomatis! ✅', 'success');
          }
        }, 500);
      }, 300);
    } else {
      sbSoalList = [];
      showPage('page-guru');
      loadGuruSoalPreview();
    }
  } else {
    toast('Soal tidak valid! Pastikan pertanyaan & jawaban benar terisi.', 'error');
  }
}

function batalBuatSoal() {
  closeModal('modal-soal');
  resetSoalForm();
  const btnSimpan = document.querySelector('#modal-soal .btn-submit');
  if (btnSimpan) btnSimpan.textContent = '✅ Simpan Soal';
  // Jika dari modal kuis, kembalikan ke modal kuis
  if (soalDariBuatKuis) {
    soalDariBuatKuis = false;
    openModal('modal-buat-kuis');
  }
}

// Flag: apakah modal soal dibuka dari dalam modal buat kuis
let soalDariBuatKuis = false;

function buatSoalDariKuis() {
  soalDariBuatKuis = true;
  // Set default mapel sesuai kelas yang sedang aktif
  setTimeout(() => {
    const mapelSelect = document.getElementById('s-mapel');
    if (mapelSelect && currentKelas?.mapel) {
      for (let opt of mapelSelect.options) {
        if (opt.value === currentKelas.mapel) { opt.selected = true; break; }
      }
    }
    // Ubah tombol simpan agar kembali ke kuis setelah simpan
    const btnSimpan = document.querySelector('#modal-soal .btn-submit');
    if (btnSimpan) btnSimpan.textContent = '✅ Simpan & Kembali ke Kuis';
  }, 100);
  openModal('modal-soal');
}

async function submitSoal(tambahLagi = false) {
  const pertanyaan = document.getElementById('s-pertanyaan').value.trim();
  const emoji = document.getElementById('s-emoji').value.trim() || '❓';
  const mapel = document.getElementById('s-mapel').value;
  const poin = parseInt(document.getElementById('s-poin').value) || 100;
  const tingkat = document.getElementById('s-tingkat').value;

  if (!pertanyaan) { toast('Pertanyaan harus diisi!', 'error'); return; }

  let opsi = [], jawaban = '', jenis = currentTipeSoal;

  if (jenis === 'pilihan_ganda') {
    const inputs = document.querySelectorAll('.opsi-input');
    opsi = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    if (opsi.length < 2) { toast('Minimal 2 pilihan jawaban harus diisi!', 'error'); return; }
    const jawabanIdx = document.getElementById('s-jawaban-pg').value;
    if (jawabanIdx === '') { toast('Pilih jawaban yang benar!', 'error'); return; }
    jawaban = opsi[parseInt(jawabanIdx)];
    if (!jawaban) { toast('Pilihan untuk jawaban benar tidak diisi!', 'error'); return; }

  } else if (jenis === 'essay') {
    jawaban = document.getElementById('s-jawaban-essay').value.trim();
    if (!jawaban) { toast('Kunci jawaban harus diisi!', 'error'); return; }
    opsi = [];
    jenis = 'isian';

  } else if (jenis === 'benar_salah') {
    jawaban = document.getElementById('s-jawaban-bs').value;
    if (!jawaban) { toast('Pilih jawaban Benar atau Salah!', 'error'); return; }
    opsi = ['Benar', 'Salah'];
  }

  showLoading(true);
  try {
    const data = await api('POST', '/soal', {
      pertanyaan, emoji, mapel, jenis,
      opsi: JSON.stringify(opsi), jawaban, poin, tingkat
    });
    if (data.success) {
      toast('Soal berhasil ditambahkan! ✏️', 'success');
      loadGuruSoalPreview();

      if (tambahLagi) {
        // Tetap di modal, reset form, pertahankan mapel
        const mapelLama = mapel;
        resetSoalForm();
        const mapelSelect = document.getElementById('s-mapel');
        if (mapelSelect && mapelLama) {
          for (let opt of mapelSelect.options) {
            if (opt.value === mapelLama) { opt.selected = true; break; }
          }
        }
        document.getElementById('s-pertanyaan').focus();
        toast('Soal tersimpan! Isi soal berikutnya ✏️', 'success');
      } else {
        closeModal('modal-soal');
        resetSoalForm();
        if (soalDariBuatKuis) {
          soalDariBuatKuis = false;
          const btnSimpan = document.querySelector('#modal-soal .btn-submit');
          if (btnSimpan) btnSimpan.textContent = '✅ Simpan Soal';
          openModal('modal-buat-kuis');
          await loadBankSoal();
          switchKuisSoalTab('bank');
          toast('Soal ditambahkan! Ceklis soalnya di bawah ya 👇', 'success');
        }
      }
    } else {
      toast(data.pesan || 'Gagal menyimpan soal', 'error');
    }
  } catch (e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

// ============================================================
//  QUIZ GAME
// ============================================================
let questions = [];
let qIdx = 0, score = 0, correctCount = 0, timer, timeLeft = 15, answered = false;
let quizStartTime = null;
let currentQuizId = null;

// ============================================================
//  QUIZ KILAT — DUOLINGO STYLE
// ============================================================
let qkKategori      = [];   // list kategori (per kelas/mapel)
let qkActiveKategori = null; // kategori yang sedang dimainkan
let qkStages        = [];   // stages per kategori
let qkActiveStage   = 0;    // stage index yang sedang dimainkan
let qkLives         = 3;    // nyawa tersisa
let qkStageProgress = {};   // { kategoriId_stageIdx: 'done'|'locked' }

const QK_STAGES_PER_KATEGORI = 5;
const QK_SOAL_PER_STAGE = 6;
const QK_STAGE_ICONS = ['🌱','⭐','🔥','💎','👑'];
const QK_STAGE_NAMES = ['Pemula','Dasar','Menengah','Mahir','Master'];
const QK_STAGE_XP    = [30, 50, 80, 120, 200];
const QK_STAGE_COLORS= ['#6BCB77','#4D96FF','#FF6B35','#C77DFF','#FFD93D'];

// ── Load halaman kategori ──────────────────────────────────
async function startQuiz() {
  showPage('page-quiz-map');
  await loadQuizKilatMap();
}

async function loadQuizKilatMap() {
  // Update streak & XP
  document.getElementById('qk-streak').textContent   = currentUser?.level || 1;
  document.getElementById('qk-xp-total').textContent = currentUser?.xp || 0;

  const wrap = document.getElementById('qk-kategori-wrap');
  wrap.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted)"><div style="font-size:40px">⏳</div><p style="font-weight:700;margin-top:8px">Memuat kategori...</p></div>';

  try {
    // Ambil semua kelas murid
    const kelasData = await api('GET', '/kelas');
    const kelasList = kelasData.kelas || kelasData.data || [];

    if (kelasList.length === 0) {
      wrap.innerHTML = `<div style="text-align:center;padding:40px">
        <div style="font-size:56px;margin-bottom:12px">🏫</div>
        <p style="font-weight:800;font-size:16px;margin-bottom:8px">Belum ada kelas!</p>
        <p style="color:var(--muted);font-size:14px">Gabung ke kelas dulu untuk mulai Quiz Kilat.</p>
        <button onclick="openModal('modal-join-kelas');showPage('page-murid')" style="margin-top:16px;background:var(--orange);color:white;border:none;padding:12px 24px;border-radius:50px;font-family:Nunito,sans-serif;font-weight:800;font-size:14px;cursor:pointer">+ Gabung Kelas</button>
      </div>`;
      return;
    }

    // Ambil materi per kelas → buat kategori
    qkKategori = [];
    for (const kelas of kelasList) {
      const mapel = kelas.mapel || kelas.nama;
      const id    = `${kelas.id}_${mapel}`;
      // Cek apakah sudah ada kategori untuk mapel ini
      const exists = qkKategori.find(k => k.mapel === mapel);
      if (!exists) {
        qkKategori.push({
          id, mapel, kelasNama: kelas.nama, kelasId: kelas.id,
          emoji: getMapelEmoji(mapel),
          color: getMapelColor(mapel),
        });
      }
    }

    // Render kategori cards
    wrap.innerHTML = `
      <div style="margin-bottom:20px">
        <div style="font-family:'Fredoka One',cursive;font-size:15px;color:#888;letter-spacing:.5px;margin-bottom:16px;display:flex;align-items:center;gap:6px">
          📖 KELASMU <span style="background:linear-gradient(135deg,#FF6B35,#FF0080);color:white;border-radius:50px;padding:2px 10px;font-size:12px">${qkKategori.length} Kategori</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${qkKategori.map((k, i) => {
            const stagesDone = getStagesDone(k.id);
            const pct = Math.round(stagesDone / QK_STAGES_PER_KATEGORI * 100);
            const xpEarned = QK_STAGE_XP.slice(0,stagesDone).reduce((a,b)=>a+b,0);
            const stageLabel = stagesDone === QK_STAGES_PER_KATEGORI ? '🏆 Selesai!' : stagesDone === 0 ? '🚀 Mulai sekarang!' : `Stage ${stagesDone+1}: ${QK_STAGE_NAMES[stagesDone]}`;
            return `
            <div onclick="bukaStageMap('${k.id}')"
              style="background:linear-gradient(135deg,${k.color}18,${k.color}08);border-radius:24px;box-shadow:0 6px 24px rgba(0,0,0,0.09);padding:20px;cursor:pointer;transition:all 0.25s;border:2px solid ${k.color}30;position:relative;overflow:hidden"
              onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 36px rgba(0,0,0,0.14)';this.style.borderColor='${k.color}80'"
              onmouseout="this.style.transform='';this.style.boxShadow='0 6px 24px rgba(0,0,0,0.09)';this.style.borderColor='${k.color}30'">
              <!-- Decorative circle -->
              <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;border-radius:50%;background:${k.color}15;pointer-events:none"></div>
              <div style="display:flex;align-items:center;gap:16px">
                <div style="width:64px;height:64px;border-radius:20px;background:linear-gradient(145deg,${k.color},${k.color}aa);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;box-shadow:0 6px 18px ${k.color}50">
                  ${k.emoji}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-family:'Fredoka One',cursive;font-size:18px;color:#1a1a2e;margin-bottom:2px">${k.mapel}</div>
                  <div style="font-size:12px;color:#888;margin-bottom:8px;font-weight:700">📍 ${k.kelasNama}</div>
                  <div style="background:rgba(0,0,0,0.08);border-radius:50px;height:8px;overflow:hidden;margin-bottom:5px">
                    <div style="background:linear-gradient(90deg,${k.color},${k.color}cc);height:100%;border-radius:50px;width:${pct}%;transition:width 0.6s;box-shadow:0 0 6px ${k.color}60"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:11px;color:${k.color};font-weight:800">${stageLabel}</span>
                    <span style="font-size:11px;background:${k.color}20;color:${k.color};border-radius:50px;padding:2px 8px;font-weight:800">⭐ ${xpEarned} XP</span>
                  </div>
                </div>
                <div style="font-size:24px;color:${k.color};font-weight:900">›</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  } catch(e) {
    wrap.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted)"><p>Gagal memuat kategori 😢</p></div>`;
  }
}

function getMapelEmoji(mapel) {
  const m = (mapel || '').toLowerCase();
  if (m.includes('math') || m.includes('matematika')) return '🔢';
  if (m.includes('bahasa') && m.includes('indo')) return '📖';
  if (m.includes('bahasa') && m.includes('ing')) return '🌏';
  if (m.includes('ipa') || m.includes('sains')) return '🔬';
  if (m.includes('ips')) return '🗺️';
  if (m.includes('musik') || m.includes('sbd') || m.includes('seni')) return '🎵';
  if (m.includes('olahraga') || m.includes('pjok')) return '⚽';
  if (m.includes('pkn') || m.includes('ppkn')) return '🏛️';
  if (m.includes('agama')) return '🕌';
  if (m.includes('tik') || m.includes('komputer')) return '💻';
  if (m.includes('sejarah')) return '📜';
  if (m.includes('geografi')) return '🌍';
  if (m.includes('biologi')) return '🌿';
  if (m.includes('fisika')) return '⚡';
  if (m.includes('kimia')) return '🧪';
  return '📚';
}

function getMapelColor(mapel) {
  const m = (mapel || '').toLowerCase();
  if (m.includes('math') || m.includes('matematika')) return '#4D96FF';
  if (m.includes('bahasa') && m.includes('indo')) return '#FF6B35';
  if (m.includes('ipa') || m.includes('sains')) return '#6BCB77';
  if (m.includes('musik') || m.includes('sbd') || m.includes('seni')) return '#FF6B9D';
  if (m.includes('olahraga')) return '#FF6B35';
  if (m.includes('ips')) return '#FFD93D';
  if (m.includes('tik')) return '#4D96FF';
  return '#C77DFF';
}

function getStagesDone(kategoriId) {
  let done = 0;
  for (let i = 0; i < QK_STAGES_PER_KATEGORI; i++) {
    if (qkStageProgress[`${kategoriId}_${i}`] === 'done') done++;
  }
  return done;
}

// ── Buka stage map per kategori ────────────────────────────
function bukaStageMap(kategoriId) {
  qkActiveKategori = qkKategori.find(k => k.id === kategoriId);
  if (!qkActiveKategori) return;

  document.getElementById('qk-stage-title').textContent = `${qkActiveKategori.emoji} ${qkActiveKategori.mapel}`;
  const stagesDone = getStagesDone(kategoriId);
  const totalXP = QK_STAGE_XP.slice(0, stagesDone).reduce((a,b)=>a+b, 0);
  document.getElementById('qk-stage-progress-label').textContent = `${stagesDone} / ${QK_STAGES_PER_KATEGORI} stage selesai`;
  document.getElementById('qk-stage-xp-label').textContent = `${totalXP} XP`;
  document.getElementById('qk-stage-progress-bar').style.width = (stagesDone / QK_STAGES_PER_KATEGORI * 100) + '%';

  showPage('page-quiz-stages');
  requestAnimationFrame(() => renderStagePath());
}

function renderStagePath() {
  const path = document.getElementById('qk-stage-path');
  const kat  = qkActiveKategori;
  const stagesDone = getStagesDone(kat.id);

  const W  = (path.clientWidth - 40) || 340; // subtract left+right padding (20+20)
  const cx = W / 2;
  const OX = Math.min(118, cx - 68); // max offset so button+label stay on screen
  const offsets = [OX, -OX, OX, -OX, OX];

  const STEP   = 190; // vertical px between stage centers
  const BTN    = 48;  // button is 96×96 (BTN = half = 48)
  const TOTAL_H = STEP * (QK_STAGES_PER_KATEGORI - 1) + BTN * 2 + 80;

  // Build SVG defs + path segments
  let svgDefs = '', svgPaths = '';
  for (let i = 0; i < QK_STAGES_PER_KATEGORI - 1; i++) {
    const done   = i < stagesDone;
    const active = i === stagesDone;
    const locked = i > stagesDone;
    const color  = QK_STAGE_COLORS[i];
    const nColor = QK_STAGE_COLORS[i + 1];
    const sx = cx + offsets[i],       sy = i * STEP + BTN;
    const ex = cx + offsets[i + 1],   ey = (i + 1) * STEP + BTN;
    const cp1y = sy + STEP * 0.38, cp2y = ey - STEP * 0.38;
    const d = `M ${sx} ${sy} C ${sx} ${cp1y} ${ex} ${cp2y} ${ex} ${ey}`;

    svgDefs += `<linearGradient id="pcg${i}" gradientUnits="userSpaceOnUse" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}">
      <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${nColor}"/>
    </linearGradient>`;
    const stroke = done ? `url(#pcg${i})` : active ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
    const dash   = locked ? 'stroke-dasharray="14 9"' : '';
    const glow   = done ? `filter="drop-shadow(0 0 7px ${color}cc)"` : '';
    svgPaths += `<path d="${d}" stroke="${stroke}" stroke-width="11" stroke-linecap="round" fill="none" ${dash} ${glow}/>`;
  }

  // Mid-path decoration emojis
  const midDecos = [
    ['🌟','⚡'], ['💫','🎯'], ['⭐','✨'], ['💎','🌟']
  ];
  let decoHtml = '';
  for (let i = 0; i < QK_STAGES_PER_KATEGORI - 1; i++) {
    const done = i < stagesDone;
    const opa  = done ? 0.85 : 0.22;
    const sx   = cx + offsets[i], ex = cx + offsets[i + 1];
    const sy   = i * STEP + BTN,  ey = (i + 1) * STEP + BTN;
    // Two emoji decorations at t≈0.35 and t≈0.68 along the segment
    [[0.35, midDecos[i][0]], [0.68, midDecos[i][1]]].forEach(([t, em]) => {
      const bx = sx + (ex - sx) * t, by = sy + (ey - sy) * t;
      decoHtml += `<div style="position:absolute;top:${by - 12}px;left:${bx - 12}px;font-size:16px;opacity:${opa};pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">${em}</div>`;
    });
  }

  // Stage node buttons + labels
  let nodesHtml = '';
  for (let i = 0; i < QK_STAGES_PER_KATEGORI; i++) {
    const done   = i < stagesDone;
    const active = i === stagesDone;
    const locked = i > stagesDone;
    const color  = QK_STAGE_COLORS[i];
    const xp     = QK_STAGE_XP[i];
    const ox     = offsets[i];
    const bx     = cx + ox; // button center x
    const by     = i * STEP; // button top y

    const btnBg = done
      ? `linear-gradient(145deg,${color},${color}bb)`
      : active ? `linear-gradient(145deg,${color},${color}88)` : 'linear-gradient(145deg,#3a3a5c,#2a2a4a)';
    const btnShadow = active
      ? `0 0 0 8px ${color}44,0 10px 36px ${color}88`
      : done ? `0 6px 22px ${color}77` : '0 4px 14px rgba(0,0,0,0.35)';
    const nameCol = done ? color : active ? '#ffffff' : 'rgba(255,255,255,0.42)';
    const subCol  = done ? 'rgba(255,255,255,0.9)' : active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)';

    const scaleStyle = active ? 'transform:scale(1.12);transform-origin:center top;' : '';

    nodesHtml += `
    <div style="position:absolute;top:${by}px;left:${bx - BTN}px;width:${BTN * 2}px;${scaleStyle}">
      ${active ? `<div style="text-align:center;margin-bottom:5px">
        <span style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF0080);color:#fff;font-size:11px;font-weight:900;padding:4px 14px;border-radius:50px;font-family:Nunito;white-space:nowrap;box-shadow:0 3px 12px rgba(255,107,53,0.75);animation:qkBounce 1s ease-in-out infinite">▶ MULAI</span>
      </div>` : `<div style="height:24px"></div>`}
      <button onclick="${locked ? "toast('Selesaikan stage sebelumnya dulu! 🔒','error')" : `mulaiStage(${i})`}"
        style="width:${BTN * 2}px;height:${BTN * 2}px;border-radius:28px;border:none;cursor:${locked ? 'not-allowed' : 'pointer'};background:${btnBg};box-shadow:${btnShadow};transition:all 0.25s;opacity:${locked ? '0.5' : '1'}${active ? ';animation:qkPulseRing 1.6s ease-in-out infinite' : ''}">
        <div style="font-size:38px;display:flex;align-items:center;justify-content:center;height:100%">${locked ? '🔒' : QK_STAGE_ICONS[i]}</div>
      </button>
      <div style="text-align:center;margin-top:8px">
        <div style="font-family:'Fredoka One',cursive;font-size:15px;color:${nameCol};text-shadow:0 2px 8px rgba(0,0,0,0.55);line-height:1.2">${QK_STAGE_NAMES[i]}</div>
        <div style="font-size:11px;font-weight:800;color:${subCol};margin-top:3px">${done ? `✅ +${xp} XP` : active ? `⚡ ${QK_SOAL_PER_STAGE} soal` : '🔒 Terkunci'}</div>
      </div>
    </div>`;
  }

  path.innerHTML = `
  <div style="position:relative;height:${TOTAL_H}px;overflow:visible">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${TOTAL_H}"
         style="position:absolute;inset:0;width:100%;height:100%;overflow:visible" preserveAspectRatio="none">
      <defs>${svgDefs}</defs>
      ${svgPaths}
    </svg>
    ${decoHtml}
    ${nodesHtml}
  </div>`;

  if (!document.getElementById('qk-keyframes')) {
    const s = document.createElement('style');
    s.id = 'qk-keyframes';
    s.textContent = `
      @keyframes qkPulseRing {
        0%,100%{box-shadow:0 0 0 8px rgba(255,255,255,0.2),0 10px 36px rgba(255,255,255,0.25)}
        50%    {box-shadow:0 0 0 18px rgba(255,255,255,0.05),0 10px 44px rgba(255,255,255,0.45)}
      }
      @keyframes qkBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`;
    document.head.appendChild(s);
  }

  spawnQkStars();
}

function spawnQkStars() {
  const bg = document.getElementById('qk-stars-bg');
  if (!bg || bg.children.length > 0) return;
  const chars = ['⭐','✨','💫','🌟','⚡','💎','🌈','🎯','🏅','💥','🎪','🌺','🦋','🎵','🔥','🌙','🪐','🎀','🍀','🎆'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 22 + 8;
    const dur  = Math.random() * 10 + 6;
    const anim = Math.random() > 0.5 ? 'qkFloat' : 'qkFloat2';
    el.style.cssText = `position:absolute;font-size:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;opacity:${Math.random()*0.38+0.06};animation:${anim} ${dur}s ease-in-out infinite;animation-delay:${Math.random()*8}s;pointer-events:none`;
    el.textContent = chars[Math.floor(Math.random() * chars.length)];
    bg.appendChild(el);
  }
  if (!document.getElementById('qk-float-kf')) {
    const s = document.createElement('style');
    s.id = 'qk-float-kf';
    s.textContent = `
      @keyframes qkFloat{0%,100%{transform:translateY(0) scale(1) rotate(0deg)}50%{transform:translateY(-22px) scale(1.12) rotate(6deg)}}
      @keyframes qkFloat2{0%,100%{transform:translateY(0) scale(1) rotate(0deg)}50%{transform:translateY(-12px) scale(0.88) rotate(-8deg)}}`;
    document.head.appendChild(s);
  }
}

// ── Mulai stage tertentu ────────────────────────────────────
async function mulaiStage(stageIdx) {
  qkActiveStage = stageIdx;
  qkLives = 3;
  questions = [];

  showLoading(true);
  try {
    // Ambil materi dari kelas untuk generate soal
    const materiData = await api('GET', `/materi?kelas_id=${qkActiveKategori.kelasId}`);
    const materiList = materiData.materi || materiData.data || [];

    if (materiList.length === 0) {
      // Coba ambil dari bank soal guru
      const soalData = await api('GET', `/soal?mapel=${encodeURIComponent(qkActiveKategori.mapel)}`);
      const bankSoal = soalData.soal || soalData.data || [];

      if (bankSoal.length > 0) {
        // Pakai soal dari bank
        const shuffled = bankSoal.sort(() => Math.random()-0.5);
        questions = shuffled.slice(0, QK_SOAL_PER_STAGE).map(s => ({
          q: s.pertanyaan, emoji: s.emoji || getMapelEmoji(s.mapel),
          opts: Array.isArray(s.opsi) ? s.opsi : JSON.parse(s.opsi || '[]'),
          jawaban: s.jawaban, ans: -1, label: s.mapel, poin: s.poin || 100,
          fromAI: false
        }));
        questions.forEach(q => {
          q.ans = q.opts.findIndex(o => o === q.jawaban);
          if (q.ans < 0) q.ans = 0;
        });
      } else {
        toast('Guru belum menambahkan materi atau soal untuk kelas ini. Minta gurumu tambahkan dulu! 📚', 'error');
        showLoading(false); return;
      }
    } else {
      // Generate soal dari materi pakai AI (Groq)
      // Ambil konten materi — teks atau deskripsi (PDF tidak punya konten teks)
      const materiDenganKonten = materiList.filter(m =>
        (m.konten && m.konten.length > 50) || (m.deskripsi && m.deskripsi.length > 30)
      );

      // Kalau semua materi adalah PDF (konten kosong), coba bank soal dulu
      if (materiDenganKonten.length === 0) {
        const soalData2 = await api('GET', `/soal?mapel=${encodeURIComponent(qkActiveKategori.mapel)}`);
        const bankSoal2 = soalData2.soal || soalData2.data || [];
        if (bankSoal2.length > 0) {
          const shuffled2 = bankSoal2.sort(() => Math.random()-0.5);
          questions = shuffled2.slice(0, QK_SOAL_PER_STAGE).map(s => ({
            q: s.pertanyaan, emoji: s.emoji || getMapelEmoji(s.mapel),
            opts: Array.isArray(s.opsi) ? s.opsi : JSON.parse(s.opsi || '[]'),
            jawaban: s.jawaban, ans: -1, label: s.mapel, poin: s.poin || 100
          }));
          questions.forEach(q => { q.ans = q.opts.findIndex(o => o === q.jawaban); if (q.ans < 0) q.ans = 0; });
        } else {
          toast('Materi di kelas ini berupa PDF — AI tidak bisa membaca isinya. Minta guru tambahkan soal ke bank soal! 📝', 'error');
          showLoading(false); return;
        }
      } else {
      toast('🤖 AI sedang buat soal dari materi...', '');
      const kontenMateri = materiDenganKonten.slice(0, 4).map(m => {
        const isi = m.konten && m.konten.length > 50 ? m.konten.substring(0, 600) : (m.deskripsi || '');
        return `Judul: ${m.judul}\nMapel: ${m.mapel || qkActiveKategori.mapel}\nIsi: ${isi}`;
      }).join('\n---\n').substring(0, 2500); // batasi total

      const tingkatNames = ['sangat mudah','mudah','sedang','susah','sangat susah'];
      const tingkat = tingkatNames[stageIdx] || 'sedang';

      const aiResp = await api('POST', '/ai/chat', {
        model: 'openai/gpt-oss-120b',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [{
          role: 'system',
          content: 'Kamu pembuat soal. Balas HANYA JSON object: {"soal":[...]} tanpa teks lain.'
        },{
          role: 'user',
          content: `Buat ${QK_SOAL_PER_STAGE} soal pilihan ganda tingkat ${tingkat} dari materi ini:\n\n${kontenMateri}\n\nFormat: {"soal":[{"pertanyaan":"...","emoji":"📚","opsi":["A","B","C","D"],"jawaban":"teks jawaban persis sama dengan opsi","poin":${50*(stageIdx+1)}}]}`
        }]
      });
      if (!aiResp.success) throw new Error(aiResp.pesan || 'AI error');
      const aiData = aiResp.data;
      let soalAI = [];
      try {
        const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
        soalAI = parsed.soal || parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : []);
      } catch(parseErr) {
        // Fallback: coba ekstrak array
        let teks = (aiData.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
        const fi = teks.indexOf('['), la = teks.lastIndexOf(']');
        if (fi>=0&&la>=0) {
          teks = teks.slice(fi, la+1).replace(/,(\s*[}\]])/g,'$1');
          try { soalAI = JSON.parse(teks); } catch(e) {
            const objs = teks.match(/\{[\s\S]*?\}/g) || [];
            soalAI = objs.map(o => { try { return JSON.parse(o); } catch(e2) { return null; }}).filter(Boolean);
          }
        }
        if (soalAI.length === 0) throw new Error('Format soal dari AI tidak valid. Silakan coba lagi!');
      }

      questions = soalAI.map(s => {
        const cocok = (s.opsi||[]).find(o => o.trim().toLowerCase()===s.jawaban?.trim().toLowerCase());
        const jawaban = cocok || s.opsi?.[0] || '';
        return {
          q: s.pertanyaan, emoji: s.emoji || getMapelEmoji(qkActiveKategori.mapel),
          opts: s.opsi || [], jawaban, ans: (s.opsi||[]).indexOf(jawaban),
          label: qkActiveKategori.mapel, poin: s.poin || 100, fromAI: true
        };
      }).filter(s => s.opts.length >= 2);
      } // end else materiDenganKonten > 0
    } // end else (ada materi)

    if (questions.length === 0) {
      toast('Tidak bisa membuat soal. Coba lagi!', 'error');
      showLoading(false); return;
    }

    resetQuiz();
    showPage('page-quiz');
  } catch(e) {
    toast('Gagal memuat soal: ' + e.message, 'error');
    console.error(e);
  }
  showLoading(false);
}

function batalQuizKilat() {
  if (!confirm('Keluar dari quiz? Progress stage ini tidak tersimpan.')) return;
  clearInterval(timer);
  if (qkActiveKategori) bukaStageMap(qkActiveKategori.id);
  else showPage('page-quiz-map');
}

function lanjutSetelahQuiz() {
  if (qkActiveKategori) bukaStageMap(qkActiveKategori.id);
  else showPage('page-quiz-map');
}

async function startQuiz() {
  showPage('page-quiz-map');
  await loadQuizKilatMap();
}

function resetQuiz() {
  qIdx = 0; score = 0; correctCount = 0; answered = false;
  clearInterval(timer);
  quizStartTime = Date.now();

  document.getElementById('quiz-score').textContent  = '0';
  document.getElementById('qk-lives').textContent    = qkLives;
  document.getElementById('quiz-playing').style.display = 'block';
  document.getElementById('quiz-result').style.display  = 'none';
  document.getElementById('qk-feedback').style.display  = 'none';
  document.getElementById('quiz-progress').style.width  = '0%';

  if (questions.length > 0) renderQuestion();
}

function renderQuestion() {
  answered = false;
  const q   = questions[qIdx];
  const pct = (qIdx / questions.length * 100);

  document.getElementById('quiz-progress').style.width = pct + '%';
  document.getElementById('q-emoji').textContent = q.emoji;
  document.getElementById('q-text').textContent  = q.q;
  document.getElementById('qk-mapel-badge').textContent = `${getMapelEmoji(q.label)} ${q.label || 'Soal'}`;
  document.getElementById('qk-feedback').style.display = 'none';

  const opts = document.getElementById('quiz-opts');
  const optColors = ['#4D96FF','#FF6B35','#6BCB77','#C77DFF'];
  const optLetters = ['A','B','C','D'];
  opts.innerHTML = (q.opts || []).map((o, i) => `
    <button onclick="selectAnswer(${i}, this)"
      style="width:100%;padding:14px 18px;border-radius:16px;border:2.5px solid ${optColors[i%4]}30;
             background:white;font-family:Nunito,sans-serif;font-weight:700;font-size:15px;
             cursor:pointer;transition:all 0.2s;text-align:left;display:flex;align-items:center;gap:12px"
      onmouseover="if(!this.dataset.answered)this.style.background='${optColors[i%4]}15'"
      onmouseout="if(!this.dataset.answered)this.style.background='white'">
      <span style="width:32px;height:32px;border-radius:50%;background:${optColors[i%4]}20;color:${optColors[i%4]};
                   font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${optLetters[i]}
      </span>
      <span>${o}</span>
    </button>`).join('');

  startTimer();
}

function startTimer() {
  clearInterval(timer);
  timeLeft = 15;
  document.getElementById('quiz-timer').textContent = timeLeft;
  document.getElementById('quiz-timer').style.background = 'rgba(255,255,255,0.25)';
  timer = setInterval(() => {
    timeLeft--;
    document.getElementById('quiz-timer').textContent = timeLeft;
    if (timeLeft <= 5) document.getElementById('quiz-timer').style.background = 'rgba(255,0,0,0.35)';
    if (timeLeft <= 0) { clearInterval(timer); timeExpired(); }
  }, 1000);
}

function timeExpired() {
  if (answered) return;
  answered = true;
  qkLives = Math.max(0, qkLives - 1);
  document.getElementById('qk-lives').textContent = qkLives;

  // Show correct answer
  const btns = document.querySelectorAll('#quiz-opts button');
  if (btns[questions[qIdx].ans]) {
    btns[questions[qIdx].ans].style.background = '#E8F8EE';
    btns[questions[qIdx].ans].style.borderColor = '#6BCB77';
  }
  showFeedback(false, questions[qIdx].jawaban, 0);
  if (qkLives <= 0) { setTimeout(() => stageFailed(), 1600); return; }
}

function selectAnswer(i, btn) {
  if (answered) return;
  answered = true;
  clearInterval(timer);
  btn.dataset.answered = '1';

  const correct = questions[qIdx].ans;
  const btns    = document.querySelectorAll('#quiz-opts button');
  btns.forEach(b => b.style.pointerEvents = 'none');

  if (i === correct) {
    btn.style.background = '#E8F8EE';
    btn.style.borderColor = '#6BCB77';
    const bonus = Math.max(50, timeLeft * 10) + questions[qIdx].poin;
    score += bonus;
    correctCount++;
    document.getElementById('quiz-score').textContent = score;
    showFeedback(true, questions[qIdx].jawaban, bonus);
  } else {
    btn.style.background = '#FFF0F0';
    btn.style.borderColor = '#FF4757';
    if (btns[correct]) { btns[correct].style.background = '#E8F8EE'; btns[correct].style.borderColor = '#6BCB77'; }
    qkLives = Math.max(0, qkLives - 1);
    document.getElementById('qk-lives').textContent = qkLives;
    showFeedback(false, questions[qIdx].jawaban, 0);
    if (qkLives <= 0) { setTimeout(() => stageFailed(), 1600); return; }
  }
}

function showFeedback(benar, jawabanBenar, poin) {
  const fb = document.getElementById('qk-feedback');
  fb.style.display = 'block';
  fb.style.background = benar ? '#E8F8EE' : '#FFF0F0';
  document.getElementById('qk-feedback-title').textContent = benar ? `Benar! 🎉 +${poin} poin` : 'Kurang tepat 😅';
  document.getElementById('qk-feedback-title').style.color = benar ? '#27AE60' : '#E74C3C';
  document.getElementById('qk-feedback-sub').textContent = benar ? 'Pertahankan semangatmu!' : `Jawaban: ${jawabanBenar}`;
  document.getElementById('qk-feedback-sub').style.color = benar ? '#27AE60' : '#E74C3C';
  const nextBtn = document.getElementById('qk-next-btn');
  nextBtn.style.background = benar ? '#27AE60' : '#E74C3C';
  nextBtn.style.color = 'white';
}

function nextQuestion() {
  qIdx++;
  if (qIdx >= questions.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

function stageFailed() {
  clearInterval(timer);
  document.getElementById('quiz-playing').style.display = 'none';
  document.getElementById('quiz-result').style.display = 'block';
  document.getElementById('qk-feedback').style.display = 'none';

  const pct = Math.round(correctCount / questions.length * 100);
  document.getElementById('result-emoji').textContent = '💔';
  document.getElementById('result-stars').textContent = '';
  document.getElementById('result-title').textContent = 'Nyawa Habis!';
  document.getElementById('qk-result-stats').innerHTML = `
    <div style="background:#FFF0F0;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#E74C3C">${correctCount}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Benar</div>
    </div>
    <div style="background:#F0F8FF;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#4D96FF">${pct}%</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Akurasi</div>
    </div>
    <div style="background:#FFF3E8;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--orange)">${score}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Poin</div>
    </div>`;
}

function showResult() {
  clearInterval(timer);
  document.getElementById('quiz-playing').style.display = 'none';
  document.getElementById('quiz-result').style.display  = 'block';
  document.getElementById('qk-feedback').style.display  = 'none';

  const pct   = Math.round(correctCount / questions.length * 100);
  const stars = pct >= 90 ? '⭐⭐⭐' : pct >= 60 ? '⭐⭐' : '⭐';
  const xpBonus = QK_STAGE_XP[qkActiveStage] || 50;

  document.getElementById('result-emoji').textContent = pct >= 60 ? '🎉' : '😊';
  document.getElementById('result-stars').textContent = stars;
  document.getElementById('result-title').textContent = pct >= 90 ? 'Sempurna!' : pct >= 60 ? 'Bagus!' : 'Ayo coba lagi!';
  document.getElementById('qk-result-stats').innerHTML = `
    <div style="background:#E8F8EE;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#27AE60">${correctCount}/${questions.length}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Benar</div>
    </div>
    <div style="background:#FFF3E8;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--orange)">${score}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">Total Poin</div>
    </div>
    <div style="background:#EEF5FF;border-radius:16px;padding:16px">
      <div style="font-family:'Fredoka One',cursive;font-size:28px;color:#4D96FF">+${pct>=60?xpBonus:Math.round(xpBonus*0.3)}</div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">XP</div>
    </div>`;

  // Tandai stage selesai jika lulus (>= 60%)
  if (pct >= 60 && qkActiveKategori) {
    qkStageProgress[`${qkActiveKategori.id}_${qkActiveStage}`] = 'done';
    // Update XP user
    if (currentUser) {
      currentUser.xp = (currentUser.xp || 0) + xpBonus;
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      api('PUT', '/auth/profile', { nama: currentUser.nama }).catch(() => {});
    }
  }
}



// ============================================================
//  AUTO LOGIN jika token masih ada
// ============================================================
window.addEventListener('load', () => {
  initGlobalDarkMode();
  // Cek reset_token di URL
  const urlParams = new URLSearchParams(location.search);
  const resetToken = urlParams.get('reset_token');
  if (resetToken) {
    _resetToken = resetToken;
    history.replaceState(null, '', '/'); // hapus token dari URL
    showPage('page-reset');
    return;
  }

  if (token && currentUser) {
    joinPrivateChannel();
    loadBellNotifications();
    setTimeout(() => subscribePush(), 3000);
    if (currentUser.role === 'guru') {
      loadGuruDashboard();
      remindDataDiriIfNeeded();
    } else if (currentUser.role === 'orangtua') {
      loadOrangtuaDashboard();
    } else {
      loadMuridDashboard();
      remindDataDiriIfNeeded();
    }
  }
  populateMapelSelects();
  populateBuatKelasMapel();

  // Logo navbar bisa diklik -> kembali ke beranda sesuai peran
  document.querySelectorAll('.navbar .logo').forEach(logo => {
    logo.setAttribute('role', 'button');
    logo.setAttribute('tabindex', '0');
    logo.setAttribute('title', 'Kembali ke beranda');
    logo.addEventListener('click', goHome);
    logo.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); }
    });
  });

  // Inisialisasi Google login setelah semua fungsi dan DOM siap
  // Polling karena library Google load async — tunggu max 5 detik
  let _gTry = 0;
  const _gPoll = setInterval(() => {
    _gTry++;
    if (typeof google !== 'undefined' && google.accounts) {
      clearInterval(_gPoll);
      _initGoogle();
    } else if (_gTry > 50) {
      clearInterval(_gPoll); // timeout 5 detik
    }
  }, 100);
});

// ============================================================
//  TABS KELAS
// ============================================================
let currentKelasTab = 'materi';

function switchKelasTab(tab) {
  currentKelasTab = tab;
  document.getElementById('tab-materi-btn').classList.toggle('active', tab === 'materi');
  document.getElementById('tab-kuis-btn').classList.toggle('active', tab === 'kuis');
  document.getElementById('tab-murid-btn').classList.toggle('active', tab === 'murid');
  document.getElementById('tab-chat-btn').classList.toggle('active', tab === 'chat');
  document.getElementById('tab-penilaian-btn')?.classList.toggle('active', tab === 'penilaian');
  document.getElementById('kelas-stream').style.display = tab === 'materi' ? 'block' : 'none';
  document.getElementById('kelas-kuis-stream').style.display = tab === 'kuis' ? 'block' : 'none';
  document.getElementById('kelas-murid-stream').style.display = tab === 'murid' ? 'block' : 'none';
  document.getElementById('kelas-chat-stream').style.display = tab === 'chat' ? 'block' : 'none';
  document.getElementById('kelas-penilaian-stream').style.display = tab === 'penilaian' ? 'block' : 'none';
  if (tab === 'murid' && currentKelas) loadKelasMurid(currentKelas.id);
  if (tab === 'penilaian' && currentKelas) loadPenilaianKelas(currentKelas.id);
  if (tab === 'chat') {
    document.getElementById('tab-chat-btn').textContent = '💬 Chat';
    scrollChatToBottom();
  }
}

// ============================================================
//  KUIS KELAS — LOAD
// ============================================================
let semua_soal_cache = [];

let allKuisData = []; // cache untuk filter
let activeKuisFilter = 'semua';

function filterKuis(tipe) {
  activeKuisFilter = tipe;
  // Update tombol aktif
  ['semua','fun','pr','deadline'].forEach(t => {
    document.getElementById('filter-' + t)?.classList.toggle('active', t === tipe);
  });
  renderKuisFiltered();
}

function renderKuisFiltered() {
  const isGuru = currentUser?.role === 'guru';
  const now = new Date();
  let filtered = [...allKuisData];

  if (activeKuisFilter === 'fun') {
    filtered = filtered.filter(q => q.tipe === 'fun' || !q.tipe);
  } else if (activeKuisFilter === 'pr') {
    filtered = filtered.filter(q => q.tipe === 'pr');
  } else if (activeKuisFilter === 'deadline') {
    filtered = filtered.filter(q => {
      if (!q.deadline) return false;
      const diff = new Date(q.deadline) - now;
      return diff > 0 && diff < 86400000 * 3; // 3 hari ke depan
    });
  }

  // Sort: deadline terdekat di atas, lalu fun quiz
  filtered.sort((a, b) => {
    // PR dengan deadline < 24 jam paling atas
    const dA = a.deadline ? new Date(a.deadline) - now : Infinity;
    const dB = b.deadline ? new Date(b.deadline) - now : Infinity;
    if (dA < 86400000 && dB >= 86400000) return -1;
    if (dB < 86400000 && dA >= 86400000) return 1;
    if (a.deadline && b.deadline) return dA - dB;
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const container = document.getElementById('kuis-list-container');
  if (!container) return;

  if (filtered.length === 0) {
    const labels = { semua: 'belum ada kuis atau tugas', fun: 'belum ada Fun Quiz', pr: 'belum ada Tugas/PR', deadline: 'tidak ada tugas dengan deadline dekat' };
    if (isGuru && (activeKuisFilter === 'semua' || activeKuisFilter === 'fun' || activeKuisFilter === 'pr')) {
      const isFun = activeKuisFilter !== 'pr';
      const isPr = activeKuisFilter !== 'fun';
      container.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
        ${isFun ? `<div onclick="tambahKuisBaru('fun')"
          style="border:2.5px dashed #FFCC99;border-radius:18px;padding:28px 24px;text-align:center;cursor:pointer;transition:all 0.2s;background:#FFFAF5"
          onmouseover="this.style.borderColor='var(--orange)';this.style.background='#FFF3E6'"
          onmouseout="this.style.borderColor='#FFCC99';this.style.background='#FFFAF5'">
          <div style="font-size:36px;margin-bottom:10px">⚡</div>
          <div style="font-weight:800;font-size:14px;color:var(--orange);margin-bottom:4px">Belum ada Fun Quiz</div>
          <div style="font-size:12px;color:var(--muted)">Klik di sini untuk membuat Fun Quiz</div>
        </div>` : ''}
        ${isPr ? `<div onclick="tambahKuisBaru('pr')"
          style="border:2.5px dashed #A0C4FF;border-radius:18px;padding:28px 24px;text-align:center;cursor:pointer;transition:all 0.2s;background:#F5F9FF"
          onmouseover="this.style.borderColor='var(--blue)';this.style.background='#EEF5FF'"
          onmouseout="this.style.borderColor='#A0C4FF';this.style.background='#F5F9FF'">
          <div style="font-size:36px;margin-bottom:10px">📝</div>
          <div style="font-weight:800;font-size:14px;color:var(--blue);margin-bottom:4px">Belum ada Tugas/PR</div>
          <div style="font-size:12px;color:var(--muted)">Klik di sini untuk membuat Tugas/PR</div>
        </div>` : ''}
      </div>`;
    } else {
      container.innerHTML = `<div style="text-align:center;padding:40px 24px">
        <div style="font-size:48px;margin-bottom:12px">📋</div>
        <p style="font-weight:700;color:var(--text);margin-bottom:6px">Kosong!</p>
        <p style="font-size:14px;color:var(--muted)">${isGuru ? `Belum ada ${labels[activeKuisFilter]}` : `${labels[activeKuisFilter].charAt(0).toUpperCase() + labels[activeKuisFilter].slice(1)}`}</p>
      </div>`;
    }
    return;
  }
  container.innerHTML = filtered.map(q => renderKuisCard(q, isGuru)).join('');
}

async function loadKelasKuis(kelasId) {
  const el = document.getElementById('kelas-kuis-stream');
  const container = document.getElementById('kuis-list-container');
  if (container) container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat...</div>';

  const isGuru = currentUser?.role === 'guru';
  try {
    const data = await api('GET', `/quiz?kelas_id=${kelasId}`);
    allKuisData = data.quiz || data.data || [];

    // Cek status pengerjaan / submission murid — semua paralel
    if (!isGuru) {
      await Promise.all(allKuisData.map(async q => {
        try {
          if (q.tipe_submission) {
            const cek = await api('GET', `/quiz/${q.id}/submission/cek`);
            q.sudah_dikerjakan = cek.sudah || false;
            q.nilai_submission = cek.submission?.nilai ?? null;
            q.feedback_submission = cek.submission?.feedback ?? null;
          } else {
            const cek = await api('GET', `/quiz/hasil/cek?quiz_id=${q.id}`);
            q.sudah_dikerjakan = cek.sudah || false;
            q.skor_terakhir = cek.hasil?.skor || 0;
          }
        } catch(e) { q.sudah_dikerjakan = false; }
      }));
      tampilDeadlineAlert(allKuisData);
    }

    // Reset filter ke semua
    activeKuisFilter = 'semua';
    ['semua','fun','pr','deadline'].forEach(t => {
      document.getElementById('filter-' + t)?.classList.toggle('active', t === 'semua');
    });

    // Update badge count filter deadline
    const now = new Date();
    const jumlahDeadline = allKuisData.filter(q => {
      if (!q.deadline || q.sudah_dikerjakan) return false;
      const diff = new Date(q.deadline) - now;
      return diff > 0 && diff < 86400000 * 3;
    }).length;
    const filterDeadlineBtn = document.getElementById('filter-deadline');
    if (filterDeadlineBtn) {
      filterDeadlineBtn.textContent = `⏰ Deadline Dekat${jumlahDeadline > 0 ? ` (${jumlahDeadline})` : ''}`;
      if (jumlahDeadline > 0) filterDeadlineBtn.style.borderColor = 'var(--red)';
    }

    renderKuisFiltered();
  } catch(e) {
    if (container) container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Gagal memuat. Pastikan backend sudah ada route /api/quiz</p></div>';
  }
}

function renderKuisCard(q, isGuru) {
  const isFun = q.tipe === 'fun' || !q.tipe;
  const icon = isFun ? '⚡' : '📝';
  const iconBg = isFun ? 'linear-gradient(135deg,#FF6B35,#FF8C42)' : 'linear-gradient(135deg,#4D96FF,#6AADFF)';
  const tglBuat = new Date(q.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'long' });

  const sudahDikerjakan = q.sudah_dikerjakan || false;

  let deadlineHtml = '';
  const deadlineLewat = !isFun && q.deadline && new Date(q.deadline) < new Date();
  if (!isFun && q.deadline && !sudahDikerjakan && !deadlineLewat) {
    const dl = new Date(q.deadline);
    const now = new Date();
    const diff = dl - now;
    const cls = diff < 86400000 ? 'deadline-soon' : 'deadline-ok';
    const label = diff < 3600000 ? `⏰ ${Math.floor(diff/60000)} menit lagi` : diff < 86400000 ? `⚠️ ${Math.floor(diff/3600000)} jam lagi` : `📅 ${dl.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})} ${dl.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`;
    deadlineHtml = `<div class="qsc-deadline ${cls}">${label}</div>`;
  }

  let actionHtml = '';
  const isSubmission = !!q.tipe_submission;

  if (isGuru) {
    actionHtml = `<div style="display:flex;gap:6px;align-items:center">
      ${isSubmission ? `<button onclick="lihatSubmissionGuru('${q.id}','${(q.judul||'').replace(/'/g,"\\'")}','${q.kelas_id||''}')" style="background:#EEF5FF;color:var(--blue);border:none;border-radius:10px;padding:7px 14px;font-family:Nunito,sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap">📋 Lihat Submission</button>` : ''}
      <button class="btn-icon btn-delete" onclick="hapusKuis('${q.id}','${(q.judul||'').replace(/'/g,"\\'")}') " title="Hapus">🗑️</button>
    </div>`;
  } else if (isSubmission) {
    if (sudahDikerjakan) {
      const nilai = q.nilai_submission;
      const fb = q.feedback_submission;
      actionHtml = `<div class="qsc-done-badge" style="flex-direction:column;align-items:flex-end;gap:4px;max-width:180px">
        <span>✅ Sudah dikumpulkan</span>
        ${nilai != null ? `<span style="font-size:14px;font-weight:900;color:${nilai>=80?'var(--green)':nilai>=60?'var(--orange)':'var(--red)'}">${nilai}<span style="font-size:11px;font-weight:700"> / 100</span></span>` : '<span style="font-size:11px;color:var(--muted)">Menunggu penilaian...</span>'}
        ${fb ? `<div style="font-size:11px;font-weight:700;color:#5A6A9A;background:#EEF5FF;border-radius:8px;padding:4px 8px;text-align:right;word-break:break-word;max-width:180px">💬 ${fb}</div>` : ''}
      </div>`;
    } else if (deadlineLewat) {
      actionHtml = `<div class="qsc-deadline deadline-over">⛔ Tenggat terlewat</div>`;
    } else {
      actionHtml = `<button class="qsc-play-btn" style="background:var(--blue);color:white" onclick="bukaFormSubmission('${q.id}')">📤 Kumpulkan</button>`;
    }
  } else if (sudahDikerjakan) {
    const nilaiColor = q.skor_terakhir >= 80 ? 'var(--green)' : q.skor_terakhir >= 60 ? 'var(--orange)' : 'var(--red)';
    actionHtml = `<div class="qsc-done-badge" style="flex-direction:column;align-items:flex-end;gap:2px">
      <span>✅ Sudah dikerjakan</span>
      <span style="font-size:15px;font-weight:900;color:${nilaiColor}">${q.skor_terakhir || 0}<span style="font-size:11px;font-weight:700"> / 100</span></span>
    </div>`;
  } else if (deadlineLewat) {
    actionHtml = `<div class="qsc-deadline deadline-over">⛔ Tenggat terlewat</div>`;
  } else {
    const totalSoal = q.total_soal || q.jumlah_soal || 0;
    if (!isSubmission && totalSoal === 0) {
      actionHtml = `<div style="font-size:12px;color:var(--muted);font-weight:700;background:#F5F5F5;padding:7px 14px;border-radius:10px">📭 Belum ada soal</div>`;
    } else {
      actionHtml = `<button class="qsc-play-btn" style="background:${isFun ? 'var(--orange)' : 'var(--blue)'};color:white" onclick="mulaiKuisKelas('${q.id}')">
        ${isFun ? '⚡ Main!' : '📝 Kerjakan'}
      </button>`;
    }
  }

  return `<div class="quiz-stream-card" style="background:white">
    <div class="qsc-header">
      <div class="qsc-icon" style="background:${iconBg}">${icon}</div>
      <div class="qsc-meta">
        <div class="qsc-title">${q.judul}</div>
        ${q.deskripsi ? `<div style="font-size:13px;color:var(--text);margin:3px 0 4px;line-height:1.4;font-weight:600">${q.deskripsi}</div>` : ''}
        <div class="qsc-sub">
          <span>${isFun ? '⚡ Fun Quiz' : '📝 Tugas / PR'}</span>
          <span>·</span>
          <span>${tglBuat}</span>
        </div>
      </div>
      ${isGuru ? actionHtml : ''}
    </div>
    <div class="qsc-body">
      <div class="qsc-stats">
        ${isSubmission
          ? `<div class="qsc-stat" style="background:#EEF5FF"><div class="qsc-stat-num" style="font-size:16px">${{'file':'📄','gambar':'🖼️','link':'🔗','teks':'✏️','semua':'📤'}[q.tipe_submission]||'📤'}</div><div class="qsc-stat-label">Submission</div></div>`
          : `<div class="qsc-stat"><div class="qsc-stat-num">${(q.total_soal || q.jumlah_soal) > 0 ? (q.total_soal || q.jumlah_soal) : '0'}</div><div class="qsc-stat-label">Soal</div></div>`
        }
        ${isFun && !isSubmission ? `<div class="qsc-stat"><div class="qsc-stat-num">${q.durasi || 15}s</div><div class="qsc-stat-label">Per soal</div></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${deadlineHtml}
        ${!isGuru ? actionHtml : ''}
      </div>
    </div>
  </div>`;
}

// ============================================================
//  BUAT KUIS
// ============================================================
let currentTipeKuis = 'fun';
let allSoalData = [];

function switchTipeKuis(tipe) {
  currentTipeKuis = tipe;
  ['fun','pr'].forEach(t => {
    const el = document.getElementById('tipe-' + t);
    const active = t === tipe;
    el.style.border = active ? '2.5px solid var(--orange)' : '2.5px solid #eee';
    el.style.background = active ? '#FFF3E8' : 'white';
    el.querySelector('div:nth-child(2)').style.color = active ? 'var(--orange)' : 'var(--muted)';
  });
  document.getElementById('kuis-deadline-wrap').style.display = tipe === 'pr' ? 'block' : 'none';
  document.getElementById('kuis-durasi-wrap').style.display = tipe === 'fun' ? 'block' : 'none';
  document.getElementById('kuis-submission-wrap').style.display = tipe === 'pr' ? 'block' : 'none';
  if (tipe === 'fun') {
    document.getElementById('kuis-pakai-submission').checked = false;
    document.getElementById('kuis-submission-detail').style.display = 'none';
  }
}

let _selectedSubmissionTipe = '';

function toggleSubmissionSection(checked) {
  document.getElementById('kuis-submission-detail').style.display = checked ? 'block' : 'none';
  if (!checked) { _selectedSubmissionTipe = ''; document.getElementById('kuis-submission-tipe').value = ''; }
}

function selectSubmissionTipe(tipe) {
  _selectedSubmissionTipe = tipe;
  document.getElementById('kuis-submission-tipe').value = tipe;
  ['file','gambar','link','teks'].forEach(t => {
    const el = document.getElementById('sub-tipe-' + t);
    if (!el) return;
    el.style.border = t === tipe || tipe === 'semua' ? '2px solid var(--blue)' : '2px solid #eee';
    el.style.background = t === tipe || tipe === 'semua' ? '#EEF5FF' : 'white';
  });
}

let kuisSoalTabAktif = 'bank';
let aiSoalUntukKuis = []; // soal yang digenerate AI untuk kuis ini

function switchKuisSoalTab(tab) {
  kuisSoalTabAktif = tab;
  document.getElementById('kuis-panel-bank').style.display = tab === 'bank' ? 'block' : 'none';
  document.getElementById('kuis-panel-ai').style.display   = tab === 'ai'   ? 'block' : 'none';
  document.getElementById('kuis-tab-bank').style.background = tab === 'bank' ? 'var(--orange)' : 'white';
  document.getElementById('kuis-tab-bank').style.color      = tab === 'bank' ? 'white' : 'var(--muted)';
  document.getElementById('kuis-tab-ai').style.background   = tab === 'ai' ? 'linear-gradient(135deg,#7b2ff7,#a64cff)' : 'white';
  document.getElementById('kuis-tab-ai').style.color        = tab === 'ai' ? 'white' : 'var(--muted)';
  updateKuisTotalLabel();
}

function updateKuisTotalLabel() {
  const bankCount = document.querySelectorAll('.soal-check:checked').length;
  const aiCount   = document.querySelectorAll('.ai-soal-check:checked').length;
  const total = bankCount + aiCount;
  const label = document.getElementById('kuis-total-label');
  if (label) label.textContent = total > 0 ? `✅ Total ${total} soal dipilih (${bankCount} bank + ${aiCount} AI)` : '';
}

async function generateSoalUntukKuis() {
  const topik   = document.getElementById('kuis-ai-topik').value.trim();
  const jumlah  = parseInt(document.getElementById('kuis-ai-jumlah').value);
  const tingkat = document.getElementById('kuis-ai-tingkat').value;
  const mapel   = document.getElementById('kuis-ai-mapel').value || 'Umum';
  if (!topik) { toast('Masukkan topik soal dulu!', 'error'); return; }

  const btn = document.getElementById('kuis-ai-gen-btn');
  btn.disabled = true;

  // Kurangi batch size ke 3 agar tidak kena rate limit Groq (6000 TPM)
  const BATCH_SIZE = 3;
  const totalBatch = Math.ceil(jumlah / BATCH_SIZE);
  let semuaSoal = [];
  const aspekList = [
    'pengertian dan definisi','contoh dan penerapan nyata','proses dan cara kerja',
    'perbandingan dan perbedaan','fungsi dan manfaat','rumus dan perhitungan',
    'ciri-ciri dan karakteristik','dampak dan akibat','sejarah dan asal-usul','fakta unik'
  ];

  try {
    for (let b = 0; b < totalBatch; b++) {
      const soalBatch = Math.min(BATCH_SIZE, jumlah - semuaSoal.length);
      const sudahAda  = semuaSoal.length;
      btn.textContent = `⏳ Batch ${b+1}/${totalBatch} (${sudahAda}/${jumlah} soal)...`;

      // Sudut pandang acak per batch agar soal lebih bervariasi
      const sudutPandang = [
        'aplikasi nyata di kehidupan sehari-hari','kasus pengecualian dan kondisi khusus',
        'miskonsepsi umum yang harus diluruskan','perbandingan dan perbedaan mendalam',
        'perspektif historis dan perkembangannya','dampak, implikasi, dan konsekuensi',
        'proses mekanisme dan cara kerja detail','fakta jarang diketahui dan unik',
        'hubungan sebab-akibat','analisis kritis dan evaluasi'
      ];
      const sudut = sudutPandang[(b * 3 + Math.floor(Math.random() * sudutPandang.length)) % sudutPandang.length];
      const seed = Math.random().toString(36).substring(2, 9); // variasi unik tiap request

      // Retry logic untuk handle rate limit Groq
      let res, retryCount = 0;
      while (retryCount < 3) {
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || localStorage.getItem('kb_token') || '') },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            max_tokens: 1500,
            temperature: 0.98,
            top_p: 0.92,
            messages: [{
              role: 'system',
              content: `Kamu adalah ahli pembuat soal ujian kreatif untuk siswa Indonesia.
ATURAN KETAT — ikuti semua:
1. Balas HANYA JSON object: {"soal":[...]} tanpa teks apapun di luar JSON.
2. Buat CAMPURAN tipe soal: sekitar 65% pilihan_ganda, 35% benar_salah.
3. Untuk pilihan_ganda: "jawaban" HARUS teks PERSIS SAMA dengan salah satu item di "opsi". Verifikasi sebelum menulis.
4. Untuk benar_salah: "opsi" HARUS persis ["Benar","Salah"]. Jawaban harus MIX — sekitar separuh "Benar" dan separuh "Salah". JANGAN semua jawabannya "Benar". Buat pernyataan yang salah agar jawabannya "Salah".
5. VARIASIKAN posisi jawaban benar di PG — jangan selalu opsi pertama.
6. Semua opsi PG harus masuk akal dan relevan, bukan jebakan murahan.
7. Pastikan fakta/jawaban secara akademis BENAR dan tidak ambigu.
8. Setiap soal harus UNIK — topik, angle, dan cara bertanya harus berbeda satu sama lain.`
            }, {
              role: 'user',
              content: `[variasi:${seed}] Buat tepat ${soalBatch} soal UNIK untuk:
- Mata pelajaran: ${mapel}
- Topik: ${topik}
- Aspek fokus: ${aspekList[b % aspekList.length]}
- Sudut pandang kreatif: ${sudut}
- Tingkat kesulitan: ${tingkat}
- Nomor soal: ${sudahAda + 1} s/d ${sudahAda + soalBatch}${semuaSoal.length > 0 ? '\n\nWAJIB BERBEDA dari soal berikut:\n' + semuaSoal.map((s,i) => `${i+1}. ${s.pertanyaan}`).join('\n') : ''}

Format JSON wajib:
{"soal":[
  {"jenis":"pilihan_ganda","pertanyaan":"...?","emoji":"📝","opsi":["A...","B...","C...","D..."],"jawaban":"teks SAMA PERSIS dengan salah satu opsi","poin":100},
  {"jenis":"benar_salah","pertanyaan":"Pernyataan faktual...","emoji":"✅","opsi":["Benar","Salah"],"jawaban":"Benar","poin":75}
]}`
            }]
          })
        });

        const resJson = await res.json();
        // Backend membungkus: { success, data: { choices } } atau { success: false, pesan }
        const resData = resJson.data || resJson;

        // Cek rate limit
        const errMsg = resJson.pesan || resData.error?.message || '';
        if (errMsg.includes('rate_limit') || errMsg.includes('tokens per minute') || errMsg.includes('429')) {
          retryCount++;
          btn.textContent = `⏳ Rate limit! Tunggu ${12 * retryCount} detik... (${retryCount}/3)`;
          toast(`Rate limit AI, retry ke-${retryCount}...`, '');
          await new Promise(r => setTimeout(r, 12000 * retryCount));
          continue;
        }

        if (!resJson.success && resJson.pesan) throw new Error(resJson.pesan);
        if (resData.error) throw new Error(resData.error.message);

        let teks = resData.choices?.[0]?.message?.content || '{}';
        let batchSoal;
        try {
          // Parse output AI → ambil field "soal"
          const parsed = JSON.parse(teks);
          // Dukung berbagai bentuk: {soal:[...]}, {questions:[...]}, atau langsung array
          batchSoal = parsed.soal || parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : []);
        } catch(parseErr) {
          // Fallback: coba ekstrak array dari teks mentah
          teks = teks.replace(/```json\n?/gi,'').replace(/```\n?/g,'').trim();
          // Hapus <think>...</think> jika ada
          teks = teks.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          // Fix emoji tanpa tanda kutip: "emoji": 🚀 → "emoji": "🚀"
          teks = teks.replace(/"emoji"\s*:\s*(?!")([^,}\]\n]+)/g, (_, v) => `"emoji": "${v.trim()}"`);
          const arrStart = teks.indexOf('[');
          const arrEnd = teks.lastIndexOf(']');
          if (arrStart !== -1 && arrEnd !== -1) {
            let arrTeks = teks.substring(arrStart, arrEnd + 1);
            // Repair truncated: cari closing brace terakhir
            if (!arrTeks.trimEnd().endsWith(']')) {
              const lastBrace = arrTeks.lastIndexOf('}');
              if (lastBrace !== -1) arrTeks = arrTeks.substring(0, lastBrace + 1) + ']';
            }
            try { batchSoal = JSON.parse(arrTeks); }
            catch(e2) {
              // Hapus objek terakhir yang mungkin terpotong
              const idx = arrTeks.lastIndexOf('},{');
              if (idx !== -1) {
                try { batchSoal = JSON.parse(arrTeks.substring(0, idx + 1) + ']'); }
                catch(e3) { throw new Error('Format JSON dari AI tidak valid, coba generate ulang.'); }
              } else { throw new Error('Format JSON dari AI tidak valid, coba generate ulang.'); }
            }
          } else { throw new Error('Format JSON dari AI tidak valid, coba generate ulang.'); }
        }

        // ✅ Normalisasi & validasi per tipe soal
        batchSoal = batchSoal.map(s => {
          if (!s.pertanyaan || !s.opsi || !Array.isArray(s.opsi)) return null;
          if (s.jenis === 'benar_salah') {
            s.opsi = ['Benar', 'Salah'];
            if (!['Benar','Salah'].includes(s.jawaban)) s.jawaban = 'Benar';
          } else {
            s.jenis = 'pilihan_ganda';
            if (s.opsi.length < 2) return null;
            const cocok = s.opsi.find(o => o.trim().toLowerCase() === s.jawaban?.trim().toLowerCase());
            s.jawaban = cocok ? cocok : s.opsi[0];
          }
          return s;
        }).filter(Boolean);

        // ✅ Deduplikasi
        batchSoal = batchSoal.filter(s => {
          const pBaru = s.pertanyaan.toLowerCase().replace(/\s+/g,' ').trim();
          return !semuaSoal.some(ex => {
            const pLama = ex.pertanyaan.toLowerCase().replace(/\s+/g,' ').trim();
            const wA = new Set(pBaru.split(' '));
            const wB = new Set(pLama.split(' '));
            const irisan = [...wA].filter(w => wB.has(w)).length;
            const gabungan = new Set([...wA, ...wB]).size;
            return irisan / gabungan > 0.65;
          });
        });

        semuaSoal = semuaSoal.concat(batchSoal);
        break; // sukses, keluar dari retry loop
      }

      if (retryCount >= 3) throw new Error('Rate limit Groq terus-menerus, coba lagi nanti');

      // Delay lebih lama antar batch: 3 detik untuk hindari rate limit
      if (b < totalBatch - 1) {
        btn.textContent = `⏳ Jeda sebentar... (${semuaSoal.length}/${jumlah} soal)`;
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    aiSoalUntukKuis = semuaSoal.slice(0, jumlah);

    // Render checklist
    const listEl = document.getElementById('kuis-ai-soal-list');
    const pgCount = aiSoalUntukKuis.filter(s => s.jenis !== 'benar_salah').length;
    const bsCount = aiSoalUntukKuis.filter(s => s.jenis === 'benar_salah').length;
    listEl.innerHTML = `<div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:8px;padding:0 4px">🔵 ${pgCount} Pilihan Ganda · ⭕ ${bsCount} Benar/Salah</div>` +
    aiSoalUntukKuis.map((s, i) => {
      const isBS = s.jenis === 'benar_salah';
      const tipeBadge = isBS
        ? `<span style="background:#E8F5E9;color:#16A34A;font-size:10px;font-weight:800;padding:2px 7px;border-radius:50px">⭕ B/S</span>`
        : `<span style="background:#EEF5FF;color:var(--blue);font-size:10px;font-weight:800;padding:2px 7px;border-radius:50px">🔵 PG</span>`;
      const opsiStr = isBS ? 'Benar / Salah' : s.opsi.map((o,j)=>`${String.fromCharCode(65+j)}. ${o}`).join(' · ');
      return `
      <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;cursor:pointer;border-bottom:1px solid #F0EEFF;transition:background .15s" onmouseover="this.style.background='#F3EEFF'" onmouseout="this.style.background=''">
        <input type="checkbox" class="ai-soal-check" value="${i}" onchange="updateKuisTotalLabel()" checked style="margin-top:3px;width:16px;height:16px;cursor:pointer;accent-color:#7b2ff7">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">${tipeBadge}</div>
          <div style="font-weight:700;font-size:13px;line-height:1.5">${s.emoji||'❓'} ${s.pertanyaan}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">${opsiStr}</div>
        </div>
      </label>`;
    }).join('');

    document.getElementById('kuis-ai-count-label').textContent = `${aiSoalUntukKuis.length} soal digenerate`;
    document.getElementById('kuis-ai-soal-count').textContent = aiSoalUntukKuis.length;
    document.getElementById('kuis-ai-result').style.display = 'block';
    document.getElementById('kuis-ai-pilih-semua').checked = true;
    updateKuisTotalLabel();
    toast(`✨ ${aiSoalUntukKuis.length} soal berhasil digenerate!`, 'success');
  } catch(e) {
    toast('Gagal generate: ' + e.message, 'error');
    console.error(e);
  }
  btn.disabled = false;
  btn.textContent = '✨ Generate Soal!';
}

function pilihSemuaAI(checked) {
  document.querySelectorAll('.ai-soal-check').forEach(cb => cb.checked = checked);
  const count = checked ? aiSoalUntukKuis.length : 0;
  document.getElementById('kuis-ai-soal-count').textContent = count;
  updateKuisTotalLabel();
}

function updateSoalCount() {
  const count = document.querySelectorAll('.soal-check:checked').length;
  document.getElementById('kuis-soal-count').textContent = count;
  updateKuisTotalLabel();
}

function tambahKuisBaru(tipe) {
  if (!currentKelas) return;
  openBuatKuis(tipe || 'fun');
}

async function openBuatKuis(tipe) {
  if (!currentKelas) return;
  // Reset form
  currentTipeKuis = tipe || 'fun';
  kuisSoalTabAktif = 'bank';
  aiSoalUntukKuis = [];
  switchTipeKuis(currentTipeKuis);
  switchKuisSoalTab('bank');
  document.getElementById('kuis-judul').value = '';
  document.getElementById('kuis-deskripsi').value = '';
  document.getElementById('kuis-deadline').value = '';
  document.getElementById('kuis-durasi').value = '15';
  document.getElementById('kuis-pilih-semua').checked = false;
  document.getElementById('kuis-pakai-submission').checked = false;
  document.getElementById('kuis-submission-detail').style.display = 'none';
  document.getElementById('kuis-submission-tipe').value = '';
  _selectedSubmissionTipe = '';
  document.getElementById('kuis-ai-topik').value = '';
  document.getElementById('kuis-ai-result').style.display = 'none';
  document.getElementById('kuis-total-label').textContent = '';

  // Populate mapel untuk AI
  const mapelList = getMapelList();
  const aiMapelEl = document.getElementById('kuis-ai-mapel');
  if (aiMapelEl) {
    aiMapelEl.innerHTML = mapelList.length
      ? mapelList.map(m => `<option value="${m.nama}">${m.emoji} ${m.nama}</option>`).join('')
      : '<option value="Umum">📚 Umum</option>';
    // Set default ke mapel kelas
    if (currentKelas?.mapel) {
      for (let opt of aiMapelEl.options) {
        if (opt.value === currentKelas.mapel) { opt.selected = true; break; }
      }
    }
  }

  // Load soal bank
  openModal('modal-buat-kuis');
  await loadBankSoal();
}

function filterSoalKuis() {
  const mapel = document.getElementById('kuis-soal-mapel-filter').value;
  const kelas = document.getElementById('kuis-soal-kelas-filter').value;
  let filtered = allSoalData;
  if (mapel) filtered = filtered.filter(s => s.mapel === mapel);
  if (kelas) filtered = filtered.filter(s => !s.kelas_id || s.kelas_id === kelas);
  renderSoalChecklistKuis(filtered);
}

async function loadBankSoal() {
  const listEl = document.getElementById('kuis-soal-list');
  listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted)">Memuat soal...</div>';
  try {
    const data = await api('GET', '/soal');
    allSoalData = data.soal || data.data || [];

    // Populate filter mapel
    const mapels = [...new Set(allSoalData.map(s => s.mapel).filter(Boolean))];
    const filterMapel = document.getElementById('kuis-soal-mapel-filter');
    if (filterMapel) {
      filterMapel.innerHTML = '<option value="">📚 Semua Mapel</option>' +
        mapels.map(m => `<option value="${m}">${m}</option>`).join('');
      if (currentKelas?.mapel && mapels.includes(currentKelas.mapel)) filterMapel.value = currentKelas.mapel;
    }

    // Populate filter kelas dari data guru
    const kelasData = await api('GET', '/kelas');
    const kelasList = kelasData.data || [];
    const filterKelas = document.getElementById('kuis-soal-kelas-filter');
    if (filterKelas) {
      filterKelas.innerHTML = '<option value="">🏫 Semua Kelas</option>' +
        kelasList.map(k => `<option value="${k.id}">${k.nama}</option>`).join('');
      // Jangan auto-filter kelas agar semua soal guru tampil
    }

    filterSoalKuis();
  } catch(e) {
    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted)">Gagal memuat soal</div>';
  }
}

function renderSoalChecklistKuis(list) {
  const el = document.getElementById('kuis-soal-list');
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--muted)">Tidak ada soal untuk filter ini. Buat soal dulu!</div>';
    return;
  }
  el.innerHTML = list.map(s => {
    const jenis = s.jenis === 'pilihan_ganda' ? '🔵 PG' : s.jenis === 'isian' ? '✍️ Essay' : '✅ B/S';
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;border-bottom:1px solid #F5F5F5;transition:background 0.15s" onmouseover="this.style.background='#F8F9FA'" onmouseout="this.style.background=''">
      <label style="display:flex;align-items:flex-start;gap:10px;flex:1;cursor:pointer">
        <input type="checkbox" class="soal-check" value="${s.id}" onchange="updateSoalCount()" style="margin-top:3px;width:16px;height:16px;cursor:pointer;accent-color:var(--orange)">
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px;line-height:1.5">${s.emoji || '❓'} ${s.pertanyaan}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">${jenis} · ${s.mapel || '–'} · ${s.poin || 100} poin</div>
        </div>
      </label>
      <button onclick="hapusSoalBank('${s.id}', this)" title="Hapus soal" style="background:none;border:none;cursor:pointer;font-size:15px;opacity:0.4;padding:2px 4px;transition:opacity 0.2s;flex-shrink:0" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">🗑️</button>
    </div>`;
  }).join('');
  updateSoalCount();
}

async function hapusSoalBank(id, btn) {
  if (!confirm('Hapus soal ini dari bank soal? Soal yang sudah dipakai di kuis tidak akan terpengaruh.')) return;
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const data = await api('DELETE', `/soal/${id}`);
    if (data.success || data.pesan?.toLowerCase().includes('berhasil')) {
      // Hapus dari data lokal
      allSoalData = allSoalData.filter(s => s.id !== id);
      // Hapus elemen dari DOM
      btn.closest('div[style*="border-bottom"]').remove();
      updateSoalCount();
      toast('Soal berhasil dihapus! 🗑️', 'success');
    } else {
      toast(data.pesan || 'Gagal menghapus soal', 'error');
      btn.disabled = false;
      btn.textContent = '🗑️';
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
    btn.disabled = false;
    btn.textContent = '🗑️';
  }
}

function updateSoalCount() {
  const count = document.querySelectorAll('.soal-check:checked').length;
  document.getElementById('kuis-soal-count').textContent = count;

  // Tampilkan tombol hapus terpilih jika ada yang dicentang
  const btnHapus = document.getElementById('btn-hapus-terpilih');
  if (btnHapus) {
    if (count > 0) {
      btnHapus.style.display = '';
      btnHapus.textContent = '🗑️ Hapus ' + count + ' Soal';
    } else {
      btnHapus.style.display = 'none';
      btnHapus.textContent = '🗑️ Hapus Terpilih';
    }
  }
}

async function hapusSoalTerpilih() {
  const checked = Array.from(document.querySelectorAll('.soal-check:checked'));
  if (checked.length === 0) return;
  if (!confirm('Hapus ' + checked.length + ' soal terpilih dari bank soal?\n\nSoal yang sudah dipakai di kuis tidak akan terpengaruh.')) return;

  const ids = checked.map(cb => cb.value);
  let berhasil = 0, gagal = 0;
  const btnHapus = document.getElementById('btn-hapus-terpilih');
  btnHapus.disabled = true;
  btnHapus.textContent = '⏳ Menghapus...';

  for (const id of ids) {
    try {
      const data = await api('DELETE', `/soal/${id}`);
      if (data.success || data.pesan?.toLowerCase().includes('berhasil')) {
        allSoalData = allSoalData.filter(s => s.id !== id);
        const cb = document.querySelector('.soal-check[value="' + id + '"]');
        cb?.closest('div[style*="border-bottom"]')?.remove();
        berhasil++;
      } else gagal++;
    } catch(e) { gagal++; }
  }

  btnHapus.disabled = false;
  updateSoalCount();
  const pilihSemua = document.getElementById('kuis-pilih-semua');
  if (pilihSemua) pilihSemua.checked = false;

  if (berhasil > 0) toast('✅ ' + berhasil + ' soal dihapus!' + (gagal > 0 ? ' (' + gagal + ' gagal)' : ''), 'success');
  else toast('Gagal menghapus soal', 'error');
}

function pilihSemuaSoal(checked) {
  document.querySelectorAll('.soal-check').forEach(cb => cb.checked = checked);
  updateSoalCount();
}

async function submitBuatKuis() {
  const judul    = document.getElementById('kuis-judul').value.trim();
  const deskripsi = document.getElementById('kuis-deskripsi').value.trim();
  const deadlineRaw = document.getElementById('kuis-deadline').value;
  const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
  const durasi   = parseInt(document.getElementById('kuis-durasi').value) || 15;

  // Soal dari bank
  const soalBankIds = Array.from(document.querySelectorAll('.soal-check:checked')).map(cb => cb.value);

  // Soal dari AI yang dipilih
  const aiChecked = Array.from(document.querySelectorAll('.ai-soal-check:checked')).map(cb => parseInt(cb.value));
  const soalAITerpilih = aiSoalUntukKuis.filter((_, i) => aiChecked.includes(i));

  const totalSoal = soalBankIds.length + soalAITerpilih.length;

  const pakaiSubmission = document.getElementById('kuis-pakai-submission')?.checked || false;
  const tipeSubmission = pakaiSubmission ? (document.getElementById('kuis-submission-tipe')?.value || '') : null;

  if (!judul) { toast('Judul kuis harus diisi!', 'error'); return; }
  if (currentTipeKuis === 'pr' && !deadline) { toast('Tenggat waktu harus diisi untuk Tugas/PR!', 'error'); return; }
  if (pakaiSubmission && !tipeSubmission) { toast('Pilih tipe submission terlebih dahulu!', 'error'); return; }
  // Soal wajib hanya jika BUKAN tugas submission murni
  if (!pakaiSubmission && totalSoal === 0) { toast('Pilih minimal 1 soal dari bank atau generate dengan AI!', 'error'); return; }

  showLoading(true);
  try {
    const mapel = currentKelas?.mapel || document.getElementById('kuis-ai-mapel')?.value || 'Umum';
    let semuaSoalIds = [...soalBankIds];

    // Jika submission murni, skip proses soal sama sekali
    if (!pakaiSubmission) {
      // Simpan soal AI ke bank soal dulu, lalu ambil ID-nya
      if (soalAITerpilih.length > 0) {
        toast(`💾 Menyimpan ${soalAITerpilih.length} soal AI ke bank soal...`);
        for (const s of soalAITerpilih) {
          try {
            const jenisSoal = s.jenis === 'benar_salah' ? 'benar_salah' : 'pilihan_ganda';
            const opsiSoal = jenisSoal === 'benar_salah' ? ['Benar', 'Salah'] : s.opsi;
            const r = await api('POST', '/soal', {
              pertanyaan: s.pertanyaan,
              emoji: s.emoji || '❓',
              mapel,
              jenis: jenisSoal,
              opsi: JSON.stringify(opsiSoal),
              jawaban: s.jawaban,
              poin: s.poin || 100,
              tingkat: document.getElementById('kuis-ai-tingkat')?.value || 'sedang'
            });
            if (r.success && r.data?.id) semuaSoalIds.push(r.data.id);
          } catch(e) {}
        }
      }

      if (semuaSoalIds.length === 0) {
        toast('Gagal mendapatkan ID soal. Coba lagi!', 'error');
        showLoading(false); return;
      }
    }

    const data = await api('POST', '/quiz', {
      judul,
      deskripsi: deskripsi || null,
      mapel,
      kelas_id: currentKelas?.id,
      durasi,
      tipe: currentTipeKuis,
      deadline: deadline || null,
      status: 'aktif',
      soal_ids: semuaSoalIds.length > 0 ? semuaSoalIds : undefined,
      tipe_submission: tipeSubmission || null
    });

    if (!data.success) { toast(data.pesan || 'Gagal membuat kuis', 'error'); showLoading(false); return; }

    const aiInfo = soalAITerpilih.length > 0 ? ` (${soalBankIds.length} bank + ${soalAITerpilih.length} AI)` : '';
    toast(`🎉 Kuis "${judul}" berhasil dibuat! ${semuaSoalIds.length} soal${aiInfo}`, 'success');
    closeModal('modal-buat-kuis');
    aiSoalUntukKuis = [];
    switchKelasTab('kuis');
    await loadKelasKuis(currentKelas.id);
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

// ============================================================
//  HAPUS KUIS (GURU)
// ============================================================
async function hapusKuis(id, judul) {
  if (!confirm(`Hapus kuis "${judul}"?`)) return;
  showLoading(true);
  try {
    const data = await api('DELETE', `/quiz/${id}`);
    if (data.success || data.pesan?.toLowerCase().includes('berhasil')) {
      toast('Kuis dihapus! 🗑️', 'success');
      loadKelasKuis(currentKelas.id);
    } else {
      toast(data.pesan || 'Gagal menghapus kuis', 'error');
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

// ============================================================
//  SUBMISSION TUGAS (MURID)
// ============================================================
let _subQuizData = null;
let _subTipeAktif = '';
let _subFileObj = null;

async function bukaFormSubmission(quizId) {
  showLoading(true);
  try {
    const [quizRes, cekRes] = await Promise.all([
      api('GET', `/quiz/${quizId}`),
      api('GET', `/quiz/${quizId}/submission/cek`)
    ]);
    if (!quizRes.success) { toast('Gagal memuat tugas', 'error'); showLoading(false); return; }
    const q = quizRes.quiz;

    if (cekRes.sudah) {
      const sub = cekRes.submission;
      toast(`Kamu sudah mengumpulkan tugas ini${sub.nilai != null ? ' — Nilai: ' + sub.nilai + '/100' : ''}`, 'info');
      showLoading(false); return;
    }

    _subQuizData = q;
    _subTipeAktif = '';
    _subFileObj = null;

    document.getElementById('sub-modal-judul').textContent = '📤 ' + q.judul;
    const deskEl = document.getElementById('sub-modal-deskripsi');
    if (q.deskripsi) { deskEl.textContent = q.deskripsi; deskEl.style.display = 'block'; }
    else deskEl.style.display = 'none';

    if (q.deadline) {
      const dl = new Date(q.deadline);
      const diff = dl - new Date();
      const dlEl = document.getElementById('sub-modal-deadline');
      dlEl.innerHTML = diff > 0
        ? `<span style="color:${diff < 86400000 ? 'var(--red)' : 'var(--orange)'}">⏰ Tenggat: ${dl.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} ${dl.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>`
        : `<span style="color:var(--red)">⛔ Tenggat sudah lewat</span>`;
    } else document.getElementById('sub-modal-deadline').innerHTML = '';

    // Reset semua form
    ['teks','link','file','gambar'].forEach(t => {
      document.getElementById(`sub-form-${t}`).style.display = 'none';
    });
    document.getElementById('sub-catatan').value = '';
    hapusSubFile('file'); hapusSubFile('gambar');
    if (document.getElementById('sub-konten-teks')) document.getElementById('sub-konten-teks').value = '';
    if (document.getElementById('sub-konten-link')) document.getElementById('sub-konten-link').value = '';

    const tipe = q.tipe_submission;
    const pilihWrap = document.getElementById('sub-pilih-tipe');
    if (tipe === 'semua') {
      pilihWrap.style.display = 'block';
      document.getElementById('sub-tipe-pilihan').innerHTML = [
        { tipe:'file', label:'📄 File / PDF' },
        { tipe:'gambar', label:'🖼️ Foto/Gambar' },
        { tipe:'link', label:'🔗 Link/URL' },
        { tipe:'teks', label:'✏️ Teks/Esai' }
      ].map(o => `<button onclick="pilihTipeSubmission('${o.tipe}')" id="sub-pilih-${o.tipe}" style="padding:10px;border:2px solid #eee;border-radius:10px;background:white;cursor:pointer;font-family:Nunito,sans-serif;font-weight:700;font-size:13px;transition:all 0.2s">${o.label}</button>`).join('');
    } else {
      pilihWrap.style.display = 'none';
      pilihTipeSubmission(tipe);
    }
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
  openModal('modal-submission');
}

function pilihTipeSubmission(tipe) {
  _subTipeAktif = tipe;
  ['file','gambar','link','teks'].forEach(t => {
    document.getElementById(`sub-form-${t}`).style.display = t === tipe ? 'block' : 'none';
    const btn = document.getElementById('sub-pilih-' + t);
    if (btn) { btn.style.border = t === tipe ? '2px solid var(--blue)' : '2px solid #eee'; btn.style.background = t === tipe ? '#EEF5FF' : 'white'; }
  });
}

function previewSubFile(input, tipe) {
  const file = input.files[0];
  if (!file) return;
  _subFileObj = file;
  if (tipe === 'gambar') {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('sub-preview-gambar-img').src = e.target.result;
      document.getElementById('sub-preview-gambar').style.display = 'block';
      document.getElementById('sub-dropzone-gambar').style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById('sub-preview-file-nama').textContent = file.name;
    document.getElementById('sub-preview-file-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
    document.getElementById('sub-preview-file').style.display = 'flex';
    document.getElementById('sub-dropzone-file').style.display = 'none';
  }
}

function hapusSubFile(tipe) {
  _subFileObj = null;
  if (tipe === 'gambar') {
    document.getElementById('sub-preview-gambar').style.display = 'none';
    document.getElementById('sub-dropzone-gambar').style.display = 'block';
    const inp = document.getElementById('sub-input-gambar'); if (inp) inp.value = '';
  } else {
    document.getElementById('sub-preview-file').style.display = 'none';
    document.getElementById('sub-dropzone-file').style.display = 'block';
    const inp = document.getElementById('sub-input-file'); if (inp) inp.value = '';
  }
}

async function submitTugas() {
  if (!_subQuizData || !_subTipeAktif) { toast('Pilih tipe submission dulu!', 'error'); return; }
  const catatan = document.getElementById('sub-catatan').value.trim();
  const btn = document.getElementById('sub-submit-btn');
  btn.disabled = true; btn.textContent = '⏳ Mengirim...';
  try {
    let res;
    if (_subTipeAktif === 'teks') {
      const konten = document.getElementById('sub-konten-teks').value.trim();
      if (!konten) { toast('Isi teks tidak boleh kosong!', 'error'); return; }
      res = await api('POST', `/quiz/${_subQuizData.id}/submission`, { tipe: 'teks', konten, catatan });
    } else if (_subTipeAktif === 'link') {
      const konten = document.getElementById('sub-konten-link').value.trim();
      if (!konten || !konten.startsWith('http')) { toast('Masukkan URL yang valid!', 'error'); return; }
      res = await api('POST', `/quiz/${_subQuizData.id}/submission`, { tipe: 'link', konten, catatan });
    } else {
      if (!_subFileObj) { toast('Pilih file terlebih dahulu!', 'error'); return; }
      const fd = new FormData();
      fd.append('file', _subFileObj);
      fd.append('tipe', _subTipeAktif);
      if (catatan) fd.append('catatan', catatan);
      const token = localStorage.getItem('kb_token') || token;
      const r = await fetch('/api/quiz/' + _subQuizData.id + '/submission', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
      res = await r.json();
    }
    if (res.success) {
      toast('✅ Tugas berhasil dikumpulkan!', 'success');
      closeModal('modal-submission');
      loadKelasKuis(currentKelas?.id);
    } else {
      toast(res.pesan || 'Gagal mengumpulkan tugas', 'error');
    }
  } catch(e) { toast('Gagal terhubung ke server', 'error'); }
  finally { btn.disabled = false; btn.textContent = '📤 Kumpulkan'; }
}

// ============================================================
//  LIHAT SUBMISSION (GURU)
// ============================================================
async function lihatSubmissionGuru(quizId, judul, kelasId) {
  document.getElementById('sub-lihat-judul').textContent = '📋 ' + judul;
  const listEl = document.getElementById('sub-lihat-list');
  listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted)">Memuat...</div>';
  openModal('modal-lihat-submission');
  try {
    // Ambil submissions & daftar murid di kelas secara paralel
    const [res, kelasRes] = await Promise.all([
      api('GET', `/quiz/${quizId}/submissions`),
      kelasId ? api('GET', `/kelas/${kelasId}`) : Promise.resolve(null)
    ]);

    if (!res.success) { listEl.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">Gagal memuat.</div>'; return; }

    const submissions = res.data || [];
    const semuaMurid = kelasRes?.data?.murid || [];
    const sudahIds = new Set(submissions.map(s => s.murid_id || s.murid?.id));
    const belumMurid = semuaMurid.filter(m => !sudahIds.has(m.id));

    const tipeIcon = { file:'📄', gambar:'🖼️', link:'🔗', teks:'✏️' };

    // Ringkasan
    const ringkasan = `<div style="display:flex;gap:10px;margin-bottom:16px">
      <div style="flex:1;background:#F0FFF4;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:var(--green)">${submissions.length}</div>
        <div style="font-size:12px;color:var(--muted);font-weight:700">Sudah Mengumpulkan</div>
      </div>
      <div style="flex:1;background:#FFF5F5;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:var(--red)">${belumMurid.length}</div>
        <div style="font-size:12px;color:var(--muted);font-weight:700">Belum Mengumpulkan</div>
      </div>
    </div>`;

    // Daftar yang sudah
    const sudahHtml = submissions.length === 0
      ? `<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">📭 Belum ada murid yang mengumpulkan.</div>`
      : submissions.map(s => `
      <div style="border:2px solid #eee;border-radius:14px;overflow:hidden;margin-bottom:10px">
        <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;background:#F8F9FA">
          <span style="font-size:22px;width:32px;height:32px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#eee">${chatAvatarHtml(s.murid?.avatar || '🦁')}</span>
          <div style="flex:1">
            <div style="font-weight:800;font-size:14px">${s.murid?.nama || 'Murid'}</div>
            <div style="font-size:11px;color:var(--muted)">${tipeIcon[s.tipe]||'📤'} ${s.tipe} · ${new Date(s.submitted_at).toLocaleDateString('id-ID',{day:'numeric',month:'short'})} ${new Date(s.submitted_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          ${s.nilai != null ? `<span style="background:${s.nilai>=80?'var(--green)':s.nilai>=60?'var(--orange)':'var(--red)'};color:white;padding:4px 12px;border-radius:50px;font-weight:800;font-size:13px">${s.nilai}</span>` : '<span style="font-size:11px;color:var(--muted);font-weight:700">Belum dinilai</span>'}
        </div>
        <div style="padding:12px 14px">
          ${s.tipe === 'teks' ? `<div style="font-size:13px;line-height:1.7;color:var(--text);background:#F8F9FA;border-radius:8px;padding:10px;margin-bottom:10px">${(s.konten||'').replace(/\n/g,'<br>')}</div>` : ''}
          ${s.tipe === 'link' ? `<a href="${s.konten}" target="_blank" rel="noopener" style="display:inline-block;margin-bottom:10px;color:var(--blue);font-weight:700;font-size:13px;word-break:break-all">${s.konten}</a>` : ''}
          ${s.tipe === 'file' ? `<a href="${s.file_url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#EEF5FF;color:var(--blue);border-radius:8px;padding:8px 14px;font-weight:800;font-size:13px;text-decoration:none;margin-bottom:10px">📄 ${s.file_nama || 'Unduh File'} <span style="font-size:11px;font-weight:600;opacity:0.7">(${s.file_size ? (s.file_size/1024).toFixed(0)+'KB' : ''})</span></a>` : ''}
          ${s.tipe === 'gambar' ? `<img src="${s.file_url}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid #eee;cursor:pointer;display:block;margin-bottom:10px" onclick="window.open('${s.file_url}','_blank')" title="Klik untuk buka penuh">` : ''}
          ${s.catatan ? `<div style="margin-bottom:8px;font-size:12px;color:var(--muted);font-style:italic;background:#F8F9FA;border-radius:8px;padding:8px 10px">💬 "${s.catatan}"</div>` : ''}
          ${s.feedback ? `<div style="margin-bottom:8px;background:#F0FFF4;border-radius:8px;padding:8px 12px;font-size:12px;color:var(--green);font-weight:700">✅ Feedback: ${s.feedback}</div>` : ''}
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" min="0" max="100" placeholder="Nilai 0-100" id="nilai-${s.id}" value="${s.nilai??''}" style="width:100px;padding:7px 10px;border:2px solid #eee;border-radius:8px;font-family:Nunito,sans-serif;font-size:13px;outline:none">
            <input type="text" placeholder="Tulis feedback..." id="feedback-${s.id}" value="${s.feedback||''}" style="flex:1;padding:7px 10px;border:2px solid #eee;border-radius:8px;font-family:Nunito,sans-serif;font-size:13px;outline:none">
            <button onclick="simpanNilaiSubmission('${quizId}','${s.id}')" style="background:var(--blue);color:white;border:none;padding:7px 14px;border-radius:8px;font-family:Nunito,sans-serif;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap">💾 Simpan</button>
          </div>
        </div>
      </div>`).join('');

    // Daftar yang belum
    const belumHtml = belumMurid.length > 0
      ? `<div style="margin-top:16px">
          <div style="font-weight:800;font-size:13px;color:var(--red);margin-bottom:8px">⏳ Belum Mengumpulkan (${belumMurid.length})</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${belumMurid.map(m => `
              <div style="display:flex;align-items:center;gap:10px;background:#FFF5F5;border-radius:10px;padding:10px 12px">
                <span style="font-size:18px;width:28px;height:28px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:#eee">${chatAvatarHtml(m.avatar || '🦁')}</span>
                <span style="font-weight:700;font-size:13px">${m.nama}</span>
                <span style="margin-left:auto;font-size:11px;color:var(--red);font-weight:700">Belum</span>
              </div>`).join('')}
          </div>
        </div>` : '';

    listEl.innerHTML = ringkasan +
      `<div style="font-weight:800;font-size:13px;color:var(--green);margin-bottom:8px">✅ Sudah Mengumpulkan (${submissions.length})</div>` +
      sudahHtml + belumHtml;

  } catch(e) {
    listEl.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">Gagal memuat submission.</div>';
  }
}

async function simpanNilaiSubmission(quizId, subId) {
  const nilai = document.getElementById('nilai-' + subId)?.value;
  const feedback = document.getElementById('feedback-' + subId)?.value || '';
  if (nilai === '' || nilai == null) { toast('Isi nilai dulu!', 'error'); return; }
  try {
    const res = await api('PUT', `/quiz/${quizId}/submissions/${subId}/nilai`, { nilai: parseInt(nilai), feedback });
    if (res.success) toast('✅ Nilai disimpan!', 'success');
    else toast(res.pesan || 'Gagal simpan nilai', 'error');
  } catch(e) { toast('Gagal terhubung', 'error'); }
}

// ============================================================
//  KERJAKAN KUIS (MURID)
// ============================================================
let kuisKelasData = null;
let kuisJawaban = {};
let kuisCurrentQ = 0;
let kuisFunTimer = null;

async function mulaiKuisKelas(quizId) {
  showLoading(true);
  try {
    const data = await api('GET', `/quiz/${quizId}`);
    if (!data.success || !data.quiz) { toast('Kuis tidak ditemukan', 'error'); showLoading(false); return; }

    const kuis = data.quiz;
    if (!kuis.soal || kuis.soal.length === 0) { toast('Kuis belum punya soal', 'error'); showLoading(false); return; }

    kuisKelasData = {
      id: quizId,
      info: kuis,
      soal: kuis.soal.map(s => ({
        id: s.id,
        pertanyaan: s.pertanyaan,
        emoji: s.emoji || '❓',
        opsi: Array.isArray(s.opsi) ? s.opsi : JSON.parse(s.opsi || '[]'),
        jawaban: s.jawaban,
        poin: s.poin || 100,
        mapel: s.mapel || ''
      }))
    };
    kuisJawaban = {};
    kuisCurrentQ = 0;
    kuisStartTime = Date.now();
    clearInterval(kuisFunTimer);

    document.getElementById('kuis-kelas-title').textContent = kuis.judul;
    document.getElementById('kuis-kelas-info').textContent = `${kuisKelasData.soal.length} soal`;

    showPage('page-kuis-kelas');
    renderPrSoal();

    if ((kuis.tipe || 'fun') === 'fun') {
      jalankanFunTimer(kuis.durasi || 15);
    }
  } catch(e) {
    toast('Gagal memuat kuis dari server', 'error');
  }
  showLoading(false);
}

function renderPrSoal() {
  if (!kuisKelasData) return;
  const soal = kuisKelasData.soal;
  const isFun = (kuisKelasData.info?.tipe || 'fun') === 'fun';

  // Render dots
  document.getElementById('pr-q-dots').innerHTML = soal.map((s, i) => {
    const answered = kuisJawaban[i] !== undefined;
    const current = i === kuisCurrentQ;
    return `<div class="q-dot ${answered ? 'answered' : ''} ${current ? 'current' : ''}" onclick="goToSoal(${i})">${i + 1}</div>`;
  }).join('');

  // Render soal saat ini
  const q = soal[kuisCurrentQ];
  const dipilih = kuisJawaban[kuisCurrentQ];
  document.getElementById('pr-soal-container').innerHTML = `
    <div class="pr-question-card">
      <div class="pr-q-num">${q.mapel ? q.mapel + ' · ' : ''}Soal ${kuisCurrentQ + 1} dari ${soal.length}</div>
      <div class="pr-q-text">${q.emoji} ${q.pertanyaan}</div>
      <div class="pr-options">
        ${q.opsi.map((o, i) => `
          <button class="pr-opt ${dipilih === i ? 'selected' : ''}" onclick="pilihJawaban(${i})" ${isFun && dipilih !== undefined ? 'disabled' : ''}>
            <strong>${String.fromCharCode(65 + i)}.</strong> ${o}
          </button>
        `).join('')}
      </div>
    </div>`;

  // Nav
  const isLast = kuisCurrentQ === soal.length - 1;
  const sudahSemua = Object.keys(kuisJawaban).length === soal.length;
  document.getElementById('pr-nav-area').innerHTML = `
    <div class="pr-nav">
      <button class="pr-nav-btn" style="background:#F5F5F5;color:var(--muted)" onclick="goToSoal(${kuisCurrentQ - 1})" ${kuisCurrentQ === 0 ? 'disabled style="opacity:0.4"' : ''}>← Sebelumnya</button>
      ${isLast
        ? `<button class="pr-submit-btn" onclick="submitKuisKelas()">✅ Kumpulkan (${Object.keys(kuisJawaban).length}/${soal.length} dijawab)</button>`
        : `<button class="pr-nav-btn" style="background:var(--blue);color:white" onclick="goToSoal(${kuisCurrentQ + 1})">Selanjutnya →</button>`
      }
    </div>`;
}

function pilihJawaban(idx) {
  const isFun = (kuisKelasData?.info?.tipe || 'fun') === 'fun';
  if (isFun && kuisJawaban[kuisCurrentQ] !== undefined) return; // sudah jawab di fun quiz
  kuisJawaban[kuisCurrentQ] = idx;
  renderPrSoal();
  if (isFun) {
    // Auto next setelah 1.2 detik
    clearInterval(kuisFunTimer);
    setTimeout(() => {
      if (kuisCurrentQ < kuisKelasData.soal.length - 1) goToSoal(kuisCurrentQ + 1);
      else submitKuisKelas();
    }, 1200);
  }
}

function goToSoal(idx) {
  if (idx < 0 || idx >= kuisKelasData.soal.length) return;
  kuisCurrentQ = idx;
  if ((kuisKelasData.info?.tipe || 'fun') === 'fun') {
    clearInterval(kuisFunTimer);
    jalankanFunTimer(kuisKelasData.info?.durasi || 15);
  }
  renderPrSoal();
}

function jalankanFunTimer(durasi) {
  let sisa = durasi;
  document.getElementById('kuis-kelas-info').textContent = `⏱ ${sisa}s · Soal ${kuisCurrentQ + 1}/${kuisKelasData.soal.length}`;
  clearInterval(kuisFunTimer);
  kuisFunTimer = setInterval(() => {
    sisa--;
    document.getElementById('kuis-kelas-info').textContent = `⏱ ${sisa}s · Soal ${kuisCurrentQ + 1}/${kuisKelasData.soal.length}`;
    if (sisa <= 0) {
      clearInterval(kuisFunTimer);
      // Auto lanjut
      if (kuisCurrentQ < kuisKelasData.soal.length - 1) goToSoal(kuisCurrentQ + 1);
      else submitKuisKelas();
    }
  }, 1000);
}

async function submitKuisKelas() {
  clearInterval(kuisFunTimer);
  const soal = kuisKelasData.soal;
  const durasi_detik = Math.round((Date.now() - (kuisStartTime || Date.now())) / 1000);

  // Kirim jawaban murid ke server — validasi & scoring dilakukan server-side
  const jawabanKirim = soal.map((q, i) => ({
    soal_id: q.id,
    jawaban_user: kuisJawaban[i] !== undefined ? q.opsi[kuisJawaban[i]] : null
  }));

  let skor = 0, benar = 0, totalPoin = 0, total_soal = soal.length;

  try {
    const simpan = await api('POST', '/quiz/hasil', {
      quiz_id: kuisKelasData.id,
      jawaban: jawabanKirim,
      durasi_detik
    });
    if (simpan.success) {
      skor       = simpan.skor       ?? 0;
      benar      = simpan.benar      ?? 0;
      total_soal = simpan.total_soal ?? soal.length;
      totalPoin  = simpan.totalPoin  ?? 0;
    } else {
      console.warn('Gagal simpan hasil:', simpan.pesan);
    }
  } catch(e) {
    console.warn('Gagal simpan hasil (network):', e);
  }

  const emoji = skor >= 80 ? '🎉' : skor >= 60 ? '😊' : skor >= 40 ? '😅' : '💪';
  const judul = skor >= 80 ? 'Luar Biasa!' : skor >= 60 ? 'Bagus!' : skor >= 40 ? 'Terus Semangat!' : 'Jangan Menyerah!';
  const stars = skor >= 80 ? '⭐⭐⭐' : skor >= 60 ? '⭐⭐' : '⭐';

  document.getElementById('hasil-emoji').textContent = emoji;
  document.getElementById('hasil-stars').textContent = stars;
  document.getElementById('hasil-judul').textContent = judul;
  document.getElementById('hasil-skor').textContent = totalPoin;
  document.getElementById('hasil-sub').textContent = `poin · ${benar} dari ${total_soal} benar (${skor}%)`;
  document.getElementById('hasil-stats').innerHTML = `
    <div style="background:#F8F9FA;border-radius:14px;padding:16px;text-align:center"><div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--green)">${benar}</div><div style="font-size:12px;color:var(--muted);font-weight:700">Benar</div></div>
    <div style="background:#F8F9FA;border-radius:14px;padding:16px;text-align:center"><div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--red)">${total_soal - benar}</div><div style="font-size:12px;color:var(--muted);font-weight:700">Salah</div></div>
    <div style="background:#FFF3E8;border-radius:14px;padding:16px;text-align:center"><div style="font-family:'Fredoka One',cursive;font-size:28px;color:var(--orange)">${totalPoin}</div><div style="font-size:12px;color:var(--muted);font-weight:700">Poin</div></div>
  `;
  showPage('page-kuis-hasil');
}

let kuisStartTime = null;

function batalKuisKelas() {
  clearInterval(kuisFunTimer);
  if (currentKelas) {
    openKelas(currentKelas.id, currentKelas.colorIdx || 0);
  } else {
    loadMuridDashboard();
  }
}

function kembaliDariHasil() {
  if (currentKelas) {
    openKelas(currentKelas.id, currentKelas.colorIdx || 0);
    setTimeout(() => switchKelasTab('kuis'), 500);
  } else {
    loadMuridDashboard();
  }
}

// ============================================================
//  EDIT & DELETE MATERI
// ============================================================
function editMateriBtn(btn) {
  editMateri(btn.dataset.id, btn.dataset.judul, btn.dataset.mapel, btn.dataset.jenis, btn.dataset.status);
}
function deleteMateriBtn(btn) {
  deleteMateri(btn.dataset.id, btn.dataset.judul);
}
let editMateriId = null;

function editMateri(id, judul, mapel, jenis, status) {
  editMateriId = id;
  document.getElementById('edit-m-judul').value = judul;
  document.getElementById('edit-m-mapel').value = mapel;
  document.getElementById('edit-m-jenis').value = jenis;
  document.getElementById('edit-m-status').value = status;
  document.getElementById('edit-m-konten').value = '';
  openModal('modal-edit-materi');
}

async function submitEditMateri() {
  const judul = document.getElementById('edit-m-judul').value.trim();
  const mapel = document.getElementById('edit-m-mapel').value;
  const jenis = document.getElementById('edit-m-jenis').value;
  const status = document.getElementById('edit-m-status').value;
  const konten = document.getElementById('edit-m-konten').value.trim();
  if (!judul) { toast('Judul tidak boleh kosong!', 'error'); return; }

  showLoading(true);
  try {
    const body = { judul, mapel, jenis, status };
    if (konten) body.konten = konten;
    const data = await api('PUT', `/materi/${editMateriId}`, body);
    if (data.success) {
      toast('Materi berhasil diperbarui! ✅', 'success');
      closeModal('modal-edit-materi');
      if (currentKelas) await loadKelasStream(currentKelas.id);
      else loadGuruDashboard();
    } else {
      toast(data.pesan || 'Gagal update materi', 'error');
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}

let hapusMateriId = null;

function deleteMateri(id, judul) {
  hapusMateriId = id;
  document.getElementById('konfirmasi-pesan').textContent = `Materi "${judul}" akan dihapus permanen.`;
  openModal('modal-konfirmasi');
}

async function konfirmasiHapus() {
  if (!hapusMateriId) return;
  closeModal('modal-konfirmasi');
  showLoading(true);
  try {
    const data = await api('DELETE', `/materi/${hapusMateriId}`);
    hapusMateriId = null;
    if (data.success) {
      toast('Materi berhasil dihapus! 🗑️', 'success');
      if (currentKelas) await loadKelasStream(currentKelas.id);
      else loadGuruDashboard();
    } else {
      toast(data.pesan || 'Gagal hapus materi', 'error');
    }
  } catch(e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
}
