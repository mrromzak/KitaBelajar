// ============================================================
//  ai-features.js — KitaBelajar AI Features
//  Include di belajar-seru.html dengan:
//  <script src="ai-features.js"></script>
//  Letakkan SETELAH semua script lain
// ============================================================

// ── AI CONFIG ──────────────────────────────────────────────
// API key disimpan di .env server, frontend memanggil proxy
const AI_MAX_TOKENS = 1024;

// ── Helper: deteksi URL dalam pesan ─────────────────────────
function ambilUrlDariPesan(pesan) {
  const m = pesan.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

// ── Helper: fetch konten artikel dari URL via proxy ──────────
// Returns: { ok: true, url, teks } | { ok: false, url, pesan }
async function fetchArtikelUrl(url) {
  try {
    // Pastikan https
    const safeUrl = url.replace(/^http:\/\//i, 'https://');
    const res = await fetch('/api/proxy/fetch?url=' + encodeURIComponent(safeUrl));
    const json = await res.json();
    if (json.success && json.teks && json.teks.length > 100) {
      return { ok: true, url: safeUrl, teks: json.teks };
    }
    return { ok: false, url: safeUrl, pesan: json.pesan || 'Konten tidak bisa dibaca' };
  } catch(e) {
    return { ok: false, url, pesan: 'Koneksi ke server gagal' };
  }
}

// ── Helper: panggil Groq via proxy backend ─────────────────
async function callAI(systemPrompt, userMessage, maxTokens = AI_MAX_TOKENS) {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.pesan || 'AI error');
  return json.data.choices?.[0]?.message?.content || '';
}

// ── Helper: panggil Groq dengan history chat ───────────────
async function callAIWithHistory(systemPrompt, history, maxTokens = AI_MAX_TOKENS) {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history
      ]
    })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.pesan || 'AI error');
  return json.data.choices?.[0]?.message?.content || '';
}

// ============================================================
//  CSS — inject styles
// ============================================================
const aiCSS = `
  /* ── AI Chat Floating Button ── */
  #ai-fab {
    position: fixed; bottom: 28px; right: 28px; z-index: 300;
    width: 60px; height: 60px; border-radius: 50%; border: none;
    background: linear-gradient(135deg, #7b2ff7, #a64cff);
    color: white; font-size: 26px; cursor: pointer;
    box-shadow: 0 6px 24px rgba(123,47,247,0.45);
    transition: all 0.3s cubic-bezier(.34,1.56,.64,1);
    display: flex; align-items: center; justify-content: center;
  }
  #ai-fab:hover { transform: scale(1.12) rotate(8deg); }
  #ai-fab.open { transform: scale(1.1) rotate(45deg); background: linear-gradient(135deg, #e74c3c, #ff6b6b); }

  /* ── AI Panel ── */
  #ai-panel {
    position: fixed; bottom: 100px; right: 28px; z-index: 299;
    width: 380px; max-height: 560px;
    background: white; border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    display: flex; flex-direction: column;
    transform: scale(0.85) translateY(20px); opacity: 0;
    pointer-events: none; transition: all 0.3s cubic-bezier(.34,1.56,.64,1);
    overflow: hidden;
  }
  #ai-panel.show { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
  @media (max-width: 480px) { #ai-panel { width: calc(100vw - 32px); right: 16px; bottom: 90px; } }

  .ai-panel-header {
    padding: 18px 20px 14px;
    background: linear-gradient(135deg, #7b2ff7, #a64cff);
    color: white; flex-shrink: 0;
  }
  .ai-panel-header h3 { font-family: 'Fredoka One', cursive; font-size: 18px; margin-bottom: 2px; }
  .ai-panel-header p { font-size: 12px; opacity: 0.85; }

  .ai-tabs { display: flex; background: #F8F9FA; flex-shrink: 0; border-bottom: 2px solid #F0F0F0; overflow-x: auto; }
  .ai-tab {
    padding: 10px 14px; border: none; background: none; cursor: pointer;
    font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 12px;
    color: #7A7A7A; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;
  }
  .ai-tab.active { color: #7b2ff7; border-bottom: 3px solid #7b2ff7; background: white; }
  .ai-tab:hover:not(.active) { background: #F0F0F0; }

  .ai-panel-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

  /* ── Chat Messages ── */
  .ai-msg { display: flex; gap: 8px; animation: fadeInUp 0.3s ease; }
  .ai-msg.user { flex-direction: row-reverse; }
  .ai-bubble {
    max-width: 80%; padding: 10px 14px; border-radius: 18px;
    font-size: 13px; line-height: 1.6; font-family: 'Nunito', sans-serif;
  }
  .ai-msg.ai .ai-bubble { background: #F3EEFF; color: #2D2D2D; border-bottom-left-radius: 4px; }
  .ai-msg.user .ai-bubble { background: linear-gradient(135deg, #7b2ff7, #a64cff); color: white; border-bottom-right-radius: 4px; }
  .ai-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; margin-top: 2px; }
  .ai-avatar.ai-side { background: linear-gradient(135deg, #7b2ff7, #a64cff); }
  .ai-typing { display: flex; gap: 4px; align-items: center; padding: 10px 14px; background: #F3EEFF; border-radius: 18px; width: fit-content; }
  .ai-typing span { width: 7px; height: 7px; background: #7b2ff7; border-radius: 50%; animation: typing 1.2s ease-in-out infinite; }
  .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
  .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-6px);opacity:1} }

  .ai-input-wrap { padding: 12px 16px; border-top: 2px solid #F0F0F0; display: flex; gap: 8px; flex-shrink: 0; }
  .ai-input {
    flex: 1; padding: 10px 14px; border: 2px solid #E8E8E8; border-radius: 50px;
    font-family: 'Nunito', sans-serif; font-size: 13px; outline: none; transition: border-color 0.2s;
  }
  .ai-input:focus { border-color: #7b2ff7; }
  .ai-send-btn {
    width: 38px; height: 38px; border-radius: 50%; border: none;
    background: linear-gradient(135deg, #7b2ff7, #a64cff);
    color: white; cursor: pointer; font-size: 16px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; transition: all 0.2s;
  }
  .ai-send-btn:hover { transform: scale(1.1); }
  .ai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── AI Cards (Generate Soal, Analisis, dll) ── */
  .ai-card { background: #F8F9FA; border-radius: 16px; padding: 14px; }
  .ai-card-title { font-weight: 800; font-size: 13px; color: #2D2D2D; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .ai-gen-input {
    width: 100%; padding: 10px 12px; border: 2px solid #E8E8E8; border-radius: 12px;
    font-family: 'Nunito', sans-serif; font-size: 13px; outline: none; margin-bottom: 8px; transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .ai-gen-input:focus { border-color: #7b2ff7; }
  .ai-gen-btn {
    width: 100%; padding: 10px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #7b2ff7, #a64cff); color: white;
    font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13px; cursor: pointer; transition: all 0.2s;
  }
  .ai-gen-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(123,47,247,0.35); }
  .ai-gen-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
  .ai-result {
    background: white; border-radius: 12px; padding: 12px; font-size: 12px; line-height: 1.7;
    color: #2D2D2D; border: 1.5px solid #E8E8E8; white-space: pre-wrap; max-height: 200px; overflow-y: auto;
  }
  .ai-chip { display: inline-block; background: #F3EEFF; color: #7b2ff7; padding: 4px 12px; border-radius: 50px; font-size: 11px; font-weight: 800; margin: 2px; cursor: pointer; transition: all 0.2s; }
  .ai-chip:hover { background: #7b2ff7; color: white; }

  /* ── Summarize Button in Materi ── */
  .ai-summarize-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: linear-gradient(135deg, #7b2ff7, #a64cff);
    color: white; border: none; padding: 8px 18px; border-radius: 50px;
    font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 13px;
    cursor: pointer; transition: all 0.2s; margin-top: 10px;
  }
  .ai-summarize-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(123,47,247,0.35); }

  /* ── AI Summary Box ── */
  .ai-summary-box {
    background: linear-gradient(135deg, #F3EEFF, #EEF5FF);
    border: 2px solid #D8BBFF; border-radius: 16px; padding: 16px; margin-top: 12px;
    font-size: 13px; line-height: 1.8; color: #2D2D2D;
  }
  .ai-summary-box .ai-summary-title { font-weight: 800; color: #7b2ff7; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }

  /* ── Analisis Panel ── */
  .ai-analisis-card {
    background: linear-gradient(135deg, #F3EEFF, #EEF5FF);
    border-radius: 16px; padding: 16px; font-size: 13px; line-height: 1.8;
  }

  /* ── Koreksi Essay ── */
  .ai-koreksi-result { background: #F0FFF4; border: 2px solid #6BCB77; border-radius: 12px; padding: 12px; font-size: 13px; line-height: 1.7; margin-top: 8px; }
  .ai-koreksi-wrong { background: #FFF0F0; border-color: #FF4757; }
`;

