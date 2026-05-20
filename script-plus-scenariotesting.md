# Script Presentasi + Skenario Testing — CreditRisk AIS (Versi Santai)

> Halo! Dokumen ini ditulis pakai bahasa sehari-hari biar kamu gampang paham dulu sebelum presentasi ke dosen.
> Isinya: (1) **Kamus singkatan** biar nggak bingung istilah, (2) **Isi Financial Report dari mana**, (3) **Persiapan**, (4) **Script ngomong**, (5) **Demo langkah-demi-langkah**, (6) **Testing (cek fitur)**.
>
> **Cara nyalain aplikasinya:** buka folder `homecredit-ais` → ketik `npm install` (sekali aja) → `npm run dev` → buka `http://localhost:3000` di browser.

---

## 1. Kamus Singkatan (baca ini dulu, penting!)

Banyak istilah singkatan di aplikasi ini. Ini artinya pakai bahasa gampang:

| Singkatan | Kepanjangan | Artinya gampangnya |
|---|---|---|
| **AIS** | Accounting Information System | Sistem informasi akuntansi — software yang ngurus data + akuntansi sebuah perusahaan. Ini nama mata kuliahnya juga. |
| **ERP** | Enterprise Resource Planning | Software besar yang ngatur banyak bagian perusahaan jadi satu. Aplikasi kita ini "ERP mini" buat bagian kredit. |
| **IC** | Internal Control | Kontrol internal = aturan/pengaman biar data nggak salah dan nggak ada kecurangan. Ada 8 (IC-1 sampai IC-8). |
| **SoD** | Segregation of Duties | Pemisahan tugas. Maksudnya: yang input data ≠ yang menyetujui. Biar nggak bisa main sendiri. |
| **DTI** | Debt-to-Income ratio | Perbandingan cicilan bulanan vs pendapatan. Makin gede = makin berat utangnya. Kalau lewat 50% = bahaya. |
| **EXT Score** | External Credit Score | Nilai kelayakan kredit dari luar (dari **BI Checking / SLIK OJK** — semacam "rapor utang" nasabah di bank lain). Skala 0–1. Makin tinggi makin bagus. |
| **SLIK OJK** | Sistem Layanan Informasi Keuangan - Otoritas Jasa Keuangan | Database resmi pemerintah yang nyatat riwayat pinjaman semua orang. Bank ngecek ini sebelum kasih pinjaman. |
| **PSAK 71** | Pernyataan Standar Akuntansi Keuangan no. 71 | Aturan akuntansi Indonesia soal cara menghitung cadangan kerugian piutang. Intinya: pinjaman dibagi 3 tingkat risiko (Stage 1/2/3). |
| **ECL** | Expected Credit Loss | Perkiraan kerugian = berapa duit yang mungkin gagal ditagih. Dihitung per Stage. |
| **Stage 1/2/3** | (PSAK 71) | Tingkat risiko pinjaman. **Stage 1** = sehat (cadangan 1%), **Stage 2** = mulai berisiko (5%), **Stage 3** = macet (45%). |
| **COSO** | Committee of Sponsoring Organizations | Kerangka standar dunia buat menata kontrol internal, dibagi 5 komponen. Dosen AIS pasti suka ini. |
| **DFD** | Data Flow Diagram | Diagram alur data — gambar yang nunjukin data ngalir dari mana ke mana di sistem. |
| **Journal / Double-entry** | Jurnal / pembukuan berpasangan | Catatan akuntansi. "Double-entry" = tiap transaksi dicatat 2 sisi: **Debit** dan **Kredit**, jumlahnya HARUS sama. |
| **Ledger** | Buku Besar | Kumpulan saldo per akun, hasil rangkuman dari semua jurnal. |
| **Trial Balance** | Neraca Saldo | Daftar semua akun + saldonya, buat ngecek Total Debit = Total Kredit (kalau sama berarti pembukuan benar). |
| **Reconciliation** | Rekonsiliasi | Pengecekan kecocokan angka (mis. jumlah aplikasi cocok, debit = kredit). |
| **Kaggle** | (nama website) | Website kompetisi data. Dataset asli Home Credit (307.511 nasabah) kita ambil dari sini buat kalibrasi angka. |
| **Supabase** | (nama layanan) | Database online gratis. Dipakai biar data yang kamu input juga kelihatan di laptop dosen (realtime). |
| **Realtime** | — | Langsung update tanpa refresh. Kamu input di laptopmu, di laptop dosen langsung muncul. |
| **Vercel** | (nama layanan) | Tempat hosting biar aplikasi bisa dibuka lewat link internet. |

