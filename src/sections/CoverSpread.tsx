import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { Application } from '../lib/data';

interface CoverSpreadProps {
  isActive: boolean;
  onEnterGallery: () => void;
  onResetData: () => void;
  applications: Application[];
}

const IC_DETAILS: { id: string; name: string; where: string; desc: string }[] = [
  { id: 'IC-1', name: 'Input Validation', where: 'New Application (Form)',
    desc: 'Form memvalidasi field wajib (nama, pendapatan, pinjaman, lama kerja, external score). Input kosong atau tidak valid ditolak dengan animasi shake — mencegah data tidak lengkap/salah masuk ke sistem.' },
  { id: 'IC-2', name: 'Automated Scoring', where: 'Form + Assessment Result',
    desc: 'Risk score dihitung otomatis oleh sistem: External Score 50% + DTI Inverted 30% + Employment 20%. Tidak ada input skor manual, sehingga menghindari bias dan kesalahan manusia.' },
  { id: 'IC-3', name: 'Threshold Authorization', where: 'Assessment Result',
    desc: 'Keputusan kredit diambil otomatis berdasarkan ambang: skor ≥ 60 → APPROVED, 40–59 → MANUAL REVIEW, < 40 → REJECTED. Konsisten dan tidak bisa diintervensi sembarangan.' },
  { id: 'IC-4', name: 'Dual Control + Segregation of Duties', where: 'Result + Portfolio',
    desc: 'Kasus MANUAL REVIEW wajib ditinjau Credit Analyst — bukan Loan Officer yang menginput. Tiap role punya hak akses berbeda, sehingga yang menginput ≠ yang menyetujui.' },
  { id: 'IC-5', name: 'Audit Trail', where: 'Portfolio (detail baris)',
    desc: 'Setiap aplikasi menyimpan riwayat status yang immutable: timestamp + user + aksi + alasan. Bisa ditelusuri per transaksi untuk keperluan audit.' },
  { id: 'IC-6', name: 'DTI Hard Limit', where: 'Form preview + Result',
    desc: 'Jika rasio Debt-to-Income melebihi 50%, aplikasi dipaksa ke MANUAL REVIEW berapapun skornya — pengaman terhadap nasabah yang terlalu banyak utang (over-leveraged).' },
  { id: 'IC-7', name: 'Reconciliation', where: 'Financial Report',
    desc: 'Laporan keuangan mengecek konsistensi: jumlah approved + manual + rejected = total aplikasi, dan Total Debit = Total Credit pada jurnal. Memastikan pembukuan seimbang.' },
  { id: 'IC-8', name: 'Management Dashboard', where: 'Financial Report',
    desc: 'Financial Report hanya dapat diakses role Finance, Auditor, atau Management. Loan Officer diblokir dengan lock screen — memisahkan akses operasional dari pelaporan manajemen.' },
];

// Pemetaan 8 Internal Control ke 5 komponen kerangka COSO.
const COSO_COMPONENTS: { name: string; desc: string; ics: string[] }[] = [
  { name: '1. Control Environment', desc: 'Struktur otorisasi & pemisahan tugas — siapa boleh melakukan apa.', ics: ['IC-4', 'IC-8'] },
  { name: '2. Risk Assessment', desc: 'Identifikasi & ukur risiko kredit lewat scoring otomatis + batas DTI.', ics: ['IC-2', 'IC-3', 'IC-6'] },
  { name: '3. Control Activities', desc: 'Aktivitas kontrol: validasi input, dual control, rekonsiliasi.', ics: ['IC-1', 'IC-4', 'IC-7'] },
  { name: '4. Information & Communication', desc: 'Informasi tercatat & tersampaikan: audit trail + dashboard manajemen.', ics: ['IC-5', 'IC-8'] },
  { name: '5. Monitoring Activities', desc: 'Pemantauan berkelanjutan: review audit trail & cek rekonsiliasi.', ics: ['IC-5', 'IC-7'] },
];

