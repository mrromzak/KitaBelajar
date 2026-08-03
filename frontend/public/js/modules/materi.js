// ============================================================
//  MATERI HELPERS
// ============================================================
selectedPdfFile = null;
selectedGambarFile = null;

// ============================================================
//  AI MATERI — PDF, Artikel, YouTube
// ============================================================
// GROQ_API_KEY_MATERI dihapus — semua AI call dilakukan via backend proxy /api/ai/
aiSumberAktif = null;
aiPdfFile = null;
aiHasilMateri = null;
aiHasilSoal = [];

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

function handleGambarSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) { toast('Format gambar harus PNG, JPEG, atau WebP!', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { toast('File terlalu besar! Maksimal 10MB', 'error'); return; }
  selectedGambarFile = file;
  document.getElementById('gambar-label').textContent = '✅ ' + file.name;
  document.getElementById('gambar-dropzone').style.borderColor = 'var(--green)';
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

    } else if (jenis === 'pdf' || jenis === 'gambar') {
      const selectedFile = jenis === 'pdf' ? selectedPdfFile : selectedGambarFile;
      const label = jenis === 'pdf' ? 'PDF' : 'gambar';
      if (!selectedFile) { toast(`Pilih file ${label} dulu!`, 'error'); showLoading(false); document.getElementById('btn-simpan-materi').disabled = false; return; }

      setUploadProgress(30, `Mengupload ${label}...`);
      const formData = new FormData();
      formData.append('file', selectedFile);
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
        toast(`${label.charAt(0).toUpperCase() + label.slice(1)} berhasil diupload! 📚`, 'success');
        resetMateriForm();
        closeModal('modal-materi');
        if (currentKelas) {
          await loadKelasStream(currentKelas.id);
        } else {
          loadGuruDashboard();
        }
      } else {
        toast(data.pesan || `Gagal upload ${label}`, 'error');
      }
      showLoading(false);
      document.getElementById('btn-simpan-materi').disabled = false;
      return;
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
  document.getElementById('m-jenis').value = 'teks';
  document.getElementById('m-pdf-file').value = '';
  document.getElementById('m-gambar-file').value = '';
  document.getElementById('pdf-label').textContent = 'Klik untuk pilih file PDF';
  document.getElementById('gambar-label').textContent = 'Klik untuk pilih gambar PNG/JPEG';
  document.getElementById('pdf-dropzone').style.borderColor = '#ddd';
  document.getElementById('gambar-dropzone').style.borderColor = '#ddd';
  document.getElementById('upload-progress').style.display = 'none';
  selectedPdfFile = null;
  selectedGambarFile = null;
  toggleMateriInput();
}
