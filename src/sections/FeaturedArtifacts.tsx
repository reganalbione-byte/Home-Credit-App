import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { calculateRiskScore, formatIDR, type SystemUser } from '../lib/data';

interface FeaturedArtifactsProps {
  isActive: boolean;
  onResult: (result: any) => void;
  onNavigateToResult: () => void;
  currentUser: SystemUser;
}

const PURPOSES = ['Electronics','Home Repair','Car','Medical','Education','Business'];

interface FormErrors { [k: string]: string; }

export default function FeaturedArtifacts({ isActive, onResult, onNavigateToResult, currentUser }: FeaturedArtifactsProps) {
  const hasAnimated = useRef(false);
  const [form, setForm] = useState({ name:'', income:'', loan:'', purpose:'Electronics', empYears:'', extScore:'' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);

  const STEPS = ['Memvalidasi data aplikasi...','Menghitung rasio DTI...','Querying external credit score (SLIK OJK)...','Menghasilkan risk assessment...'];

  const canCreate = currentUser.role === 'LOAN_OFFICER';

  const liveIncome = parseFloat(form.income.replace(/\./g,'').replace(',','.')) || 0;
  const liveLoan = parseFloat(form.loan.replace(/\./g,'').replace(',','.')) || 0;
  const liveEmp = parseFloat(form.empYears) || 0;
  const liveExt = parseFloat(form.extScore) || 0;
  const liveDTI = liveIncome > 0 ? (liveLoan / 60) / liveIncome : 0;
  const liveEmpScore = Math.min(liveEmp / 10, 1.0);
  const liveRisk = liveIncome > 0 && liveLoan > 0 ? Math.max(0, Math.min(100, (liveExt * 0.5 + (1 - Math.min(liveDTI,1)) * 0.3 + liveEmpScore * 0.2) * 100)) : 0;

  useEffect(() => {
    if (!isActive || hasAnimated.current) return;
    hasAnimated.current = true;
    const tl = gsap.timeline();
    tl.fromTo('.form-header', { opacity:0, y:30 }, { opacity:1, y:0, duration:0.6, ease:'power2.out' }, 0.2);
    tl.fromTo('.form-card', { opacity:0, y:40 }, { opacity:1, y:0, duration:0.6, ease:'power2.out' }, 0.4);
    tl.fromTo('.preview-card', { opacity:0, x:40 }, { opacity:1, x:0, duration:0.6, ease:'power2.out' }, 0.5);
    return () => { tl.kill(); };
  }, [isActive]);

  const formatNum = (v: string) => {
    const n = v.replace(/\D/g,'');
    return n ? parseInt(n).toLocaleString('id-ID') : '';
  };

  const validate = () => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Nama wajib diisi';
    if (!form.income) e.income = 'Pendapatan wajib diisi';
    if (!form.loan) e.loan = 'Jumlah pinjaman wajib diisi';
    if (!form.empYears || isNaN(parseFloat(form.empYears))) e.empYears = 'Lama kerja wajib diisi';
    if (!form.extScore || isNaN(parseFloat(form.extScore)) || parseFloat(form.extScore) < 0 || parseFloat(form.extScore) > 1)
      e.extScore = 'Skor harus antara 0.00 - 1.00';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!canCreate) return;
    if (!validate()) {
      gsap.fromTo('.form-card', { x:-6 }, { x:0, duration:0.4, ease:'elastic.out(1,0.3)', keyframes:[{x:-6},{x:6},{x:-4},{x:4},{x:0}] });
      return;
    }
    setLoading(true); setLoadStep(0);
    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, 420));
      setLoadStep(i + 1);
    }
    await new Promise(r => setTimeout(r, 300));
    const income = parseFloat(form.income.replace(/\./g,''));
    const loan = parseFloat(form.loan.replace(/\./g,''));
    const res = calculateRiskScore(income, loan, parseFloat(form.empYears), parseFloat(form.extScore));
    onResult({
      name: form.name, income, loan, purpose: form.purpose,
      empYears: parseFloat(form.empYears), extScore: parseFloat(form.extScore),
      date: new Date().toISOString().slice(0,10),
      submittedBy: currentUser.id,
      ...res,
    });
    setLoading(false);
    onNavigateToResult();
    setForm({ name:'', income:'', loan:'', purpose:'Electronics', empYears:'', extScore:'' });
    hasAnimated.current = false;
  };

  const scoreColor = liveRisk >= 60 ? '#10B981' : liveRisk >= 40 ? '#F59E0B' : liveRisk > 0 ? '#EF4444' : 'var(--app-text-dim)';

  return (
    <div className="w-screen h-screen relative overflow-hidden" style={{ paddingTop:'64px', background:'var(--cover-gradient)' }}>
      <div className="grid-overlay absolute inset-0 opacity-40" />
      <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full pointer-events-none" style={{ background:'var(--radial-glow-blue)' }} />

      <div className="relative z-10 h-full flex flex-col px-16 py-8 overflow-y-auto">
        {/* Header */}
        <div className="form-header mb-8" style={{ opacity:0 }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="ic-badge">IC-1: Input Validation</span>
            <span className="ic-badge">IC-2: Automated Scoring</span>
            <span className="ic-badge">IC-5: Audit Trail</span>
            <span className="ic-badge">IC-6: DTI Hard Limit</span>
          </div>
          <h2 className="text-3xl font-bold text-[var(--app-text-strong)]">New Loan Application</h2>
          <p className="text-sm text-[var(--app-text-dim)] mt-1">
            Isi data nasabah untuk memulai asesmen risiko kredit otomatis.
            <span className="ml-2 text-[var(--accent-soft)]">Created by: <span className="font-mono">{currentUser.id} — {currentUser.name}</span></span>
          </p>
        </div>

        {!canCreate && (
          <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)' }}>
            <span className="text-[#F59E0B]">🔒</span>
            <div className="text-xs">
              <div className="font-semibold text-[#FBBF24]">Read-only: Hanya Loan Officer yang berhak input aplikasi baru</div>
              <div className="text-[var(--app-text-dim)] mt-0.5">
                Role aktif kamu adalah <strong>{currentUser.name}</strong>. Switch ke Loan Officer dari menu navbar (kanan atas) untuk membuat aplikasi.
                <span className="ml-1 text-[var(--accent-soft)]">— IC-4 Segregation of Duties</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-8 flex-1 min-h-0">
          {/* Form */}
          <div className="form-card flex-1 glass-card-static p-8 rounded-2xl" style={{ opacity:0 }}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center relative"
                  style={{ background:'rgba(99,102,241,0.1)', border:'2px solid rgba(99,102,241,0.3)' }}>
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor:'#6366F1', borderTopColor:'transparent' }} />
                </div>
                <div className="text-center">
                  <p className="text-[var(--app-text-strong)] font-medium mb-4">Memproses Aplikasi...</p>
                  <div className="flex flex-col gap-2 text-left">
                    {STEPS.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        {loadStep > i
                          ? <span className="text-[#10B981]">✓</span>
                          : loadStep === i
                          ? <span className="animate-spin text-[#6366F1]">◐</span>
                          : <span className="text-[var(--app-text-dim)]">○</span>}
                        <span style={{ color: loadStep > i ? '#10B981' : loadStep === i ? '#a5b4fc' : '#475569' }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <fieldset disabled={!canCreate} style={{ border: 'none', padding: 0, opacity: canCreate ? 1 : 0.5 }}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-2 block">Nama Lengkap Nasabah *</label>
                    <input className="fintech-input" placeholder="cth. Budi Santoso" value={form.name}
                      onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                    {errors.name && <p className="text-xs text-[#EF4444] mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-2 block">Pendapatan per Bulan (Rp) *</label>
                    <input className="fintech-input" placeholder="cth. 8.000.000" value={form.income}
                      onChange={e => setForm(f => ({...f, income: formatNum(e.target.value)}))} />
                    {liveIncome > 0 && <p className="text-xs text-[#6366F1] mt-1">{formatIDR(liveIncome)}</p>}
                    {errors.income && <p className="text-xs text-[#EF4444] mt-1">{errors.income}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-2 block">Jumlah Pinjaman (Rp) *</label>
                    <input className="fintech-input" placeholder="cth. 50.000.000" value={form.loan}
                      onChange={e => setForm(f => ({...f, loan: formatNum(e.target.value)}))} />
                    {liveLoan > 0 && <p className="text-xs text-[#6366F1] mt-1">{formatIDR(liveLoan)}</p>}
                    {errors.loan && <p className="text-xs text-[#EF4444] mt-1">{errors.loan}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-2 block">Tujuan Pinjaman</label>
                    <select className="fintech-select" value={form.purpose} onChange={e => setForm(f => ({...f, purpose: e.target.value}))}>
                      {PURPOSES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-2 block">Lama Bekerja (Tahun) *</label>
                    <input className="fintech-input" type="number" step="0.5" min="0" placeholder="cth. 5" value={form.empYears}
                      onChange={e => setForm(f => ({...f, empYears: e.target.value}))} />
                    {errors.empYears && <p className="text-xs text-[#EF4444] mt-1">{errors.empYears}</p>}
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-2 block">
                      External Credit Score (0.00 – 1.00) *
                      <span className="ml-2 text-[#6366F1] normal-case">— dari BI Checking / SLIK OJK</span>
                    </label>
                    <input className="fintech-input" type="number" step="0.01" min="0" max="1" placeholder="cth. 0.72" value={form.extScore}
                      onChange={e => setForm(f => ({...f, extScore: e.target.value}))} />
                    {errors.extScore && <p className="text-xs text-[#EF4444] mt-1">{errors.extScore}</p>}
                  </div>
                  <div className="col-span-2 pt-2">
                    <button onClick={handleSubmit} className="btn-gradient w-full py-4 text-sm font-semibold flex items-center justify-center gap-3"
                      style={{ cursor: canCreate ? 'pointer' : 'not-allowed' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                        <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Hitung Risk Score
                    </button>
                    <p className="text-xs text-[var(--app-text-dim)] text-center mt-3">Skor dihitung otomatis berdasarkan formula tertimbang — <span className="text-[var(--accent-soft)]">IC-2: Automated Scoring</span></p>
                  </div>
                </div>
              </fieldset>
            )}
          </div>

          {/* Live Preview */}
          <div className="preview-card w-72 flex flex-col gap-4" style={{ opacity:0 }}>
            <div className="glass-card-static p-6 rounded-2xl">
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-4">Live Score Preview</div>
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-24 h-24 mb-3">
                  <svg viewBox="0 0 90 90" className="w-full h-full -rotate-90">
                    <circle cx="45" cy="45" r="38" fill="none" stroke="var(--overlay-bg)" strokeWidth="6"/>
                    <circle cx="45" cy="45" r="38" fill="none" stroke={scoreColor} strokeWidth="6"
                      strokeLinecap="round" strokeDasharray="239"
                      strokeDashoffset={239 - (239 * liveRisk / 100)} style={{ transition:'stroke-dashoffset 0.3s,stroke 0.3s' }}/>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-[var(--app-text-strong)]">{Math.round(liveRisk)}</span>
                    <span className="text-xs text-[var(--app-text-dim)]">/ 100</span>
                  </div>
                </div>
                <span className="text-sm font-semibold" style={{ color: scoreColor }}>
                  {liveRisk >= 60 ? '✓ APPROVED' : liveRisk >= 40 && liveRisk > 0 ? '⚠ MANUAL REVIEW' : liveRisk > 0 ? '✗ REJECTED' : '— Belum dihitung'}
                </span>
              </div>
              {[
                { label: 'External Score (50%)', val: liveExt * 100, color: '#6366F1' },
                { label: 'DTI Inverted (30%)', val: Math.max(0, (1 - Math.min(liveDTI, 1)) * 100), color: '#3B82F6' },
                { label: 'Employment (20%)', val: liveEmpScore * 100, color: '#06B6D4' },
              ].map(f => (
                <div key={f.label} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--app-text-dim)]">{f.label}</span>
                    <span className="text-[var(--app-text-muted)]">{Math.round(f.val)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background:'var(--overlay-bg)' }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width:`${f.val}%`, background:f.color }} />
                  </div>
                </div>
              ))}
            </div>
            {liveDTI > 0.5 && (
              <div className="glass-card-static p-4 rounded-xl" style={{ borderColor:'rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.08)' }}>
                <div className="flex items-start gap-2">
                  <span className="text-[#F59E0B] text-sm">⚠</span>
                  <div>
                    <div className="text-xs font-semibold text-[#FBBF24] mb-1">IC-6: DTI Limit Terlampaui</div>
                    <div className="text-xs text-[var(--app-text-muted)]">DTI {(liveDTI * 100).toFixed(1)}% &gt; 50%. Aplikasi otomatis ke Manual Review.</div>
                  </div>
                </div>
              </div>
            )}
            <div className="glass-card-static p-4 rounded-xl">
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-3">Formula Scoring</div>
              <div className="font-mono text-xs text-[var(--app-text-muted)] leading-relaxed">
                <div className="text-[var(--accent-soft)] mb-1">Risk Score =</div>
                <div className="pl-2">EXT × <span className="text-[#6366F1]">0.50</span></div>
                <div className="pl-2">+ (1-DTI) × <span className="text-[#3B82F6]">0.30</span></div>
                <div className="pl-2">+ EMP × <span className="text-[#06B6D4]">0.20</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
