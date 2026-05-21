# Setup AI Assistant (Groq) — CreditRisk AIS

Aplikasi punya **AIS Assistant**: chatbot mengambang (tombol ✨ pojok kanan bawah) yang bisa menjawab pertanyaan soal cara kerja aplikasi (formula scoring, internal control, PSAK 71, journal) **dan** angka portfolio yang sedang aktif (dihitung sama persis seperti Financial Report).

Pakai **Groq** (gratis, cepat). Setup ±5 menit. Kalau key tidak di-set saat `npm run dev`, tombol chat otomatis disembunyikan — tidak ada yang error.

---

## Langkah 1 — Ambil API key Groq (gratis)

1. Buka **https://console.groq.com** → sign in (bisa Google/GitHub).
2. Menu **API Keys** → **Create API Key** → salin nilainya (format `gsk_...`).

> Key ini rahasia. Untuk dev lokal aman dipakai langsung; untuk produksi simpan di server (lihat Langkah 3).

## Langkah 2 — Dev lokal (`npm run dev`)

1. Di folder `homecredit-ais/`, buka `.env` (copy dari `.env.example` kalau belum ada).
2. Isi:

   ```
   VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
   # opsional: VITE_GROQ_MODEL=llama-3.3-70b-versatile
   ```

3. **Restart** dev server (`Ctrl+C` lalu `npm run dev`) — Vite hanya baca env saat start.
4. Tombol ✨ muncul di pojok kanan bawah. Coba tanya "aplikasi ini tentang apa?".

Di mode ini browser memanggil Groq langsung pakai key di `.env`. Key **tidak** ikut ter-deploy (`.env` di-gitignore).

## Langkah 3 — Produksi (Vercel) — key tetap rahasia

Di produksi, key **tidak** boleh ikut ke bundle browser. Caranya: set key sebagai env **server-side** (tanpa prefix `VITE_`). Browser akan otomatis lewat serverless function `/api/chat` (file `api/chat.ts`) yang menambahkan key di sisi server.

1. Vercel → project → **Settings** → **Environment Variables**, tambahkan:

   | Name | Value | Catatan |
   | --- | --- | --- |
   | `GROQ_API_KEY` | `gsk_...` | **tanpa** `VITE_`. Server-only. |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` | opsional |

2. **Jangan** set `VITE_GROQ_API_KEY` di Vercel (kalau di-set, browser akan memanggil Groq langsung dan key terekspos).
3. **Redeploy** supaya env terbaca.

Hasilnya: di Vercel, request chat → `/api/chat` (server) → Groq. Key tidak pernah muncul di browser.

---

## Cara kerja (ringkas, untuk laporan)

- **Pemilihan mode otomatis** (`src/lib/groq.ts`):
  - `VITE_GROQ_API_KEY` ada → **DIRECT** (browser → Groq). Untuk dev.
  - Tidak ada + build produksi → **PROXY** (browser → `/api/chat` → Groq). Untuk Vercel.
  - Tidak ada + dev → **OFF** (tombol disembunyikan).
- **Konteks** (`src/lib/aiContext.ts`): tiap pertanyaan dikirim dengan *system prompt* berisi (1) pengetahuan statis soal aplikasi + (2) ringkasan data portfolio live (counts, total, ECL per stage, Net Revenue) yang dihitung dengan rumus identik dengan `VisitExplore.tsx`. Jadi angka yang disebut chatbot konsisten dengan Financial Report.
- **Streaming**: respons Groq di-stream (SSE) supaya jawaban muncul bertahap.
- **Privasi data**: hanya teks konteks + pertanyaan yang dikirim ke Groq. Tidak ada tulis-balik ke database; assistant read-only.

## Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
| Tombol ✨ tidak muncul saat dev | `VITE_GROQ_API_KEY` kosong atau dev server belum di-restart. |
| "API key Groq tidak valid" | Key salah/kadaluarsa. Buat ulang di console.groq.com. |
| "AI belum dikonfigurasi di server" (di Vercel) | `GROQ_API_KEY` belum di-set di Vercel, atau belum redeploy. |
| "Kena rate limit Groq" | Tunggu sebentar (free tier dibatasi per menit). |
| Angka chatbot beda dgn laporan | Seharusnya sama — keduanya dari rumus yang sama. Refresh halaman supaya data live ter-update. |
