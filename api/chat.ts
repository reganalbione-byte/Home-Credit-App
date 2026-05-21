// Vercel serverless function (Edge runtime) — proxy ke Groq supaya API key TIDAK
// pernah ikut ke bundle browser. Dipakai di produksi: browser POST ke /api/chat,
// fungsi ini menambahkan GROQ_API_KEY (env server-only) lalu meneruskan respons
// streaming dari Groq apa adanya.
//
// Set di Vercel → Settings → Environment Variables:
//   GROQ_API_KEY = gsk_...            (WAJIB, jangan pakai prefix VITE_)
//   GROQ_MODEL   = llama-3.3-70b-versatile   (opsional, override model)
//
// File ini berada di luar folder `src`, jadi tidak ikut di-compile Vite/tsc.

export const config = { runtime: 'edge' };

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: { message: 'Method not allowed' } }, 405);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return json({ error: { message: 'GROQ_API_KEY belum di-set di server.' } }, 503);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: { message: 'Body bukan JSON valid.' } }, 400);
  }

  if (!Array.isArray(body?.messages)) {
    return json({ error: { message: 'Field "messages" wajib berupa array.' } }, 400);
  }

  const upstream = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || body.model || DEFAULT_MODEL,
      messages: body.messages,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
      max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : 1024,
      stream: body.stream !== false,
    }),
  });

  // Teruskan error Groq apa adanya supaya client bisa menampilkannya.
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return new Response(text || JSON.stringify({ error: { message: 'Groq upstream error.' } }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Pass-through stream SSE dari Groq ke browser.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
