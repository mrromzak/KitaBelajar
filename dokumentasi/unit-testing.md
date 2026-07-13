# Dokumentasi Unit Testing — KitaBelajar

Dokumen ini menjelaskan **cara menjalankan**, **isi**, dan **cara menambah** unit test pada backend KitaBelajar.

---

## A. Apa itu Unit Test di Proyek Ini?

Unit test adalah pengujian otomatis yang memeriksa apakah sebuah bagian kode (misalnya satu *endpoint* API) berperilaku **sesuai harapan**, tanpa harus menjalankan seluruh aplikasi atau menyentuh database asli.

Tujuannya: setiap kali kode diubah, kita bisa memastikan fitur lama **tidak rusak** hanya dengan satu perintah.

Proyek ini memakai:
- **`node:test`** — kerangka pengujian **bawaan Node.js** (tidak perlu install library tambahan seperti Jest/Mocha).
- **`fetch`** — bawaan Node.js untuk mengirim request HTTP ke server uji.
- **Mock Supabase** — tiruan database yang berjalan **di dalam memori**, sehingga test **tidak menghapus/mengubah data Supabase asli**.

> **Syarat:** Node.js versi **18 ke atas** (proyek diuji dengan Node v22). Modul `node:test` dan `fetch` sudah tersedia otomatis.

---

## B. Cara Menjalankan Test

Buka terminal di folder proyek, lalu jalankan:

```bash
npm test
```

Perintah ini menjalankan `node --test`, yang otomatis mencari dan menjalankan semua file di dalam folder `test/`.

### Contoh hasil yang benar (lulus semua)

```
✔ menolak tanpa token (401)
✔ menolak konfirmasi yang salah (400) dan akun tetap ada
✔ menolak konfirmasi kosong (400)
✔ menghapus akun guru dengan konfirmasi benar (200)
✔ konfirmasi tidak case-sensitive dan mengabaikan spasi
✔ hapus murid ikut menghapus orangtua yang hanya terhubung ke dia
✔ orangtua TIDAK dihapus jika masih punya anak lain
✔ mengembalikan 404 jika user pada token tidak ada di database

# tests 9
# pass 9
# fail 0
```

Jika ada test yang **gagal**, baris akan diawali tanda `✖` dan menampilkan nilai yang diharapkan vs nilai aktual — gunakan itu untuk menemukan bug.

### Menjalankan satu file test saja

```bash
node --test test/auth.account.test.js
```

---

## C. Struktur File Test

```
test/
├── helpers/
│   └── mockSupabase.js      ← tiruan database Supabase (in-memory)
└── auth.account.test.js     ← test untuk endpoint hapus akun
```

| File | Fungsi |
|------|--------|
| `test/helpers/mockSupabase.js` | Membuat objek tiruan Supabase yang menyimpan data di array memori. Mendukung `from().select().eq().single()`, `insert`, `update`, `upsert`, `delete`, serta `select(cols, { count, head })`. Bisa dipakai ulang untuk menguji endpoint lain. |
| `test/auth.account.test.js` | Berisi 9 skenario uji untuk endpoint `DELETE /api/auth/account` (fitur hapus akun). |

---

## D. Apa Saja yang Diuji? (`auth.account.test.js`)

Endpoint **`DELETE /api/auth/account`** (hapus akun permanen). Skenario yang diperiksa:

| # | Skenario | Harapan |
|---|----------|---------|
| 1 | Request tanpa token login | Ditolak `401`, akun tidak terhapus |
| 2 | Konfirmasi salah (mis. ketik `"hapus"`) | Ditolak `400`, akun tetap ada |
| 3 | Konfirmasi kosong | Ditolak `400` |
| 4 | Guru mengetik `"HAPUS AKUN"` | Berhasil `200`, akun terhapus |
| 5 | Konfirmasi `"  hapus akun  "` (huruf kecil + spasi) | Tetap diterima (tidak *case-sensitive*, spasi diabaikan) |
| 6 | Murid menghapus akun | Akun murid **dan** akun orangtua otomatisnya ikut terhapus |
| 7 | Murid hapus akun, tapi orangtuanya punya anak lain | Orangtua **tidak** ikut terhapus |
| 8 | Token menunjuk user yang sudah tidak ada | Mengembalikan `404` |

---

## E. Cara Kerja Test (Penjelasan Teknis)

Agar test berjalan cepat dan aman, dipakai beberapa teknik:

1. **Set variabel lingkungan dulu.** `JWT_SECRET` diisi nilai uji **sebelum** modul backend di-*import*, karena `middleware/auth.js` membacanya saat dimuat.

2. **Menyuntik mock Supabase.** Sebelum router `auth.js` dimuat, modul `src/supabase.js` diganti di `require.cache` dengan tiruan in-memory. Jadi saat router memanggil `supabase.from('users')...`, yang dipakai adalah database memori — **bukan Supabase asli**.

3. **Menjalankan server kecil.** Router dipasang ke aplikasi Express sementara dengan `app.listen(0)` (port acak), lalu request dikirim memakai `fetch`. Ini menguji *endpoint* layaknya request HTTP sungguhan.

4. **Data direset tiap test.** Fungsi `resetDb({ ... })` mengisi ulang data tiruan sebelum setiap skenario, supaya test tidak saling memengaruhi.

---

## F. Cara Menambah Test Baru

Misal ingin menguji endpoint lain. Pola dasarnya:

```js
// 1. Siapkan data tiruan untuk skenario ini
resetDb({
  users: [{ id: 'guru-1', nama: 'Sari', email: 'sari@test.id', role: 'guru' }],
});

// 2. Buat token login untuk user tersebut
const token = tokenFor({ id: 'guru-1', role: 'guru', nama: 'Sari', email: 'sari@test.id' });

// 3. Kirim request & periksa hasilnya
const res = await fetch(`${baseUrl}/api/...`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ /* ... */ }),
});

assert.strictEqual(res.status, 200);
```

Tips:
- Beri nama file dengan akhiran `.test.js` dan letakkan di folder `test/` agar otomatis dijalankan `npm test`.
- Gunakan `assert` bawaan: `assert.strictEqual(a, b)`, `assert.ok(x)`, `assert.match(teks, /pola/)`.
- Untuk endpoint yang mengirim email (Brevo) atau memverifikasi token Google, *stub* `global.fetch` agar tidak benar-benar memanggil layanan luar.

---

## G. Catatan Penting

- Test **tidak menyentuh database Supabase asli** — aman dijalankan kapan saja.
- Test **tidak perlu** file `.env` atau koneksi internet untuk skenario hapus akun.
- File test berada di folder `test/` dan **tidak ikut dijalankan** saat aplikasi produksi (`npm start`), sehingga tidak memengaruhi *deploy* di Railway.
