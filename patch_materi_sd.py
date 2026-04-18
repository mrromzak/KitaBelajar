# -*- coding: utf-8 -*-
"""Add more topics to SD subjects in kita-materi.html"""

SD_EXTRA = {
  'SD_Matematika': [
    ("Bangun Ruang", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p>Bangun ruang adalah bangun tiga dimensi yang memiliki panjang, lebar, dan tinggi (volume).</p></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus Volume & Luas Permukaan</div>
<div class="formula">Kubus: V = s³ | LP = 6s²</div>
<div class="formula">Balok: V = p×l×t | LP = 2(pl+pt+lt)</div>
<div class="formula">Tabung: V = πr²t | LP = 2πr(r+t)</div>
<div class="formula">Kerucut: V = ⅓πr²t | LP = πr(r+s)</div>
<div class="formula">Bola: V = ⁴⁄₃πr³ | LP = 4πr²</div></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Sifat Kubus vs Balok</div><ul>
<li>Kubus: 6 sisi berbentuk persegi, 12 rusuk sama panjang, 8 titik sudut</li>
<li>Balok: 6 sisi berbentuk persegi panjang, 12 rusuk, 8 titik sudut</li>
</ul></div>
<div class="mc-tips">💡 <b>Ingat:</b> Luas permukaan = total luas semua sisi. Volume = isi di dalam bangun.</div>"""),

    ("Pengukuran (Panjang, Berat, Waktu)", """<div class="mc-poin"><div class="mc-poin-title">✅ Satuan Panjang (dari besar ke kecil)</div>
<div class="formula">km → hm → dam → m → dm → cm → mm</div>
<p>Setiap turun 1 tangga: × 10. Setiap naik 1 tangga: ÷ 10.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Satuan Berat</div>
<div class="formula">ton → kwintal → kg → hg → dag → g → dg → cg → mg</div>
<p>1 ton = 1.000 kg | 1 kwintal = 100 kg | 1 kg = 1.000 g</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Satuan Waktu</div><ul>
<li>1 abad = 100 tahun | 1 dasawarsa = 10 tahun</li>
<li>1 tahun = 12 bulan = 365 hari</li>
<li>1 minggu = 7 hari | 1 hari = 24 jam</li>
<li>1 jam = 60 menit | 1 menit = 60 detik</li>
</ul></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh</div><p>2,5 km = 2.500 m. 3 jam 20 menit = 200 menit.</p></div>"""),

    ("Data, Tabel & Diagram", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p>Data adalah kumpulan informasi yang dikumpulkan untuk diolah dan disajikan.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Ukuran Statistik Dasar</div><ul>
<li><b>Mean (rata-rata):</b> jumlah semua data ÷ banyak data</li>
<li><b>Median:</b> nilai tengah setelah data diurutkan</li>
<li><b>Modus:</b> data yang paling sering muncul</li>
</ul></div>
<div class="mc-rumus"><div class="mc-rumus-title">📐 Rumus</div>
<div class="formula">Mean = Σdata / n</div></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh</div><p>Data: 5, 7, 7, 8, 9, 10<br>Mean = (5+7+7+8+9+10)/6 = 46/6 ≈ 7,67<br>Median = (7+8)/2 = 7,5<br>Modus = 7 (muncul 2x)</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Diagram</div><ul>
<li><b>Diagram batang:</b> membandingkan kategori</li>
<li><b>Diagram lingkaran (pie):</b> persentase bagian dari keseluruhan</li>
<li><b>Diagram garis:</b> menunjukkan perubahan dari waktu ke waktu</li>
</ul></div>"""),

    ("Bilangan Bulat & Bilangan Romawi", """<div class="mc-poin"><div class="mc-poin-title">✅ Bilangan Bulat</div><ul>
<li>Bilangan bulat positif: 1, 2, 3, ... (di kanan 0 pada garis bilangan)</li>
<li>Bilangan bulat negatif: -1, -2, -3, ... (di kiri 0)</li>
<li>Operasi: (+) × (+) = (+), (−) × (−) = (+), (+) × (−) = (−)</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Bilangan Romawi</div>
<div class="formula">I=1, V=5, X=10, L=50, C=100, D=500, M=1000</div>
<ul>
<li>Jika simbol LEBIH KECIL di depan simbol besar → KURANGI: IV=4, IX=9, XL=40, XC=90</li>
<li>Jika simbol LEBIH BESAR atau SAMA di depan → JUMLAH: VI=6, XI=11, LX=60</li>
</ul></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh</div><p>2024 → MMXXIV (2000+20+4 = MM+XX+IV)<br>XIV = 10+4 = 14 | XLII = 40+2 = 42</p></div>
<div class="mc-tips">💡 <b>Tips:</b> Tidak ada simbol yang diulang lebih dari 3 kali berturut-turut (kecuali M).</div>"""),
  ],

  'SD_IPA': [
    ("Perubahan Wujud Benda", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p>Benda dapat berubah wujud dari satu bentuk ke bentuk lainnya karena pengaruh suhu (panas/dingin).</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Perubahan Wujud</div><ul>
<li>❄️ <b>Membeku</b>: cair → padat (contoh: air → es)</li>
<li>💧 <b>Mencair</b>: padat → cair (contoh: es → air)</li>
<li>♨️ <b>Menguap</b>: cair → gas (contoh: air dipanaskan → uap)</li>
<li>🌫️ <b>Mengembun</b>: gas → cair (contoh: embun pagi)</li>
<li>💨 <b>Menyublim</b>: padat → gas (contoh: kapur barus habis)</li>
<li>❄️ <b>Mengkristal/Deposisi</b>: gas → padat (contoh: salju)</li>
</ul></div>
<div class="mc-ingat">🧠 <b>Ingat:</b> Perubahan wujud adalah perubahan FISIKA (tidak menghasilkan zat baru).</div>"""),

    ("Panca Indera Manusia", """<div class="mc-poin"><div class="mc-poin-title">✅ Lima Indera Manusia</div><ul>
<li>👁️ <b>Mata</b>: alat penglihatan. Bagian: kornea, iris, pupil, lensa, retina</li>
<li>👂 <b>Telinga</b>: alat pendengaran. Bagian: daun telinga, gendang telinga, koklea</li>
<li>👃 <b>Hidung</b>: alat penciuman. Bulu hidung menyaring debu dari udara</li>
<li>👅 <b>Lidah</b>: alat pengecap. Bagian depan: manis. Belakang: pahit. Tepi: asin & asam</li>
<li>🤚 <b>Kulit</b>: alat peraba. Merasakan panas, dingin, kasar, halus, tekanan</li>
</ul></div>
<div class="mc-tips">💡 <b>Menjaga Kesehatan Indera:</b> Cuci tangan sebelum menyentuh mata, jangan terlalu keras membersihkan telinga, hindari makanan terlalu panas.</div>
<div class="mc-ingat">🧠 <b>Ingat:</b> Panca indera berhubungan langsung dengan otak melalui sistem saraf untuk diproses menjadi informasi.</div>"""),

    ("Daur Hidup Hewan", """<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Metamorfosis</div>
<div class="mc-contoh"><div class="mc-contoh-title">🦋 Metamorfosis Sempurna (Holometabola)</div>
<p>4 tahap: <b>Telur → Larva (ulat) → Pupa (kepompong) → Imago (dewasa)</b><br>Contoh: kupu-kupu, lebah, nyamuk, lalat</p></div>
<div class="mc-contoh"><div class="mc-contoh-title">🦗 Metamorfosis Tidak Sempurna (Hemimetabola)</div>
<p>3 tahap: <b>Telur → Nimfa → Imago (dewasa)</b><br>Nimfa mirip dewasa tapi lebih kecil, belum ada sayap<br>Contoh: belalang, kecoa, jangkrik</p></div>
<div class="mc-contoh"><div class="mc-contoh-title">🐔 Tanpa Metamorfosis</div>
<p>Hewan yang lahir/menetas mirip induknya: ayam, bebek, ular, buaya</p></div>
<div class="mc-tips">💡 <b>Tips:</b> Metamorfosis SEMPURNA ada fase kepompong, TIDAK SEMPURNA tidak ada fase kepompong!</div>"""),

    ("Sumber Daya Alam & Lingkungan", """<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Sumber Daya Alam (SDA)</div><ul>
<li>🌱 <b>Dapat Diperbarui</b>: dapat pulih sendiri (air, udara, hewan, tumbuhan, tanah)</li>
<li>⛽ <b>Tidak Dapat Diperbarui</b>: akan habis (minyak bumi, batu bara, gas alam, emas)</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Cara Menjaga Lingkungan (3R)</div><ul>
<li>♻️ <b>Reduce</b>: mengurangi penggunaan barang yang menghasilkan sampah</li>
<li>🔄 <b>Reuse</b>: menggunakan kembali barang yang masih bisa dipakai</li>
<li>♻️ <b>Recycle</b>: mendaur ulang sampah menjadi barang baru</li>
</ul></div>
<div class="mc-ingat">🧠 <b>Dampak Pencemaran:</b> Sampah plastik → membahayakan hewan laut. Asap pabrik → polusi udara. Limbah industri → pencemaran air sungai.</div>"""),
  ],

  'SD_IPS': [
    ("Pahlawan & Sejarah Kemerdekaan", """<div class="mc-def"><div class="mc-def-title">📖 Perjuangan Kemerdekaan</div><p>Indonesia merdeka pada 17 Agustus 1945 setelah lama dijajah Belanda (350 tahun) dan Jepang (3,5 tahun).</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Tokoh Pejuang Kemerdekaan</div><ul>
<li>🎤 <b>Ir. Soekarno</b>: Presiden pertama, membacakan proklamasi</li>
<li>🤝 <b>Drs. Mohammad Hatta</b>: Wakil Presiden pertama, mendampingi proklamasi</li>
<li>✍️ <b>Ahmad Soebardjo</b>: membantu merumuskan teks proklamasi</li>
<li>💪 <b>Bung Tomo</b>: pemimpin pertempuran 10 November di Surabaya</li>
<li>⚔️ <b>Cut Nyak Dien & Teuku Umar</b>: pahlawan dari Aceh melawan Belanda</li>
<li>🛡️ <b>Pangeran Diponegoro</b>: memimpin Perang Jawa (1825-1830)</li>
</ul></div>
<div class="mc-ingat">🧠 <b>Ingat:</b> Hari Pahlawan = 10 November. Hari Kemerdekaan = 17 Agustus.</div>"""),

    ("Keragaman Suku, Bahasa & Budaya Indonesia", """<div class="mc-def"><div class="mc-def-title">📖 Indonesia Negara Majemuk</div><p>Indonesia memiliki lebih dari 1.300 suku bangsa, 700+ bahasa daerah, dan beragam tradisi budaya.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Contoh Keragaman Budaya</div><ul>
<li>🎭 <b>Tarian daerah</b>: Saman (Aceh), Kecak (Bali), Piring (Minang), Jaipong (Jawa Barat)</li>
<li>🏠 <b>Rumah adat</b>: Joglo (Jawa), Honai (Papua), Gadang (Minang), Limas (Palembang)</li>
<li>👘 <b>Pakaian adat</b>: Kebaya (Jawa), Ulos (Batak), Bodo (Bugis)</li>
<li>🎵 <b>Lagu daerah</b>: Rasa Sayange (Maluku), Suwe Ora Jamu (Yogya), Ampar-Ampar Pisang (Kalsel)</li>
</ul></div>
<div class="mc-tips">💡 <b>Sikap terhadap Keragaman:</b> Toleransi, menghargai, dan menjaga persatuan. Perbedaan adalah kekayaan bangsa!</div>"""),

    ("Pemerintahan Daerah & Pusat", """<div class="mc-poin"><div class="mc-poin-title">✅ Susunan Pemerintahan Pusat</div><ul>
<li>🏛️ Presiden & Wakil Presiden (masa jabatan 5 tahun)</li>
<li>📋 DPR (Dewan Perwakilan Rakyat) — membuat undang-undang</li>
<li>⚖️ MA (Mahkamah Agung) — lembaga peradilan tertinggi</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Susunan Pemerintahan Daerah</div><ul>
<li>🌍 <b>Provinsi</b>: dipimpin Gubernur (dibantu Wakil Gubernur)</li>
<li>🏙️ <b>Kabupaten</b>: dipimpin Bupati | <b>Kota</b>: dipimpin Walikota</li>
<li>🏘️ <b>Kecamatan</b>: dipimpin Camat</li>
<li>🏡 <b>Desa/Kelurahan</b>: dipimpin Kepala Desa/Lurah</li>
</ul></div>
<div class="mc-ingat">🧠 <b>Ingat:</b> Indonesia terdiri dari 38 provinsi. Setiap daerah punya pemerintahan sendiri sesuai otonomi daerah.</div>"""),
  ],

  'SD_Bahasa_Indonesia': [
    ("Pantun & Syair", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian Pantun</div><p>Pantun adalah puisi rakyat asli Indonesia yang terdiri dari 4 baris per bait: 2 baris <b>sampiran</b> dan 2 baris <b>isi</b>.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Ciri-Ciri Pantun</div><ul>
<li>Setiap bait = 4 baris (tidak lebih, tidak kurang)</li>
<li>Baris 1-2 = <b>sampiran</b> (tidak berhubungan langsung dengan isi)</li>
<li>Baris 3-4 = <b>isi</b> (pesan/maksud pantun)</li>
<li>Rima: a-b-a-b (baris 1 rima dengan baris 3, baris 2 rima dengan 4)</li>
<li>Setiap baris 8-12 suku kata</li>
</ul></div>
<div class="mc-contoh"><div class="mc-contoh-title">💡 Contoh Pantun</div>
<p><i>Buah mangga buah salak (sampiran)<br>Dimakan bersama nasi (sampiran)<br>Rajin belajar setiap harinya (isi)<br>Agar sukses di kemudian hari (isi)</i></p></div>"""),

    ("Dongeng & Cerita Rakyat", """<div class="mc-poin"><div class="mc-poin-title">✅ Jenis-Jenis Cerita Fiksi</div><ul>
<li>🧚 <b>Dongeng</b>: cerita khayalan yang tidak benar-benar terjadi (Cinderella, Timun Mas)</li>
<li>🏔️ <b>Legenda</b>: cerita rakyat yang dianggap benar-benar terjadi di masa lalu (Sangkuriang, Malin Kundang)</li>
<li>🌟 <b>Mite/Mitos</b>: cerita yang berhubungan dengan dewa/makhluk gaib (Nyi Roro Kidul)</li>
<li>🐻 <b>Fabel</b>: cerita dengan tokoh hewan yang berperilaku seperti manusia (Kancil, Si Kura-Kura)</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Unsur-Unsur Cerita</div><ul>
<li><b>Tema</b>: gagasan pokok cerita</li>
<li><b>Tokoh</b>: pelaku cerita (protagonis/antagonis)</li>
<li><b>Alur</b>: jalan cerita (awal, tengah, akhir)</li>
<li><b>Latar</b>: tempat, waktu, dan suasana cerita</li>
<li><b>Amanat</b>: pesan moral cerita</li>
</ul></div>"""),

    ("Surat & Karangan", """<div class="mc-poin"><div class="mc-poin-title">✅ Jenis Surat</div><ul>
<li>📮 <b>Surat pribadi</b>: untuk keluarga/teman, bahasa tidak formal</li>
<li>🏢 <b>Surat resmi</b>: untuk instansi/organisasi, bahasa formal</li>
<li>🎓 <b>Surat undangan</b>: mengundang seseorang ke suatu acara</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Bagian Surat Resmi</div>
<ol><li>Kop surat (nama organisasi, alamat)</li>
<li>Tanggal surat</li>
<li>Nomor, lampiran, hal surat</li>
<li>Alamat tujuan</li>
<li>Salam pembuka</li>
<li>Isi surat</li>
<li>Salam penutup</li>
<li>Tanda tangan dan nama</li></ol></div>
<div class="mc-tips">💡 <b>Karangan</b> = tulisan panjang berisi pendapat, cerita, atau uraian. Jenis: narasi, deskripsi, eksposisi, argumentasi, persuasi.</div>"""),
  ],

  'SD_PKN': [
    ("Hak & Kewajiban Warga Negara", """<div class="mc-def"><div class="mc-def-title">📖 Pengertian</div><p><b>Hak</b> = sesuatu yang boleh didapatkan. <b>Kewajiban</b> = sesuatu yang harus dilakukan.</p></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Hak Siswa di Sekolah</div><ul>
<li>Mendapatkan pelajaran dari guru</li>
<li>Menggunakan fasilitas sekolah</li>
<li>Mendapatkan penilaian yang adil</li>
<li>Bermain saat istirahat</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Kewajiban Siswa di Sekolah</div><ul>
<li>Hadir tepat waktu</li>
<li>Memakai seragam lengkap</li>
<li>Menghormati guru dan teman</li>
<li>Menjaga kebersihan kelas</li>
<li>Mengerjakan tugas dan PR</li>
</ul></div>
<div class="mc-ingat">🧠 <b>Hak dan kewajiban harus seimbang!</b> Kita tidak bisa hanya menuntut hak tanpa memenuhi kewajiban.</div>"""),

    ("Simbol & Identitas Negara Indonesia", """<div class="mc-poin"><div class="mc-poin-title">✅ Simbol-Simbol Negara</div><ul>
<li>🦅 <b>Garuda Pancasila</b>: lambang negara (perisai 5 simbol sila, 17 bulu sayap, 8 bulu ekor, 45 bulu dada)</li>
<li>🚩 <b>Merah Putih</b>: bendera nasional (merah=keberanian, putih=kesucian)</li>
<li>🎵 <b>Indonesia Raya</b>: lagu kebangsaan (ciptaan W.R. Supratman, 1928)</li>
<li>🌿 <b>Bhinneka Tunggal Ika</b>: semboyan dari kitab Sutasoma Mpu Tantular</li>
</ul></div>
<div class="mc-poin"><div class="mc-poin-title">✅ Makna Angka pada Garuda</div><ul>
<li>17 helai bulu sayap = tanggal kemerdekaan (17)</li>
<li>8 helai bulu ekor = bulan kemerdekaan (Agustus/8)</li>
<li>45 helai bulu dada = tahun kemerdekaan (1945)</li>
<li>19 helai bulu pangkal ekor = tahun 19-45</li>
</ul></div>"""),
  ],
}

