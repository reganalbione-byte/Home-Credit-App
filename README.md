# CreditRisk AIS — Home Credit Indonesia

> Web-based **Accounting Information System (AIS)** untuk manajemen risiko kredit konsumtif. Final project mata kuliah AIS, menggunakan dataset publik **Home Credit Default Risk** (Kaggle) sebagai basis.

Sistem ini mendemonstrasikan siklus AIS klasik — **Input → Process → Output → Internal Control** — plus **Segregation of Duties**, **PSAK 71 ECL Staging**, dan **double-entry journal entries**. UI fintech glassmorphism dengan dua tema (dark default + light corporate). Hasil akhir berupa Loan Portfolio Financial Report yang siap di-print.

---

## Tech Stack

| Layer            | Tech                                                             |
| ---------------- | ---------------------------------------------------------------- |
| Framework        | React 19 + TypeScript                                            |
| Build tool       | Vite 7                                                           |
| Animation        | GSAP 3 (page transitions, count-up, ring draw, intro stagger)    |
| Styling          | Tailwind CSS 3 + custom CSS (CSS variables, glassmorphism)       |
| Charts           | Recharts (PieChart + BarChart)                                   |
| UI primitives    | Radix UI / shadcn (terpasang, sebagian dipakai)                  |
| Font             | Inter + JetBrains Mono (via Google Fonts)                        |
| Deploy target    | Vercel                                                           |
| Pre-compute      | Node 20+ streaming script (no extra deps)                        |

---

## Cara Kerja Sistem

Aplikasi adalah **single-page horizontal slide deck** dengan 5 halaman utama. State global (daftar aplikasi nasabah, hasil asesmen terakhir, halaman aktif, user aktif, tema) hidup di `App.tsx` dan diturunkan via props ke tiap section. Tidak ada router — semua section ter-mount sekaligus dan ditampilkan via GSAP `translateX` transition.

### Alur Data End-to-End

```
                  ┌─────────────────────────────────────────────────────────────┐
                  │                       App.tsx (root)                         │
                  │  applications[]   lastResult   currentPage   currentUserId   │
                  └──────┬──────────────────────────────────────────┬───────────┘
                         │                                          │
        ┌────────────────┼──────────────┐                           │
        ▼                ▼              ▼                           ▼
   ┌─────────┐    ┌─────────────┐ ┌────────────┐   ┌─────────────────────────┐
   │ Cover   │    │  Featured   │ │  History   │   │  WorldInside (portfolio) │
   │ Spread  │    │  Artifacts  │ │  Spread    │   │  + VisitExplore (report) │
   │ (hero)  │    │  (form)     │ │  (result)  │   │  + Journal Entries       │
   └─────────┘    └──────┬──────┘ └─────┬──────┘   └─────────────┬───────────┘
                         │              │                        │
                         ▼              ▲                        │
                  calculateRiskScore()  │                        │
                  (src/lib/data.ts)     │                        │
                         │              │                        │
                         └──► onResult──┘                        │
                              + navigate to result               │
                                                                  │
                                            kaggleStats.json ◄────┘
                                            (PSAK 71 stage rates,
                                             pre-computed dari CSV)
```

1. **Loan Officer** (OFC-001) input data nasabah di form `FeaturedArtifacts.tsx`. Form di-disable kalau current role bukan Loan Officer.
2. Live preview di samping form menghitung ulang skor setiap keystroke pakai rumus inline yang **harus konsisten** dengan `calculateRiskScore()` di `src/lib/data.ts`.
3. Submit → 4-step loading animation 2 detik (validasi → DTI → SLIK OJK query → final assessment) → navigate otomatis ke `HistorySpread.tsx`.
4. Result page menampilkan score ring (GSAP animated), keputusan APPROVED/MANUAL_REVIEW/REJECTED, breakdown 3 faktor, dan calculation trace.
5. Klik **Tambah ke Portfolio** → entry baru di-append ke `applications[]` lewat `buildApplicationFromForm()` yang otomatis mencatat `createdBy = currentUserId` + `createdAt = now` + initial `statusHistory[]`.
6. **Credit Analyst** (CA-001) buka Portfolio Dashboard → klik row MANUAL_REVIEW → modal munculkan tombol **Approve/Reject** + textarea decision notes (minimum 8 karakter). Submit → `manualReviewDecision()` flip status + append entry ke statusHistory.
7. **Finance/Auditor** buka Financial Report → income statement dengan PSAK 71 staged ECL, journal entries auto-generated, reconciliation check.

### Navigasi

