# Script Presentasi + Skenario Testing — CreditRisk AIS

> Dokumen panduan untuk **presentasi live** dan **demo** ke dosen mata kuliah Accounting Information System (AIS).
> Sistem: **CreditRisk AIS** — Home Credit Indonesia. Stack: React 19 + TypeScript + Vite + GSAP + Tailwind.
>
> Isi dokumen: (1) Script narasi presentasi, (2) Skenario demo langkah-demi-langkah, (3) Skenario testing (test cases).
>
> **Cara jalankan sebelum mulai:** `cd homecredit-ais` → `npm install` → `npm run dev` → buka `http://localhost:3000`.

---

## 0. Persiapan Sebelum Presentasi (checklist)

| # | Item | Catatan |
|---|------|---------|
| 1 | `npm run dev` sudah jalan, app terbuka di `http://localhost:3000` | Pastikan dev server hidup |
| 2 | **Refresh browser** sekali sebelum mulai | Audit trail & data in-memory → mulai dari state bersih (10 data awal) |
| 3 | Role default = **Loan Officer (OFC-001 — Andre Saputra)** | Cek dropdown pojok kanan navbar |
| 4 | Tema = **Dark** (default) | Toggle sun/moon di pojok kanan navbar |
| 5 | Zoom browser ~100%, full-screen (F11) | Biar glassmorphism & animasi terlihat jelas |
| 6 | Siapkan 2 input demo di catatan kecil | C001 (approved), C006 (rejected), C002 (manual review), + 1 kasus IC-6 |

**Konsep inti yang harus tersampaikan:** siklus AIS **Input → Process → Output**, plus **8 Internal Controls**, **Segregation of Duties (SoD)**, **PSAK 71 ECL Staging**, dan **double-entry journal entries** — semua terlihat konkret di UI, bukan sekadar narasi.

---

## BAGIAN 1 — SCRIPT NARASI PRESENTASI

### 1.1 Pembukaan (±1 menit)

> "Selamat pagi/siang Bapak/Ibu. Kami mempresentasikan **CreditRisk AIS**, sebuah *Accounting Information System* berbasis web untuk **manajemen risiko kredit konsumtif**, dengan studi kasus **Home Credit Indonesia**.
>
> Sistem ini kami bangun untuk mendemonstrasikan siklus AIS klasik — **Input, Process, Output** — yang berakhir pada sebuah **Financial Report** lengkap dengan **jurnal akuntansi double-entry**. Di dalamnya kami tanamkan **8 Internal Control**, **Segregation of Duties** lewat 4 role pengguna, **staging Expected Credit Loss sesuai PSAK 71**, dan **audit trail** yang immutable.
>
> Yang membuat sistem ini realistis: parameter risikonya kami kalibrasi dari **dataset nyata Kaggle Home Credit Default Risk** — 307.511 baris data nasabah — yang kami olah jadi statistik agregat."

**Talking point teknis (kalau ditanya):** dataset 307K baris (~158 MB) tidak di-*fetch* runtime karena terlalu besar untuk browser. Kami *pre-compute* sekali pakai Node streaming script (`scripts/compute-stats.mjs`) menjadi `kaggleStats.json` (~3 KB) yang di-import statis.

### 1.2 Penjelasan Konsep — Siklus AIS (±1 menit)

> "Sistem ini memetakan langsung ke kerangka AIS:
> - **INPUT** → Loan Officer memasukkan data aplikasi nasabah (pendapatan, pinjaman, lama kerja, skor kredit eksternal).
> - **PROCESS** → mesin scoring otomatis menghitung *risk score* dan *Debt-to-Income ratio*, lalu mengambil keputusan kredit berdasarkan threshold.
> - **OUTPUT** → portfolio dashboard, lalu Financial Report dengan PSAK 71 ECL dan jurnal akuntansi.
> - **CONTROL** → di setiap tahap ada Internal Control: validasi input, scoring otomatis, otorisasi berbasis threshold, dual control, audit trail, batas DTI, rekonsiliasi, dan management dashboard."

### 1.3 Penjelasan Formula Scoring (±1 menit)

