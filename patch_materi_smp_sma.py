# -*- coding: utf-8 -*-
"""Add more topics to SMP and SMA subjects in kita-materi.html"""

def make_topic(name, html):
    return f"\n      {{ j:'{name}', i:`\n{html}\n` }},"

def add_topics(content, subject_marker, new_topics, occurrence=0):
    idx = content.find(subject_marker)
    count = 0
    while idx != -1 and count < occurrence:
        idx = content.find(subject_marker, idx + 1)
        count += 1
    if idx == -1:
        print(f"WARNING: not found: {subject_marker[:50]}")
        return content
    topics_idx = content.find("topics:[", idx)
    end_idx = content.find("\n    ]\n  },", topics_idx)
    if end_idx == -1:
        end_idx = content.find("\n    ]\n  }", topics_idx)
    if end_idx == -1:
        print(f"WARNING: end not found for {subject_marker[:40]}")
        return content
    topics_html = "".join(make_topic(n, h) for n, h in new_topics)
    print(f"  Added {len(new_topics)} topics to: {subject_marker[:50]}")
    return content[:end_idx] + topics_html + content[end_idx:]

# ==================== SMP TOPICS ====================
SMP_TOPICS = {
  # SMP Matematika (occurrence=1, after SD)
  'SMP_Matematika': {
    'marker': "'Matematika': {\n    icon:'📐', bg:'linear-gradient(145deg,#4776E6,#8E54E9)'",
    'occ': 0,
    'topics': [
      ("Transformasi Geometri", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p>Transformasi geometri adalah perubahan posisi atau ukuran bangun datar pada bidang koordinat.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Transformasi</div><ul>
<li>↔️ <b>Translasi (pergeseran)</b>: bangun digeser sejauh vektor (a, b). Titik (x,y) → (x+a, y+b)</li>
<li>🔄 <b>Rotasi (putaran)</b>: bangun diputar dengan sudut tertentu terhadap titik pusat</li>
<li>🪞 <b>Refleksi (pencerminan)</b>: bangun dicerminkan terhadap garis tertentu</li>
<li>📏 <b>Dilatasi (pembesaran/pengecilan)</b>: bangun diperbesar/diperkecil dengan faktor skala k</li>
</ul></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Refleksi Penting</div>
<div class="formula">Terhadap sumbu-X: (x,y) → (x,-y)</div>
<div class="formula">Terhadap sumbu-Y: (x,y) → (-x,y)</div>
<div class="formula">Terhadap y=x: (x,y) → (y,x)</div></div>"""),

      ("SPLDV (Sistem Persamaan Linear Dua Variabel)", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p>SPLDV adalah sistem yang terdiri dari dua persamaan linear dengan dua variabel (biasanya x dan y).</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Metode Penyelesaian</div><ul>
<li><b>Substitusi</b>: nyatakan satu variabel dari satu persamaan, substitusikan ke persamaan lain</li>
<li><b>Eliminasi</b>: kurangi/jumlahkan dua persamaan untuk menghilangkan satu variabel</li>
<li><b>Grafik</b>: titik perpotongan dua garis = solusi SPLDV</li>
</ul></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh: x + y = 5 dan 2x − y = 1</div>
<p>Eliminasi: (x+y) + (2x−y) = 5+1 → 3x = 6 → x = 2<br>Substitusi: 2 + y = 5 → y = 3<br>Solusi: (x, y) = (2, 3)</p></div>"""),

      ("Aritmetika Sosial", """<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Penting</div>
<div class="formula">Untung = Harga Jual − Harga Beli</div>
<div class="formula">Rugi = Harga Beli − Harga Jual</div>
<div class="formula">% Untung = (Untung / HB) × 100%</div>
<div class="formula">Diskon = % × Harga Asli</div>
<div class="formula">Bunga = Modal × Suku Bunga × Waktu</div></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh</div>
<p>Beli Rp80.000, jual Rp100.000 → Untung = Rp20.000<br>% Untung = 20.000/80.000 × 100% = 25%</p></div>
<div class="mc-tips">💡 <b>Tips:</b> Bruto = berat kotor (barang + kemasan). Tara = berat kemasan. Netto = berat bersih (bruto − tara).</div>"""),

      ("Lingkaran (Busur, Juring & Tali Busur)", """<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Lingkaran</div>
<div class="formula">Luas = πr² | Keliling = 2πr</div>
<div class="formula">Panjang busur = (α/360°) × 2πr</div>
<div class="formula">Luas juring = (α/360°) × πr²</div></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Bagian-Bagian Lingkaran</div><ul>
<li><b>Jari-jari (r)</b>: jarak dari pusat ke tepi</li>
<li><b>Diameter (d = 2r)</b>: garis lurus melalui pusat</li>
<li><b>Busur</b>: lengkungan pada tepi lingkaran</li>
<li><b>Tali busur</b>: garis lurus menghubungkan dua titik di tepi</li>
<li><b>Juring</b>: daerah yang dibatasi dua jari-jari dan busur</li>
<li><b>Tembereng</b>: daerah yang dibatasi tali busur dan busur</li>
</ul></div>"""),
    ]
  },

  'SMP_IPA': {
    'marker': "'IPA': {\n    icon:'🔬', bg:'linear-gradient(145deg,#1a6b3a,#2ecc71)'",
    'occ': 0,
    'topics': [
      ("Ekosistem & Pencemaran Lingkungan", """<div class="mc-def"><div class="mc-def-title">📖 Ekosistem</div><p>Ekosistem = kesatuan interaksi antara makhluk hidup (biotik) dan lingkungannya (abiotik).</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Tingkatan Ekosistem</div>
<div class="formula">Individu → Populasi → Komunitas → Ekosistem → Biosfer</div></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Pencemaran</div><ul>
<li>💧 <b>Air</b>: limbah industri, pestisida, sampah → ikan mati, air tidak layak minum</li>
<li>💨 <b>Udara</b>: asap kendaraan/pabrik, CO₂ → hujan asam, gangguan pernapasan</li>
<li>🌍 <b>Tanah</b>: sampah plastik, pupuk kimia berlebih → tanah tidak subur</li>
<li>🔊 <b>Suara</b>: kebisingan → gangguan pendengaran dan stres</li>
</ul></div>
<div class="mc-tips">💡 <b>Dampak Globalisasi Lingkungan:</b> Efek rumah kaca → pemanasan global → es kutub mencair → permukaan laut naik.</div>"""),

      ("Tekanan Zat (Padat, Cair, Gas)", """<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Tekanan</div>
<div class="formula">Tekanan zat padat: P = F/A (N/m²)</div>
<div class="formula">Tekanan hidrostatis: P = ρgh</div>
<div class="formula">Hukum Pascal: F₁/A₁ = F₂/A₂</div>
<div class="formula">Hukum Archimedes: Fa = ρ_cair × V_tercelup × g</div></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Aplikasi dalam Kehidupan</div><ul>
<li>🚗 Rem hidrolik (Hukum Pascal): tekanan kecil → gaya besar</li>
<li>🛳️ Kapal laut mengapung (Archimedes): gaya apung > berat kapal</li>
<li>🩸 Tekanan darah (sistolik/diastolik) dalam mmHg</li>
<li>🌬️ Tekanan udara diukur dengan barometer</li>
</ul></div>"""),

      ("Gerak pada Tumbuhan", """<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Gerak Tumbuhan</div><ul>
<li>🌻 <b>Tropisme</b>: gerak tumbuh akibat rangsangan searah
  <ul><li>Fototropisme: arah cahaya (bunga matahari)</li>
  <li>Geotropisme: arah gravitasi (akar tumbuh ke bawah)</li>
  <li>Tigmotropisme: sentuhan (tanaman merambat)</li></ul></li>
<li>🌙 <b>Nasti</b>: gerak tumbuh akibat rangsangan tanpa dipengaruhi arah
  <ul><li>Seismonasti: sentuhan (putri malu menutup)</li>
  <li>Fotonasti: cahaya (bunga mekar saat siang)</li>
  <li>Termonasti: suhu (bunga tulip mekar)</li></ul></li>
<li>🔄 <b>Taksis</b>: gerak pindah tempat seluruh tumbuhan (misal: ganggang menuju cahaya)</li>
</ul></div>"""),

      ("Reproduksi Manusia & Perkembangan", """<div class="mc-poin"><div class="mc-poin-title">✅ Sistem Reproduksi</div><ul>
<li>♂️ <b>Laki-laki</b>: testis (sperma), penis, vas deferens, epididimis</li>
<li>♀️ <b>Perempuan</b>: ovarium (sel telur), rahim (uterus), tuba fallopi, vagina</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Proses Reproduksi</div>
<div class="formula">Sperma + Ovum → Fertilisasi → Zigot → Embrio → Janin → Bayi</div>
<p>Kehamilan berlangsung ± 9 bulan (40 minggu)</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Pubertas</div><ul>
<li>♂️ Laki-laki (10-15 th): jakun, suara berubah, tumbuh kumis, mimpi basah</li>
<li>♀️ Perempuan (9-13 th): menstruasi, payudara berkembang, pinggul melebar</li>
</ul></div>"""),
    ]
  },

  'SMP_Biologi': {
    'marker': "'Biologi': {\n    icon:'🧬', bg:'linear-gradient(145deg,#56ab2f,#a8e063)'",
    'occ': 0,
    'topics': [
      ("Sistem Pencernaan Manusia", """<div class="mc-poin"><div class="mc-poin-title">✅ Urutan Saluran Pencernaan</div>
<div class="formula">Mulut → Kerongkongan → Lambung → Usus Halus → Usus Besar → Rektum → Anus</div></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Proses di Setiap Organ</div><ul>
<li>👄 <b>Mulut</b>: mengunyah + enzim ptialin (amylase) mencerna pati → maltosa</li>
<li>🔄 <b>Kerongkongan</b>: peristaltik mendorong makanan ke lambung</li>
<li>🫀 <b>Lambung</b>: HCl membunuh kuman, pepsin mencerna protein, gerakan peristaltik</li>
<li>🌿 <b>Usus Halus</b>: penyerapan sari makanan (duodenum, jejunum, ileum)</li>
<li>💧 <b>Usus Besar</b>: penyerapan air dan mineral, pembentukan feses</li>
</ul></div>
<div class="mc-tips">💡 Enzim pencernaan: ptialin (mulut), pepsin (lambung), tripsin & lipase (pankreas), amilase (usus halus).</div>"""),

      ("Sistem Peredaran Darah", """<div class="mc-def"><div class="mc-def-title">📖 Komponen Darah</div></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Sel-Sel Darah</div><ul>
<li>🔴 <b>Eritrosit</b> (sel darah merah): mengangkut O₂ (hemoglobin), tidak berinti, bentuk bikonkaf</li>
<li>⚪ <b>Leukosit</b> (sel darah putih): melawan kuman, berinti</li>
<li>🟡 <b>Trombosit</b> (keping darah): pembekuan darah</li>
<li>🌊 <b>Plasma darah</b>: cairan kuning bening, mengangkut zat makanan & hormon</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Peredaran Darah</div><ul>
<li>🔴 <b>Peredaran besar</b>: Jantung (kiri) → seluruh tubuh → Jantung (kanan)</li>
<li>🫁 <b>Peredaran kecil</b>: Jantung (kanan) → paru-paru → Jantung (kiri)</li>
</ul></div>
<div class="mc-tips">💡 Golongan darah: A, B, AB (resipien universal), O (donor universal).</div>"""),
    ]
  },

  'SMP_Bahasa_Inggris': {
    'marker': "'Bahasa Inggris': {\n    icon:'🇬🇧', bg:'linear-gradient(145deg,#1e3c72,#2a5298)'",
    'occ': 0,
    'topics': [
      ("Narrative Text & Reading", """<div class="mc-def"><div class="mc-def-title">📖 Narrative Text</div><p>Teks naratif menceritakan kisah (nyata atau fiksi) dengan struktur: <b>Orientation → Complication → Resolution → Reorientation</b></p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Ciri-Ciri Narrative Text</div><ul>
<li>Menggunakan past tense (was, went, said, felt)</li>
<li>Ada tokoh (characters), latar (setting), dan alur (plot)</li>
<li>Biasanya mengandung dialog</li>
<li>Contoh: fairy tales, legends, fables, myths</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Strategi Membaca Teks Bahasa Inggris</div><ul>
<li><b>Skimming</b>: membaca cepat untuk mendapatkan ide umum</li>
<li><b>Scanning</b>: mencari informasi spesifik (nama, angka, tanggal)</li>
<li><b>Context clues</b>: menebak arti kata dari konteks kalimat</li>
</ul></div>"""),

      ("Describing People & Things", """<div class="mc-poin"><div class="mc-poin-title">✅ Vocabulary untuk Deskripsi</div><ul>
<li><b>Appearance</b>: tall/short, thin/fat, curly/straight hair, dark/fair skin</li>
<li><b>Personality</b>: kind, hardworking, lazy, funny, serious, outgoing, shy</li>
<li><b>Things</b>: round, square, soft, rough, shiny, colorful</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Adjective Order</div>
<div class="formula">Opini → Ukuran → Usia → Bentuk → Warna → Asal → Bahan → Tujuan + NOUN</div>
<p>Contoh: "a beautiful (opini) small (ukuran) old (usia) red (warna) Italian (asal) car"</p></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh Kalimat Deskripsi</div>
<p>"My best friend has curly black hair and brown eyes. She is very kind and always smiling."</p></div>"""),
    ]
  },

  'SMP_Fisika': {
    'marker': "'Fisika': {\n    icon:'⚛️', bg:'linear-gradient(145deg,#4D96FF,#818CF8)'",
    'occ': 0,
    'topics': [
      ("Kalor & Perpindahan Panas", """<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Kalor</div>
<div class="formula">Q = m × c × ΔT</div>
<p>Q = kalor (J), m = massa (kg), c = kalor jenis (J/kg°C), ΔT = perubahan suhu</p>
<div class="formula">Q = m × L (perubahan wujud)</div>
<p>L = kalor laten (lebur/uap)</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Cara Perpindahan Kalor</div><ul>
<li>🔥 <b>Konduksi</b>: perpindahan melalui zat tanpa ikut berpindahnya partikel (pada zat padat)</li>
<li>🌊 <b>Konveksi</b>: perpindahan bersama aliran zat (pada zat cair dan gas)</li>
<li>☀️ <b>Radiasi</b>: perpindahan tanpa medium (cahaya matahari)</li>
</ul></div>
<div class="mc-tips">💡 <b>Contoh:</b> Sendok logam panas (konduksi). Angin darat/laut (konveksi). Panas matahari (radiasi).</div>"""),

      ("Rangkaian Listrik", """<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Rangkaian</div><ul>
<li>📗 <b>Seri</b>: komponen dihubungkan berurutan. Arus sama, tegangan berbagi.
  <div class="formula">R_total = R₁ + R₂ + R₃</div></li>
<li>📕 <b>Paralel</b>: komponen dihubungkan bercabang. Tegangan sama, arus berbagi.
  <div class="formula">1/R_total = 1/R₁ + 1/R₂ + 1/R₃</div></li>
</ul></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Hukum Ohm & Daya</div>
<div class="formula">V = I × R (Tegangan = Arus × Hambatan)</div>
<div class="formula">P = V × I = I²R = V²/R (Daya Listrik)</div>
<div class="formula">W = P × t (Energi Listrik = Daya × Waktu)</div></div>
<div class="mc-tips">💡 Lampu di rumah dipasang paralel agar jika satu mati, yang lain tetap menyala.</div>"""),
    ]
  },

  'SMP_Kimia': {
    'marker': "'Kimia': {\n    icon:'🧪', bg:'linear-gradient(145deg,#f093fb,#f5576c)'",
    'occ': 0,
    'topics': [
      ("Larutan Elektrolit & Non-Elektrolit", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p>Larutan elektrolit dapat menghantarkan listrik karena mengandung ion bebas.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Perbedaan</div><ul>
<li>⚡ <b>Elektrolit kuat</b>: terionisasi sempurna → lampu menyala terang (NaCl, HCl, NaOH)</li>
<li>💡 <b>Elektrolit lemah</b>: terionisasi sebagian → lampu menyala redup (asam cuka, NH₃)</li>
<li>❌ <b>Non-elektrolit</b>: tidak terionisasi → lampu tidak menyala (gula, alkohol, urea)</li>
</ul></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Uji Elektrolit</div>
<p>Celupkan elektroda ke larutan → hubungkan ke lampu. Nyala terang = elektrolit kuat. Redup = lemah. Mati = non-elektrolit.</p></div>"""),

      ("Koloid & Campuran", """<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Campuran</div><ul>
<li>💧 <b>Larutan</b>: campuran homogen, partikel < 1 nm, tidak dapat disaring (air garam)</li>
<li>🌫️ <b>Koloid</b>: campuran heterogen, partikel 1-100 nm, tidak dapat disaring biasa (susu, asap)</li>
<li>🪨 <b>Suspensi</b>: campuran heterogen, partikel > 100 nm, dapat disaring (air+pasir)</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Sifat Koloid</div><ul>
<li><b>Efek Tyndall</b>: penghamburan cahaya oleh partikel koloid</li>
<li><b>Gerak Brown</b>: gerak acak partikel koloid karena tumbukan molekul pelarut</li>
<li><b>Adsorpsi</b>: kemampuan menyerap zat lain di permukaannya</li>
</ul></div>"""),
    ]
  },

  'SMP_IPS': {
    'marker': "'IPS': {\n    icon:'🌍', bg:'linear-gradient(145deg,#F7971E,#FFD200)'",
    'occ': 0,
    'topics': [
      ("Penjelajahan Samudra & Kedatangan Bangsa Barat", """<div class="mc-poin"><div class="mc-poin-title">✅ Bangsa Eropa ke Indonesia</div><ul>
<li>🇵🇹 <b>Portugis</b>: pertama tiba di Maluku (1511), mencari rempah-rempah</li>
<li>🇪🇸 <b>Spanyol</b>: tiba dari arah Filipina</li>
<li>🇳🇱 <b>Belanda</b>: mendirikan VOC (1602), penjajahan paling lama</li>
<li>🇬🇧 <b>Inggris</b>: pernah menguasai Jawa (Raffles, 1811-1816)</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Motif Penjelajahan (3G)</div><ul>
<li>💰 <b>Gold</b>: mencari kekayaan (rempah-rempah bernilai tinggi)</li>
<li>✝️ <b>Glory</b>: mencari kejayaan dan kekuasaan wilayah</li>
<li>🙏 <b>Gospel</b>: menyebarkan agama Kristen</li>
</ul></div>"""),

      ("Masa Pendudukan Jepang (1942-1945)", """<div class="mc-def"><div class="mc-def-title">📖 Konteks</div><p>Jepang masuk ke Indonesia setelah mengalahkan Belanda pada Maret 1942. Masa pendudukan berlangsung 3,5 tahun.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Kebijakan Jepang di Indonesia</div><ul>
<li>💪 <b>Romusha</b>: kerja paksa rakyat Indonesia untuk kepentingan Jepang</li>
<li>🪖 <b>PETA (Pembela Tanah Air)</b>: organisasi militer pemuda Indonesia bentukan Jepang</li>
<li>🏫 <b>Bahasa Indonesia</b>: dijadikan bahasa resmi (menggantikan Belanda)</li>
<li>🌾 <b>Tanam paksa padi</b>: padi diserahkan ke Jepang → kelaparan rakyat</li>
</ul></div>
<div class="mc-ingat">🧠 <b>Dampak positif:</b> Militer Indonesia mendapat latihan (cikal bakal TNI). Bahasa Indonesia diperkuat sebagai bahasa nasional.</div>"""),
    ]
  },

  'SMP_PKN': {
    'marker': "'PKN': {\n    icon:'⚖️', bg:'linear-gradient(145deg,#8B1A1A,#D44000)'",
    'occ': 0,
    'topics': [
      ("Lembaga Negara Indonesia", """<div class="mc-poin"><div class="mc-poin-title">✅ Lembaga Negara Utama (Pasca-Amandemen UUD 1945)</div><ul>
<li>🏛️ <b>MPR</b>: Majelis Permusyawaratan Rakyat (DPR + DPD) — mengubah UUD</li>
<li>📋 <b>DPR</b>: Dewan Perwakilan Rakyat — membuat UU, fungsi legislasi, anggaran, pengawasan</li>
<li>🌍 <b>DPD</b>: Dewan Perwakilan Daerah — mewakili kepentingan daerah</li>
<li>🎖️ <b>Presiden</b>: kepala negara & pemerintahan, panglima tertinggi TNI</li>
<li>⚖️ <b>MA</b>: Mahkamah Agung — peradilan umum tertinggi</li>
<li>🔨 <b>MK</b>: Mahkamah Konstitusi — menguji UU terhadap UUD</li>
<li>💰 <b>BPK</b>: Badan Pemeriksa Keuangan — audit keuangan negara</li>
</ul></div>"""),

      ("Perlindungan & Penegakan Hukum", """<div class="mc-poin"><div class="mc-poin-title">✅ Aparat Penegak Hukum</div><ul>
<li>👮 <b>Kepolisian</b>: menyelidiki dan menyidik tindak pidana</li>
<li>🔎 <b>Kejaksaan</b>: menuntut tersangka di pengadilan</li>
<li>⚖️ <b>Kehakiman/Pengadilan</b>: memutus perkara</li>
<li>🛡️ <b>Advokat</b>: membela/mendampingi tersangka atau klien</li>
<li>💼 <b>KPK</b>: Komisi Pemberantasan Korupsi — kasus korupsi</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Peradilan</div><ul>
<li>Pengadilan Negeri (umum), Pengadilan Agama (Islam), Pengadilan Militer, Pengadilan TUN</li>
</ul></div>
<div class="mc-tips">💡 Setiap orang BERHAK mendapat perlindungan hukum yang sama (equality before the law).</div>"""),
    ]
  },

  'SMP_Bahasa_Indonesia': {
    'marker': "'Bahasa Indonesia': {\n    icon:'✍️', bg:'linear-gradient(145deg,#FF416C,#FF4B2B)'",
    'occ': 1,
    'topics': [
      ("Cerpen & Unsur Pembangunnya", """<div class="mc-def"><div class="mc-def-title">📖 Cerpen (Cerita Pendek)</div><p>Cerpen adalah karya sastra fiksi yang singkat, bisa dibaca dalam sekali duduk, dengan konflik tunggal.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Struktur Cerpen</div><ul>
<li><b>Abstrak</b>: ringkasan cerita (opsional)</li>
<li><b>Orientasi</b>: perkenalan tokoh, latar, dan situasi awal</li>
<li><b>Komplikasi</b>: munculnya masalah/konflik</li>
<li><b>Resolusi</b>: penyelesaian masalah</li>
<li><b>Koda</b>: pesan moral (opsional)</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Unsur Intrinsik vs Ekstrinsik</div><ul>
<li><b>Intrinsik</b>: tema, tokoh, alur, latar, sudut pandang, gaya bahasa, amanat</li>
<li><b>Ekstrinsik</b>: biografi pengarang, latar sosial budaya, nilai yang mempengaruhi karya</li>
</ul></div>"""),

      ("Teks Laporan & Teks Ulasan", """<div class="mc-poin"><div class="mc-poin-title">✅ Teks Laporan Percobaan</div><ul>
<li>Berisi hasil percobaan/pengamatan ilmiah</li>
<li>Struktur: Tujuan → Alat/Bahan → Langkah → Hasil → Kesimpulan</li>
<li>Menggunakan bahasa objektif dan kalimat definisi</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Teks Ulasan (Resensi)</div><ul>
<li>Struktur: Identitas karya → Orientasi → Tafsiran → Evaluasi → Rangkuman</li>
<li>Berisi: sinopsis, kelebihan, kekurangan, dan rekomendasi</li>
<li>Tujuan: memberikan gambaran dan penilaian suatu karya</li>
</ul></div>
<div class="mc-tips">💡 Kata kunci teks laporan: "berdasarkan pengamatan", "diperoleh data", "dapat disimpulkan". Teks ulasan: "kelebihan", "kekurangan", "sangat direkomendasikan".</div>"""),
    ]
  },
}

# ==================== SMA TOPICS ====================
SMA_TOPICS = {
  'SMA_Matematika': {
    'marker': "'Matematika': {\n    icon:'∑', bg:'linear-gradient(145deg,#4776E6,#8E54E9)'",
    'occ': 0,
    'topics': [
      ("Matriks & Determinan", """<div class="mc-def"><div class="mc-def-title">📖 Matriks</div><p>Matriks adalah susunan bilangan dalam baris dan kolom yang diapit tanda kurung.</p></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Operasi Matriks</div>
<div class="formula">Penjumlahan: A+B (elemen-elemen dijumlah, ukuran sama)</div>
<div class="formula">Perkalian: (AB)ᵢⱼ = Σ AᵢₖBₖⱼ</div>
<div class="formula">Determinan 2×2: det[[a,b],[c,d]] = ad − bc</div>
<div class="formula">Invers 2×2: A⁻¹ = (1/det A) × [[d,-b],[-c,a]]</div></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh</div>
<p>A = [[2,1],[3,4]] → det(A) = 2×4 − 1×3 = 8 − 3 = 5<br>A⁻¹ = (1/5) × [[4,-1],[-3,2]] = [[4/5, -1/5],[-3/5, 2/5]]</p></div>"""),

      ("Barisan & Deret (Aritmetika & Geometri)", """<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Barisan & Deret</div>
<p><b>Aritmetika (beda tetap = b):</b></p>
<div class="formula">Uₙ = a + (n−1)b</div>
<div class="formula">Sₙ = n/2 × (2a + (n−1)b) = n/2 × (U₁ + Uₙ)</div>
<p><b>Geometri (rasio tetap = r):</b></p>
<div class="formula">Uₙ = a × rⁿ⁻¹</div>
<div class="formula">Sₙ = a(rⁿ − 1)/(r − 1) untuk r ≠ 1</div>
<div class="formula">S∞ = a/(1−r) untuk |r| < 1</div></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh</div>
<p>Barisan aritmetika: 3, 7, 11, 15... (a=3, b=4)<br>U₁₀ = 3 + 9×4 = 39</p></div>"""),

      ("Peluang Statistika Lanjut", """<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Kombinatorika</div>
<div class="formula">Permutasi: nPr = n!/(n-r)!</div>
<div class="formula">Kombinasi: nCr = n!/(r!(n-r)!)</div>
<div class="formula">Peluang: P(A) = n(A)/n(S)</div>
<div class="formula">P(A∪B) = P(A) + P(B) − P(A∩B)</div></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh</div>
<p>4C2 = 4!/(2!×2!) = 24/4 = 6<br>Peluang dadu genap = 3/6 = 1/2</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Ukuran Pemusatan & Penyebaran Data</div><ul>
<li>Mean, Median, Modus untuk data kelompok</li>
<li>Variansi (σ²) dan Simpangan Baku (σ)</li>
<li>Kuartil, Desil, Persentil</li>
</ul></div>"""),
    ]
  },

  'SMA_Fisika': {
    'marker': "'Fisika': {\n    icon:'⚡', bg:'linear-gradient(145deg,#F7971E,#FFD200)'",
    'occ': 0,
    'topics': [
      ("Termodinamika", """<div class="mc-poin"><div class="mc-poin-title">✅ Hukum-Hukum Termodinamika</div><ul>
<li><b>Hukum 0</b>: jika A = B dan B = C maka A = C (kesetimbangan termal)</li>
<li><b>Hukum I</b>: ΔU = Q − W (energi dalam = kalor − usaha yang dilakukan sistem)</li>
<li><b>Hukum II</b>: panas mengalir spontan dari suhu tinggi ke rendah</li>
<li><b>Hukum III</b>: suhu 0 K tidak dapat dicapai</li>
</ul></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Efisiensi Mesin Carnot</div>
<div class="formula">η = 1 − (T₂/T₁) × 100%</div>
<p>T₁ = suhu sumber panas (K), T₂ = suhu sumber dingin (K)</p></div>
<div class="mc-tips">💡 <b>Proses Termodinamika:</b> Isotermal (T konstan), Isobarik (P konstan), Isokhorik (V konstan), Adiabatik (Q=0).</div>"""),

      ("Optika Fisik & Alat Optik", """<div class="mc-poin"><div class="mc-poin-title">✅ Alat-Alat Optik</div><ul>
<li>👁️ <b>Mata</b>: lensa bikonveks alami. Cacat: miopi (−), hipermetropi (+), presbiopi (bifokus)</li>
<li>🔍 <b>Kaca Pembesar (Lup)</b>: M = 25/f (untuk mata berakomodasi maksimum)</li>
<li>🔬 <b>Mikroskop</b>: perbesaran total = Mob × Mok</li>
<li>🔭 <b>Teleskop</b>: M = fob/fok (untuk benda sangat jauh)</li>
<li>📷 <b>Kamera</b>: lensa konvergen, bayangan nyata terbalik di film/sensor</li>
</ul></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Lensa Tipis</div>
<div class="formula">1/f = 1/s + 1/s' (s=jarak benda, s'=jarak bayangan)</div>
<div class="formula">M = |s'/s| (perbesaran)</div></div>"""),

      ("Fisika Inti & Radioaktivitas", """<div class="mc-def"><div class="mc-def-title">📖 Struktur Inti Atom</div><p>Inti atom terdiri dari proton (+) dan neutron (netral). Elektron berada di luar inti.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Radiasi Inti</div><ul>
<li>🔴 <b>Alfa (α)</b>: partikel ²He⁴, daya tembus rendah, ionisasi kuat</li>
<li>🔵 <b>Beta (β)</b>: elektron/positron, daya tembus sedang</li>
<li>🟡 <b>Gamma (γ)</b>: gelombang EM frekuensi tinggi, daya tembus kuat</li>
</ul></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Peluruhan Radioaktif</div>
<div class="formula">N = N₀ × (1/2)^(t/t½)</div>
<p>t½ = waktu paruh, t = waktu, N₀ = jumlah awal</p></div>
<div class="mc-tips">💡 Aplikasi: reaktor nuklir (energi), CT scan (kedokteran), penanggalan karbon-14 (arkeologi).</div>"""),
    ]
  },

  'SMA_Kimia': {
    'marker': "'Kimia': {\n    icon:'⚗️', bg:'linear-gradient(145deg,#11998e,#38ef7d)'",
    'occ': 0,
    'topics': [
      ("Kesetimbangan Kimia", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p>Kesetimbangan kimia terjadi ketika laju reaksi maju = laju reaksi balik (kondisi dinamis).</p></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Tetapan Kesetimbangan</div>
<div class="formula">aA + bB ⇌ cC + dD</div>
<div class="formula">Kc = [C]^c[D]^d / [A]^a[B]^b</div>
<div class="formula">Kp = Kc × (RT)^Δn</div></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Asas Le Chatelier</div><p>Jika kesetimbangan terganggu, sistem akan bergeser untuk mengurangi gangguan:</p><ul>
<li>Konsentrasi naik → bergeser ke arah berlawanan</li>
<li>Tekanan naik → bergeser ke jumlah mol gas lebih sedikit</li>
<li>Suhu naik → bergeser ke arah reaksi endoterm</li>
</ul></div>"""),

      ("Elektrokimia", """<div class="mc-poin"><div class="mc-poin-title">✅ Sel Elektrokimia</div><ul>
<li>⚡ <b>Sel Galvani (Volta)</b>: reaksi kimia → energi listrik (baterai). Anoda=oksidasi, Katoda=reduksi</li>
<li>🔌 <b>Sel Elektrolisis</b>: energi listrik → reaksi kimia. Anoda=oksidasi, Katoda=reduksi</li>
</ul></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Hukum Faraday</div>
<div class="formula">W = (Ar × I × t) / (n × F)</div>
<p>W=massa(g), Ar=massa atom relatif, I=arus(A), t=waktu(s), n=valensi, F=96.500 C/mol</p></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Aplikasi</div>
<p>Baterai/aki (sel galvani), Penyepuhan emas (elektroplating), Pembuatan aluminium (Hall-Heroult)</p></div>"""),

      ("Kimia Organik: Gugus Fungsi", """<div class="mc-poin"><div class="mc-poin-title">✅ Gugus Fungsi Penting</div><ul>
<li><b>–OH</b>: Alkohol (R–OH). Cth: etanol (C₂H₅OH)</li>
<li><b>–CHO</b>: Aldehid. Cth: formaldehid (metanal HCHO)</li>
<li><b>–COOH</b>: Asam karboksilat. Cth: asam asetat (CH₃COOH)</li>
<li><b>–CO–</b>: Keton. Cth: aseton (CH₃COCH₃)</li>
<li><b>–O–</b>: Eter. Cth: dietil eter (C₂H₅OC₂H₅)</li>
<li><b>–COO–</b>: Ester (dari asam + alkohol). Cth: etil asetat</li>
</ul></div>
<div class="mc-tips">💡 Nama IUPAC: hitung jumlah karbon rantai utama (met=1, et=2, prop=3, but=4, pent=5) + akhiran sesuai gugus (–ol, –al, –on, –oat).</div>"""),
    ]
  },

  'SMA_Ekonomi': {
    'marker': "'Ekonomi': {\n    icon:'💰', bg:'linear-gradient(145deg,#f7971e,#ffd200)'",
    'occ': 0,
    'topics': [
      ("Pasar Modal & Investasi", """<div class="mc-def"><div class="mc-def-title">📖 Pasar Modal</div><p>Pasar modal adalah tempat jual-beli instrumen keuangan jangka panjang seperti saham dan obligasi.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Instrumen Pasar Modal</div><ul>
<li>📊 <b>Saham</b>: tanda kepemilikan di perusahaan. Keuntungan: dividen + capital gain</li>
<li>📋 <b>Obligasi</b>: surat utang. Keuntungan: kupon (bunga) tetap</li>
<li>🏦 <b>Reksa Dana</b>: investasi kolektif yang dikelola manajer investasi</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Lembaga di Pasar Modal</div><ul>
<li>BEI (Bursa Efek Indonesia): tempat perdagangan saham</li>
<li>OJK (Otoritas Jasa Keuangan): pengawas pasar modal</li>
<li>KSEI: Kustodian Sentral Efek Indonesia</li>
</ul></div>"""),

      ("Perdagangan Internasional", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p>Perdagangan internasional adalah pertukaran barang/jasa antar negara.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Faktor Pendorong</div><ul>
<li>Perbedaan SDA, teknologi, dan biaya produksi</li>
<li>Keunggulan komparatif dan absolut</li>
<li>Perluasan pasar dan peningkatan devisa</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Kebijakan Perdagangan</div><ul>
<li>🛡️ <b>Tarif/Bea masuk</b>: pajak impor untuk melindungi produk dalam negeri</li>
<li>📉 <b>Kuota impor</b>: membatasi jumlah barang impor</li>
<li>📈 <b>Subsidi ekspor</b>: bantuan pemerintah agar ekspor kompetitif</li>
<li>🚫 <b>Dumping</b>: menjual di bawah harga pokok di pasar luar negeri (dilarang)</li>
</ul></div>"""),
    ]
  },

  'SMA_Sejarah': {
    'marker': "'Sejarah': {\n    icon:'🏛️', bg:'linear-gradient(145deg,#C94B4B,#4B134F)'",
    'occ': 0,
    'topics': [
      ("Perang Dunia I & II", """<div class="mc-poin"><div class="mc-poin-title">✅ Perang Dunia I (1914-1918)</div><ul>
<li><b>Penyebab</b>: pembunuhan Archduke Franz Ferdinand + sistem aliansi</li>
<li><b>Blok Sekutu</b>: Perancis, Inggris, Rusia, AS vs <b>Blok Sentral</b>: Jerman, Austria-Hungaria, Ottoman</li>
<li><b>Akhir</b>: Perjanjian Versailles 1919, Jerman kalah</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Perang Dunia II (1939-1945)</div><ul>
<li><b>Penyebab</b>: Jerman invasi Polandia, kebangkitan Nazisme</li>
<li><b>Blok Sekutu</b>: AS, Inggris, USSR vs <b>Blok Poros</b>: Jerman, Italia, Jepang</li>
<li><b>Akhir</b>: Jerman menyerah (Mei 1945), Jepang menyerah setelah bom atom (Agustus 1945)</li>
</ul></div>
<div class="mc-ingat">🧠 PD II mengakhiri penjajahan Jepang di Indonesia → Proklamasi 17 Agustus 1945.</div>"""),

      ("Perang Dingin & Dunia Pasca-1945", """<div class="mc-def"><div class="mc-def-title">📖 Perang Dingin (1947-1991)</div><p>Persaingan ideologi dan kekuatan antara AS (kapitalisme/demokrasi liberal) dan USSR (komunisme) tanpa perang langsung.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Peristiwa Penting</div><ul>
<li>🇺🇸 Marshall Plan: bantuan AS untuk rekonstruksi Eropa Barat</li>
<li>🏰 Tembok Berlin (1961): memisahkan Jerman Barat & Timur</li>
<li>🚀 Perlombaan Antariksa: Sputnik (USSR) vs Apollo (AS)</li>
<li>🌎 Krisis Misil Kuba (1962): nyaris perang nuklir</li>
<li>🏁 Runtuhnya USSR (1991): akhir Perang Dingin</li>
</ul></div>
<div class="mc-tips">💡 Indonesia memilih jalur Non-Blok (tidak memihak AS maupun USSR) bersama Nehru, Nasser, Tito.</div>"""),
    ]
  },

  'SMA_Geografi': {
    'marker': "'Geografi': {\n    icon:'🌏', bg:'linear-gradient(145deg,#1a6b3a,#2ecc71)'",
    'occ': 0,
    'topics': [
      ("Kependudukan & Sumber Daya Manusia", """<div class="mc-poin"><div class="mc-poin-title">✅ Konsep Kependudukan</div><ul>
<li><b>Sensus penduduk</b>: pencacahan seluruh penduduk (Indonesia: setiap 10 tahun)</li>
<li><b>Piramida penduduk</b>: muda (expansif), tua (stasioner/konstruktif)</li>
<li><b>Laju pertumbuhan</b>: (lahir + imigrasi) − (mati + emigrasi)</li>
</ul></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Kepadatan Penduduk</div>
<div class="formula">Kepadatan aritmetis = Jumlah penduduk / Luas wilayah (km²)</div>
<div class="formula">Kepadatan agraris = Jumlah penduduk petani / Luas lahan pertanian</div></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Bonus Demografi</div><p>Kondisi di mana penduduk usia produktif (15-64 th) jauh lebih banyak dari non-produktif → potensi percepatan ekonomi jika dimanfaatkan dengan baik.</p></div>"""),

      ("Pembangunan & Lingkungan Hidup", """<div class="mc-def"><div class="mc-def-title">📖 Pembangunan Berkelanjutan</div><p>Pembangunan yang memenuhi kebutuhan sekarang tanpa mengorbankan kemampuan generasi mendatang.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Masalah Lingkungan Global</div><ul>
<li>🌡️ <b>Pemanasan global</b>: CO₂ naik → efek rumah kaca → suhu bumi naik</li>
<li>☔ <b>Hujan asam</b>: SO₂ + NO₂ + air → asam → merusak bangunan dan ekosistem</li>
<li>🕳️ <b>Lubang ozon</b>: CFC merusak lapisan ozon di stratosfer</li>
<li>🌳 <b>Deforestasi</b>: penebangan hutan → banjir, erosi, kepunahan spesies</li>
</ul></div>
<div class="mc-tips">💡 SDGs (Sustainable Development Goals): 17 tujuan pembangunan berkelanjutan PBB untuk 2015-2030.</div>"""),
    ]
  },

  'SMA_Sosiologi': {
    'marker': "'Sosiologi': {\n    icon:'👥', bg:'linear-gradient(145deg,#8E2DE2,#4A00E0)'",
    'occ': 0,
    'topics': [
      ("Konflik & Integrasi Sosial", """<div class="mc-def"><div class="mc-def-title">📖 Konflik Sosial</div><p>Konflik sosial adalah pertentangan antar individu/kelompok karena perbedaan kepentingan, nilai, atau sumber daya.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Bentuk Penyelesaian Konflik</div><ul>
<li>🤝 <b>Konsiliasi</b>: penyelesaian melalui lembaga tertentu</li>
<li>⚖️ <b>Mediasi</b>: melibatkan pihak ketiga sebagai penengah</li>
<li>🏛️ <b>Arbitrasi</b>: pihak ketiga dengan wewenang memutus</li>
<li>🔨 <b>Ajudikasi</b>: penyelesaian melalui pengadilan</li>
<li>🌿 <b>Rekonsiliasi</b>: upaya memulihkan hubungan</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Integrasi Sosial</div><p>Proses penyatuan kelompok-kelompok sosial menjadi satu kesatuan yang harmonis. Faktor pendorong: kesamaan nasib, tujuan, budaya, dan wilayah.</p></div>"""),

      ("Penelitian Sosial", """<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Penelitian Sosial</div><ul>
<li>📊 <b>Kuantitatif</b>: data berupa angka/statistik. Metode: survei, eksperimen</li>
<li>📝 <b>Kualitatif</b>: data berupa kata/narasi. Metode: wawancara mendalam, observasi, etnografi</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Langkah Penelitian Sosial</div>
<ol><li>Pemilihan topik/masalah</li>
<li>Perumusan masalah & hipotesis</li>
<li>Pengumpulan data (observasi, wawancara, kuesioner)</li>
<li>Pengolahan & analisis data</li>
<li>Penarikan kesimpulan</li>
<li>Penyusunan laporan</li></ol></div>
<div class="mc-tips">💡 <b>Sampel</b> = bagian dari populasi yang diteliti. <b>Random sampling</b> = pengambilan sampel acak agar representatif.</div>"""),
    ]
  },
}

with open(r'c:\file kuliah\Pemerograman\project KitaBelajar\public\kita-materi.html', 'r', encoding='utf-8') as f:
    content = f.read()

all_subjects = {**SMP_TOPICS, **SMA_TOPICS}
total_added = 0
for subj_name, cfg in all_subjects.items():
    original_len = len(content)
    content = add_topics(content, cfg['marker'], cfg['topics'], cfg['occ'])
    added = len(content) - original_len
    total_added += len(cfg['topics'])
    print(f"  {subj_name}: +{len(cfg['topics'])} topics ({added} chars)")

with open(r'c:\file kuliah\Pemerograman\project KitaBelajar\public\kita-materi.html', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal: +{total_added} topics added to SMP & SMA!")
