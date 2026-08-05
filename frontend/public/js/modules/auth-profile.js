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

_pendingManualGuruLogin = null; // { email, password } — menunggu kode guru utk login manual

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { toast('Isi email dan password dulu ya! 😊', 'error'); return; }
  if (!isValidEmail(email)) { toast('Format email tidak valid. Contoh: nama@email.com', 'error'); return; }

  showLoading(true);
  try {
    const data = await api('POST', '/auth/login', { email, password });
    if (data.needs_kode_guru) {
      // Akun guru terdeteksi — minta kode guru (reuse modal yang sama dgn alur Google)
      _pendingManualGuruLogin = { email, password };
      const namaEl = document.getElementById('google-guru-kode-nama');
      if (namaEl) namaEl.textContent = email;
      const inputEl = document.getElementById('google-guru-kode-input');
      if (inputEl) inputEl.value = '';
      showLoading(false);
      openModal('modal-google-guru-kode');
      setTimeout(() => { if (inputEl) inputEl.focus(); }, 300);
      return;
    }
    if (data.success) {
      // Login terpadu: peran ditentukan backend, langsung diarahkan ke dashboard yang sesuai.
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('kb_token', token);
      refreshSocketConnection();
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

_pendingRegEmail = null;

function validatePasswordClient(password) {
  if (!password || password.length < 8) return 'Password minimal 8 karakter ya! 🔒';
  if (!/[a-z]/.test(password)) return 'Password harus mengandung huruf kecil!';
  if (!/[A-Z]/.test(password)) return 'Password harus mengandung huruf kapital!';
  if (!/[0-9]/.test(password)) return 'Password harus mengandung angka!';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password harus mengandung simbol (mis. !@#)!';
  return null;
}

const PW_EYE_OPEN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12 C3.5 6.5 7.5 4 12 4 C16.5 4 20.5 6.5 21.5 12 C20.5 17.5 16.5 20 12 20 C7.5 20 3.5 17.5 2.5 12 Z"/><path d="M5 7.5 L4.6 5.4"/><path d="M8 5.3 L8 3.2"/><path d="M12 4.3 L12 2.2"/><path d="M16 5.3 L16 3.2"/><path d="M19 7.5 L19.4 5.4"/><circle cx="12" cy="11" r="3" fill="currentColor" stroke="none"/><circle cx="11" cy="9.8" r="1.1" fill="#fff" stroke="none"/></svg>';
const PW_EYE_CLOSED = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 11 Q12 16.5 21.5 11"/><path d="M4.4 12 L4.4 14.1"/><path d="M7.3 13.1 L7.3 15.2"/><path d="M12 13.8 L12 15.9"/><path d="M16.7 13.1 L16.7 15.2"/><path d="M19.6 12 L19.6 14.1"/></svg>';

function togglePwVisibility(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const isPw = el.type === 'password';
  el.type = isPw ? 'text' : 'password';
  btn.innerHTML = isPw ? PW_EYE_CLOSED : PW_EYE_OPEN;
  btn.title = isPw ? 'Sembunyikan password' : 'Lihat password';
  btn.setAttribute('aria-label', btn.title);
}

async function doRegister() {
  const nama = document.getElementById('reg-nama').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const konfirm = document.getElementById('reg-password-confirm').value;
  const kelas = document.getElementById('reg-kelas').value.trim();
  if (!nama || !email || !password) { toast('Lengkapi semua data ya! 😊', 'error'); return; }
  if (!isValidEmail(email)) { toast('Format email tidak valid. Contoh: nama@email.com', 'error'); return; }
  if (!konfirm) { toast('Ulangi password pada kolom konfirmasi!', 'error'); return; }
  if (password !== konfirm) { toast('Password dan konfirmasi tidak cocok!', 'error'); return; }
  const pwMsg = validatePasswordClient(password);
  if (pwMsg) { toast(pwMsg, 'error'); return; }

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
          confirmDialog({
            icon: '👨‍👩‍👧',
            title: 'Akun Orangtua Dibuat!',
            body: `Email: <strong>${parentEmail}</strong><br>Password: <strong>${parentPassword}</strong><br><br>Kredensial ini tersimpan di notifikasi 🔔 dan dikirim ke emailmu. Screenshot untuk disimpan!`,
            okLabel: 'Mengerti',
            cancelLabel: ''
          });
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
      <div style="background:linear-gradient(135deg,#FF6B35,#FF8C42);color:#fff;border-radius:16px;padding:16px;font-weight:900;font-size:30px;letter-spacing:1px">+${xp} XP</div>
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
_forgotEmail = null;
_resetToken = null;

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

_pendingGoogleToken = null;
_pendingGoogleGuruToken = null; // Token Google yang menunggu verifikasi kode undangan guru

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
      refreshSocketConnection();
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      joinPrivateChannel();
      loadBellNotifications();
      setTimeout(() => subscribePush(), 2000);
      toast(`Selamat datang, ${currentUser.nama}! 🎉`, 'success');
      if (currentUser.role === 'guru') { loadGuruDashboard(); remindDataDiriIfNeeded(); }
      else if (currentUser.role === 'kepala_sekolah') window.location.href = '/portal-kepala.html';
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
  // Jika modal ini dibuka dari alur login manual (email+password) → kode utk login manual
  if (_pendingManualGuruLogin) {
    return completeManualGuruLoginKode();
  }
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
      refreshSocketConnection();
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

// Dipanggil dari modal-google-guru-kode saat alur login MANUAL (email+password)
// Mengirim kode guru sebagai kode_guru_login ke /auth/login (BUKAN kode_guru).
async function completeManualGuruLoginKode() {
  const pending = _pendingManualGuruLogin;
  if (!pending) return;
  const inputEl = document.getElementById('google-guru-kode-input');
  const kode = inputEl ? inputEl.value.trim().toUpperCase() : '';
  if (!kode) { toast('Masukkan kode undangan dari kepala sekolah.', 'error'); return; }

  closeModal('modal-google-guru-kode');
  showLoading(true);
  try {
    const data = await api('POST', '/auth/login', {
      email: pending.email,
      password: pending.password,
      kode_guru_login: kode
    });
    if (data.success && data.token) {
      _pendingManualGuruLogin = null;
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('kb_token', token);
      refreshSocketConnection();
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
      _pendingManualGuruLogin = null;
      toast(data.pesan || 'Login gagal. Cek email & password kamu!', 'error');
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
      refreshSocketConnection();
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

_googleInited = false;
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
        style="font-size:32px;cursor:pointer;width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:50%;
               border:2px solid ${isActive ? accent : '#eee'};
               background:${isActive ? '#FFEFE8' : 'white'};
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

// Avatar Cropper Variables
cropImage = null;
cropZoom = 1;
cropX = 0;
cropY = 0;
isDraggingCrop = false;
startDragX = 0;
startDragY = 0;
cropTargetRole = 'murid';

function uploadFotoProfil(role) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('Foto terlalu besar. Maksimal 10MB.', 'error'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        cropImage = img;
        cropTargetRole = role;

        const w = img.width;
        const h = img.height;
        // Hitung scale minimal agar menutupi lingkaran 200x200
        const minScale = Math.max(200 / w, 200 / h);
        cropZoom = minScale;

        // Atur range slider
        const slider = document.getElementById('crop-zoom');
        slider.min = minScale;
        slider.max = minScale * 4;
        slider.step = 0.01;
        slider.value = minScale;

        // Pusatkan gambar secara horizontal & vertikal
        cropX = (200 - w * minScale) / 2;
        cropY = (200 - h * minScale) / 2;

        const previewImg = document.getElementById('crop-preview-img');
        previewImg.src = img.src;
        previewImg.style.width = w + 'px';
        previewImg.style.height = h + 'px';

        updateCropPreview();
        openModal('modal-crop-avatar');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function updateCropPreview() {
  const imgEl = document.getElementById('crop-preview-img');
  if (!imgEl) return;
  imgEl.style.transform = `translate(${cropX}px, ${cropY}px) scale(${cropZoom})`;
}

function initCropDragging() {
  const container = document.getElementById('crop-viewport-container');
  if (!container) return;

  const startDrag = (clientX, clientY) => {
    isDraggingCrop = true;
    startDragX = clientX - cropX;
    startDragY = clientY - cropY;
  };

  const doDrag = (clientX, clientY) => {
    if (!isDraggingCrop || !cropImage) return;
    cropX = clientX - startDragX;
    cropY = clientY - startDragY;

    // Batasi pergeseran agar gambar selalu menutupi lingkaran 200x200
    const w = cropImage.width * cropZoom;
    const h = cropImage.height * cropZoom;

    if (w >= 200) {
      if (cropX > 0) cropX = 0;
      if (cropX < 200 - w) cropX = 200 - w;
    } else {
      cropX = (200 - w) / 2;
    }

    if (h >= 200) {
      if (cropY > 0) cropY = 0;
      if (cropY < 200 - h) cropY = 200 - h;
    } else {
      cropY = (200 - h) / 2;
    }

    updateCropPreview();
  };

  const endDrag = () => {
    isDraggingCrop = false;
  };

  container.addEventListener('mousedown', e => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', e => {
    if (isDraggingCrop) doDrag(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', endDrag);

  // Sentuhan (Mobile)
  container.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  });

  container.addEventListener('touchmove', e => {
    if (isDraggingCrop && e.touches.length === 1) {
      doDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  });

  container.addEventListener('touchend', endDrag);

  // Event listener untuk zoom slider
  const slider = document.getElementById('crop-zoom');
  if (slider) {
    slider.addEventListener('input', e => {
      if (!cropImage) return;
      const newZoom = parseFloat(e.target.value);
      const cx = 100;
      const cy = 100;

      // Zoom terpusat ke tengah lingkaran
      cropX = cx - (cx - cropX) * (newZoom / cropZoom);
      cropY = cy - (cy - cropY) * (newZoom / cropZoom);
      cropZoom = newZoom;

      // Batasi setelah zoom
      const w = cropImage.width * cropZoom;
      const h = cropImage.height * cropZoom;

      if (w >= 200) {
        if (cropX > 0) cropX = 0;
        if (cropX < 200 - w) cropX = 200 - w;
      } else {
        cropX = (200 - w) / 2;
      }

      if (h >= 200) {
        if (cropY > 0) cropY = 0;
        if (cropY < 200 - h) cropY = 200 - h;
      } else {
        cropY = (200 - h) / 2;
      }

      updateCropPreview();
    });
  }
}

async function selesaiCropAvatar() {
  if (!cropImage) return;
  showLoading(true, 'Menyimpan foto...');

  const canvas = document.createElement('canvas');
  canvas.width = 150;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');

  // Konversi koordinat viewport 200x200 ke ukuran asli gambar
  const sx = -cropX / cropZoom;
  const sy = -cropY / cropZoom;
  const sWidth = 200 / cropZoom;
  const sHeight = 200 / cropZoom;

  ctx.drawImage(cropImage, sx, sy, sWidth, sHeight, 0, 0, 150, 150);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

  try {
    const data = await api('PUT', '/auth/profile', { avatar: dataUrl });
    if (data.success) {
      currentUser.avatar = dataUrl;
      localStorage.setItem('kb_user', JSON.stringify(currentUser));
      if (cropTargetRole === 'murid') {
        setAvatarEl(document.getElementById('pm-avatar-display'), dataUrl);
        document.getElementById('pm-avatar-picker').style.display = 'none';
        syncAvatarUI(dataUrl, 'murid');
      } else {
        setAvatarEl(document.getElementById('pg-avatar-display'), dataUrl);
        document.getElementById('pg-avatar-picker').style.display = 'none';
        syncAvatarUI(dataUrl, 'guru');
      }
      closeModal('modal-crop-avatar');
      toast('Foto profil berhasil diperbarui! 🎉', 'success');
    } else {
      toast(data.pesan || 'Gagal mengganti foto', 'error');
    }
  } catch (e) {
    toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
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

async function kirimOtpGantiPassword(prefix) {
  const btn = document.getElementById(prefix + '-pw-otp-btn');
  if (btn.dataset.sending === '1') return;
  btn.dataset.sending = '1';
  btn.style.opacity = '0.6';
  showLoading(true);
  try {
    const data = await api('POST', '/auth/send-change-password-otp', {});
    if (data.success) {
      toast(data.pesan || 'Kode OTP dikirim ke email kamu!', 'success');
    } else {
      toast(data.pesan || 'Gagal mengirim kode', 'error');
    }
  } catch(e) {
    if (e && e.status === 429) toast('Batas percobaan ganti password hari ini sudah habis. Coba lagi besok.', 'error');
    else toast('Tidak bisa terhubung ke server', 'error');
  }
  showLoading(false);
  setTimeout(() => { btn.dataset.sending = '0'; btn.style.opacity = '1'; }, 3000);
}

async function gantiPasswordMurid() {
  const otp = document.getElementById('pm-pw-otp').value.trim();
  const baru = document.getElementById('pm-pw-baru').value;
  const konfirm = document.getElementById('pm-pw-konfirm').value;
  if (!otp) { toast('Minta kode OTP dan isi kode dari email dulu!', 'error'); return; }
  if (!baru || !konfirm) { toast('Isi password baru dan konfirmasi!', 'error'); return; }
  if (baru.length < 8) { toast('Password baru minimal 8 karakter!', 'error'); return; }
  if (baru !== konfirm) { toast('Konfirmasi password tidak cocok!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('PUT', '/auth/profile', { password_baru: baru, otp });
    if (data.success) {
      document.getElementById('pm-pw-baru').value = '';
      document.getElementById('pm-pw-konfirm').value = '';
      document.getElementById('pm-pw-otp').value = '';
      toast('Password berhasil diganti! 🔒', 'success');
    } else toast(data.pesan || 'Gagal ganti password', 'error');
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

async function gantiPasswordGuru() {
  const otp = document.getElementById('pg-pw-otp').value.trim();
  const baru = document.getElementById('pg-pw-baru').value;
  const konfirm = document.getElementById('pg-pw-konfirm').value;
  if (!otp) { toast('Minta kode OTP dan isi kode dari email dulu!', 'error'); return; }
  if (!baru || !konfirm) { toast('Isi password baru dan konfirmasi!', 'error'); return; }
  if (baru.length < 8) { toast('Password baru minimal 8 karakter!', 'error'); return; }
  if (baru !== konfirm) { toast('Konfirmasi password tidak cocok!', 'error'); return; }
  showLoading(true);
  try {
    const data = await api('PUT', '/auth/profile', { password_baru: baru, otp });
    if (data.success) {
      document.getElementById('pg-pw-baru').value = '';
      document.getElementById('pg-pw-konfirm').value = '';
      document.getElementById('pg-pw-otp').value = '';
      toast('Password berhasil diganti! 🔒', 'success');
    } else toast(data.pesan || 'Gagal ganti password', 'error');
  } catch(e) { toast('Tidak bisa terhubung ke server', 'error'); }
  showLoading(false);
}

function doLogout() {
  token = null; currentUser = null;
  localStorage.removeItem('kb_token');
  localStorage.removeItem('kb_user');
  if (socket) socket.disconnect();
  onGuruPageHidden();
  showPage('page-landing');
  toast('Sampai jumpa! 👋');
}