> "Keputusan kredit tidak diambil manual — semuanya otomatis lewat formula tertimbang:
>
> **Risk Score = (External Score × 50%) + (DTI Inverted × 30%) + (Employment Stability × 20%) × 100**
>
> - **External Score (50%)** — skor kredit dari BI Checking / SLIK OJK, bobot terbesar.
> - **DTI Inverted (30%)** — Debt-to-Income ratio dibalik; makin rendah cicilan terhadap pendapatan, makin sehat.
> - **Employment (20%)** — stabilitas masa kerja, di-*cap* di 10 tahun.
>
> Keputusan dari skor:
> - **≥ 60 → APPROVED** (otomatis disetujui)
> - **40–59 → MANUAL REVIEW** (zona abu-abu, wajib dicek Credit Analyst)
> - **< 40 → REJECTED**
>
> Ada satu *hard limit* terpisah: kalau **DTI > 50%**, berapapun skornya, langsung dipaksa **MANUAL REVIEW** — ini Internal Control nomor 6."

### 1.4 Penjelasan 8 Internal Controls (tampilkan saat di Dashboard)

| ID | Nama | Letak di UI |
|----|------|-------------|
| IC-1 | Input Validation | Form — field wajib + animasi *shake* kalau kosong |
| IC-2 | Automated Scoring | Form + Result — skor dihitung mesin, tidak ada input manual |
| IC-3 | Threshold Authorization | Result — approve/reject otomatis dari threshold |
| IC-4 | Dual Control + SoD | Result + Portfolio — MANUAL_REVIEW butuh Credit Analyst |
| IC-5 | Audit Trail | Portfolio — kolom Created By/Last Action + timeline di modal |
| IC-6 | DTI Hard Limit | Form + Result — DTI > 50% paksa manual review |
| IC-7 | Reconciliation | Financial Report — sum check + Debit = Credit |
| IC-8 | Management Dashboard | Financial Report — terkunci untuk Loan Officer |

### 1.5 Penjelasan Segregation of Duties (4 role)

> "Sistem punya 4 role dengan kewenangan berbeda yang saling mengunci — inilah Segregation of Duties:
> - **Loan Officer** (Andre/Maya) — hanya input aplikasi, **tidak boleh** lihat Financial Report.
> - **Credit Analyst** (Sari/Rahmat) — satu-satunya yang boleh approve/reject kasus manual review.
> - **Finance** (Indra) — akses Financial Report.
> - **Auditor** (Tini) — read-only ke semua halaman untuk inspeksi.
>
> Yang menginput tidak bisa menyetujui; yang menyetujui tidak bisa menginput. Kami akan tunjukkan ini live dengan mengganti role di navbar."

### 1.6 Penutup (±30 detik)

> "Jadi seluruh siklus tertutup: dari input nasabah, proses scoring otomatis dengan kontrol berlapis, sampai Financial Report yang seimbang secara akuntansi (Debit = Credit) dan sesuai standar PSAK 71. Setiap keputusan terekam permanen di audit trail. Terima kasih, kami siap untuk demo dan pertanyaan."

---

## BAGIAN 2 — SKENARIO DEMO (LANGKAH-DEMI-LANGKAH)

> Urutan demo dirancang agar setiap Internal Control & konsep tampil secara natural. Setiap langkah berisi: **[Aksi]** yang dilakukan, **[Narasi]** yang diucapkan, dan **[Yang muncul di layar]** sebagai ekspektasi.

### DEMO 0 — Landing / Dashboard

- **[Aksi]** Buka app → loading screen jalan ±2 detik → masuk halaman **Dashboard (Cover)**.
- **[Narasi]** "Ini halaman utama. Di sini ada ringkasan statistik dari dataset Kaggle dan daftar Internal Control yang sistem ini terapkan. Navigasi antar halaman bisa pakai scroll, panah keyboard, atau tab di navbar."
- **[Yang muncul di layar]** Hero stats, info sistem, daftar IC. Navbar 5 tab: Dashboard, New Application, Assessment, Portfolio, Financial Report. Role aktif "Andre Saputra — Loan Officer" di pojok kanan.

### DEMO 1 — Input nasabah APPROVED (Input → Process → Output) 🟢

- **[Aksi]** Klik tab **New Application**. Isi form:
  - Nama: **Budi Santoso**
  - Pendapatan per Bulan: **8.000.000**
  - Jumlah Pinjaman: **50.000.000**
  - Lama Bekerja: **5**
  - External Score: **0.72**
