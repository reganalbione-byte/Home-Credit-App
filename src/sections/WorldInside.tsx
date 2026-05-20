import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { toast } from 'sonner';
import {
  type Application,
  type SystemUser,
  type AuditEntry,
  formatIDR,
  formatTimestamp,
  describeUser,
  USERS,
  ROLE_LABELS,
} from '../lib/data';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface WorldInsideProps {
  isActive: boolean;
  applications: Application[];
  currentUser: SystemUser;
  onManualReviewDecision: (appId: string, decision: 'APPROVED' | 'REJECTED', notes: string) => void;
  onVoidApplication: (appId: string, reason: string) => void;
}

type Filter = 'ALL' | 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';

const ACTION_COLOR: Record<string, string> = {
  CREATED: '#6366F1',
  AUTO_DECISION: '#3B82F6',
  QUEUED_FOR_REVIEW: '#F59E0B',
  APPROVED: '#10B981',
  REJECTED: '#EF4444',
  VIEWED: '#94A3B8',
  VOIDED: '#EF4444',
};

const STAGE_COLOR: Record<number, string> = {
  1: '#10B981',
  2: '#F59E0B',
  3: '#EF4444',
};

function lastAction(app: Application): AuditEntry | undefined {
  return app.statusHistory[app.statusHistory.length - 1];
}