Antar halaman bisa via:

- **Scroll wheel** (akumulasi delta dengan threshold 80px)
- **Keyboard** (`ArrowRight`/`ArrowDown` next, `ArrowLeft`/`ArrowUp` prev)
- **Touch swipe** (delta horizontal > 50px)
- **Nav bar buttons** (top nav, 5 tab)
- **Dot indicators** (kanan tengah, 5 dot)

Transisi pakai GSAP `power3.inOut` 0.75s slide horizontal. `isTransitioning` ref di `App.tsx` mengunci input selama animasi berjalan — **jangan pernah `setCurrentPage` langsung**, selalu lewat `goToPage()`.

---

## Scoring Formula

Implementasi di `src/lib/data.ts` (`calculateRiskScore`):

```typescript
monthlyPayment = loan / 60               // asumsi tenor 60 bulan
dti            = monthlyPayment / income  // Debt-to-Income ratio
empScore       = min(empYears / 10, 1.0)

riskScore = ( extScore  * 0.50          // External credit score (BI Checking / SLIK OJK)
            + (1 - min(dti, 1)) * 0.30  // DTI inverted — makin rendah, makin sehat
            + empScore  * 0.20          // Employment stability
            ) * 100

// IC-6: DTI Hard Limit
if (dti > 0.50) → decision = MANUAL_REVIEW

// IC-3: Threshold Authorization
score >= 60  → APPROVED
score 40–59  → MANUAL_REVIEW
score < 40   → REJECTED
```

**Heads-up:** Form page (`FeaturedArtifacts.tsx`) me-reimplementasi rumus yang sama secara inline untuk live preview. Kalau bobot, threshold, atau formula DTI berubah di `lib/data.ts`, update kedua tempat atau preview akan mismatch sama hasil submit.

---

## Roles & Segregation of Duties

User aktif disimpan di `App.tsx` (`currentUserId`, dipersist ke `localStorage`) dan dipilih via dropdown di navbar.

| Role             | User ID(s)             | Hak Akses                                                       |
| ---------------- | ---------------------- | --------------------------------------------------------------- |
| `LOAN_OFFICER`   | `OFC-001`, `OFC-002`   | Input aplikasi baru; tidak boleh akses Financial Report          |
| `CREDIT_ANALYST` | `CA-001`, `CA-002`     | Approve/Reject MANUAL_REVIEW cases (dengan decision notes)       |
| `FINANCE`        | `FIN-001`              | Akses Financial Report                                           |
| `AUDITOR`        | `AUD-001`              | Read-only access ke semua page; review audit trail               |

Gate enforcement diimplementasikan dengan disabled fieldset (Form), conditional button (Portfolio modal), dan lock screen (Financial Report).

---

## Audit Trail (IC-5)

Setiap `Application` punya `statusHistory[]` — array `AuditEntry` immutable yang dimulai dari `CREATED` + `AUTO_DECISION` saat submit, dan growing terus setiap mutasi. Setiap entry punya `at` (ISO timestamp dengan jam), `by` (user ID), `action`, dan optional `reason` / `fromStatus` / `toStatus`.

Audit timeline tampil di Portfolio row modal lengkap dengan dot indicator berwarna per action type.

---

## PSAK 71 Expected Credit Loss

Replaces flat 14.5% default rate yang lama. Setiap on-book loan diberi `eclStage`:

| Stage | Definisi PSAK 71                                  | ECL Rate |
| ----- | ------------------------------------------------- | -------- |
| 1     | Performing — 12-month ECL                         | 1.0%     |
| 2     | Significant increase in credit risk — lifetime    | 5.0%     |
| 3     | Credit-impaired — lifetime ECL                    | 45.0%   |

Stage proportions di-derive dari Kaggle dataset (`scripts/compute-stats.mjs` → `src/lib/kaggleStats.json`). Section III di Financial Report menampilkan breakdown per stage + blended ECL rate + total allowance.

---

## Journal Entries (Double-Entry)

Auto-generated di Financial Report Section V (toggleable). Tiga jenis posting:

```
[Loan Disbursement — per approved loan]
Dr. Loan Receivable — {customer ID}    {amount}
    Cr. Cash / Bank                              {amount}

[PSAK 71 ECL Provisioning — aggregate month-end]
Dr. Bad Debt Expense — Stage 1         {stage 1 ECL}
Dr. Bad Debt Expense — Stage 2         {stage 2 ECL}
Dr. Bad Debt Expense — Stage 3         {stage 3 ECL}
    Cr. Allowance for ECL                       {total ECL}

[Interest Accrual — aggregate]
Dr. Interest Receivable                {projected interest}
    Cr. Interest Income                          {projected interest}
```