- **[Narasi]** "Sebagai Loan Officer, saya input data nasabah. Perhatikan panel di kanan — ada **live preview**: setiap kali saya mengetik, sistem langsung menghitung ulang skor. Ini IC-2, Automated Scoring."
- **[Aksi]** Klik tombol **Hitung Risk Score**.
- **[Yang muncul di layar]** Loading 4 langkah ±2 detik:
  1. *Memvalidasi data aplikasi...*
  2. *Menghitung rasio DTI...*
  3. *Querying external credit score (SLIK OJK)...*
  4. *Menghasilkan risk assessment...*
- **[Aksi]** Otomatis pindah ke halaman **Assessment Result**.
- **[Narasi]** "Skor **72.9** — di atas threshold 60, jadi otomatis **APPROVED**. Di breakdown terlihat kontribusi tiap faktor: External 50%, DTI 30%, Employment 20%. DTI-nya cuma ~10%, sangat sehat. Ini IC-3, Threshold Authorization."
- **[Yang muncul di layar]** Score ring beranimasi ke **72.9**, badge **✓ APPROVED** (hijau), breakdown 3 faktor, calculation trace.
- **[Aksi]** Klik **+ Tambah ke Portfolio**.

### DEMO 2 — Input nasabah REJECTED (IC-3) 🔴

- **[Aksi]** Kembali ke **New Application**, isi:
  - Nama: **Lia Marlina**
  - Pendapatan: **2.800.000**
  - Pinjaman: **55.000.000**
  - Lama Bekerja: **0.5**
  - External Score: **0.29**
- **[Aksi]** Klik **Hitung Risk Score**.
- **[Narasi]** "Nasabah ini external score-nya rendah (0.29) dan baru kerja 6 bulan. Skornya **35.7** — di bawah 40, jadi sistem otomatis **REJECTED**. Tidak ada intervensi manusia; threshold yang menentukan. Inilah kekuatan kontrol otomatis."
- **[Yang muncul di layar]** Score ring **35.7**, badge **✗ REJECTED** (merah), teks "Skor terlalu rendah untuk disetujui."

### DEMO 3 — Input nasabah MANUAL REVIEW via zona abu-abu (IC-4) 🟡

- **[Aksi]** Kembali ke **New Application**, isi:
  - Nama: **Siti Rahayu**
  - Pendapatan: **4.500.000**
  - Pinjaman: **80.000.000**
  - Lama Bekerja: **2**
  - External Score: **0.38**
- **[Aksi]** Klik **Hitung Risk Score**.
- **[Narasi]** "Skornya **44.1** — masuk **zona abu-abu 40–59**. Sistem tidak berani memutuskan sendiri, jadi diteruskan ke **MANUAL REVIEW**. Ini IC-4, Dual Control: keputusan butuh mata kedua dari Credit Analyst."
- **[Yang muncul di layar]** Score ring **44.1**, badge **⚠ MANUAL REVIEW** (amber), badge **IC-4: Dual Control**, teks "Skor berada di zona abu-abu. Perlu review Credit Analyst."
- **[Aksi]** Klik **+ Tambah ke Portfolio**.

### DEMO 4 — IC-6 DTI Hard Limit (kasus khusus) ⛔

> **PENTING:** Ini menggantikan klaim lama di README bahwa C002 memicu IC-6. Faktanya C002 punya DTI ~29.6% (lewat zona abu-abu, bukan hard limit). Untuk mendemonstrasikan IC-6 secara murni, pakai input rasio pinjaman-terhadap-pendapatan yang sangat tinggi.

- **[Aksi]** **New Application**, isi:
  - Nama: **Joko Demo IC-6**
  - Pendapatan: **3.000.000**
  - Pinjaman: **100.000.000**
  - Lama Bekerja: **5**
  - External Score: **0.70**
- **[Aksi]** Klik **Hitung Risk Score**.
- **[Narasi]** "Walaupun external score-nya cukup baik (0.70), cicilan bulanannya ~Rp 1,67 juta dari pendapatan Rp 3 juta — **DTI ~55.6%, melampaui batas 50%**. Berapapun skornya, sistem **memaksa MANUAL REVIEW**. Ini IC-6, DTI Hard Limit — pengaman terhadap nasabah *over-leveraged*."
- **[Yang muncul di layar]** Badge **⚠ MANUAL REVIEW** dengan teks "DTI 55.6% melampaui batas 50% — IC-6 triggered."

