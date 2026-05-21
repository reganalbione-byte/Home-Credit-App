// Groq client — menyalakan AI assistant (chatbot) yang menjawab pertanyaan soal
// aplikasi ini. Dua mode (dipilih otomatis):
//
//   • DIRECT  — browser memanggil Groq langsung pakai VITE_GROQ_API_KEY.
//               Dipakai saat `npm run dev` (key cuma ada di mesin kamu, tidak ikut deploy).
//   • PROXY   — browser memanggil /api/chat (Vercel serverless function) yang
//               menyimpan GROQ_API_KEY di sisi server. Key TIDAK pernah ikut ke bundle.
//               Dipakai otomatis di produksi (Vercel) saat VITE_GROQ_API_KEY tidak di-set.
//   • OFF     — tidak ada key & bukan produksi → tombol chat disembunyikan.
//
// Lihat AI_SETUP.md untuk cara isi env.

const directKey = import.meta.env.VITE_GROQ_API_KEY;

/** Model Groq. Override via VITE_GROQ_MODEL kalau perlu. */
export const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile';

export type AIMode = 'direct' | 'proxy' | 'off';

/** Mode aktif. DIRECT kalau ada VITE key; PROXY di produksi; selain itu OFF. */
export const aiMode: AIMode = directKey ? 'direct' : import.meta.env.PROD ? 'proxy' : 'off';

/** true kalau fitur AI tersedia (tombol chat ditampilkan). */
export const isAIEnabled = aiMode !== 'off';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

function humanizeError(status: number, body: string): string {
  if (status === 401 || status === 403)
    return 'API key Groq tidak valid atau belum di-set. Cek VITE_GROQ_API_KEY (lokal) / GROQ_API_KEY (Vercel).';
  if (status === 429) return 'Kena rate limit Groq. Tunggu sebentar lalu coba lagi.';
  if (status === 503) return 'AI belum dikonfigurasi di server (GROQ_API_KEY kosong di Vercel).';
  // Coba ambil pesan error dari body kalau ada.
  try {
    const j = JSON.parse(body);
    if (j?.error?.message) return `Groq error: ${j.error.message}`;
  } catch {
    /* abaikan */
  }
  return `Groq error (HTTP ${status}).`;
}

/**
 * Streaming chat ke Groq. Memanggil `onToken` tiap potongan teks datang.
 * Throw Error (dengan pesan ramah) kalau gagal. Hormati AbortSignal untuk stop.
 */
export async function streamGroqChat(
  messages: ChatMessage[],
  opts: { onToken: (delta: string) => void; signal?: AbortSignal }
): Promise<void> {
  const payload = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 1024,
    stream: true,
  };

  let resp: Response;
  if (aiMode === 'direct') {
    resp = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${directKey}` },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });
  } else {
    // PROXY: serverless function meneruskan ke Groq + menyembunyikan key.
    resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });
  }

  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    throw new Error(humanizeError(resp.status, txt));
  }

  // Parse Server-Sent Events (format OpenAI-compatible): baris `data: {json}`.
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // sisa baris yang belum lengkap

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data);
        const delta: string | undefined = json?.choices?.[0]?.delta?.content;
        if (delta) opts.onToken(delta);
      } catch {
        // potongan JSON belum lengkap antar-chunk — aman diabaikan.
      }
    }
  }
}