const csvCell = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function WorldInside({ isActive, applications, currentUser, onManualReviewDecision, onVoidApplication }: WorldInsideProps) {
  const hasAnimated = useRef(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [selectedRow, setSelectedRow] = useState<Application | null>(null);
  const [counts, setCounts] = useState({ total:0, approved:0, manual:0, rejected:0 });
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [voidMode, setVoidMode] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');

  // Voided records dikecualikan dari statistik/portofolio aktif, tapi tetap tampil di tabel (audit).
  const active = applications.filter(a => !a.voided);
  const approved = active.filter(a => a.decision === 'APPROVED');
  const manual = active.filter(a => a.decision === 'MANUAL_REVIEW');
  const rejected = active.filter(a => a.decision === 'REJECTED');

  const q = query.trim().toLowerCase();
  const tableRows = applications.filter(a => {
    const matchStatus = filter === 'ALL' || a.decision === filter;
    const matchQuery = !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  const totalDisbursed = approved.reduce((s, a) => s + a.loan, 0);
  const totalManualAmt = manual.reduce((s, a) => s + a.loan, 0);
  const totalActiveLoan = active.reduce((s, a) => s + a.loan, 0);

  useEffect(() => {
    if (!isActive) return;
    hasAnimated.current = false;
  }, [applications]);

  useEffect(() => {
    if (!selectedRow) return;
    const fresh = applications.find(a => a.id === selectedRow.id);
    if (fresh && fresh !== selectedRow) setSelectedRow(fresh);
  }, [applications]);

  useEffect(() => {
    setReviewNotes('');
    setReviewError('');
    setVoidMode(false);
    setVoidReason('');
    setVoidError('');
  }, [selectedRow?.id]);

  useEffect(() => {
    if (!isActive || hasAnimated.current) return;
    hasAnimated.current = true;
    const tl = gsap.timeline();
    tl.fromTo('.dash-header', { opacity:0, y:20 }, { opacity:1, y:0, duration:0.5 }, 0.1);
    tl.fromTo('.stat-card-anim', { opacity:0, y:30 }, { opacity:1, y:0, stagger:0.08, duration:0.4, ease:'power2.out' }, 0.3);
    tl.fromTo('.chart-wrap', { opacity:0, y:20 }, { opacity:1, y:0, stagger:0.1, duration:0.5, ease:'power2.out' }, 0.5);
    tl.fromTo('.table-wrap', { opacity:0, y:20 }, { opacity:1, y:0, duration:0.5, ease:'power2.out' }, 0.7);
    let t = 0; const end = Math.max(active.length, 1);
    const countTimer = setInterval(() => {
      t += 1;
      setCounts({
        total: Math.min(t, active.length),
        approved: Math.min(Math.ceil(t * approved.length / end), approved.length),
        manual: Math.min(Math.ceil(t * manual.length / end), manual.length),
        rejected: Math.min(Math.ceil(t * rejected.length / end), rejected.length),
      });
      if (t >= end) clearInterval(countTimer);
    }, 40);
    return () => { tl.kill(); clearInterval(countTimer); };
  }, [isActive]);

  const pieData = [
    { name: 'Approved', value: approved.length, color: '#10B981' },
    { name: 'Manual Review', value: manual.length, color: '#F59E0B' },
    { name: 'Rejected', value: rejected.length, color: '#EF4444' },
  ];
  const barData = active.map(a => ({
    name: a.name.split(' ')[0],
    amount: Math.round(a.loan / 1_000_000),
    fill: a.decision === 'APPROVED' ? '#10B981' : a.decision === 'MANUAL_REVIEW' ? '#F59E0B' : '#EF4444',
  }));

  const CustomTooltip = ({ active: act, payload }: any) => {
    if (!act || !payload?.length) return null;
    return (
      <div className="glass-card-static px-3 py-2 rounded-lg text-xs">
        <div className="text-[var(--app-text-muted)]">{payload[0].name}</div>
        <div className="text-[var(--app-text-strong)] font-bold">{payload[0].value}</div>
      </div>
    );
  };

  const canReview = currentUser.role === 'CREDIT_ANALYST' && selectedRow?.decision === 'MANUAL_REVIEW' && !selectedRow?.voided;
  const canVoid = currentUser.role === 'CREDIT_ANALYST' && !!selectedRow && !selectedRow.voided;

  const submitDecision = (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedRow) return;
    if (reviewNotes.trim().length < 8) {
      setReviewError('Alasan keputusan minimum 8 karakter (audit requirement)');
      return;
    }
    onManualReviewDecision(selectedRow.id, decision, reviewNotes.trim());
    setReviewNotes('');
    setReviewError('');
  };

  const submitVoid = () => {
    if (!selectedRow) return;
    if (voidReason.trim().length < 8) {
      setVoidError('Alasan void minimum 8 karakter (audit requirement)');
      return;
    }
    onVoidApplication(selectedRow.id, voidReason.trim());
    setVoidMode(false);
    setVoidReason('');
    setVoidError('');
  };

  const exportCSV = () => {
    const headers = ['ID','Nama','Pinjaman','Pendapatan','DTI %','Risk Score','Decision','ECL Stage','Voided','Created By','Created At','Last Action'];
    const rows = applications.map(a => {
      const last = lastAction(a);
      return [
        a.id, a.name, a.loan, a.income,
        ((a.dti ?? 0) * 100).toFixed(1), (a.riskScore ?? 0).toFixed(1),
        a.decision ?? '', a.eclStage ? `S${a.eclStage}` : '',
        a.voided ? 'YES' : 'NO',
        a.createdBy, a.createdAt, last ? `${last.action} @ ${last.at}` : '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`CSV diunduh (${applications.length} baris)`);
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden" style={{ paddingTop:'64px', background:'var(--cover-gradient)' }}>
      <div className="grid-overlay absolute inset-0 opacity-40"/>
      <div className="relative z-10 h-full px-6 md:px-16 py-6 overflow-y-auto space-y-5">

        {/* Header */}
        <div className="dash-header flex flex-wrap items-center justify-between gap-3" style={{ opacity:0 }}>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="ic-badge">IC-4: Dual Control</span>
              <span className="ic-badge">IC-5: Audit Trail</span>
              <span className="ic-badge">IC-7: Reconciliation</span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--app-text-strong)]">Loan Portfolio Dashboard</h2>
            <p className="text-xs text-[var(--app-text-dim)] mt-1">
              Active session: <span className="font-mono text-[var(--accent-soft)]">{currentUser.id}</span> · {ROLE_LABELS[currentUser.role]} —{' '}
              {currentUser.role === 'CREDIT_ANALYST'
                ? 'Anda dapat approve/reject & void cases.'
                : 'Read-only access; switch ke Credit Analyst untuk review cases.'}
            </p>
          </div>
          <div className="text-xs text-[var(--app-text-dim)]">Total Disbursed: <span className="text-[#10B981] font-bold text-sm">{formatIDR(totalDisbursed)}</span></div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'Total Applications', val: counts.total, sub: formatIDR(totalActiveLoan), color:'#6366F1' },
            { label:'Approved', val: counts.approved, sub: formatIDR(totalDisbursed), color:'#10B981' },
            { label:'Manual Review', val: counts.manual, sub: formatIDR(totalManualAmt), color:'#F59E0B' },
            { label:'Rejected', val: counts.rejected, sub: formatIDR(rejected.reduce((s,a)=>s+a.loan,0)), color:'#EF4444' },
          ].map(s => (
            <div key={s.label} className="stat-card-anim stat-card" style={{ opacity:0, borderTop:`2px solid ${s.color}40` }}>
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-2">{s.label}</div>
              <div className="text-3xl font-black mb-1" style={{ color:s.color }}>{s.val}</div>
              <div className="text-xs text-[var(--app-text-dim)]">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="chart-wrap md:col-span-2 glass-card-static rounded-2xl p-5" style={{ opacity:0 }}>
            <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-4">Status Distribution</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" animationBegin={0} animationDuration={1000}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent"/>)}
                </Pie>
                <Tooltip content={<CustomTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 flex-wrap">
              {pieData.map(p => (
                <div key={p.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background:p.color }}/>
                  <span className="text-xs text-[var(--app-text-dim)]">{p.name} ({p.value})</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-wrap md:col-span-3 glass-card-static rounded-2xl p-5" style={{ opacity:0 }}>
            <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-wider mb-4">Loan Amount by Applicant (juta IDR)</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--recharts-grid)"/>
                <XAxis dataKey="name" tick={{ fill:'var(--app-text-dim)', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'var(--app-text-dim)', fontSize:11 }} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="amount" radius={[4,4,0,0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap glass-card-static rounded-2xl overflow-hidden" style={{ opacity:0 }}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/5">
            <span className="text-sm font-semibold text-[var(--app-text-strong)]">All Applications · IC-5 Audit Trail</span>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="🔍 Cari nama / ID…"
                className="fintech-input"
                style={{ width: 180, padding: '6px 12px', fontSize: 12 }}
              />
              {(['ALL','APPROVED','MANUAL_REVIEW','REJECTED'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none transition-all"
                  style={{ background: filter===f ? 'rgba(99,102,241,0.18)' : 'var(--overlay-bg-soft)', color: filter===f ? 'var(--accent-soft)' : 'var(--app-text-dim)' }}>
                  {f.replace('_',' ')}
                </button>
              ))}
              <button onClick={exportCSV}
                className="text-xs px-3 py-1.5 rounded-lg cursor-pointer border-none transition-all"
                style={{ background:'rgba(16,185,129,0.12)', color:'#10B981', border:'1px solid rgba(16,185,129,0.3)' }}>
                ⬇ CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="fintech-table">
              <thead>
                <tr><th>#</th><th>ID</th><th>Nama</th><th>Pinjaman</th><th>DTI</th><th>Risk Score</th><th>Status</th><th>Stage</th><th>Created By</th><th>Last Action</th></tr>
              </thead>
              <tbody>
                {tableRows.map((a, i) => {
                  const sc = a.riskScore ?? 0;
                  const scoreColor = sc >= 60 ? '#10B981' : sc >= 40 ? '#F59E0B' : '#EF4444';
                  const last = lastAction(a);
                  const stageColor = a.eclStage ? STAGE_COLOR[a.eclStage] : '#94A3B8';
                  return (
                    <tr key={a.id} onClick={() => setSelectedRow(a)} style={{ cursor: 'pointer', opacity: a.voided ? 0.5 : 1 }}>
                      <td className="text-[var(--app-text-dim)]">{i+1}</td>
                      <td><span className="font-mono text-xs text-[#6366F1]">{a.id}</span></td>
                      <td className="font-medium text-[var(--app-text-strong)]">
                        <span style={{ textDecoration: a.voided ? 'line-through' : 'none' }}>{a.name}</span>
                      </td>
                      <td>{formatIDR(a.loan)}</td>
                      <td><span style={{ color: (a.dti??0) > 0.5 ? '#F59E0B' : '#94A3B8' }}>{((a.dti??0)*100).toFixed(1)}%</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width:`${sc}%`, background:scoreColor }}/>
                          </div>
                          <span className="font-mono text-xs" style={{ color:scoreColor }}>{sc.toFixed(1)}</span>
                        </div>
                      </td>
                      <td>
                        {a.voided ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background:'rgba(239,68,68,0.15)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.5)' }}>VOIDED</span>
                        ) : (
                          <span className={a.decision === 'APPROVED' ? 'badge-approved' : a.decision === 'MANUAL_REVIEW' ? 'badge-manual' : 'badge-rejected'}>
                            {a.decision?.replace('_',' ')}
                          </span>
                        )}
                      </td>
                      <td>
                        {a.eclStage && !a.voided ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: `${stageColor}1f`, color: stageColor, border: `1px solid ${stageColor}55` }}>
                            S{a.eclStage}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--app-text-dim)]">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[11px] font-mono text-[var(--app-text-muted)]">{a.createdBy}</span>
                          <span className="text-[10px] text-[var(--app-text-dim)]">{USERS[a.createdBy]?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td>
                        {last ? (
                          <div className="flex flex-col leading-tight">
                            <span className="text-[10px] font-bold uppercase" style={{ color: ACTION_COLOR[last.action] ?? 'var(--app-text-muted)' }}>
                              {last.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-[var(--app-text-dim)]">{formatTimestamp(last.at)}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--app-text-dim)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-xs text-[var(--app-text-dim)] py-8">Tidak ada aplikasi yang cocok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row detail modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" style={{ background:'var(--modal-backdrop)', backdropFilter:'blur(8px)' }} onClick={() => setSelectedRow(null)}>
          <div className="glass-card-static rounded-2xl p-7 w-full max-w-[640px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-[#6366F1]">{selectedRow.id}</span>
                  {selectedRow.voided ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background:'rgba(239,68,68,0.15)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.5)' }}>VOIDED</span>
                  ) : (
                    <span className={selectedRow.decision === 'APPROVED' ? 'badge-approved' : selectedRow.decision === 'MANUAL_REVIEW' ? 'badge-manual' : 'badge-rejected'}>
                      {selectedRow.decision?.replace('_',' ')}
                    </span>
                  )}
                  {selectedRow.eclStage && !selectedRow.voided && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{ background: `${STAGE_COLOR[selectedRow.eclStage]}1f`, color: STAGE_COLOR[selectedRow.eclStage], border: `1px solid ${STAGE_COLOR[selectedRow.eclStage]}55` }}>
                      PSAK 71 — Stage {selectedRow.eclStage}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-[var(--app-text-strong)]" style={{ textDecoration: selectedRow.voided ? 'line-through' : 'none' }}>{selectedRow.name}</h3>
              </div>
              <button onClick={() => setSelectedRow(null)} className="text-[var(--app-text-dim)] hover:text-[var(--app-text)] cursor-pointer bg-transparent border-none text-xl">×</button>
            </div>

            {selectedRow.voided && (
              <div className="mb-4 px-4 py-3 rounded-xl text-[11px]" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)' }}>
                <span className="font-semibold text-[#EF4444]">Record di-VOID (tidak dihapus — dipertahankan untuk audit).</span>
                {selectedRow.voidReason && <span className="text-[var(--app-text-muted)]"> Alasan: "{selectedRow.voidReason}"</span>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Left: facts */}
              <div>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 90 90" className="w-full h-full -rotate-90">
                      <circle cx="45" cy="45" r="38" fill="none" stroke="var(--overlay-bg)" strokeWidth="6"/>
                      <circle cx="45" cy="45" r="38" fill="none" strokeWidth="6" strokeLinecap="round"
                        stroke={(selectedRow.riskScore ?? 0) >= 60 ? '#10B981' : (selectedRow.riskScore ?? 0) >= 40 ? '#F59E0B' : '#EF4444'}
                        strokeDasharray="239" strokeDashoffset={239 - 239 * (selectedRow.riskScore ?? 0) / 100}/>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-black text-[var(--app-text-strong)]">{selectedRow.riskScore?.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                {[
                  ['Pinjaman', formatIDR(selectedRow.loan)],
                  ['Pendapatan/bln', formatIDR(selectedRow.income)],
                  ['DTI', `${((selectedRow.dti??0)*100).toFixed(1)}%`],
                  ['EXT Score', selectedRow.extScore.toFixed(2)],
                  ['Employment', `${selectedRow.empYears} thn`],
                  ['Purpose', selectedRow.purpose],
                ].map(([k,v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-[11px] text-[var(--app-text-dim)]">{k}</span>
                    <span className="text-[11px] text-[var(--app-text-muted)]">{v}</span>
                  </div>
                ))}
              </div>

              {/* Right: audit / IC-5 */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--app-text-dim)] mb-2 font-semibold">IC-5 Audit Trail</div>
                <div className="rounded-xl p-3 mb-3" style={{ background:'var(--overlay-bg-soft)' }}>
                  <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                    <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Created by</span><span className="font-mono text-[var(--app-text-muted)]">{describeUser(selectedRow.createdBy)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Created at</span><span className="font-mono text-[var(--app-text-muted)]">{formatTimestamp(selectedRow.createdAt)}</span></div>
                    {selectedRow.reviewedBy && (
                      <>
                        <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Reviewed by</span><span className="font-mono text-[var(--app-text-muted)]">{describeUser(selectedRow.reviewedBy)}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Reviewed at</span><span className="font-mono text-[var(--app-text-muted)]">{formatTimestamp(selectedRow.reviewedAt!)}</span></div>
                      </>
                    )}
                  </div>
                  {selectedRow.decisionNotes && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <div className="text-[10px] text-[var(--app-text-dim)] uppercase tracking-wider mb-1">Decision Notes</div>
                      <p className="text-[11px] text-[var(--app-text-muted)] italic">"{selectedRow.decisionNotes}"</p>
                    </div>
                  )}
                </div>

                <div className="text-[10px] uppercase tracking-widest text-[var(--app-text-dim)] mb-2 font-semibold">Status History (immutable log)</div>
                <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {selectedRow.statusHistory.map((e, i) => (
                    <div key={i} className="flex gap-2 items-start text-[11px] py-1.5 px-2 rounded-md" style={{ background:'var(--overlay-bg)' }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: ACTION_COLOR[e.action] ?? '#94A3B8' }}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold uppercase tracking-wider text-[10px]" style={{ color: ACTION_COLOR[e.action] ?? 'var(--app-text-muted)' }}>{e.action.replace(/_/g,' ')}</span>
                          <span className="text-[10px] text-[var(--app-text-dim)] font-mono">{formatTimestamp(e.at)}</span>
                        </div>
                        <div className="text-[10px] text-[var(--app-text-muted)] mt-0.5">by <span className="font-mono">{describeUser(e.by)}</span></div>
                        {e.reason && <div className="text-[10px] text-[var(--app-text-dim)] mt-0.5 italic">"{e.reason}"</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Approve / Reject — IC-4 Dual Control */}
            {selectedRow.decision === 'MANUAL_REVIEW' && !selectedRow.voided && (
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="ic-badge">IC-4: Dual Control</span>
                  <span className="text-[11px] text-[var(--app-text-dim)]">Aksi review hanya untuk Credit Analyst</span>
                </div>
                {canReview ? (
                  <>
                    <label className="text-[10px] uppercase tracking-widest text-[var(--app-text-dim)] block mb-1">Decision Notes (wajib, min. 8 karakter)</label>
                    <textarea
                      className="fintech-input"
                      rows={2}
                      placeholder="cth. Verifikasi slip gaji 3 bulan clear, tenor diperpanjang ke 72 bulan"
                      value={reviewNotes}
                      onChange={e => { setReviewNotes(e.target.value); setReviewError(''); }}
                    />
                    {reviewError && <p className="text-xs text-[#EF4444] mt-1">{reviewError}</p>}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => submitDecision('APPROVED')}
                        className="flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer border-none"
                        style={{ background:'rgba(16,185,129,0.15)', color:'#10B981', border:'1px solid rgba(16,185,129,0.4)' }}>
                        ✓ Approve
                      </button>
                      <button onClick={() => submitDecision('REJECTED')}
                        className="flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer border-none"
                        style={{ background:'rgba(239,68,68,0.12)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.4)' }}>
                        ✗ Reject
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="px-3 py-2.5 rounded-xl flex items-center gap-2 text-[11px]"
                    style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)' }}>
                    <span className="text-[#F59E0B]">🔒</span>
                    <span className="text-[var(--app-text-muted)]">
                      Role aktif kamu adalah <strong>{ROLE_LABELS[currentUser.role]}</strong>. Switch ke <strong>Credit Analyst</strong> dari navbar untuk approve/reject case ini.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Void / Batalkan — CRUD + IC-5 (record dipertahankan untuk audit) */}
            {canVoid && (
              <div className="mt-4 pt-4 border-t border-white/10">
                {!voidMode ? (
                  <button onClick={() => setVoidMode(true)}
                    className="text-xs px-4 py-2 rounded-lg cursor-pointer border-none"
                    style={{ background:'rgba(239,68,68,0.10)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.3)' }}>
                    🗑 Void Record (batalkan dengan alasan)
                  </button>
                ) : (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-[var(--app-text-dim)] block mb-1">Alasan Void (wajib, min. 8 karakter — masuk audit trail)</label>
                    <textarea
                      className="fintech-input"
                      rows={2}
                      placeholder="cth. Duplikat dari C012 / data nasabah salah input, dibatalkan"
                      value={voidReason}
                      onChange={e => { setVoidReason(e.target.value); setVoidError(''); }}
                    />
                    {voidError && <p className="text-xs text-[#EF4444] mt-1">{voidError}</p>}
                    <div className="flex gap-2 mt-3">
                      <button onClick={submitVoid}
                        className="flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer border-none"
                        style={{ background:'rgba(239,68,68,0.15)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.4)' }}>
                        Konfirmasi Void
                      </button>
                      <button onClick={() => { setVoidMode(false); setVoidReason(''); setVoidError(''); }}
                        className="flex-1 py-2.5 text-xs font-medium rounded-xl cursor-pointer border-none"
                        style={{ background:'var(--overlay-bg-soft)', color:'var(--app-text-muted)' }}>
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