### DEMO 5 — Audit Trail + locked approve (IC-5)

- **[Aksi]** Klik tab **Portfolio**. Tunjukkan tabel 10+ aplikasi dengan kolom **Created By** dan **Last Action**.
- **[Narasi]** "Setiap aplikasi punya jejak siapa yang membuat dan aksi terakhirnya. Mari buka satu kasus manual review."
- **[Aksi]** Klik baris **C002 — Siti Rahayu** (atau Siti Rahayu hasil input demo).
- **[Yang muncul di layar]** Modal dengan **timeline audit trail**: CREATED (oleh OFC-002), AUTO_DECISION (oleh SYSTEM, alasan zona abu-abu), QUEUED_FOR_REVIEW, VIEWED (oleh CA-001) — masing-masing dengan **timestamp + user + alasan**.
- **[Narasi]** "Inilah IC-5, Audit Trail — immutable, bisa diaudit per transaksi. Tapi perhatikan: **tidak ada tombol Approve/Reject**, dan ada banner kuning menyuruh saya ganti ke Credit Analyst. Sebagai Loan Officer, saya **tidak berwenang** menyetujui. Inilah Segregation of Duties bekerja."

### DEMO 6 — Switch role → Credit Analyst approve (SoD + IC-4 live)

- **[Aksi]** Tutup modal. Buka dropdown role di navbar → pilih **Sari Wulandari (CA-001 — Credit Analyst)**.
- **[Aksi]** Buka lagi baris **C002** di Portfolio.
- **[Narasi]** "Sekarang saya login sebagai Credit Analyst. Modal yang sama, tapi **sekarang tombol Approve dan Reject muncul**. Wewenang yang berbeda untuk role yang berbeda."
- **[Aksi]** Ketik alasan di kotak notes (minimal 8 karakter), misal: **"Income terverifikasi via slip gaji 3 bulan, layak disetujui."** → klik **Approve**.
- **[Yang muncul di layar]** Status berubah **MANUAL_REVIEW → APPROVED** secara real-time, timeline audit trail **bertambah entry baru** (APPROVED oleh CA-001 + alasan + timestamp). ECL stage akan ikut bergeser (Stage 2 → Stage 1) di Financial Report nanti.
- **[Narasi]** "Keputusan tercatat lengkap dengan alasan dan identitas reviewer. Inilah Dual Control yang tuntas."

### DEMO 7 — Switch role → Finance → Financial Report (OUTPUT) 📊

- **[Aksi]** Ganti role ke **Indra Wijaya (FIN-001 — Finance)** → klik tab **Financial Report**.
- **[Narasi]** "Sebagai Finance, saya bisa generate Financial Report. Ini OUTPUT akhir siklus AIS." Telusuri section demi section:
  - **Section I — Origination Summary:** jumlah aplikasi, approved/manual/rejected, total pinjaman tersalurkan.
  - **Section II — Revenue:** Interest rate 2%/bulan flat, tenor 24 bulan, total expected interest revenue.
  - **Section III — PSAK 71 Staged ECL:** *(bagian unggulan)*
    > "Daripada pakai *flat default rate*, kami pakai **PSAK 71**. Setiap pinjaman on-book diklasifikasi ke **Stage 1 (performing, ECL 1%)**, **Stage 2 (significant increase in credit risk, ECL 5%)**, atau **Stage 3 (credit-impaired, ECL 45%)**. Persentase stage ini diturunkan dari dataset Kaggle 307K nasabah — Stage 1 ≈ 71.7%, Stage 2 ≈ 20.2%, Stage 3 ≈ 8.1%. Lihat breakdown per stage: jumlah loan, total nilai, kontribusi ECL, dan *blended rate*."
  - **Section IV — Net Expected Revenue:** Interest − ECL − Operating Cost (5%).
- **[Yang muncul di layar]** Income statement bertingkat dengan badge IC-7 & IC-8 di header.

### DEMO 8 — Journal Entries double-entry + Reconciliation (IC-7)

- **[Aksi]** Klik tombol **＋ Show Journal Entries**.
- **[Narasi]** "Sistem auto-generate **jurnal double-entry**:
  - **Loan Disbursement** per pinjaman: Dr. Loan Receivable / Cr. Cash.
  - **PSAK 71 ECL Provisioning**: Dr. Bad Debt Expense per Stage / Cr. Allowance for ECL.
  - **Interest Accrual**: Dr. Interest Receivable / Cr. Interest Income.
  Setiap entry punya nomor referensi dan tanggal."