**Singkatnya alur sistem ini:** Nasabah dinilai otomatis → kalau ragu dicek manusia → semua tercatat → jadi laporan keuangan. Sambil jalan, ada 8 pengaman (IC) biar nggak ada yang nyeleweng.

---

## 2. Isi Financial Report (Laporan Keuangan) Itu Dari Mana?

Ini sering ditanya dosen: "angkanya dari mana?" Nih jawabannya per bagian. Semua **otomatis dihitung dari data nasabah** (yang ada di Portfolio), bukan ngarang.

### Bahan dasarnya:
1. **Data aplikasi nasabah** (`applications`) — daftar nasabah + pinjaman + keputusannya. Sumbernya dari yang kamu input + 10 nasabah contoh bawaan. Kalau Supabase nyala, ini diambil dari cloud.
2. **`kaggleStats.json`** — angka statistik hasil olahan dari dataset asli Kaggle (307.511 nasabah). Dipakai buat nentuin tarif ECL per Stage (1% / 5% / 45%) dan proporsi tiap Stage. File ini dibuat sekali oleh script `scripts/compute-stats.mjs` yang baca `application_train.csv`.

> Catatan: nasabah yang di-**VOID** (dibatalkan) TIDAK ikut dihitung di laporan.

### Isi laporannya, bagian per bagian:

| Bagian | Isinya apa | Rumus / sumber |
|---|---|---|
| **I. Loan Origination Summary** | Jumlah aplikasi masuk, disetujui, manual review, ditolak + total nominalnya | Dihitung dari `applications` (jumlah & total pinjaman per status) |
| **II. Projected Revenue** | Perkiraan pendapatan bunga | **Bunga = Total pinjaman disetujui × 2% × 24 bulan** |
| **III. PSAK 71 Staged ECL** | Cadangan kerugian per tingkat risiko | Tiap pinjaman dapat Stage (1/2/3). **ECL = Σ (total pinjaman per Stage × tarif Stage)**. Tarif dari `kaggleStats.json` (1%/5%/45%) |
| **IV. Net Expected Revenue** | Untung bersih perkiraan | **Bunga − ECL − Biaya Operasional**. Biaya Operasional = 5% × pinjaman disetujui |
| **V. Journal Entries** | Jurnal akuntansi otomatis (double-entry) | Dibuat dari: (a) pencairan tiap pinjaman, (b) cadangan ECL, (c) akrual bunga. Tiap entry pasti balance (Debit = Kredit) |
| **VI. General Ledger (Buku Besar)** | Saldo per akun | Hasil rangkuman semua jurnal di Section V, dikelompokkan per akun |
| **VII. Trial Balance (Neraca Saldo)** | Daftar saldo + cek seimbang | Hasil rangkuman Buku Besar. Total Debit harus = Total Kredit |
| **IC-7 Reconciliation** | Panel cek kecocokan | Cek: jumlah aplikasi cocok + Debit = Kredit |

**Alur akuntansinya (penting buat dosen):** Transaksi → **Jurnal** → **Buku Besar** → **Neraca Saldo** → **Laporan Keuangan**. Aplikasi kita nunjukin SEMUA tahap ini. 👍

**Contoh angka (pakai 10 nasabah bawaan, sebelum kamu nambah data):**
- Total pinjaman disetujui = Rp 360 juta
- Bunga = 360jt × 2% × 24 = **Rp 172,8 juta**
- ECL (PSAK 71) ≈ **Rp 13,7 juta** (Stage 1: 320jt×1% + Stage 2: 210jt×5%)
- Biaya operasional = 360jt × 5% = **Rp 18 juta**
- **Untung bersih = 172,8 − 13,7 − 18 = Rp 141,1 juta**