Setiap entry diberi reference number, tanggal, dan deskripsi. **Balance check** (`Σ Debits = Σ Credits`) tampil sebagai badge dan juga di Reconciliation panel (IC-7).

---

## Pre-Computing Kaggle Statistics

CSV mentahnya (`application_train.csv` ~158 MB) **tidak di-fetch runtime** — terlalu besar untuk browser/Vercel. Sebaliknya, `scripts/compute-stats.mjs` adalah Node streaming script (tanpa external deps) yang:

1. Stream-parse 307,511 baris × 122 kolom application_train.csv
2. Compute agregat:
   - Overall default rate, unemployment rate
   - Default rate breakdown per education / income type / region rating / occupation
   - PSAK 71 Stage 1/2/3 distribution (using TARGET + EXT_SOURCE_2 + DTI proxy)
   - Average EXT_SOURCE_2 untuk defaulter vs non-defaulter
3. Tulis hasil ke `src/lib/kaggleStats.json` (~3 KB)

Jalankan ulang kalau dataset di-update:

```bash
node scripts/compute-stats.mjs
```

Runtime ~3 detik untuk 307K rows.

---

## 8 Internal Controls

Setiap IC hadir sebagai pill badge di UI dekat fitur yang merepresentasikannya.

| ID   | Nama                     | Letak di UI                                                       |
| ---- | ------------------------ | ----------------------------------------------------------------- |
| IC-1 | Input Validation         | Form — validasi field wajib, shake animation kalau gagal          |
| IC-2 | Automated Scoring        | Form + Result — formula otomatis, tidak ada input manual skor     |
| IC-3 | Threshold Authorization  | Result — auto approve/reject berdasarkan threshold                |
| IC-4 | Dual Control + SoD       | Result + Portfolio — MANUAL_REVIEW perlu Credit Analyst; gate per role di setiap page |
| IC-5 | Audit Trail              | Portfolio — Created By/Last Action columns; row modal show timeline `statusHistory[]` lengkap (timestamp + user + action + reason) |
| IC-6 | DTI Hard Limit           | Form preview + Result — DTI > 50% force manual review             |
| IC-7 | Reconciliation           | Financial Report — sum check approved + manual + rejected = total; juga Debit = Credit di journal |
| IC-8 | Management Dashboard     | Financial Report — blocked dengan lock screen untuk Loan Officer  |

---

## Financial Report

Generated otomatis dari `applications[]` di `VisitExplore.tsx` (page 4):

```
Interest Revenue  = totalApprovedLoan × 2.00% × 24 bulan       (flat monthly, tenor 24 bln)
ECL Reserve       = Σ (stage_loan × stage_eclRate)              (PSAK 71)
Operating Cost    = totalApprovedLoan × 5.00%                   (estimate)
─────────────────────────────────────────────────────────────
Net Revenue       = Interest - ECL - OpCost
```

**Print-friendly:** `@media print` di `src/index.css` switch ke white bg dengan teks hitam dan menyembunyikan elemen `.no-print`. Print button di pojok kanan atas.

---

## Theme System

Sistem dua-tema dengan toggle di navbar (pill switch sun/moon di kanan, `role="switch"`).

- **Dark** (default) — deep navy `#070B14`, glassmorphism cards, gradient text biru-ungu. Vibe "fintech malam hari".
- **Light** (corporate professional) — near-white `#F4F6FA`, navy text `#0F172A`, solid white cards dengan soft drop-shadow, navy/indigo accent. Vibe "annual report".

State `theme` hidup di `App.tsx`, dipersist ke `localStorage` (key `theme`), dan ditulis ke `<html data-theme="...">`. Semua warna theme-aware dikemas sebagai CSS custom property di `src/index.css` (`--app-bg`, `--app-text`, `--accent-primary`, `--glass-bg`, `--cover-gradient`, dst). Status colors (green/amber/red) dan brand blues sengaja **tidak** ditokenisasi karena kontras OK di kedua tema.

---

## Getting Started

```bash
git clone <repo-url>
cd homecredit-ais
npm install
npm run dev
```

Buka **http://localhost:3000** (kalau port 3000 dipakai aplikasi lain, Vite otomatis pindah ke 3001).

### Available Scripts

