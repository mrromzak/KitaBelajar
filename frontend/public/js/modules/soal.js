// ============================================================
//  SOAL HELPERS
// ============================================================
currentTipeSoal = 'pilihan_ganda';
selectedBS = '';

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
  active.style.background = '#FFEFE8';
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
  document.getElementById('bs-salah').style.background = val === 'Salah' ? '#FFEFE8' : 'white';
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
sbSoalList = [];       // [{id, tipe, pertanyaan, opsi, jawaban, mapel, poin, tingkat, dbId}]
sbAktifIdx = 0;        // index soal yang sedang diedit
sbFromKuis  = false;   // dibuka dari modal buat kuis?

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
    const jumlah = sbSoalList.filter(s => s.pertanyaan.trim() && !s.dbId).length;
    const pilih = await confirmDialog({
      icon: '💾',
      title: 'Ada Soal Belum Disimpan',
      body: `${jumlah} soal belum disimpan. Mau simpan sebelum keluar?`,
      okLabel: 'Simpan & Keluar',
      cancelLabel: 'Keluar Tanpa Simpan'
    });
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
  if (salahEl) salahEl.style.cssText = `border:3px solid ${val==='Salah'?'var(--red)':'#eee'};border-radius:14px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;background:${val==='Salah'?'#FFEFE8':'white'}`;
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

async function sbHapusSoalAktif() {
  if (sbSoalList.length <= 1) { toast('Minimal harus ada 1 soal!', 'error'); return; }
  const ok = await confirmDialog({
    icon: '🗑️', title: `Hapus Soal #${sbAktifIdx + 1}?`,
    body: 'Soal ini akan dihapus dari sesi ini.',
    okLabel: 'Ya, Hapus', cancelLabel: 'Batal', danger: true
  });
  if (!ok) return;
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
soalDariBuatKuis = false;

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