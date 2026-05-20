import { supabase } from './supabase';
import { INITIAL_APPLICATIONS, type Application } from './data';

// Satu baris = satu Application. Seluruh objek (termasuk statusHistory & eclStage)
// disimpan apa adanya di kolom JSONB `data`, dengan `id` sebagai primary key.
const TABLE = 'applications';

export type CloudResult = { ok: boolean; error?: string };

const byCreatedAt = (a: Application, b: Application) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/** Ambil semua aplikasi dari cloud. Fallback ke data awal kalau cloud mati/error. */
export async function loadApplications(): Promise<Application[]> {
  if (!supabase) return [...INITIAL_APPLICATIONS];
  const { data, error } = await supabase.from(TABLE).select('data');
  if (error) {
    console.error('[cloud] load gagal:', error.message);
    return [...INITIAL_APPLICATIONS];
  }
  return (data ?? []).map(r => r.data as Application).sort(byCreatedAt);
}

/** Isi 10 nasabah awal hanya kalau tabel masih kosong (aman dipanggil berkali-kali). */
export async function seedIfEmpty(): Promise<void> {
  if (!supabase) return;
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true });
  if (error) {
    console.error('[cloud] cek isi tabel gagal:', error.message);
    return;
  }
  if ((count ?? 0) > 0) return;
  const rows = INITIAL_APPLICATIONS.map(a => ({ id: a.id, data: a }));
  const { error: insErr } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (insErr) console.error('[cloud] seed gagal:', insErr.message);
}

/**
 * Tambah aplikasi BARU. Sengaja pakai INSERT (bukan upsert) supaya kalau id-nya
 * sudah dipakai perangkat lain (race condition), gagal terdeteksi — bukan menimpa
 * data orang lain diam-diam.
 */
export async function insertApplication(app: Application): Promise<CloudResult> {
  if (!supabase) return { ok: true };
  const { error } = await supabase.from(TABLE).insert({ id: app.id, data: app });
  if (error) {
    console.error('[cloud] insert gagal:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Perbarui aplikasi yang sudah ada (mis. setelah keputusan manual review). */
export async function upsertApplication(app: Application): Promise<CloudResult> {
  if (!supabase) return { ok: true };
  const { error } = await supabase
    .from(TABLE)
    .upsert({ id: app.id, data: app }, { onConflict: 'id' });
  if (error) {
    console.error('[cloud] simpan gagal:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Kosongkan tabel & isi ulang dengan 10 nasabah awal (tombol Reset). */
export async function resetApplications(): Promise<CloudResult> {
  if (!supabase) return { ok: true };
  const { error: delErr } = await supabase.from(TABLE).delete().neq('id', '');
  if (delErr) {
    console.error('[cloud] reset (hapus) gagal:', delErr.message);
    return { ok: false, error: delErr.message };
  }
  const rows = INITIAL_APPLICATIONS.map(a => ({ id: a.id, data: a }));
  const { error: insErr } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id' });
  if (insErr) {
    console.error('[cloud] reset (seed) gagal:', insErr.message);
    return { ok: false, error: insErr.message };
  }
  return { ok: true };
}

/** Subscribe perubahan realtime. Callback dipanggil tiap ada insert/update/delete. */
export function subscribeApplications(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel('applications-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => onChange())
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

/** Subscribe presence — jumlah viewer yang sedang membuka app (realtime). */
export function subscribePresence(onCount: (n: number) => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const key = (globalThis.crypto?.randomUUID?.() ?? String(Math.random()));
  const channel = client.channel('presence-room', { config: { presence: { key } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      onCount(Object.keys(channel.presenceState()).length);
    })
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });
  return () => {
    client.removeChannel(channel);
  };
}