| Command           | Fungsi                                              |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Start Vite dev server di port 3000                  |
| `npm run build`   | `tsc -b` (type-check) lalu `vite build` → `/dist`   |
| `npm run preview` | Serve hasil build lokal untuk smoke test            |
| `npm run lint`    | ESLint flat config                                  |
| `node scripts/compute-stats.mjs` | Re-generate `kaggleStats.json` dari CSV |

> **Catatan:** Belum ada test runner — `npm test` tidak tersedia.

---

## Struktur Folder

```
homecredit-ais/
├── src/
│   ├── App.tsx                    # Root — state global, GSAP transitions, theme & role
│   ├── main.tsx                   # Entry point Vite
│   ├── index.css                  # Tailwind + CSS variables (theme tokens) + custom classes
│   ├── lib/
│   │   ├── data.ts                # Application interface, USERS, calculateRiskScore, INITIAL_APPLICATIONS, audit helpers
│   │   └── kaggleStats.json       # Pre-computed agregat dari application_train.csv (tidak edit manual)
│   ├── components/
│   │   ├── Navigation.tsx         # Top navbar + role switcher + theme toggle
│   │   ├── ParticleCanvas.tsx     # Animated background (theme-aware opacity)
│   │   ├── LoadingScreen.tsx      # Intro loader dengan progress bar + step text
│   │   └── CustomCursor.tsx       # Custom cursor dot + lerp ring
│   └── sections/                  # 5 halaman utama (horizontal slide)
│       ├── CoverSpread.tsx        # Page 0 — Dashboard / hero
│       ├── FeaturedArtifacts.tsx  # Page 1 — New Application form + live preview (Loan Officer)
│       ├── HistorySpread.tsx      # Page 2 — Assessment Result + factor breakdown
│       ├── WorldInside.tsx        # Page 3 — Portfolio Dashboard + Audit Trail + Approve/Reject (Credit Analyst)
│       └── VisitExplore.tsx       # Page 4 — Financial Report + PSAK 71 ECL + Journal Entries (Finance/Auditor)
├── scripts/
│   └── compute-stats.mjs          # Node streaming CSV → JSON pre-computer
├── application_train.csv          # (di parent folder) Dataset Kaggle, dipakai oleh script, BUKAN runtime
├── application_test.csv           # (parent) tidak dipakai
├── bureau.csv / bureau_balance.csv
├── previous_application.csv
├── POS_CASH_balance.csv
├── credit_card_balance.csv
├── installments_payments.csv
└── HomeCredit_columns_description.csv
```

### Section ↔ Page Name Mapping

Tiga sumber penamaan berbeda untuk 5 halaman yang sama (warisan template "museum spread"):

| Index | `PAGES` const | Nav label        | File komponen             |
| ----- | ------------- | ---------------- | ------------------------- |
| 0     | `cover`       | Dashboard        | `CoverSpread.tsx`         |
| 1     | `form`        | New Application  | `FeaturedArtifacts.tsx`   |
| 2     | `result`      | Assessment       | `HistorySpread.tsx`       |
| 3     | `portfolio`   | Portfolio        | `WorldInside.tsx`         |
| 4     | `report`      | Financial Report | `VisitExplore.tsx`        |

---

## Dataset

