import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Sparkles, X, ArrowUp, Square, Eraser } from 'lucide-react';
import { type Application, type SystemUser } from '../lib/data';
import { buildSystemPrompt } from '../lib/aiContext';
import { streamGroqChat, isAIEnabled, type ChatMessage } from '../lib/groq';

interface AIChatProps {
  applications: Application[];
  currentUser: SystemUser;
  currentPage: number;
  theme: 'dark' | 'light';
}

interface UIMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Aplikasi ini tentang apa?',
  'Jelaskan rumus risk score.',
  'Apa itu 8 internal control?',
  'Berapa total pinjaman yang disetujui sekarang?',
  'Bagaimana PSAK 71 ECL dihitung di sini?',
];

// Maksimum pesan riwayat yang dikirim ulang (hemat token). System prompt selalu di-refresh.
const HISTORY_LIMIT = 8;

export default function AIChat({ applications, currentUser, currentPage, theme }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll ke bawah tiap ada teks baru.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // AI dimatikan (tidak ada key di dev) → jangan render apapun.
  if (!isAIEnabled) return null;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    const userMsg: UIMessage = { role: 'user', content: trimmed };
    const history = [...messages, userMsg];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    const systemPrompt = buildSystemPrompt({ applications, currentUser, currentPage });
    const payload: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-HISTORY_LIMIT).map(m => ({ role: m.role, content: m.content }) as ChatMessage),
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamGroqChat(payload, {
        signal: controller.signal,
        onToken: delta => {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + delta };
            return next;
          });
        },
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // dihentikan pengguna — biarkan teks yang sudah masuk.
      } else {
        const msg = e?.message ?? 'Gagal menghubungi AI.';
        setError(msg);
        // Buang bubble assistant kosong kalau belum ada isinya.
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.content === '') return prev.slice(0, -1);
          return prev;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const clear = () => {
    if (streaming) return;
    setMessages([]);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Tutup AI assistant' : 'Buka AI assistant'}
        className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer border-none no-print transition-transform duration-200 hover:scale-105"
        style={{
          background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
          boxShadow: '0 8px 30px rgba(99,102,241,0.45)',
        }}
      >
        {open ? <X size={22} color="white" /> : <Sparkles size={22} color="white" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-[60] flex flex-col no-print rounded-2xl overflow-hidden"
          style={{
            width: 'min(400px, calc(100vw - 2.5rem))',
            height: 'min(620px, calc(100vh - 11rem))',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 16px 48px rgba(15,23,42,0.45)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--divider-soft)' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}
              >
                <Sparkles size={16} color="white" />
              </span>
              <div className="leading-none">
                <div className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>
                  AIS Assistant
                </div>
                <div className="text-[10px] mt-1 tracking-wide" style={{ color: 'var(--app-text-dim)' }}>
                  Tanya apa saja soal aplikasi ini
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clear}
                  disabled={streaming}
                  title="Bersihkan percakapan"
                  aria-label="Bersihkan percakapan"
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none disabled:opacity-40"
                  style={{ background: 'transparent', color: 'var(--app-text-dim)' }}
                >
                  <Eraser size={15} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none"
                style={{ background: 'transparent', color: 'var(--app-text-dim)' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                  Halo! Saya bisa menjelaskan cara kerja CreditRisk AIS — formula scoring, internal control,
                  PSAK 71, sampai angka portfolio yang sedang aktif. Coba salah satu:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 rounded-xl cursor-pointer transition-colors"
                      style={{
                        background: 'var(--overlay-bg-soft)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--app-text-muted)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--overlay-bg-soft)')}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                streaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
              />
            ))}

            {error && (
              <div
                className="text-xs px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#F87171' }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 flex-shrink-0" style={{ borderTop: '1px solid var(--divider-soft)' }}>
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{ background: 'var(--overlay-bg-soft)', border: '1px solid var(--glass-border)' }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Tulis pertanyaan…"
                className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed max-h-28"
                style={{ color: 'var(--app-text)' }}
              />
              {streaming ? (
                <button
                  onClick={stop}
                  aria-label="Hentikan"
                  title="Hentikan"
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none flex-shrink-0"
                  style={{ background: 'var(--glass-bg)', color: 'var(--app-text-muted)' }}
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  aria-label="Kirim"
                  title="Kirim"
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}
                >
                  <ArrowUp size={16} color="white" />
                </button>
              )}
            </div>
            <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--app-text-dim)' }}>
              AI bisa keliru. Verifikasi angka penting di Financial Report. · {theme === 'dark' ? '🌙' : '☀️'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ role, content, streaming }: { role: 'user' | 'assistant'; content: string; streaming: boolean }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[88%] text-sm leading-relaxed rounded-2xl px-3.5 py-2.5"
        style={
          isUser
            ? { background: 'linear-gradient(135deg,#3B82F6,#6366F1)', color: 'white', borderBottomRightRadius: 4 }
            : { background: 'var(--overlay-bg-soft)', border: '1px solid var(--glass-border)', color: 'var(--app-text)', borderBottomLeftRadius: 4 }
        }
      >
        {isUser ? (
          <span className="whitespace-pre-wrap break-words">{content}</span>
        ) : content === '' && streaming ? (
          <TypingDots />
        ) : (
          <div className="ai-rich break-words">
            {renderRich(content)}
            {streaming && <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--accent-soft)' }} />}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: 'var(--app-text-dim)', animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

// --- Markdown ringan (tanpa dependency) ---
// Mendukung: heading (#..###), bullet (- / *), numbered list, fenced code block (```),
// inline **bold** dan `code`. Cukup untuk output chat pada umumnya.
function renderRich(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // lewati penutup ```
      out.push(
        <pre
          key={key++}
          className="my-1.5 p-2.5 rounded-lg text-xs overflow-x-auto font-mono"
          style={{ background: 'var(--app-bg)', border: '1px solid var(--glass-border)' }}
        >
          <code>{code.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      out.push(
        <p key={key++} className="font-bold mt-2 mb-0.5" style={{ color: 'var(--app-text-strong)' }}>
          {renderInline(heading[2], key)}
        </p>
      );
      i++;
      continue;
    }

    // Bullet / numbered list (kumpulkan item berurutan)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[i])!;
        const ordered = /\d+\./.test(m[1]);
        items.push(
          <li key={key++} className="ml-4 list-outside" style={{ listStyleType: ordered ? 'decimal' : 'disc' }}>
            {renderInline(m[2], key)}
          </li>
        );
        i++;
      }
      out.push(
        <ul key={key++} className="my-1 flex flex-col gap-0.5">
          {items}
        </ul>
      );
      continue;
    }

    // Baris kosong → spasi antar paragraf
    if (line.trim() === '') {
      out.push(<div key={key++} className="h-1.5" />);
      i++;
      continue;
    }

    // Paragraf biasa
    out.push(
      <p key={key++} className="my-0.5">
        {renderInline(line, key)}
      </p>
    );
    i++;
  }

  return out;
}

// Inline: **bold** dan `code`.
function renderInline(text: string, baseKey: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));
    if (m[2] !== undefined) {
      nodes.push(
        <strong key={`${baseKey}-b-${k++}`} style={{ color: 'var(--app-text-strong)' }}>
          {m[2]}
        </strong>
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={`${baseKey}-c-${k++}`}
          className="px-1 py-0.5 rounded text-[0.85em] font-mono"
          style={{ background: 'var(--overlay-bg-soft)', border: '1px solid var(--glass-border)' }}
        >
          {m[3]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