> Angka ini berubah kalau kamu nambah/void nasabah pas demo. Mending dibacain dari layar aja.

---

## 3. Persiapan Sebelum Demo (checklist)

| # | Yang dicek | Catatan |
|---|---|---|
| 1 | `npm run dev` udah jalan, web kebuka | di `http://localhost:3000` |
| 2 | **Refresh browser** sekali | mulai dari kondisi bersih |
| 3 | Pojok kanan navbar tulisannya apa? | **CLOUD SYNC** (hijau) = data nyambung Supabase. **LOCAL ONLY** (kuning) = belum (data nggak kesimpen) |
| 4 | Role awal = **Loan Officer (Andre)** | bisa diganti via dropdown kanan atas (butuh PIN) |
| 5 | Tema = **Dark** | bisa ditoggle (matahari/bulan) |
| 6 | Layar full (F11), zoom 100% | biar rapi |
| 7 | Hafalin **PIN role**: Loan Officer `1111`, Credit Analyst `2222`, Finance `3333`, Auditor `4444` | dipakai pas ganti role |

---

## 4. Script Ngomong Pas Presentasi (santai tapi sopan)

### Pembukaan
> "Selamat pagi/siang Bapak/Ibu. Kami presentasi **CreditRisk AIS** — sistem informasi akuntansi berbasis web buat ngurus risiko kredit, studi kasusnya Home Credit Indonesia.
> Sistem ini nunjukin alur akuntansi lengkap: dari input data nasabah, dinilai otomatis, sampai jadi laporan keuangan plus jurnal. Di dalamnya ada 8 kontrol internal, pemisahan tugas antar role, standar PSAK 71, dan pembukuan double-entry. Angkanya kami kalibrasi dari data asli Kaggle Home Credit, 307 ribu nasabah."

### Pas jelasin konsep (sambil di Dashboard)
> "Sistem ini ngikutin siklus AIS: **Input → Proses → Output**. Loan Officer input data, sistem ngitung skor otomatis, lalu keluar keputusan, dan akhirnya jadi laporan keuangan. Di tiap tahap ada pengaman (Internal Control). Bisa diklik badge IC-nya buat lihat penjelasan, dan ada tombol COSO + diagram alur sistem juga."

### Pas jelasin cara nilai nasabah
> "Skor dihitung otomatis dari 3 faktor: **skor kredit eksternal (50%)**, **rasio cicilan-ke-pendapatan/DTI (30%)**, dan **lama kerja (20%)**. Hasilnya: skor ≥ 60 langsung disetujui, 40–59 masuk review manual, di bawah 40 ditolak. Ada pengaman khusus: kalau DTI lewat 50%, otomatis review manual berapapun skornya."

### Penutup
> "Jadi semua nyambung: dari input nasabah, kontrol berlapis, sampai laporan keuangan yang seimbang (Debit=Kredit) dan sesuai PSAK 71. Semua keputusan tercatat permanen di audit trail, dan datanya tersinkron realtime ke perangkat lain. Terima kasih."

---

## 5. Skenario Demo Langkah-demi-Langkah

> Tiap langkah ada: **[Lakuin]** (yang kamu klik) dan **[Bilang]** (yang kamu omongin) dan **[Muncul]** (yang harusnya kelihatan).

### DEMO 0 — Dashboard
- **[Lakuin]** Buka web → loading 2 detik → halaman Dashboard.
- **[Bilang]** "Ini halaman utama. Ada statistik, daftar 8 kontrol internal, dan info sistem. Pindah halaman lewat menu navbar atas atau titik di kanan — bukan scroll ya, scroll buat baca konten."
- **[Muncul]** Statistik (dihitung dari data nyata), 8 badge IC, tombol COSO.
- **[Lakuin]** Klik salah satu **badge IC** (mis. IC-4) → muncul penjelasan. Lalu klik **"COSO Framework & Alur Sistem (DFD)"** → muncul pemetaan COSO + diagram alur.
- **[Bilang]** "Tiap kontrol bisa diklik buat lihat detailnya, dan ini pemetaan ke kerangka COSO plus diagram alur datanya."