- **[Aksi]** Scroll ke panel **IC-7: Reconciliation Check**.
- **[Narasi]** "Dan inilah kontrol penutup — **rekonsiliasi**: sum check approved + manual + rejected = total aplikasi, **dan Total Debit = Total Credit**. Kalau seimbang, badge hijau. Pembukuan kita balance."
- **[Yang muncul di layar]** Tabel jurnal + badge balance hijau (Debit = Credit).
- **[Aksi]** *(Opsional)* Klik **🖨 Print Report** → tampilkan tampilan print hitam-putih yang rapi.

### DEMO 9 — Kunci akses Loan Officer (IC-8) 🔒

- **[Aksi]** Ganti role kembali ke **Andre Saputra (Loan Officer)** → klik tab **Financial Report**.
- **[Narasi]** "Sekarang sebagai Loan Officer, saya coba buka Financial Report... **terkunci**. Muncul lock screen: 'Read-only Management Dashboard — hanya untuk Finance, Auditor, atau Management.' Inilah IC-8 — Loan Officer yang menginput tidak boleh melihat laporan keuangan. Pemisahan tugas yang tegas."
- **[Yang muncul di layar]** Lock screen dengan teks **IC-8: Management Dashboard (Segregation of Duties)**.

### DEMO 10 — Theme toggle (penutup visual)

- **[Aksi]** Klik pill **sun/moon** di pojok kanan navbar → switch ke **Light mode**.
- **[Narasi]** "Sistem mendukung dua tema — dark untuk operasional dan light 'corporate' untuk presentasi/print. Semua section tetap rapi dan terbaca di kedua mode."

> **Total durasi demo:** ±8–10 menit. Kalau waktu mepet, prioritaskan DEMO 1 → 3 → 5 → 6 → 7 → 8 → 9 (alur Input-Process-Output + SoD + IC inti).

---

## BAGIAN 3 — SKENARIO TESTING (TEST CASES)

> Test cases ini bisa dipakai untuk QA manual sebelum demo, dan sebagai bukti pengujian fungsional di laporan. Status: **PASS** kalо hasil = ekspektasi.

### 3.1 Scoring Engine (IC-2, IC-3, IC-6)

| TC | Input (income / loan / emp / ext) | Risk Score | Decision | IC | Status |
|----|-----------------------------------|-----------:|----------|----|--------|
| TC-01 | 8.000.000 / 50.000.000 / 5 / 0.72 | 72.9 | APPROVED | IC-3 | ☐ |
| TC-02 | 2.800.000 / 55.000.000 / 0.5 / 0.29 | 35.7 | REJECTED | IC-3 | ☐ |
| TC-03 | 4.500.000 / 80.000.000 / 2 / 0.38 | 44.1 | MANUAL_REVIEW (zona abu-abu) | IC-4 | ☐ |
| TC-04 | 3.000.000 / 100.000.000 / 5 / 0.70 | (di-override) | MANUAL_REVIEW (DTI 55.6% > 50%) | IC-6 | ☐ |
| TC-05 | 15.000.000 / 100.000.000 / 10 / 0.77 | 85.2 | APPROVED | IC-3 | ☐ |
| TC-06 | Tepat di batas: skor = 60 | 60.0 | APPROVED (≥ 60 inklusif) | IC-3 | ☐ |
| TC-07 | Tepat di batas: skor = 40 | 40.0 | MANUAL_REVIEW (40 inklusif, bukan reject) | IC-3 | ☐ |

**Catatan boundary:** threshold inklusif di bawah — `>= 60` approved, `>= 40` manual, sisanya reject. DTI hard limit (`> 0.50`) dievaluasi **lebih dulu** dan menimpa hasil threshold.

### 3.2 Input Validation (IC-1)

| TC | Langkah | Ekspektasi | Status |
|----|---------|------------|--------|
| TC-08 | Klik "Hitung Risk Score" dengan **field kosong** | Submit ditolak, animasi *shake* / indikasi error pada field wajib | ☐ |
| TC-09 | External Score isi nilai di luar 0–1 (mis. 5) | Input ter-*clamp*/divalidasi (field `max=1`, `min=0`) | ☐ |
| TC-10 | Lama Bekerja isi angka negatif | Ditolak (field `min=0`) | ☐ |
| TC-11 | Live preview update tiap keystroke | Skor & breakdown di panel kanan berubah real-time | ☐ |

