import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Kredensial diambil dari env (lihat .env.example). Kalau belum di-set, aplikasi
// tetap jalan dalam mode LOKAL (in-memory) — data tidak dibagikan antar perangkat.
const url = import.meta.env.VITE_SUPABASE_URL;
// Terima nama baru (publishable key, format `sb_publishable_...`) maupun nama lama
// (anon key JWT, format `eyJ...`). Cukup salah satu yang di-set.
const anonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

/** true kalau kredensial Supabase tersedia → data dibagikan via cloud + realtime. */
export const isCloudEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isCloudEnabled
  ? createClient(url as string, anonKey as string)
  : null;

if (!isCloudEnabled) {
  // Bantu debugging saat lupa set env di Vercel.
  console.info(
    '[CreditRisk AIS] Mode LOKAL: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum di-set. ' +
      'Data hanya disimpan di memori browser ini dan hilang saat refresh.'
  );
}