### DEMO 1 — Input nasabah DISETUJUI 🟢
- **[Lakuin]** Menu **New Application**, isi: Nama **Budi Santoso**, Pendapatan **8.000.000**, Pinjaman **50.000.000**, Lama Kerja **5**, External Score **0.72** → klik **Hitung Risk Score**.
- **[Bilang]** "Perhatikan panel kanan, skor update tiap saya ngetik (itu Automated Scoring). Sekarang submit."
- **[Muncul]** Loading 4 langkah → halaman Assessment, skor **72,9 → APPROVED** (hijau).
- **[Lakuin]** Klik **+ Tambah ke Portfolio**. (Kalau cloud nyala, muncul notif "ditambahkan".)

### DEMO 2 — Input nasabah DITOLAK 🔴
- **[Lakuin]** New Application: **Lia Marlina**, **2.800.000**, **55.000.000**, **0.5**, **0.29** → Hitung.
- **[Bilang]** "Skor 35,7, di bawah 40, jadi otomatis DITOLAK. Nggak ada campur tangan manusia — murni dari ambang batas."
- **[Muncul]** Skor **35,7 → REJECTED** (merah).

### DEMO 3 — Input nasabah REVIEW MANUAL 🟡
- **[Lakuin]** New Application: **Siti Rahayu**, **4.500.000**, **80.000.000**, **2**, **0.38** → Hitung → **+ Tambah ke Portfolio**.
- **[Bilang]** "Skor 44,1 masuk zona abu-abu (40–59). Sistem nggak berani putuskan sendiri, jadi dilempar ke Credit Analyst. Ini Dual Control."
- **[Muncul]** Skor **44,1 → MANUAL REVIEW** (kuning).

### DEMO 4 — Pengaman DTI (IC-6) ⛔
- **[Lakuin]** New Application: **Joko Demo**, Pendapatan **3.000.000**, Pinjaman **100.000.000**, Lama Kerja **5**, External **0.70** → Hitung.
- **[Bilang]** "Walaupun skor kreditnya lumayan, cicilannya kegedean dibanding gaji — DTI sekitar 55%, lewat batas 50%. Jadi DIPAKSA review manual. Ini pengaman buat nasabah yang utangnya kebanyakan."
- **[Muncul]** Badge MANUAL REVIEW + tulisan "DTI 55.6% melampaui batas 50%".

### DEMO 5 — Portfolio: cari, audit trail 🔎
- **[Lakuin]** Menu **Portfolio**. Ketik **"Siti"** di kotak cari → tabel nyaring otomatis. Klik baris **Siti Rahayu**.
- **[Bilang]** "Tiap nasabah punya jejak lengkap: siapa input, kapan, aksinya apa — ini Audit Trail, nggak bisa diutak-atik. Tapi tombol Approve/Reject nggak ada, karena saya cuma Loan Officer."
- **[Muncul]** Modal dengan timeline audit + pesan "switch ke Credit Analyst".

### DEMO 6 — Ganti role (pakai PIN) → setujui 🔐
- **[Lakuin]** Dropdown role kanan atas → pilih **Sari Wulandari (Credit Analyst)** → muncul **minta PIN** → ketik **2222** → Konfirmasi.
- **[Bilang]** "Ganti role butuh PIN — ini bukti pemisahan tugas yang beneran, nggak sembarang orang bisa jadi siapa aja."
- **[Lakuin]** Buka lagi baris Siti Rahayu → sekarang ada tombol **Approve/Reject**. Isi alasan (min. 8 huruf) → **Approve**.
- **[Muncul]** Status berubah jadi APPROVED, audit trail nambah entry baru otomatis.

### DEMO 7 — Void (batalkan) record 🗑
- **[Lakuin]** Masih sebagai Credit Analyst, buka satu nasabah → tombol **Void Record** → isi alasan → **Konfirmasi Void**.
- **[Bilang]** "Kalau ada data salah, kita nggak HAPUS — tapi di-VOID. Recordnya tetap disimpan buat audit (prinsip akuntansi: void, jangan hapus). Datanya jadi abu-abu dan nggak ikut dihitung di laporan."
- **[Muncul]** Baris jadi abu-abu + badge VOIDED.