### 3.3 Segregation of Duties / Role Gates (IC-4, IC-8)

| TC | Role aktif | Aksi | Ekspektasi | Status |
|----|-----------|------|------------|--------|
| TC-12 | Loan Officer | Buka tab New Application | Form **aktif**, bisa input | ☐ |
| TC-13 | Credit Analyst | Buka tab New Application | Form **disabled** + banner warning (bukan Loan Officer) | ☐ |
| TC-14 | Loan Officer | Buka modal kasus MANUAL_REVIEW di Portfolio | **Tidak ada** tombol Approve/Reject + banner "switch ke Credit Analyst" | ☐ |
| TC-15 | Credit Analyst | Buka modal kasus MANUAL_REVIEW | Tombol Approve/Reject **muncul** | ☐ |
| TC-16 | Loan Officer | Buka tab Financial Report | **Lock screen** IC-8 muncul | ☐ |
| TC-17 | Finance | Buka tab Financial Report | Report tampil penuh | ☐ |
| TC-18 | Auditor | Semua tab | Read-only akses semua halaman, bisa lihat audit trail | ☐ |

### 3.4 Dual Control Workflow (IC-4 end-to-end)

| TC | Langkah | Ekspektasi | Status |
|----|---------|------------|--------|
| TC-19 | Credit Analyst klik Approve dengan notes < 8 karakter | Ditolak (minimal 8 karakter) | ☐ |
| TC-20 | Credit Analyst Approve dengan notes valid | Status MANUAL_REVIEW → APPROVED, real-time | ☐ |
| TC-21 | Setelah approve, cek timeline | Entry baru: action APPROVED, by CA-001, ada reason + timestamp | ☐ |
| TC-22 | Setelah approve, cek Financial Report | Loan tsb pindah ke on-book; ECL stage menyesuaikan | ☐ |

### 3.5 Audit Trail (IC-5)

| TC | Langkah | Ekspektasi | Status |
|----|---------|------------|--------|
| TC-23 | Buka modal C004 (Dewi Lestari) | Timeline menunjukkan riwayat *post-manual-review approval* lengkap dengan decisionNotes, reviewedBy (CA-001) | ☐ |
| TC-24 | Tiap entry punya timestamp + user + action | Format `at` ada jam, `by` = user ID/SYSTEM | ☐ |
| TC-25 | Submit aplikasi baru lalu cek audit trail | Otomatis ada CREATED + AUTO_DECISION (+ QUEUED_FOR_REVIEW jika manual) | ☐ |
| TC-26 | Refresh browser | State reset ke 10 data awal (audit trail in-memory) | ☐ |

### 3.6 PSAK 71 ECL Staging (Financial Report Section III)

| TC | Cek | Ekspektasi | Status |
|----|-----|------------|--------|
| TC-27 | Stage rates | Stage 1 = 1%, Stage 2 = 5%, Stage 3 = 45% | ☐ |
| TC-28 | Stage share dari Kaggle | Stage 1 ≈ 71.69%, Stage 2 ≈ 20.24%, Stage 3 ≈ 8.07% | ☐ |
| TC-29 | Klasifikasi loan APPROVED skor ≥ 60 | Masuk Stage 1 | ☐ |
| TC-30 | Klasifikasi loan MANUAL_REVIEW | Masuk Stage 2 | ☐ |
| TC-31 | Loan REJECTED | **Tidak** masuk on-book (tidak ada ECL) | ☐ |
| TC-32 | Loan approved-via-manual dengan skor < 60 (mis. C004) | Tetap Stage 2 (rate 5%), bukan Stage 1 | ☐ |

### 3.7 Journal Entries & Reconciliation (IC-7)

| TC | Cek | Ekspektasi | Status |
|----|-----|------------|--------|
| TC-33 | Klik "Show Journal Entries" | Muncul Loan Disbursement, ECL Provisioning per stage, Interest Accrual | ☐ |
| TC-34 | Balance check jurnal | Total Debit = Total Credit (badge hijau) | ☐ |
| TC-35 | Reconciliation sum check | approved + manual + rejected = total aplikasi | ☐ |
| TC-36 | Setiap entry | Punya nomor ref (mis. JE-LD-..., JE-ECL-..., JE-INT-...) + tanggal | ☐ |