// Inject CSS
const styleEl = document.createElement('style');
styleEl.textContent = aiCSS;
document.head.appendChild(styleEl);

// ============================================================
//  STATE
// ============================================================
let aiPanelOpen = false;
let aiCurrentTab = 'chat';
let aiChatHistory = []; // { role, content }
let aiIsLoading = false;

// ============================================================
//  INJECT HTML ke body
// ============================================================
function injectAIHTML() {
  const html = `
  <!-- AI FAB Button -->
  <button id="ai-fab" onclick="toggleAIPanel()" title="Asisten AI">🤖</button>

  <!-- AI Panel -->
  <div id="ai-panel">
    <div class="ai-panel-header">
      <h3>🤖 KitaBelajar AI</h3>
      <p>Asisten pintar untuk belajar lebih seru!</p>
    </div>
    <div class="ai-tabs" id="ai-tabs">
      <button class="ai-tab active" onclick="switchAITab('chat')">💬 Chat</button>
      <button class="ai-tab" onclick="switchAITab('generate')">📝 Buat Soal</button>
      <button class="ai-tab" onclick="switchAITab('analisis')">📊 Analisis</button>
      <button class="ai-tab" onclick="switchAITab('guru')">👩‍🏫 Guru AI</button>
    </div>

    <!-- TAB: Chat Asisten -->
    <div class="ai-panel-body" id="ai-tab-chat">
      <div id="ai-chat-messages">
        <div class="ai-msg ai">
          <div class="ai-avatar ai-side">🤖</div>
          <div class="ai-bubble">Halo! Aku asisten belajarmu 😊 Tanya apa saja tentang pelajaran, dan aku siap bantu!</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
        <span class="ai-chip" onclick="kirimPesanCepat('Jelaskan fotosintesis dengan mudah')">🌿 Fotosintesis</span>
        <span class="ai-chip" onclick="kirimPesanCepat('Apa itu pecahan sederhana?')">🔢 Pecahan</span>
        <span class="ai-chip" onclick="kirimPesanCepat('Ceritakan tentang Sumpah Pemuda')">🏛️ Sejarah</span>
        <span class="ai-chip" onclick="kirimPesanCepat('Bantu aku belajar perkalian')">✖️ Perkalian</span>
      </div>
    </div>
    <div class="ai-input-wrap" id="ai-chat-input-wrap">
      <input class="ai-input" id="ai-chat-input" placeholder="Tanya apa saja..." onkeydown="if(event.key==='Enter')kirimChatAI()">
      <button class="ai-send-btn" id="ai-send-btn" onclick="kirimChatAI()">➤</button>
    </div>

    <!-- TAB: Generate Soal -->
    <div class="ai-panel-body" id="ai-tab-generate" style="display:none">
      <div class="ai-card">
        <div class="ai-card-title">📝 Generate Soal Otomatis</div>
        <input class="ai-gen-input" id="ai-gen-topik" placeholder="Topik soal (contoh: Pecahan, Fotosintesis...)">
        <select class="ai-gen-input" id="ai-gen-mapel">
          <option value="Matematika">🔢 Matematika</option>
          <option value="IPA">🔬 IPA</option>
          <option value="IPS">🗺️ IPS</option>
          <option value="Bahasa Indonesia">📖 Bahasa Indonesia</option>
          <option value="Umum">📚 Umum</option>
        </select>
        <select class="ai-gen-input" id="ai-gen-jenis">
          <option value="pilihan_ganda">🔘 Pilihan Ganda (A/B/C/D)</option>
          <option value="benar_salah">✅ Benar / Salah</option>
          <option value="campuran">🎲 Campuran (PG + Benar/Salah)</option>
        </select>
        <select class="ai-gen-input" id="ai-gen-jumlah">
          <option value="3">3 soal</option>
          <option value="5" selected>5 soal</option>
          <option value="10">10 soal</option>
          <option value="20">20 soal</option>
          <option value="30">30 soal</option>
          <option value="50">50 soal</option>
          <option value="100">100 soal</option>
        </select>
        <select class="ai-gen-input" id="ai-gen-tingkat">
          <option value="mudah">😊 Mudah</option>
          <option value="sedang" selected>🤔 Sedang</option>
          <option value="sulit">😤 Sulit</option>
        </select>
        <button class="ai-gen-btn" id="ai-gen-btn" onclick="generateSoalAI()">✨ Generate Soal!</button>
      </div>
      <div id="ai-gen-result" style="display:none">
        <div class="ai-card-title" style="margin-top:8px">📋 Hasil Generate:</div>
        <div class="ai-result" id="ai-gen-output"></div>
        <div id="ai-gen-stats" style="font-size:11px;color:#7A7A7A;margin:4px 0 8px;"></div>
        <button class="ai-gen-btn" style="margin-top:8px;background:linear-gradient(135deg,#6BCB77,#4CAF50)" onclick="simpanSoalDariAI()">💾 Simpan Semua ke Bank Soal</button>
      </div>
    </div>

    <!-- TAB: Analisis -->
    <div class="ai-panel-body" id="ai-tab-analisis" style="display:none">
      <div class="ai-card">
        <div class="ai-card-title">📊 Analisis Hasil Belajar</div>
        <p style="font-size:12px;color:#7A7A7A;margin-bottom:10px">AI akan menganalisis performa belajarmu dan memberikan saran</p>
        <button class="ai-gen-btn" onclick="analisisBelajarAI()">🔍 Analisis Sekarang</button>
      </div>
      <div id="ai-analisis-result"></div>
    </div>

    <!-- TAB: Guru AI -->
    <div class="ai-panel-body" id="ai-tab-guru" style="display:none">
      <div class="ai-msg ai">
        <div class="ai-avatar ai-side">👩‍🏫</div>
        <div class="ai-bubble">Halo Bu/Pak Guru! Aku siap bantu dalam hal strategi mengajar, membuat materi, atau saran pembelajaran 😊</div>
      </div>
      <div id="ai-guru-messages"></div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        <span class="ai-chip" onclick="kirimPesanGuru('Beri saran cara mengajar matematika yang menyenangkan')">💡 Strategi Mengajar</span>
        <span class="ai-chip" onclick="kirimPesanGuru('Bagaimana cara membuat soal yang baik untuk SD?')">📝 Buat Soal</span>
        <span class="ai-chip" onclick="kirimPesanGuru('Cara memotivasi murid yang malas belajar')">🎯 Motivasi Murid</span>
      </div>
    </div>
    <div class="ai-input-wrap" id="ai-guru-input-wrap" style="display:none">
      <input class="ai-input" id="ai-guru-input" placeholder="Tanya strategi mengajar..." onkeydown="if(event.key==='Enter')kirimChatGuru()">
      <button class="ai-send-btn" onclick="kirimChatGuru()">➤</button>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

// ============================================================
//  TOGGLE & TAB
// ============================================================
function toggleAIPanel() {
  aiPanelOpen = !aiPanelOpen;
  document.getElementById('ai-fab').classList.toggle('open', aiPanelOpen);
  document.getElementById('ai-panel').classList.toggle('show', aiPanelOpen);

  // Sembunyikan FAB di halaman zep quiz/game
  const activePage = document.querySelector('.page.active')?.id || '';
  if (activePage.includes('zep') || activePage.includes('quiz')) {
    document.getElementById('ai-panel').classList.remove('show');
    aiPanelOpen = false;
    return;
  }

  // Update tab sesuai role user
  if (aiPanelOpen) updateAITabsForRole();
}

function updateAITabsForRole() {
  const isGuru = window.currentUser?.role === 'guru';
  const tabGenerate = document.querySelector('.ai-tab:nth-child(2)');
  const tabGuru = document.querySelector('.ai-tab:nth-child(4)');
  if (isGuru) {
    tabGenerate.style.display = 'block';
    tabGuru.style.display = 'block';
  } else {
    tabGenerate.style.display = 'none';
    tabGuru.style.display = 'none';
  }
}

function switchAITab(tab) {
  aiCurrentTab = tab;
  const tabs = ['chat', 'generate', 'analisis', 'guru'];
  tabs.forEach(t => {
    const body = document.getElementById(`ai-tab-${t}`);
    if (body) body.style.display = t === tab ? 'flex' : 'none';
  });
  // Input area
  const chatInput = document.getElementById('ai-chat-input-wrap');
  const guruInput = document.getElementById('ai-guru-input-wrap');
  if (chatInput) chatInput.style.display = tab === 'chat' ? 'flex' : 'none';
  if (guruInput) guruInput.style.display = tab === 'guru' ? 'flex' : 'none';

  // Update active tab button
  document.querySelectorAll('.ai-tab').forEach((btn, i) => {
    btn.classList.toggle('active', tabs[i] === tab);
  });
}

// ============================================================
//  CHAT ASISTEN MURID
// ============================================================
let chatMuridHistory = [];

function kirimPesanCepat(pesan) {
  document.getElementById('ai-chat-input').value = pesan;
  kirimChatAI();
}

async function kirimChatAI() {
  const input = document.getElementById('ai-chat-input');
  const pesan = input.value.trim();
  if (!pesan || aiIsLoading) return;
  input.value = '';

  tambahPesanChat('ai-chat-messages', 'user', pesan, window.currentUser?.avatar || '🦁');
  aiIsLoading = true;
  document.getElementById('ai-send-btn').disabled = true;

  const typing = tambahTyping('ai-chat-messages');

  try {
    let pesanUntukAI = pesan;
    const detectedUrl = ambilUrlDariPesan(pesan);

    if (detectedUrl) {
      // Ada URL — coba fetch artikel
      const hasil = await fetchArtikelUrl(detectedUrl);
      if (hasil.ok) {
        const permintaan = pesan.replace(detectedUrl, '').trim() || 'Tolong ringkas artikel ini dengan bahasa yang mudah dipahami.';
        // Jangan sertakan URL di pesan ke AI agar tidak trigger refusal bawaan model
        pesanUntukAI = `Berikut ini adalah teks dari sebuah artikel/halaman web yang sudah diambil:\n\n---\n${hasil.teks}\n---\n\nPermintaan: ${permintaan}`;
      } else {
        // Fetch gagal — langsung kasih tahu user, jangan kirim ke AI
        typing.remove();
        const pesanGagal = `😕 Maaf, aku tidak berhasil membuka artikel itu.\n\nKemungkinan penyebabnya:\n• Artikel memerlukan login/berlangganan\n• Situs memblokir akses otomatis\n• URL tidak valid\n\nCoba **salin isi artikel**-nya dan tempel di sini, nanti aku bantu ringkas! 📋`;
        tambahPesanChat('ai-chat-messages', 'ai', pesanGagal, '🤖');
        aiIsLoading = false;
        document.getElementById('ai-send-btn').disabled = false;
        return;
      }
    }

    chatMuridHistory.push({ role: 'user', content: pesanUntukAI });
    const jawaban = await callAIWithHistory(
      `Kamu adalah asisten belajar yang ramah dan menyenangkan untuk siswa SD/SMP Indonesia.
Nama kamu adalah "Kiki" 🤖. Selalu gunakan bahasa Indonesia yang sederhana dan mudah dipahami.
Gunakan emoji secukupnya agar terasa fun. Berikan penjelasan singkat, jelas, dan pakai contoh nyata.
Kalau ada soal matematika, tunjukkan langkah-langkahnya. Semangati murid jika mereka kesulitan.
Jika ada teks artikel yang diberikan pengguna, langsung proses dan ringkas/jelaskan sesuai permintaan tanpa perlu komentar tentang cara kamu mendapatkan teks tersebut.
User saat ini: ${window.currentUser?.nama || 'Murid'}`,
      chatMuridHistory.slice(-10)
    );
    chatMuridHistory.push({ role: 'assistant', content: jawaban });
    typing.remove();
    tambahPesanChat('ai-chat-messages', 'ai', jawaban, '🤖');
  } catch(e) {
    typing.remove();
    tambahPesanChat('ai-chat-messages', 'ai', '😅 Koneksi bermasalah. Coba lagi ya!', '🤖');
  }
  aiIsLoading = false;
  document.getElementById('ai-send-btn').disabled = false;
}

// ============================================================
//  CHAT GURU AI
// ============================================================
let chatGuruHistory = [];

function kirimPesanGuru(pesan) {
  document.getElementById('ai-guru-input').value = pesan;
  kirimChatGuru();
}

async function kirimChatGuru() {
  const input = document.getElementById('ai-guru-input');
  const pesan = input.value.trim();
  if (!pesan || aiIsLoading) return;
  input.value = '';

  tambahPesanChat('ai-guru-messages', 'user', pesan, window.currentUser?.avatar || '👩‍🏫');
  aiIsLoading = true;

  const typing = tambahTyping('ai-guru-messages');

  try {
    let pesanUntukAI = pesan;
    const detectedUrl = ambilUrlDariPesan(pesan);

    if (detectedUrl) {
      const hasil = await fetchArtikelUrl(detectedUrl);
      if (hasil.ok) {
        const permintaan = pesan.replace(detectedUrl, '').trim() || 'Tolong ringkas artikel ini untuk keperluan mengajar.';
        pesanUntukAI = `Berikut ini adalah teks dari sebuah artikel/jurnal yang sudah diambil:\n\n---\n${hasil.teks}\n---\n\nPermintaan guru: ${permintaan}`;
      } else {
        typing.remove();
        const pesanGagal = `😕 Maaf, artikel tersebut tidak bisa diakses secara otomatis.\n\nKemungkinan penyebabnya:\n• Artikel memerlukan login atau berlangganan\n• Situs memblokir akses otomatis\n• URL tidak valid\n\nSolusi: **salin teks artikel**-nya lalu tempel di sini — saya akan bantu ringkas dan kaitkan dengan materi ajar! 📋`;
        tambahPesanChat('ai-guru-messages', 'ai', pesanGagal, '👩‍🏫');
        aiIsLoading = false;
        return;
      }
    }

    chatGuruHistory.push({ role: 'user', content: pesanUntukAI });
    const jawaban = await callAIWithHistory(
      `Kamu adalah konsultan pendidikan AI untuk guru SD/SMP di Indonesia.
Nama kamu adalah "Prof. Kiki" 👩‍🏫. Berikan saran yang praktis, berbasis penelitian pendidikan,
dan mudah diterapkan di kelas. Gunakan bahasa Indonesia yang profesional namun hangat.
Jika ada teks artikel yang diberikan, langsung ringkas atau kaitkan dengan konteks pembelajaran tanpa komentar tentang cara kamu mendapatkan teks tersebut.
Jika ingin merujuk sumber, sebutkan nama buku atau nama jurnal saja tanpa URL.
Guru saat ini: ${window.currentUser?.nama || 'Guru'}`,
      chatGuruHistory.slice(-10)
    );
    chatGuruHistory.push({ role: 'assistant', content: jawaban });
    typing.remove();
    tambahPesanChat('ai-guru-messages', 'ai', jawaban, '👩‍🏫');
  } catch(e) {
    typing.remove();
    tambahPesanChat('ai-guru-messages', 'ai', 'Koneksi bermasalah. Coba lagi!', '👩‍🏫');
  }
  aiIsLoading = false;
}

// ============================================================
//  GENERATE SOAL AI — Smart & Accurate (PG + Benar/Salah)
// ============================================================
let generatedSoalData = [];

// ── System prompt yang ketat untuk akurasi tinggi ─────────
function buildSystemPromptSoal(jenis) {
  const instruksiJenis = jenis === 'benar_salah'
    ? `Kamu membuat soal BENAR/SALAH.
ATURAN WAJIB untuk Benar/Salah:
- Field "jawaban" HANYA boleh berisi string "Benar" atau "Salah" (kapital di huruf pertama, tidak ada kata lain).
- Pernyataan harus faktual dan bisa diverifikasi secara ilmiah/akademis.
- Buat pernyataan yang spesifik, bukan ambigu. Hindari kata "biasanya", "mungkin", "kadang".
- Pastikan distribusi seimbang: sekitar 50% Benar dan 50% Salah.`
    : `Kamu membuat soal PILIHAN GANDA (A/B/C/D).
ATURAN WAJIB untuk Pilihan Ganda:
- Field "jawaban" HARUS berisi teks yang IDENTIK PERSIS dengan salah satu elemen di array "opsi".
- Hanya SATU jawaban yang benar, tiga lainnya adalah pengecoh yang masuk akal.
- Pengecoh (opsi salah) harus relevan dengan topik, bukan asal-asalan.
- Hindari pola jawaban: jangan selalu "C" atau selalu opsi pertama yang benar.`;

  return `Kamu adalah pembuat soal ujian profesional untuk siswa SD/SMP Indonesia.
Tugasmu adalah membuat soal yang AKURAT SECARA FAKTUAL dan sesuai kurikulum Merdeka Belajar.

${instruksiJenis}

ATURAN UMUM WAJIB (berlaku untuk semua jenis soal):
1. AKURASI adalah prioritas utama. Setiap soal dan jawaban HARUS benar secara ilmiah/faktual.
2. Field "pembahasan" WAJIB diisi dengan penjelasan singkat MENGAPA jawaban tersebut benar. Ini memaksamu memverifikasi jawabanmu sendiri.
3. Jangan buat soal yang ambigu atau punya lebih dari satu jawaban yang mungkin benar.
4. Gunakan bahasa Indonesia yang baku dan sesuai tingkat pemahaman siswa SD/SMP.
5. Balas HANYA dengan JSON array yang valid. TIDAK ADA teks lain di luar JSON.
6. Pastikan setiap soal UNIK, tidak mengulang soal sebelumnya dalam batch yang sama.`;
}

// ── Builder prompt per jenis ───────────────────────────────
function buildUserPromptSoal({ jenis, mapel, topik, tingkat, jumlahBatch, nomorMulai, batchKe, totalBatch, soalSebelumnya }) {
  const contohPG = `[{"jenis":"pilihan_ganda","pertanyaan":"Apa ibu kota Indonesia?","emoji":"🏛️","opsi":["Surabaya","Jakarta","Bandung","Medan"],"jawaban":"Jakarta","pembahasan":"Jakarta adalah ibu kota Republik Indonesia sejak kemerdekaan tahun 1945.","poin":100}]`;
  const contohBS = `[{"jenis":"benar_salah","pertanyaan":"Matahari terbit dari arah barat.","emoji":"☀️","jawaban":"Salah","pembahasan":"Matahari terbit dari arah timur dan terbenam di barat, akibat rotasi Bumi dari barat ke timur.","poin":50}]`;

  const instruksiJenis = jenis === 'pilihan_ganda'
    ? `Buat TEPAT ${jumlahBatch} soal PILIHAN GANDA.\nContoh format: ${contohPG}`
    : jenis === 'benar_salah'
    ? `Buat TEPAT ${jumlahBatch} soal BENAR/SALAH.\nContoh format: ${contohBS}`
    : `Buat TEPAT ${jumlahBatch} soal CAMPURAN (gabungkan pilihan_ganda dan benar_salah secara bergantian).\nGunakan format yang sesuai untuk masing-masing jenis.`;

  const konteksBatch = totalBatch > 1
    ? `\nIni batch ke-${batchKe} dari ${totalBatch}. Soal nomor ${nomorMulai} s.d. ${nomorMulai + jumlahBatch - 1}.`
    : '';

  const hindariTopik = soalSebelumnya.length > 0
    ? `\nHINDARI membuat soal dengan pertanyaan serupa:\n${soalSebelumnya.map(s => `- "${s.pertanyaan}"`).join('\n')}`
    : '';

  return `Mata pelajaran: ${mapel}
Topik spesifik: ${topik}
Tingkat kesulitan: ${tingkat}${konteksBatch}

${instruksiJenis}${hindariTopik}

INGAT: Isi "pembahasan" dengan alasan ilmiah/faktual yang memverifikasi jawabanmu. Balas HANYA JSON array.`;
}

// ── Validasi soal hasil generate ──────────────────────────
function validasiSoal(soal) {
  const valid = [];
  const invalid = [];

  for (const s of soal) {
    let alasanGagal = null;

    if (!s.pertanyaan || s.pertanyaan.trim().length < 5) {
      alasanGagal = 'pertanyaan kosong/terlalu pendek';
    } else if (!s.jawaban) {
      alasanGagal = 'jawaban tidak ada';
    } else if (s.jenis === 'pilihan_ganda' || (!s.jenis && s.opsi)) {
      // Validasi PG: jawaban harus ada di opsi
      if (!Array.isArray(s.opsi) || s.opsi.length < 2) {
        alasanGagal = 'opsi pilihan ganda tidak lengkap';
      } else if (!s.opsi.includes(s.jawaban)) {
        // Coba cocokkan case-insensitive
        const cocok = s.opsi.find(o => o.toLowerCase().trim() === s.jawaban.toLowerCase().trim());
        if (cocok) {
          s.jawaban = cocok; // perbaiki kapitalisasi
        } else {
          alasanGagal = `jawaban "${s.jawaban}" tidak ada di opsi`;
        }
      }
    } else if (s.jenis === 'benar_salah') {
      // Validasi BS: jawaban harus "Benar" atau "Salah"
      const j = s.jawaban.trim();
      if (j.toLowerCase() === 'benar') s.jawaban = 'Benar';
      else if (j.toLowerCase() === 'salah') s.jawaban = 'Salah';
      else alasanGagal = `jawaban "${s.jawaban}" bukan "Benar"/"Salah"`;
    }

    // Tandai jenis jika tidak ada
    if (!alasanGagal) {
      if (!s.jenis) s.jenis = s.opsi ? 'pilihan_ganda' : 'benar_salah';
      s.emoji = s.emoji || (s.jenis === 'benar_salah' ? '✅' : '❓');
      s.poin  = s.jenis === 'benar_salah' ? (s.poin || 50) : (s.poin || 100);
      valid.push(s);
    } else {
      invalid.push({ soal: s, alasan: alasanGagal });
    }
  }

  return { valid, invalid };
}

// ── Render preview soal ────────────────────────────────────
function renderPreviewSoal(soalList) {
  return soalList.map((s, i) => {
    if (s.jenis === 'benar_salah') {
      return `${i+1}. ${s.emoji} [B/S] ${s.pertanyaan}\n   ✅ Jawaban: ${s.jawaban}\n   💡 ${s.pembahasan || ''}`;
    } else {
      const opsiStr = (s.opsi || []).map((o, idx) => `${String.fromCharCode(65+idx)}. ${o}`).join('  ');
      return `${i+1}. ${s.emoji} [PG] ${s.pertanyaan}\n   ${opsiStr}\n   ✅ Jawaban: ${s.jawaban}\n   💡 ${s.pembahasan || ''}`;
    }
  }).join('\n\n');
}

async function generateSoalAI() {
  const topik   = document.getElementById('ai-gen-topik').value.trim();
  const mapel   = document.getElementById('ai-gen-mapel').value;
  const jenis   = document.getElementById('ai-gen-jenis').value;
  const jumlah  = parseInt(document.getElementById('ai-gen-jumlah').value);
  const tingkat = document.getElementById('ai-gen-tingkat').value;
  if (!topik) { alert('Masukkan topik soal dulu!'); return; }

  const btn = document.getElementById('ai-gen-btn');
  btn.disabled = true;

  const BATCH_SIZE = 8; // lebih kecil = lebih akurat per batch
  const totalBatch = Math.ceil(jumlah / BATCH_SIZE);
  let semuaSoal = [];
  let totalInvalid = 0;

  try {
    for (let b = 0; b < totalBatch; b++) {
      const sisaTarget = jumlah - semuaSoal.length;
      const soalBatch  = Math.min(BATCH_SIZE, sisaTarget);
      btn.textContent  = `⏳ Batch ${b+1}/${totalBatch} · ${semuaSoal.length}/${jumlah} soal...`;

      // Tentukan jenis per batch (untuk campuran, alternasi)
      const jenisBatch = jenis === 'campuran'
        ? (b % 2 === 0 ? 'pilihan_ganda' : 'benar_salah')
        : jenis;

      const teksRaw = await callAI(
        buildSystemPromptSoal(jenisBatch),
        buildUserPromptSoal({
          jenis: jenisBatch,
          mapel,
          topik,
          tingkat,
          jumlahBatch: soalBatch,
          nomorMulai: semuaSoal.length + 1,
          batchKe: b + 1,
          totalBatch,
          soalSebelumnya: semuaSoal.slice(-5) // kirim 5 soal terakhir biar tidak duplikat
        }),
        4000
      );

      const soalMentah = cleanAndParseJSON(teksRaw);
      const { valid, invalid } = validasiSoal(soalMentah);

      semuaSoal = semuaSoal.concat(valid);
      totalInvalid += invalid.length;

      // Log soal yang gagal validasi (untuk debugging)
      if (invalid.length > 0) {
        console.warn(`[Batch ${b+1}] ${invalid.length} soal gagal validasi:`, invalid);
      }

      if (b < totalBatch - 1) await new Promise(r => setTimeout(r, 600));
    }

    generatedSoalData = semuaSoal.slice(0, jumlah);

    // Tampilkan preview
    const preview = renderPreviewSoal(generatedSoalData);
    document.getElementById('ai-gen-output').textContent = preview;
    document.getElementById('ai-gen-result').style.display = 'block';

    // Tampilkan statistik
    const pgCount = generatedSoalData.filter(s => s.jenis === 'pilihan_ganda').length;
    const bsCount = generatedSoalData.filter(s => s.jenis === 'benar_salah').length;
    const statsEl = document.getElementById('ai-gen-stats');
    if (statsEl) {
      statsEl.textContent = `✅ ${generatedSoalData.length} soal berhasil` +
        (pgCount ? ` · 🔘 ${pgCount} PG` : '') +
        (bsCount ? ` · ✅ ${bsCount} B/S` : '') +
        (totalInvalid ? ` · ⚠️ ${totalInvalid} dibuang (validasi gagal)` : '');
    }

  } catch(e) {
    alert('Gagal generate soal: ' + e.message);
    console.error(e);
  }

  btn.disabled = false;
  btn.textContent = '✨ Generate Soal!';
}

// ── Helper: bersihkan & parse JSON dari respons AI ────────────
function cleanAndParseJSON(raw) {
  let teks = raw
    .replace(/```json\n?/gi, '').replace(/```\n?/g, '')  // hapus markdown code block
    .trim();

  // Ambil hanya bagian dari '[' hingga ']' terakhir
  const start = teks.indexOf('[');
  const end   = teks.lastIndexOf(']');
  if (start !== -1 && end !== -1) teks = teks.slice(start, end + 1);

  // Perbaiki JSON terpotong — potong di '}' terakhir sebelum ']'
  const lastObj = teks.lastIndexOf('}');
  if (lastObj !== -1 && !teks.trim().endsWith(']')) teks = teks.slice(0, lastObj + 1) + ']';

  // Hapus trailing comma sebelum ] atau } (JSON tidak boleh punya trailing comma)
  teks = teks.replace(/,\s*([}\]])/g, '$1');

  // Coba parse langsung dulu
  try { return JSON.parse(teks); } catch(_) {}

  // Fallback: ganti single quote ke double quote pada property name & string value
  try {
    const fixed = teks
      .replace(/'/g, '"')                          // single → double quote
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');  // bare key → "key"
    return JSON.parse(fixed);
  } catch(e) {
    throw new Error('JSON tidak valid dari AI: ' + e.message);
  }
}

async function simpanSoalDariAI() {
  if (!generatedSoalData.length) return;
  const mapel   = document.getElementById('ai-gen-mapel').value;
  const tingkat = document.getElementById('ai-gen-tingkat').value;
  const token   = localStorage.getItem('kb_token');
  if (!token) { alert('Login dulu!'); return; }

  let berhasil = 0;
  for (const s of generatedSoalData) {
    try {
      const payload = {
        pertanyaan : s.pertanyaan,
        emoji      : s.emoji || '❓',
        mapel,
        jenis      : s.jenis || 'pilihan_ganda',
        jawaban    : s.jawaban,
        pembahasan : s.pembahasan || '',
        poin       : s.poin || 100,
        tingkat
      };

      // Hanya kirim opsi kalau PG
      if (s.jenis === 'pilihan_ganda' && Array.isArray(s.opsi)) {
        payload.opsi = JSON.stringify(s.opsi);
      }

      const res = await fetch('/api/soal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (d.success) berhasil++;
    } catch(e) {}
  }

  const pgCount = generatedSoalData.filter(s => s.jenis === 'pilihan_ganda').length;
  const bsCount = generatedSoalData.filter(s => s.jenis === 'benar_salah').length;
  alert(`✅ ${berhasil} dari ${generatedSoalData.length} soal berhasil disimpan!\n🔘 ${pgCount} Pilihan Ganda · ✅ ${bsCount} Benar/Salah`);
  generatedSoalData = [];
  document.getElementById('ai-gen-result').style.display = 'none';
  document.getElementById('ai-gen-topik').value = '';
  const statsEl = document.getElementById('ai-gen-stats');
  if (statsEl) statsEl.textContent = '';
}

// ============================================================
//  ANALISIS BELAJAR AI
// ============================================================
async function analisisBelajarAI() {
  const el = document.getElementById('ai-analisis-result');
  el.innerHTML = '<div class="ai-typing" style="margin:8px auto"><span></span><span></span><span></span></div>';

  try {
    const token = localStorage.getItem('kb_token');
    // Ambil data hasil quiz
    let hasilData = [];
    if (token) {
      try {
        const res = await fetch('/api/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await res.json();
        hasilData = d.data?.quiz_selesai || [];
      } catch(e) {}
    }

    const user = window.currentUser;
    const ringkasanData = hasilData.length > 0
      ? hasilData.map(h => `- ${h.quiz?.judul || 'Quiz'}: ${h.skor} poin`).join('\n')
      : 'Belum ada data quiz yang diselesaikan';

    const analisis = await callAI(
      'Kamu adalah analis pendidikan yang memberikan feedback konstruktif dan memotivasi untuk siswa SD/SMP Indonesia. Gunakan bahasa yang semangat dan positif.',
      `Analisis hasil belajar siswa ini dan berikan saran yang spesifik:

Nama: ${user?.nama || 'Murid'}
Level: ${user?.level || 1}
Total XP: ${user?.xp || 0}

Hasil Quiz Terakhir:
${ringkasanData}

Berikan analisis dalam format:
1. 💪 Kelebihan
2. 📈 Area yang perlu ditingkatkan
3. 🎯 Saran belajar konkret (3 poin)
4. 🌟 Motivasi singkat

Jawaban max 200 kata, pakai emoji, bahasa Indonesia.`,
      600
    );

    el.innerHTML = `<div class="ai-analisis-card">${analisis.replace(/\n/g, '<br>')}</div>`;
  } catch(e) {
    el.innerHTML = '<div style="color:#FF4757;font-size:13px">Gagal menganalisis. Coba lagi!</div>';
  }
}

// ============================================================
//  SUMMARIZE MATERI
// ============================================================
async function summarizeMateri(konten, judul) {
  let summaryBox = document.getElementById('ai-summary-active');
  if (!summaryBox) {
    summaryBox = document.createElement('div');
    summaryBox.id = 'ai-summary-active';
    summaryBox.className = 'ai-summary-box';
    summaryBox.innerHTML = '<div class="ai-summary-title">🤖 Ringkasan AI <span style="font-size:11px;font-weight:400;opacity:.7">sedang dibuat...</span></div><div class="ai-typing"><span></span><span></span><span></span></div>';
  }

  const btn = document.querySelector('.ai-summarize-btn.active-summarize');
  if (btn) btn.parentElement.appendChild(summaryBox);

  try {
    const ringkasan = await callAI(
      'Kamu adalah asisten belajar yang membuat ringkasan materi pelajaran untuk siswa SD/SMP Indonesia. Gunakan bahasa sederhana, poin-poin jelas, dan emoji yang relevan.',
      `Buat ringkasan singkat materi "${judul}" berikut ini dalam 5-7 poin utama yang mudah diingat siswa SD/SMP:

${konten}

Format:
📌 Poin-poin penting (singkat, padat)
Diakhiri dengan: 💡 Tips mudah mengingat`,
      500
    );
    summaryBox.innerHTML = `
      <div class="ai-summary-title">🤖 Ringkasan AI</div>
      <div>${ringkasan.replace(/\n/g, '<br>')}</div>
    `;
  } catch(e) {
    summaryBox.innerHTML = '<div style="color:#FF4757">Gagal membuat ringkasan. Coba lagi!</div>';
  }
}

// ============================================================
//  KOREKSI ESSAY AI
// ============================================================
async function koreksiEssayAI(pertanyaan, jawabanSiswa, kunciJawaban) {
  try {
    return await callAI(
      'Kamu adalah guru yang mengoreksi jawaban essay siswa SD/SMP Indonesia. Berikan penilaian yang adil, konstruktif, dan semangat.',
      `Koreksi jawaban essay ini:

Pertanyaan: ${pertanyaan}
Kunci Jawaban: ${kunciJawaban}
Jawaban Siswa: ${jawabanSiswa}

Berikan:
1. Nilai (0-100)
2. Apakah jawaban benar/sebagian benar/salah
3. Poin yang tepat dari jawaban siswa
4. Yang perlu diperbaiki
5. Skor poin (dari 100)

Format singkat, bahasa Indonesia, pakai emoji.`,
      400
    );
  } catch(e) {
    return 'Gagal mengoreksi jawaban.';
  }
}

// ============================================================
//  PATCH: Tambah tombol summarize ke stream materi
// ============================================================
function patchStreamMateri() {
  // Override fungsi loadKelasStream jika ada
  const origLoad = window.loadKelasStream;
  if (!origLoad) return;

  window.loadKelasStream = async function(kelasId) {
    await origLoad(kelasId);
    // Tambah tombol summarize ke semua materi teks
    setTimeout(() => {
      document.querySelectorAll('.stream-post-body-text').forEach((bodyEl, i) => {
        const konten = bodyEl.textContent.trim();
        const judulEl = bodyEl.closest('.stream-post')?.querySelector('.stream-post-meta h4');
        const judul = judulEl?.textContent || 'Materi';
        if (konten.length > 100 && !bodyEl.querySelector('.ai-summarize-btn')) {
          const btn = document.createElement('button');
          btn.className = 'ai-summarize-btn';
          btn.innerHTML = '🤖 Ringkas dengan AI';
          btn.onclick = function() {
            this.classList.add('active-summarize');
            summarizeMateri(konten, judul);
            this.classList.remove('active-summarize');
          };
          bodyEl.appendChild(btn);
        }
      });
    }, 800);
  };
}

// ============================================================
//  PATCH: Koreksi Essay di kuis
// ============================================================
function patchKoreksiEssay() {
  const origSubmit = window.submitKuisKelas;
  if (!origSubmit) return;

  window.submitKuisKelas = async function() {
    // Koreksi essay dengan AI sebelum submit
    if (window.kuisKelasData) {
      const soal = window.kuisKelasData.soal;
      for (let i = 0; i < soal.length; i++) {
        if (soal[i].jenis === 'isian' && window.kuisJawaban[i] !== undefined) {
          const jawabanSiswa = typeof window.kuisJawaban[i] === 'number'
            ? soal[i].opsi?.[window.kuisJawaban[i]] || ''
            : window.kuisJawaban[i];
          const feedback = await koreksiEssayAI(soal[i].pertanyaan, jawabanSiswa, soal[i].jawaban);
          console.log('AI Essay Feedback:', feedback);
        }
      }
    }
    return origSubmit();
  };
}

// ============================================================
//  CHAT HELPERS
// ============================================================
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAIText(teks) {
  // Escape HTML dulu agar AI tidak bisa inject tag apapun
  let safe = escapeHtml(teks);
  safe = safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Bullet point: baris yang diawali "* " atau "- " → ubah ke •
    .replace(/(^|\n)\* /g, '$1• ')
    .replace(/(^|\n)- /g, '$1• ')
    // Italic: hanya pasangan * yang mengapit teks tanpa spasi di ujungnya
    .replace(/\*(\S[^*]*?\S|\S)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
  return safe;
}

function tambahPesanChat(containerId, role, pesan, avatar) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  const konten = role === 'ai' ? renderAIText(pesan) : escapeHtml(pesan).replace(/\n/g, '<br>');
  div.innerHTML = `
    <div class="ai-avatar ${role === 'ai' ? 'ai-side' : ''}">${avatar}</div>
    <div class="ai-bubble">${konten}</div>
  `;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

function tambahTyping(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return { remove: () => {} };
  const div = document.createElement('div');
  div.className = 'ai-msg ai';
  div.innerHTML = `
    <div class="ai-avatar ai-side">🤖</div>
    <div class="ai-typing"><span></span><span></span><span></span></div>
  `;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

// ============================================================
//  INIT — jalankan saat DOM ready
// ============================================================
function initAI() {
  injectAIHTML();
  patchStreamMateri();
  patchKoreksiEssay();

  // Sembunyikan FAB di halaman yang tidak perlu
  const observer = new MutationObserver(() => {
    const activePage = document.querySelector('.page.active')?.id || '';
    const fab = document.getElementById('ai-fab');
    if (!fab) return;
    const hiddenPages = ['page-zep-join','page-zep-wait','page-zep-soal','page-zep-hasil-soal','page-zep-final','page-zep-guru','page-quiz'];
    fab.style.display = hiddenPages.includes(activePage) ? 'none' : 'flex';
  });
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });

  console.log('🤖 KitaBelajar AI features initialized!');
}

// Tunggu DOM siap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAI);
} else {
  initAI();
}