### DEMO 8 — Finance: Laporan Keuangan lengkap 📊
- **[Lakuin]** Ganti role ke **Indra (Finance)** (PIN **3333**) → menu **Financial Report**.
- **[Bilang]** Telusuri: "Bagian I jumlah aplikasi, II pendapatan bunga, **III PSAK 71** (cadangan per tingkat risiko, tarifnya dari data Kaggle), IV untung bersih."
- **[Lakuin]** Klik **+ Show Journal & Ledger**.
- **[Bilang]** "Ini siklus akuntansi penuh: **Jurnal** (V) → **Buku Besar** (VI) → **Neraca Saldo** (VII). Lihat Total Debit = Total Kredit, berarti pembukuan seimbang."
- **[Lakuin]** Klik **🖨 Print / Save PDF** buat tunjukin laporan rapi. Balik ke Portfolio, klik **⬇ CSV** buat tunjukin export data.

### DEMO 9 — Kunci akses Loan Officer (IC-8) 🔒
- **[Lakuin]** Ganti role balik ke **Loan Officer** (PIN **1111**) → coba buka **Financial Report**.
- **[Bilang]** "Sebagai Loan Officer, laporan keuangan KEKUNCI. Yang input data nggak boleh lihat laporan — pemisahan tugas lagi."
- **[Muncul]** Layar kunci "IC-8 Management Dashboard".

### DEMO 10 — Realtime + tema (efek wow) ✨
- **[Bilang]** "Karena pakai cloud, kalau Bapak/Ibu buka link yang sama di HP, data ini muncul juga — dan kalau saya tambah nasabah, langsung kelihatan di layar Bapak/Ibu (lihat indikator '👁 online' di pojok). "
- **[Lakuin]** Toggle tema (matahari/bulan) → tunjukin mode terang juga rapi.

> **Habis demo:** kalau mau ngulang dari awal, di Dashboard ada tombol **Reset Data** (balik ke 10 nasabah awal).

---

## 6. Skenario Testing (Cek Fitur Jalan apa Nggak)

Centang ✅ kalau hasilnya sesuai. Ini buat mastiin semua fitur OK sebelum demo + bukti pengujian di laporan.

### A. Mesin Penilaian (scoring)
| # | Input (gaji / pinjaman / kerja / ext) | Harusnya | ✓ |
|---|---|---|---|
| A1 | 8jt / 50jt / 5 / 0.72 | Skor 72,9 → APPROVED | ☐ |
| A2 | 2.8jt / 55jt / 0.5 / 0.29 | Skor 35,7 → REJECTED | ☐ |
| A3 | 4.5jt / 80jt / 2 / 0.38 | Skor 44,1 → MANUAL REVIEW | ☐ |
| A4 | 3jt / 100jt / 5 / 0.70 | DTI > 50% → MANUAL REVIEW (dipaksa) | ☐ |
| A5 | (otomatis) `npm test` | **10 test lulus semua** | ☐ |

### B. Pemisahan Tugas (role + PIN)
| # | Langkah | Harusnya | ✓ |
|---|---|---|---|
| B1 | Ganti role, masukin PIN salah | Ditolak, ada pesan "PIN salah" | ☐ |
| B2 | Ganti role, PIN benar | Berhasil pindah role | ☐ |
| B3 | Sebagai Credit Analyst buka form New Application | Form ke-disable (cuma Loan Officer yang boleh) | ☐ |
| B4 | Sebagai Loan Officer buka Financial Report | Layar kunci IC-8 | ☐ |
| B5 | Sebagai Loan Officer buka modal manual review | Nggak ada tombol Approve/Reject | ☐ |
| B6 | Sebagai Credit Analyst buka modal manual review | Tombol Approve/Reject + Void muncul | ☐ |

### C. Audit Trail & Void
| # | Langkah | Harusnya | ✓ |
|---|---|---|---|
| C1 | Approve dengan alasan < 8 huruf | Ditolak | ☐ |
| C2 | Approve dengan alasan valid | Status berubah + audit trail nambah entry | ☐ |
| C3 | Void record dengan alasan | Baris jadi abu-abu + badge VOIDED, audit trail nyatat | ☐ |
| C4 | Cek laporan setelah void | Nasabah yang di-void TIDAK ikut dihitung | ☐ |