Dipakai dataset publik **[Home Credit Default Risk](https://www.kaggle.com/c/home-credit-default-risk)** (Kaggle competition). File CSV ada di parent folder.

**CSV tidak di-fetch runtime** — terlalu besar untuk browser/Vercel. App hanya pakai `src/lib/kaggleStats.json` (hasil pre-compute) untuk PSAK 71 stage rates. Plus 10 dummy customer hardcoded di `INITIAL_APPLICATIONS` (`src/lib/data.ts`).

**Kolom kunci di `application_train.csv`** (yang dipakai script):

| Kolom                 | Arti                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `TARGET`              | 0 = lunas, 1 = default (label prediksi)                           |
| `AMT_INCOME_TOTAL`    | Total pendapatan tahunan                                          |
| `AMT_CREDIT`          | Jumlah pinjaman                                                   |
| `EXT_SOURCE_2`        | External credit score (0–1, dipakai sebagai PSAK 71 stage proxy)  |
| `DAYS_EMPLOYED`       | Lama bekerja dalam hari. **`365243` = pengangguran**, bukan 1000 tahun |
| `NAME_INCOME_TYPE`    | Jenis pendapatan (Working / State servant / Pensioner / dst)      |
| `NAME_EDUCATION_TYPE` | Tingkat pendidikan                                                |
| `OCCUPATION_TYPE`     | Jabatan                                                            |
| `REGION_RATING_CLIENT`| Region risk rating (1/2/3)                                        |

---

## Demo Flow

Untuk presentasi atau quick walkthrough:

1. Buka app → loading screen 2 detik → landing page (Dashboard).
2. Sebagai **Loan Officer** (OFC-001 default): tab **New Application** → input C001 Budi Santoso (income 8jt, loan 50jt, emp 5yr, ext 0.72) → lihat live preview score naik real-time → Submit.
3. Loading 2 detik (step-by-step) → **Assessment Result** → score ring animasi → **APPROVED** → "Tambah ke Portfolio".
4. Input C006 Lia Marlina (income 2.8jt, loan 55jt) → **REJECTED** (tunjukkan IC-3 threshold).
5. Input C002 Siti Rahayu (DTI > 50%) → **MANUAL REVIEW** (tunjukkan IC-4 dual control banner + IC-6 hard limit).
6. Tab **Portfolio** → klik row C002 → tampilkan **audit trail timeline** dengan timestamps + user IDs + actions. Banner kuning: "switch ke Credit Analyst".
7. **Switch role ke Credit Analyst** (CA-001) via dropdown navbar → buka modal C002 lagi → button Approve/Reject sekarang muncul. Input alasan minimum 8 karakter → klik Approve → audit timeline update real-time.
8. **Switch ke Finance** (FIN-001) → tab **Financial Report**:
   - Section I-II: origination + revenue summary
   - **Section III**: PSAK 71 staged ECL — Stage 1/2/3 breakdown
   - Section IV: Net Expected Revenue
   - Klik "**+ Show Journal Entries**" → double-entry posting (Loan Receivable, Cash, Bad Debt Expense per stage, Allowance, Interest accrual) + balance check
   - Klik Print → laporan rapi hitam-putih
9. **Switch ke Loan Officer** kembali → coba tab Financial Report → lock screen "IC-8 Management Dashboard" muncul.
10. Toggle theme di navbar (kanan atas, pill switch) — semua section harus tetap rapi di light mode.

---

## Deploy ke Vercel

```
1. Push folder homecredit-ais ke GitHub
2. Import repo di https://vercel.com/new
3. Vercel auto-detect Vite — Build command: npm run build, Output: dist
4. Deploy
```

Tidak perlu env variable, tidak perlu backend — semua state in-memory React.

> **Heads up:** Pastikan `src/lib/kaggleStats.json` di-commit. CSV mentahnya tidak perlu di-commit (terlalu besar; tinggal di parent folder lokal saja).

---

## Known Issues / Notes

- `node_modules` tidak di-include — jalankan `npm install` dulu.
- Dataset CSV cukup besar (`application_train.csv` ~158 MB) — **jangan commit ke repo**. Yang di-commit cukup `src/lib/kaggleStats.json` hasil pre-compute (~3 KB).
- `InfoModal.tsx` dan `ProceduralPaperCanvas.tsx` adalah empty stub warisan template Kimi — boleh dihapus.
- `src/pages/Home.tsx` = Vite starter template yang tidak dipakai (`main.tsx` mount `App.tsx` langsung).
- `react-router` ada di `dependencies` tapi tidak dipakai — boleh dihapus.
- Semua amount dalam **IDR** dengan format `id-ID` — gunakan helper `formatIDR` / `formatIDRShort` dari `src/lib/data.ts`, jangan bangun string locale inline.
- Belum ada test runner.
- Audit trail in-memory — refresh = reset (state-nya React useState, bukan persisted ke localStorage karena sudah cukup kompleks).

---

## Academic Context

Final project untuk mata kuliah **Accounting Information System** (S1, semester ganjil 2025).

Tujuan akademik:

- Mendemonstrasikan siklus AIS: **Input → Process → Output**.
- Mengimplementasikan **8 internal controls** secara konkret di UI, bukan sekadar narasi.
- Menerapkan **Segregation of Duties (SoD)** lewat role switching + permission gates.
- Membangun **audit trail immutable** (timestamp + user + action + reason) yang bisa di-inspect per transaction.
- Mengikuti **PSAK 71** untuk Expected Credit Loss staging (Stage 1/2/3), bukan flat default rate.
- Menghasilkan **double-entry journal entries** otomatis dari approved loans + ECL provisioning + interest accrual.
- Output akhir berupa Financial Report yang mengikuti format Income Statement, plus reconciliation check (IC-7) lengkap dengan balance check Debit = Credit.
- Menggunakan dataset nyata (Kaggle Home Credit 307K rows) yang di-pre-compute jadi statistik agregat (bukan di-fetch runtime).
