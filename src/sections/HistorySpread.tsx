import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { formatIDR, type SystemUser } from '../lib/data';

interface HistorySpreadProps {
  isActive: boolean;
  result: any;
  onNewApplication: () => void;
  onAddToPortfolio: () => void;
  currentUser: SystemUser;
}

export default function HistorySpread({ isActive, result, onNewApplication, onAddToPortfolio, currentUser }: HistorySpreadProps) {
  const hasAnimated = useRef(false);
  const ringRef = useRef<SVGCircleElement>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [added, setAdded] = useState(false);

  const score = result?.riskScore ?? 0;
  const decision = result?.decision ?? 'APPROVED';
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (circumference * score / 100);

  const decisionConfig = {
    APPROVED: { label: '✓ APPROVED', color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', glow: 'glow-green', text: 'Aplikasi disetujui secara otomatis.' },
    MANUAL_REVIEW: { label: '⚠ MANUAL REVIEW', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', glow: 'glow-amber', text: result?.dtiFlag ? `DTI ${((result?.dti ?? 0)*100).toFixed(1)}% melampaui batas 50% — IC-6 triggered.` : 'Skor berada di zona abu-abu. Perlu review Credit Analyst.' },
    REJECTED: { label: '✗ REJECTED', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', glow: 'glow-red', text: 'Skor terlalu rendah untuk disetujui.' },
  };
  const cfg = decisionConfig[decision as keyof typeof decisionConfig];

  useEffect(() => {
    if (!isActive || !result) return;
    hasAnimated.current = false;
    setDisplayScore(0); setAdded(false);
  }, [result]);

  useEffect(() => {
    if (!isActive || !result || hasAnimated.current) return;
    hasAnimated.current = true;
    const tl = gsap.timeline();
    tl.fromTo('.result-header', { opacity:0, y:20 }, { opacity:1, y:0, duration:0.5, ease:'power2.out' }, 0.1);
    tl.fromTo('.score-ring-wrap', { opacity:0, scale:0.8 }, { opacity:1, scale:1, duration:0.6, ease:'back.out(1.4)' }, 0.3);
    tl.fromTo('.decision-badge', { opacity:0, y:20, scale:0.9 }, { opacity:1, y:0, scale:1, duration:0.5, ease:'back.out(1.5)' }, 0.7);
    tl.fromTo('.factor-card', { opacity:0, y:20 }, { opacity:1, y:0, stagger:0.1, duration:0.4, ease:'power2.out' }, 0.8);
    tl.fromTo('.detail-card', { opacity:0, x:40 }, { opacity:1, x:0, duration:0.5, ease:'power2.out' }, 0.5);
    // Count up score
    let start = 0;
    const end = score;
    const step = () => {
      start += Math.ceil((end - start) * 0.1) || 1;
      if (start >= end) { setDisplayScore(end); return; }
      setDisplayScore(start);
      requestAnimationFrame(step);
    };
    setTimeout(step, 400);
    // Animate ring
    if (ringRef.current) {
      gsap.fromTo(ringRef.current, { strokeDashoffset: circumference }, { strokeDashoffset: offset, duration: 1.5, ease: 'power2.out', delay: 0.4 });
    }
    return () => { tl.kill(); };
  }, [isActive, result]);

  if (!result) return (
    <div className="w-screen h-screen flex items-center justify-center" style={{ paddingTop:'64px', background:'var(--cover-gradient)' }}>
      <div className="text-center">
        <div className="text-6xl mb-4 opacity-20">◎</div>
        <p className="text-[var(--app-text-dim)] text-sm">Belum ada asesmen. Submit form terlebih dahulu.</p>
        <button onClick={onNewApplication} className="btn-gradient mt-6 text-sm px-6 py-3">Buat Aplikasi Baru</button>
      </div>
    </div>
  );

  const ringColor = score >= 60 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="w-screen h-screen relative overflow-hidden" style={{ paddingTop:'64px', background:'var(--cover-gradient)' }}>
      <div className="grid-overlay absolute inset-0 opacity-40" />
      <div className="relative z-10 h-full flex gap-8 px-16 py-8 overflow-y-auto">

        {/* Left: score + factors */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="result-header" style={{ opacity:0 }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="ic-badge">IC-2: Automated Scoring</span>
              <span className="ic-badge">IC-3: Threshold Authorization</span>
              {decision === 'MANUAL_REVIEW' && <span className="ic-badge">IC-4: Dual Control</span>}
            </div>
            <h2 className="text-3xl font-bold text-[var(--app-text-strong)]">Credit Assessment Result</h2>
            <p className="text-sm text-[var(--app-text-dim)] mt-1">Hasil asesmen untuk <span className="text-[var(--app-text-muted)] font-medium">{result.name}</span></p>
          </div>

          {/* Score ring */}
          <div className="score-ring-wrap glass-card-static rounded-2xl p-8 flex flex-col items-center" style={{ opacity:0 }}>
            <div className="relative w-40 h-40 mb-6">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--overlay-bg-soft)" strokeWidth="8"/>
                <circle ref={ringRef} cx="60" cy="60" r="54" fill="none" stroke={ringColor} strokeWidth="8"
                  strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference}
                  style={{ filter:`drop-shadow(0 0 12px ${ringColor}60)` }}/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-[var(--app-text-strong)]">{displayScore}</span>
                <span className="text-sm text-[var(--app-text-dim)]">/ 100 pts</span>
              </div>
            </div>
            <div className="decision-badge px-8 py-3 rounded-2xl text-lg font-bold tracking-wide" style={{ opacity:0, background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color, boxShadow:`0 0 30px ${cfg.color}25` }}>
              {cfg.label}
            </div>
            <p className="text-sm text-[var(--app-text-dim)] mt-3 text-center max-w-xs">{cfg.text}</p>
            {decision === 'MANUAL_REVIEW' && (
              <div className="mt-4 px-4 py-2 rounded-xl text-xs text-[#FBBF24] text-center" style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)' }}>
                🔒 Pending Credit Analyst Approval — IC-4: Dual Control
              </div>
            )}
          </div>

          {/* Factor breakdown */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'External Score', weight: '50%', raw: result.extScore, normalized: Math.round(result.extScore * 100), color: '#6366F1', contribution: result.extScore * 0.5 * 100 },
              { label: 'DTI Inverted', weight: '30%', raw: `${(result.dti * 100).toFixed(1)}%`, normalized: Math.max(0, Math.round((1 - Math.min(result.dti, 1)) * 100)), color: '#3B82F6', contribution: Math.max(0, (1 - Math.min(result.dti, 1))) * 0.3 * 100 },
              { label: 'Employment', weight: '20%', raw: `${result.empYears ?? 0}yr`, normalized: Math.round(Math.min((result.empYears ?? 0) / 10, 1) * 100), color: '#06B6D4', contribution: Math.min((result.empYears ?? 0) / 10, 1) * 0.2 * 100 },
            ].map(f => (
              <div key={f.label} className="factor-card glass-card-static rounded-xl p-4" style={{ opacity:0 }}>
                <div className="text-xs text-[var(--app-text-dim)] mb-1">{f.label}</div>
                <div className="text-xs text-[#6366F1] mb-3">Weight: {f.weight}</div>
                <div className="h-1.5 rounded-full mb-2" style={{ background:'var(--overlay-bg)' }}>
                  <div className="h-full rounded-full" style={{ width:`${f.normalized}%`, background:f.color }}/>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--app-text-dim)]">Raw: {f.raw}</span>
                  <span style={{ color:f.color }}>+{f.contribution.toFixed(1)}pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: detail card */}
        <div className="detail-card w-72 flex flex-col gap-4" style={{ opacity:0 }}>
          <div className="glass-card-static rounded-2xl p-6">
            <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-4">Application Detail</div>
            {[
              { k: 'Nasabah', v: result.name },
              { k: 'Tujuan', v: result.purpose },
              { k: 'Pendapatan/bln', v: formatIDR(result.income) },
              { k: 'Jumlah Pinjaman', v: formatIDR(result.loan) },
              { k: 'Cicilan/bln (est.)', v: formatIDR(Math.round(result.loan / 60)) },
              { k: 'DTI Ratio', v: `${(result.dti * 100).toFixed(1)}%`, warn: result.dtiFlag },
              { k: 'External Score', v: result.extScore.toFixed(2) },
              { k: 'Lama Kerja', v: `${result.empYears} tahun` },
              { k: 'Tanggal', v: result.date },
              { k: 'Submitted by', v: `${currentUser.id} — ${currentUser.name}` },
            ].map(r => (
              <div key={r.k} className="flex justify-between py-2.5 border-b border-white/5 last:border-0">
                <span className="text-xs text-[var(--app-text-dim)]">{r.k}</span>
                <span className={`text-xs font-medium ${r.warn ? 'text-[#F59E0B]' : 'text-[var(--app-text-muted)]'}`}>{r.v}</span>
              </div>
            ))}
          </div>

          {/* Calculation */}
          <div className="glass-card-static rounded-2xl p-6">
            <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-3">Calculation</div>
            <div className="font-mono text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">EXT × 0.50</span><span className="text-[#6366F1]">{(result.extScore * 0.5 * 100).toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">(1-DTI) × 0.30</span><span className="text-[#3B82F6]">{(Math.max(0,1-Math.min(result.dti,1)) * 0.3 * 100).toFixed(1)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">EMP × 0.20</span><span className="text-[#06B6D4]">{(Math.min((result.empYears??0)/10,1) * 0.2 * 100).toFixed(1)}</span></div>
              <div className="h-px bg-white/10 my-2"/>
              <div className="flex justify-between font-bold"><span className="text-[var(--app-text-muted)]">TOTAL</span><span className="text-[var(--app-text-strong)]">{score.toFixed(1)} pts</span></div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!added ? (
              <button onClick={() => { onAddToPortfolio(); setAdded(true); }} className="btn-gradient py-3 text-sm font-semibold">
                + Tambah ke Portfolio
              </button>
            ) : (
              <div className="py-3 text-sm text-center text-[#10B981] font-semibold rounded-xl" style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)' }}>
                ✓ Ditambahkan ke Portfolio
              </div>
            )}
            <button onClick={onNewApplication} className="py-3 text-sm font-medium rounded-xl cursor-pointer border-none"
              style={{ background:'var(--overlay-bg-soft)', color:'var(--app-text-muted)' }}>
              ← Aplikasi Baru
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
