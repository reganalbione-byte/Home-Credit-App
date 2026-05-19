import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface CoverSpreadProps { isActive: boolean; onEnterGallery: () => void; }

const STATS = [
  { label: 'Applications Processed', value: '10', suffix: '+' },
  { label: 'Approval Rate', value: '70', suffix: '%' },
  { label: 'Avg Risk Score', value: '64', suffix: 'pts' },
  { label: 'Total Portfolio', value: '585', suffix: 'jt' },
];

export default function CoverSpread({ isActive, onEnterGallery }: CoverSpreadProps) {
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isActive || hasAnimated.current) return;
    hasAnimated.current = true;
    const tl = gsap.timeline();
    tl.fromTo('.cover-badge', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.3);
    tl.fromTo('.cover-title-1', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.5);
    tl.fromTo('.cover-title-2', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.7);
    tl.fromTo('.cover-sub', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 1.0);
    tl.fromTo('.cover-divider', { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power3.inOut' }, 1.1);
    tl.fromTo('.cover-stat', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, 1.3);
    tl.fromTo('.cover-cta', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }, 1.7);
    tl.fromTo('.cover-side', { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' }, 0.9);
    return () => { tl.kill(); };
  }, [isActive]);

  return (
    <div className="w-screen h-screen relative overflow-hidden flex items-center"
      style={{ paddingTop: '64px', background: 'var(--cover-gradient)' }}>

      {/* Grid overlay */}
      <div className="grid-overlay absolute inset-0 opacity-50" />

      {/* Radial glow center-left */}
      <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'var(--radial-glow-blue)' }} />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'var(--radial-glow-indigo)' }} />

      {/* Main content */}
      <div className="relative z-10 flex w-full h-full items-center px-16">
        {/* Left block */}
        <div className="flex-1 max-w-2xl">
          <div className="cover-badge inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', opacity: 0 }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--accent-soft)' }}>Accounting Information System — Final Project</span>
          </div>

          <h1 className="cover-title-1 text-6xl font-black leading-none mb-2 tracking-tight" style={{ opacity: 0, color: 'var(--app-text-strong)' }}>
            Credit Risk
          </h1>
          <h1 className="cover-title-2 text-6xl font-black leading-none mb-6 tracking-tight" style={{ opacity: 0 }}>
            <span className="gradient-text">Management</span>
          </h1>
          <p className="cover-sub text-lg leading-relaxed mb-10 max-w-xl" style={{ opacity: 0, color: 'var(--app-text-dim)' }}>
            ERP-based Accounting Information System untuk evaluasi kredit otomatis, manajemen portofolio pinjaman, dan pelaporan keuangan — <span style={{ color: 'var(--app-text-muted)' }}>Home Credit Indonesia</span>.
          </p>

          <div className="cover-divider h-px mb-10 origin-left" style={{ background: 'linear-gradient(90deg,rgba(99,102,241,0.5),transparent)', transform: 'scaleX(0)' }} />

          {/* Stats row */}
          <div className="flex gap-8 mb-12">
            {STATS.map((s) => (
              <div key={s.label} className="cover-stat" style={{ opacity: 0 }}>
                <div className="text-3xl font-black" style={{ color: 'var(--app-text-strong)' }}>
                  {s.value}<span className="text-lg" style={{ color: 'var(--accent-secondary)' }}>{s.suffix}</span>
                </div>
                <div className="text-xs mt-1 tracking-wide" style={{ color: 'var(--app-text-dim)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <button onClick={onEnterGallery}
            className="cover-cta btn-gradient text-sm px-8 py-3.5 inline-flex items-center gap-3"
            style={{ opacity: 0 }}>
            Mulai Asesmen Kredit
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Right panel */}
        <div className="cover-side w-80 ml-16 flex flex-col gap-4" style={{ opacity: 0 }}>
          {/* System info card */}
          <div className="glass-card-static p-6">
            <div className="text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--app-text-dim)' }}>System Overview</div>
            {[
              { label: 'ERP Module', val: 'Credit Risk Management' },
              { label: 'Data Source', val: 'Kaggle Home Credit (307K rows)' },
              { label: 'Model', val: 'Weighted Scoring + PSAK 71' },
              { label: 'Roles', val: 'Officer / Analyst / Finance / Auditor' },
              { label: 'Currency', val: 'IDR (Rupiah Indonesia)' },
              { label: 'Academic Year', val: '2025 — AIS Final Project' },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-start py-2.5 border-b last:border-0" style={{ borderColor: 'var(--divider-soft)' }}>
                <span className="text-xs" style={{ color: 'var(--app-text-dim)' }}>{r.label}</span>
                <span className="text-xs text-right max-w-[140px]" style={{ color: 'var(--app-text-muted)' }}>{r.val}</span>
              </div>
            ))}
          </div>
          {/* IC list card */}
          <div className="glass-card-static p-6">
            <div className="text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--app-text-dim)' }}>Internal Controls</div>
            <div className="flex flex-wrap gap-2">
              {['IC-1','IC-2','IC-3','IC-4','IC-5','IC-6','IC-7','IC-8'].map(ic => (
                <span key={ic} className="ic-badge">{ic}</span>
              ))}
            </div>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--app-text-dim)' }}>8 internal controls aktif memastikan integritas dan keandalan sistem.</p>
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--app-text-dim)' }}>Scroll atau gunakan panah navigasi</span>
        <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, var(--accent-secondary), transparent)' }} />
      </div>

      {/* Page indicator dot row */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-60">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="w-1 h-1 rounded-full" style={{ background: i === 0 ? 'var(--accent-secondary)' : 'var(--dot-inactive)' }} />
        ))}
      </div>
    </div>
  );
}