### D. Laporan Keuangan & Akuntansi
| # | Cek | Harusnya | ✓ |
|---|---|---|---|
| D1 | Bagian III PSAK 71 | Stage 1 = 1%, Stage 2 = 5%, Stage 3 = 45% | ☐ |
| D2 | Klik Show Journal & Ledger | Muncul Jurnal (V), Buku Besar (VI), Neraca Saldo (VII) | ☐ |
| D3 | Cek jurnal & neraca saldo | Total Debit = Total Kredit (badge hijau) | ☐ |
| D4 | Panel Reconciliation | Semua centang OK | ☐ |

### E. Cloud, Search, Export, Tampilan
| # | Langkah | Harusnya | ✓ |
|---|---|---|---|
| E1 | Cek pojok navbar | "CLOUD SYNC" hijau (kalau Supabase nyala) | ☐ |
| E2 | Tambah nasabah, lalu refresh | Data TIDAK hilang (kalau cloud nyala) | ☐ |
| E3 | Buka di tab incognito / HP | Data sama muncul + indikator "online" nambah | ☐ |
| E4 | Ketik nama/ID di kotak cari Portfolio | Tabel nyaring otomatis | ☐ |
| E5 | Klik ⬇ CSV di Portfolio | File CSV ke-download | ☐ |
| E6 | Print / Save PDF di Financial Report | Laporan tercetak penuh (multi halaman), rapi | ☐ |
| E7 | Scroll mouse di halaman panjang | Scroll konten, BUKAN pindah halaman | ☐ |
| E8 | Toggle tema gelap↔terang | Semua tetap kebaca | ☐ |
| E9 | Tombol Reset Data di Dashboard | Balik ke 10 nasabah awal | ☐ |

---

## Lampiran A — User & PIN

| User | Role | PIN | Buat apa |
|---|---|---|---|
| Andre Saputra (OFC-001) | Loan Officer | **1111** | Input nasabah |
| Maya Pratiwi (OFC-002) | Loan Officer | **1111** | (sama) |
| Sari Wulandari (CA-001) | Credit Analyst | **2222** | Approve/Reject/Void |
| Rahmat Hidayat (CA-002) | Credit Analyst | **2222** | (sama) |
| Indra Wijaya (FIN-001) | Finance | **3333** | Buka Financial Report |
| Tini Marlina (AUD-001) | Auditor | **4444** | Lihat semua (read-only) |

## Lampiran B — Kalau Dosen Nanya (siap-siap jawab)

| Pertanyaan | Jawaban singkat |
|---|---|
| "Datanya beneran?" | Iya, kalibrasi dari Kaggle Home Credit 307.511 nasabah, diolah jadi statistik (`kaggleStats.json`). |
| "Angka laporan dari mana?" | Dihitung otomatis dari data nasabah + tarif PSAK 71 dari data Kaggle. Lihat bagian 2 dokumen ini. |
| "Kenapa PSAK 71?" | Karena itu standar akuntansi Indonesia buat cadangan kerugian, lebih akurat (bertingkat) daripada tarif rata. |
| "Audit trail bisa dimanipulasi?" | Nggak dari aplikasi — cuma bisa nambah catatan, nggak bisa edit/hapus. Kalau salah, di-VOID (tetap kesimpen). |
| "Pemisahan tugasnya gimana?" | Ganti role butuh PIN, form input cuma buat Loan Officer, laporan cuma buat Finance/Auditor (IC-8). |
| "Pembukuannya seimbang?" | Iya — tiap jurnal Debit = Kredit, dan Neraca Saldo dicek totalnya sama. |
| "Ada backend/database?" | Ada — Supabase (cloud) buat data bersama + realtime. Kalau dimatiin, jalan lokal (in-memory). |
| "Sudah dites?" | Sudah — ada 10 unit test buat rumus scoring & PSAK staging, jalanin `npm test`. |

---

*Dokumen ini nemenin `README.md` & `CLAUDE.md`. Kalau rumus/threshold di `src/lib/data.ts` diubah, update juga bagian 1, 2, dan 6 di sini.*