import re

with open(r'c:\file kuliah\Pemerograman\project KitaBelajar\public\kita-materi.html', 'r', encoding='utf-8') as f:
    content = f.read()

def make_topic(name, html):
    return f"""
      {{ j:'{name}', i:`
{html}
` }},"""

def add_topics_to_subject(content, subject_marker, new_topics):
    """Find the subject's topics array and add new topics before the closing ]"""
    # Find the marker for this subject
    marker_idx = content.find(subject_marker)
    if marker_idx == -1:
        print(f"WARNING: marker not found: {subject_marker[:50]}")
        return content

    # Find "topics:[" after the marker
    topics_idx = content.find("topics:[", marker_idx)
    if topics_idx == -1:
        print(f"WARNING: topics:[ not found after marker")
        return content

    # Find the closing "]" of the topics array
    # Look for "    ]\n  }," pattern or "    ]\n  },"
    end_idx = content.find("\n    ]\n  },", topics_idx)
    if end_idx == -1:
        end_idx = content.find("\n    ]\n  }", topics_idx)
    if end_idx == -1:
        print(f"WARNING: end of topics array not found")
        return content

    # Insert new topics before the closing ]
    insert_pos = end_idx  # right before \n    ]
    topics_html = "".join(make_topic(name, html) for name, html in new_topics)
    content = content[:insert_pos] + topics_html + content[insert_pos:]
    return content