### 3.8 Navigasi, Tema & Print

| TC | Langkah | Ekspektasi | Status |
|----|---------|------------|--------|
| TC-37 | Scroll wheel / panah keyboard / klik tab | Transisi horizontal GSAP halus, tidak desync | ☐ |
| TC-38 | Submit form | Auto-navigate ke Assessment Result | ☐ |
| TC-39 | Toggle theme dark→light | Semua section tetap terbaca, tidak ada teks invisible | ☐ |
| TC-40 | Print Report | Tampilan hitam-putih rapi, elemen `.no-print` tersembunyi | ☐ |

---

## Lampiran A — Baseline Financial Figures (10 data awal, sebelum demo menambah data)

> Bacakan dari layar saat presentasi. Angka di bawah adalah baseline dengan seed data; **akan berubah** bila Anda menambah aplikasi saat demo.

| Item | Nilai | Keterangan |
|------|------:|-----------|
| Aplikasi awal | 7 APPROVED / 2 MANUAL_REVIEW / 1 REJECTED | C001–C010 |
| Total pinjaman approved | Rp 360.000.000 | C001+C003+C004+C005+C007+C008+C010 |
| Interest Revenue | Rp 172.800.000 | 360jt × 2% × 24 bln |
| On-book Stage 1 | Rp 320.000.000 → ECL Rp 3.200.000 | rate 1% |
| On-book Stage 2 | Rp 210.000.000 → ECL Rp 10.500.000 | rate 5% (termasuk C004 approved-via-manual) |
| Total ECL (PSAK 71) | Rp 13.700.000 | blended ≈ 2.58% dari Rp 530jt on-book |
| Operating Cost (5%) | Rp 18.000.000 | |
| **Net Expected Revenue** | **Rp 141.100.000** | Interest − ECL − OpCost |

## Lampiran B — Daftar User untuk Switch Role (di navbar)

| User ID | Nama | Role | Untuk demo |
|---------|------|------|-----------|
| OFC-001 | Andre Saputra | Loan Officer | Input aplikasi (default) |
| OFC-002 | Maya Pratiwi | Loan Officer | — |
| CA-001 | Sari Wulandari | Credit Analyst | Approve/Reject manual review |
| CA-002 | Rahmat Hidayat | Credit Analyst | — |
| FIN-001 | Indra Wijaya | Finance | Buka Financial Report |
| AUD-001 | Tini Marlina | Auditor | Read-only / inspeksi audit |

## Lampiran C — Q&A Antisipasi Dosen

| Pertanyaan | Jawaban singkat |
|-----------|-----------------|
| "Datanya real?" | Ya, kalibrasi dari Kaggle Home Credit 307.511 baris; di-pre-compute jadi statistik agregat (`kaggleStats.json`), tidak di-fetch runtime karena ukurannya ~158 MB. |
| "Kenapa PSAK 71, bukan flat rate?" | PSAK 71 mewajibkan ECL bertingkat (Stage 1/2/3) sesuai perubahan risiko kredit — lebih akurat & sesuai standar akuntansi Indonesia daripada flat default rate. |
| "Apakah audit trail bisa dimanipulasi?" | Tidak dari UI — entry hanya bisa di-*append*, tidak bisa edit/hapus; setiap mutasi mencatat user + timestamp + alasan. |
| "Bagaimana SoD ditegakkan?" | Lewat role gate: form disabled untuk non-Loan-Officer, tombol approve hanya untuk Credit Analyst, Financial Report terkunci untuk Loan Officer (IC-8). |
| "Apakah pembukuan balance?" | Ya — IC-7 Reconciliation mengecek Total Debit = Total Credit di setiap generate report. |
| "Apakah ada database/backend?" | Tidak — semua state in-memory React (cukup untuk demo akademik); refresh = reset ke seed data. |

---

*Dokumen ini menyertai CLAUDE.md & README.md di folder `homecredit-ais/`. Jika formula scoring atau threshold diubah di `src/lib/data.ts`, perbarui juga Bagian 1.3, Bagian 3.1, dan Lampiran A.*