// Alur sistem (Data Flow Diagram) — Input → Process → Output dengan kontrol di tiap tahap.
const DFD_STEPS: { actor: string; step: string; controls: string[] }[] = [
  { actor: 'Loan Officer', step: 'Input data nasabah (New Application)', controls: ['IC-1'] },
  { actor: 'System', step: 'Hitung Risk Score & DTI (Automated Scoring)', controls: ['IC-2', 'IC-6'] },
  { actor: 'System', step: 'Keputusan otomatis berdasarkan threshold', controls: ['IC-3'] },
  { actor: 'Credit Analyst', step: 'Review manual: grey zone / DTI limit (Dual Control)', controls: ['IC-4'] },
  { actor: 'System', step: 'Catat ke Portfolio + Audit Trail', controls: ['IC-5'] },
  { actor: 'Finance', step: 'Financial Report: PSAK 71, Jurnal, Ledger, Trial Balance', controls: ['IC-7', 'IC-8'] },
];

export default function CoverSpread({ isActive, onEnterGallery, onResetData, applications }: CoverSpreadProps) {
  const hasAnimated = useRef(false);
  const [activeIC, setActiveIC] = useState<string | null>(null);
  const [showFramework, setShowFramework] = useState(false);
  const icDetail = IC_DETAILS.find(c => c.id === activeIC) ?? null;

  // Statistik dihitung dari data aktual (ikut berubah saat tambah/reset nasabah).
  const total = applications.length;
  const approved = applications.filter(a => a.decision === 'APPROVED').length;
  const stats = [
    { label: 'Applications Processed', value: String(total), suffix: '' },
    { label: 'Approval Rate', value: total ? String(Math.round((approved / total) * 100)) : '0', suffix: '%' },
    { label: 'Avg Risk Score', value: total ? String(Math.round(applications.reduce((s, a) => s + (a.riskScore ?? 0), 0) / total)) : '0', suffix: 'pts' },
    { label: 'Total Portfolio', value: String(Math.round(applications.reduce((s, a) => s + a.loan, 0) / 1_000_000)), suffix: 'jt' },
  ];

  // Tutup modal (IC detail / framework) dengan tombol Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setActiveIC(null); setShowFramework(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Tutup modal kalau pindah halaman (hindari modal ikut ter-translate saat slide)
  useEffect(() => { if (!isActive) { setActiveIC(null); setShowFramework(false); } }, [isActive]);

  const handleReset = () => {
    if (window.confirm('Reset semua data ke 10 nasabah awal?\n\nSemua aplikasi yang ditambahkan akan dihapus (termasuk di cloud / perangkat lain).')) {
      onResetData();
    }
  };

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
      <div className="relative z-10 flex w-full h-full items-center px-6 md:px-16">
        {/* Left block */}
        <div className="flex-1 max-w-2xl">
          <div className="cover-badge inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', opacity: 0 }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10B981' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: 'var(--accent-soft)' }}>Accounting Information System — Final Project</span>
          </div>

          <h1 className="cover-title-1 text-5xl md:text-6xl font-black leading-none mb-2 tracking-tight" style={{ opacity: 0, color: 'var(--app-text-strong)' }}>
            Credit Risk
          </h1>
          <h1 className="cover-title-2 text-5xl md:text-6xl font-black leading-none mb-6 tracking-tight" style={{ opacity: 0 }}>
            <span className="gradient-text">Management</span>
          </h1>
          <p className="cover-sub text-lg leading-relaxed mb-10 max-w-xl" style={{ opacity: 0, color: 'var(--app-text-dim)' }}>
            ERP-based Accounting Information System untuk evaluasi kredit otomatis, manajemen portofolio pinjaman, dan pelaporan keuangan — <span style={{ color: 'var(--app-text-muted)' }}>Home Credit Indonesia</span>.
          </p>

          <div className="cover-divider h-px mb-10 origin-left" style={{ background: 'linear-gradient(90deg,rgba(99,102,241,0.5),transparent)', transform: 'scaleX(0)' }} />

          {/* Stats row */}
          <div className="flex gap-8 mb-12">
            {stats.map((s) => (
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
        <div className="cover-side w-80 ml-16 flex flex-col gap-4 max-h-full overflow-y-auto" style={{ opacity: 0 }}>
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
              {IC_DETAILS.map(ic => (
                <button key={ic.id} type="button" className="ic-badge ic-badge-btn" onClick={() => setActiveIC(ic.id)} title={`${ic.id}: ${ic.name}`}>
                  {ic.id}
                </button>
              ))}
            </div>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--app-text-dim)' }}>
              8 internal controls aktif memastikan integritas dan keandalan sistem. <span style={{ color: 'var(--accent-soft)' }}>Klik tiap badge untuk detail.</span>
            </p>
            <button type="button" onClick={() => setShowFramework(true)}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-soft)' }}>
              📋 COSO Framework & Alur Sistem (DFD)
            </button>
          </div>

          {/* Reset data card */}
          <div className="glass-card-static p-6">
            <div className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--app-text-dim)' }}>Demo Utilities</div>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--app-text-dim)' }}>
              Kembalikan portofolio ke 10 nasabah awal sebelum demo ulang.
            </p>
            <button type="button" onClick={handleReset}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Reset Data ke 10 Nasabah Awal
            </button>
          </div>
        </div>
      </div>

      {/* IC detail modal */}
      {icDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: 'rgba(2,6,16,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setActiveIC(null)}>
          <div className="glass-card-static rounded-2xl p-8 max-w-md w-full relative"
            onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setActiveIC(null)} aria-label="Tutup"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none"
              style={{ background: 'var(--overlay-bg-soft)', color: 'var(--app-text-dim)' }}>✕</button>
            <div className="flex items-center gap-3 mb-4">
              <span className="ic-badge" style={{ fontSize: '13px', padding: '4px 14px' }}>{icDetail.id}</span>
              <h3 className="text-lg font-bold" style={{ color: 'var(--app-text-strong)' }}>{icDetail.name}</h3>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--app-text-muted)' }}>{icDetail.desc}</p>
            <div className="flex items-center gap-2 pt-4" style={{ borderTop: '1px solid var(--divider-soft)' }}>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--app-text-dim)' }}>Letak di UI:</span>
              <span className="text-xs font-medium" style={{ color: 'var(--accent-soft)' }}>{icDetail.where}</span>
            </div>
          </div>
        </div>
      )}

      {/* COSO framework + DFD modal */}
      {showFramework && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6"
          style={{ background: 'rgba(2,6,16,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowFramework(false)}>
          <div className="glass-card-static rounded-2xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto relative"
            onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setShowFramework(false)} aria-label="Tutup"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none z-10"
              style={{ background: 'var(--overlay-bg-soft)', color: 'var(--app-text-dim)' }}>✕</button>

            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--app-text-strong)' }}>Internal Control Framework — COSO</h3>
            <p className="text-xs mb-5" style={{ color: 'var(--app-text-dim)' }}>Pemetaan 8 internal control sistem ke 5 komponen kerangka COSO.</p>

            <div className="space-y-2 mb-8">
              {COSO_COMPONENTS.map(c => (
                <div key={c.name} className="rounded-xl p-4" style={{ background: 'var(--overlay-bg-soft)' }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--app-text-strong)' }}>{c.name}</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {c.ics.map(ic => <span key={ic} className="ic-badge">{ic}</span>)}
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--app-text-dim)' }}>{c.desc}</p>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--app-text-strong)' }}>Alur Sistem — Data Flow (Input → Process → Output)</h3>
            <p className="text-xs mb-5" style={{ color: 'var(--app-text-dim)' }}>Setiap tahap memiliki kontrol yang melekat.</p>

            <div className="flex flex-col">
              {DFD_STEPS.map((s, i) => (
                <div key={i}>
                  <div className="rounded-xl p-4 flex items-start justify-between gap-3" style={{ background: 'var(--overlay-bg)', border: '1px solid var(--glass-border)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--accent-soft)' }}>{s.actor}</div>
                      <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{s.step}</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap flex-shrink-0">
                      {s.controls.map(ic => <span key={ic} className="ic-badge">{ic}</span>)}
                    </div>
                  </div>
                  {i < DFD_STEPS.length - 1 && (
                    <div className="flex justify-center py-1.5 text-lg" style={{ color: 'var(--accent-secondary)' }}>↓</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--app-text-dim)' }}>Klik menu navigasi atau gunakan panah ← →</span>
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