# Define markers for each subject
mappings = [
    ("SD_Matematika",    "'Matematika': {\n    icon:'🔢', bg:'linear-gradient(145deg,#11998e,#38ef7d)'", SD_EXTRA['SD_Matematika']),
    ("SD_IPA",          "'IPA': {\n    icon:'🌿', bg:'linear-gradient(145deg,#56ab2f,#a8e063)'", SD_EXTRA['SD_IPA']),
    ("SD_IPS",          "'IPS': {\n    icon:'🗺️'", SD_EXTRA['SD_IPS']),
    ("SD_Bahasa_Indonesia", "'Bahasa Indonesia': {\n    icon:'📝', bg:'linear-gradient(145deg,#FF6B35,#FF9A5C)'", SD_EXTRA['SD_Bahasa_Indonesia']),
    ("SD_PKN",          "'PKN': {\n    icon:'⚖️'", SD_EXTRA['SD_PKN']),
]

for subj_name, marker, topics in mappings:
    original_len = len(content)
    content = add_topics_to_subject(content, marker, topics)
    added = len(content) - original_len
    print(f"{subj_name}: +{added} chars ({len(topics)} topics added)")

with open(r'c:\file kuliah\Pemerograman\project KitaBelajar\public\kita-materi.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nSD topics added successfully!")
