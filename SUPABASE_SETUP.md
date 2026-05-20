# Setup Data Bersama (Supabase) — CreditRisk AIS

Tujuan: data yang diinput di satu perangkat (mis. laptop Anda) **muncul juga** di perangkat lain (laptop dosen) lewat Vercel, dan update-nya **realtime** (tanpa refresh).

Kodenya sudah ditulis. Anda tinggal melakukan setup **sekali** (akun + 1 tabel + 2 env var). Total ±10 menit.

> Kalau dua env var di bawah **belum** di-set, app tetap jalan normal dalam **mode lokal** (data in-memory, hilang saat refresh — seperti sebelumnya). Jadi tidak ada yang rusak kalau setup belum selesai.

---

## Langkah 1 — Buat project Supabase (gratis)

1. Buka **https://supabase.com** → **Sign in** (bisa pakai akun GitHub).
2. **New project** → isi nama (mis. `creditrisk-ais`), set **Database Password** (simpan), pilih region terdekat (mis. *Southeast Asia (Singapore)*).
3. Tunggu ±1–2 menit sampai project selesai dibuat.

## Langkah 2 — Buat tabel + aktifkan realtime (copy-paste SQL)

1. Di dashboard project, buka menu kiri **SQL Editor** → **New query**.
2. Tempel SQL berikut **seluruhnya**, lalu klik **Run**:

```sql
-- 1. Tabel: satu baris = satu aplikasi nasabah (objek lengkap disimpan di kolom JSONB `data`)
create table if not exists public.applications (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- 2. Aktifkan Row Level Security
alter table public.applications enable row level security;

-- 3. Policy demo: izinkan publik (anon key) baca + tulis.
--    CATATAN KEAMANAN: ini membuka read/write untuk siapa pun yang punya anon key.
--    Cukup untuk demo akademik. JANGAN dipakai untuk data sungguhan.
create policy "demo public read"   on public.applications for select using (true);
create policy "demo public insert" on public.applications for insert with check (true);
create policy "demo public update" on public.applications for update using (true) with check (true);
create policy "demo public delete" on public.applications for delete using (true);

-- 4. Aktifkan realtime untuk tabel ini (supaya perubahan muncul tanpa refresh)
alter publication supabase_realtime add table public.applications;
```

> Tabel sengaja dibiarkan **kosong** — aplikasi akan otomatis mengisi 10 nasabah awal saat pertama kali dibuka (lihat `seedIfEmpty()`).

## Langkah 3 — Ambil URL & anon key

1. Menu kiri **Project Settings** (ikon gear) → **API** (atau **API Keys**).
2. Catat dua nilai:
   - **Project URL** → mis. `https://abcdefgh.supabase.co`
   - **API key publik** → format baru `sb_publishable_...` (atau, kalau project lama, anon key `eyJ...`). **Jangan** pakai `secret`/`service_role`.

## Langkah 4 — Set env var di lokal (untuk `npm run dev`)

1. Di folder `homecredit-ais/`, **copy** `.env.example` menjadi `.env` (copy, jangan di-rename).
2. Isi nilainya (cukup salah satu key):

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
# atau key lama: VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> ⚠️ Nama variabel harus **persis** seperti di atas. Salah nama (mis. `VITE_SUPABASE_KEY`) = app balik ke mode lokal & data hilang saat refresh.

3. **Restart** dev server (`Ctrl+C` lalu `npm run dev`) — Vite hanya membaca env saat start, jadi wajib restart tiap ubah `.env`.
4. Buka app. Cek **Console** browser: kalau tidak ada pesan "Mode LOKAL", berarti cloud aktif. Tambah 1 nasabah, lalu buka URL yang sama di **tab incognito / HP** → data harus ikut muncul.

## Langkah 5 — Set env var di Vercel (untuk yang diakses dosen)

1. Buka project di **vercel.com** → **Settings** → **Environment Variables**.
2. Tambahkan dua variabel (scope: Production + Preview + Development):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (atau `VITE_SUPABASE_ANON_KEY` = `eyJ...`) |

3. **Redeploy** (Deployments → ⋯ → Redeploy) supaya env var terbaca di build.

Selesai. Sekarang Anda dan dosen membuka **URL Vercel yang sama** → data dan perubahan tersinkron.

---

## Cara Reset ke 10 Nasabah Awal (sebelum demo ulang)

Pilihan A — lewat Supabase (cepat): **SQL Editor** → Run:

```sql
delete from public.applications;
```

Lalu **refresh** app — 10 nasabah awal otomatis terisi lagi.

Pilihan B — lewat kode: fungsi `resetApplications()` sudah tersedia di `src/lib/cloudStore.ts`. Bilang ke saya kalau mau dipasang sebagai tombol **"Reset Data"** di UI (mis. di Portfolio, khusus role tertentu).

---

## Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
| Data masih hilang saat refresh | Env var belum kebaca. Lokal: pastikan file `.env` ada & dev server di-restart. Vercel: pastikan 2 var di-set lalu **redeploy**. |
| Console menampilkan "Mode LOKAL" | `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (atau `..._ANON_KEY`) kosong, salah nama, atau dev server belum di-restart. |
| Error `permission denied` / data tidak tersimpan | Policy RLS belum dibuat. Ulangi SQL Langkah 2 bagian policy. |
| Perubahan tidak muncul realtime di perangkat lain | Baris `alter publication supabase_realtime add table ...` belum dijalankan. Jalankan ulang. Refresh tetap bekerja walau realtime mati. |
| Data awal dobel | Jangan jalankan seed manual — biarkan app yang mengisi. Kalau terlanjur dobel, `delete from public.applications;` lalu refresh. |

---

## Catatan Arsitektur (untuk laporan)

- **Sebelumnya:** 100% frontend, state React in-memory → refresh = reset, tidak sinkron antar perangkat.
- **Sekarang:** tetap frontend (Vite/React), tapi `applications[]` dibaca/ditulis ke **Supabase (Postgres)** via `@supabase/supabase-js`. Tidak ada server custom — client langsung bicara ke Supabase dengan **anon key** + **Row Level Security**.
- **Realtime:** `subscribeApplications()` mendengarkan `postgres_changes`; tiap insert/update/delete memicu reload daftar di semua client yang terbuka.
- **Fallback:** kalau env Supabase kosong, semua fungsi cloud jadi no-op dan app kembali ke perilaku in-memory lama (berguna untuk dev cepat tanpa internet).
- **Keamanan:** policy demo membuka read/write untuk anon key (wajar untuk tugas kelas). Untuk produksi sungguhan perlu auth + policy yang ketat.
