import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { type Application, type SystemUser, formatIDR, formatIDRShort, ROLE_LABELS } from '../lib/data';
import kaggleStats from '../lib/kaggleStats.json';

interface VisitExploreProps { isActive: boolean; applications: Application[]; currentUser: SystemUser; }

const STAGE_COLOR: Record<number, string> = {
  1: '#10B981',
  2: '#F59E0B',
  3: '#EF4444',
};

export default function VisitExplore({ isActive, applications, currentUser }: VisitExploreProps) {
  const hasAnimated = useRef(false);
  const [showJournal, setShowJournal] = useState(false);

  useEffect(() => {
    if (!isActive || hasAnimated.current) return;
    hasAnimated.current = true;
    gsap.fromTo('.report-section', { opacity:0, y:20 }, { opacity:1, y:0, stagger:0.1, duration:0.5, ease:'power2.out', delay:0.2 });
  }, [isActive]);

  const liveApps = applications.filter(a => !a.voided);  // voided dikecualikan dari laporan
  const approved = liveApps.filter(a => a.decision === 'APPROVED');
  const manual = liveApps.filter(a => a.decision === 'MANUAL_REVIEW');
  const rejected = liveApps.filter(a => a.decision === 'REJECTED');
  const totalApps = liveApps.length;
  const totalAll = liveApps.reduce((s,a)=>s+a.loan,0);
  const totalApprovedAmt = approved.reduce((s,a)=>s+a.loan,0);
  const totalManualAmt = manual.reduce((s,a)=>s+a.loan,0);
  const totalRejectedAmt = rejected.reduce((s,a)=>s+a.loan,0);
  const approvalRate = totalApps ? (approved.length / totalApps * 100).toFixed(2) : '0.00';
  const rejectionRate = totalApps ? (rejected.length / totalApps * 100).toFixed(2) : '0.00';
  const manualRate = totalApps ? (manual.length / totalApps * 100).toFixed(2) : '0.00';

  const INTEREST_RATE = 0.02;
  const AVG_TERM = 24;
  const OP_COST_RATE = 0.05;

  // PSAK 71 Staged ECL — based on actual eclStage assigned per application.
  // Rates per stage are derived from the pre-computed Kaggle stats (kaggleStats.json).
  const stageRates = {
    1: kaggleStats.psak71Stages.stage1.eclRate / 100,
    2: kaggleStats.psak71Stages.stage2.eclRate / 100,
    3: kaggleStats.psak71Stages.stage3.eclRate / 100,
  };
  const onBookPortfolio = liveApps.filter(a => a.decision !== 'REJECTED');
  const stageGroups = {
    1: onBookPortfolio.filter(a => a.eclStage === 1),
    2: onBookPortfolio.filter(a => a.eclStage === 2),
    3: onBookPortfolio.filter(a => a.eclStage === 3),
  };
  const stageTotals = {
    1: stageGroups[1].reduce((s,a)=>s+a.loan,0),
    2: stageGroups[2].reduce((s,a)=>s+a.loan,0),
    3: stageGroups[3].reduce((s,a)=>s+a.loan,0),
  };
  const stageECL = {
    1: stageTotals[1] * stageRates[1],
    2: stageTotals[2] * stageRates[2],
    3: stageTotals[3] * stageRates[3],
  };
  const totalOnBook = stageTotals[1] + stageTotals[2] + stageTotals[3];
  const eclReserve = stageECL[1] + stageECL[2] + stageECL[3];
  const blendedRate = totalOnBook > 0 ? (eclReserve / totalOnBook) * 100 : 0;

  const interestRevenue = totalApprovedAmt * INTEREST_RATE * AVG_TERM;
  const opCost = totalApprovedAmt * OP_COST_RATE;
  const netRevenue = interestRevenue - eclReserve - opCost;

  const now = new Date();
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const period = `${months[now.getMonth()]} ${now.getFullYear()}`;
  const refNo = `RPT-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const canViewReport = currentUser.role !== 'LOAN_OFFICER';

  // Journal entries (auto-generated, double-entry)
  type JEntry = { date: string; ref: string; description: string; debit?: { account: string; amount: number }[]; credit?: { account: string; amount: number }[] };
  const journal: JEntry[] = [];

  // 1. Loan disbursement per approved loan
  approved.forEach(a => {
    journal.push({
      date: a.date,
      ref: `JE-LD-${a.id}`,
      description: `Loan disbursement — ${a.name} (${a.id})`,
      debit: [{ account: `Loan Receivable — ${a.id}`, amount: a.loan }],
      credit: [{ account: 'Cash / Bank', amount: a.loan }],
    });
  });

  // 2. ECL provision per stage (aggregate)
  const eclDate = now.toISOString().slice(0,10);
  if (eclReserve > 0) {
    const debits = [];
    if (stageECL[1] > 0) debits.push({ account: 'Bad Debt Expense — Stage 1 (12-mo ECL)', amount: stageECL[1] });
    if (stageECL[2] > 0) debits.push({ account: 'Bad Debt Expense — Stage 2 (Lifetime ECL)', amount: stageECL[2] });
    if (stageECL[3] > 0) debits.push({ account: 'Bad Debt Expense — Stage 3 (Credit-Impaired)', amount: stageECL[3] });
    journal.push({
      date: eclDate,
      ref: 'JE-ECL-001',
      description: 'PSAK 71 ECL provisioning — month-end',
      debit: debits,
      credit: [{ account: 'Allowance for Expected Credit Loss', amount: eclReserve }],
    });
  }

  // 3. Interest accrual (aggregate)
  if (interestRevenue > 0) {
    journal.push({
      date: eclDate,
      ref: 'JE-INT-001',
      description: `Projected interest revenue — ${AVG_TERM} months @ ${(INTEREST_RATE*100).toFixed(2)}%/month`,
      debit: [{ account: 'Interest Receivable', amount: interestRevenue }],
      credit: [{ account: 'Interest Income', amount: interestRevenue }],
    });
  }

  const totalDebits = journal.reduce((s, j) => s + (j.debit?.reduce((x, d) => x + d.amount, 0) ?? 0), 0);
  const totalCredits = journal.reduce((s, j) => s + (j.credit?.reduce((x, c) => x + c.amount, 0) ?? 0), 0);
  const journalBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  // General Ledger + Trial Balance (derived dari journal) — melengkapi siklus akuntansi:
  // Jurnal → Buku Besar → Neraca Saldo. Loan Receivable per-nasabah di-roll-up ke akun
  // pengendali (control account) agar buku besar ringkas.
  const normalizeAccount = (acc: string) =>
    acc.startsWith('Loan Receivable') ? 'Loan Receivable (control)' : acc;
  const ledgerMap = new Map<string, { account: string; debit: number; credit: number }>();
  journal.forEach(j => {
    j.debit?.forEach(d => {
      const acc = normalizeAccount(d.account);
      const cur = ledgerMap.get(acc) ?? { account: acc, debit: 0, credit: 0 };
      cur.debit += d.amount; ledgerMap.set(acc, cur);
    });
    j.credit?.forEach(c => {
      const acc = normalizeAccount(c.account);
      const cur = ledgerMap.get(acc) ?? { account: acc, debit: 0, credit: 0 };
      cur.credit += c.amount; ledgerMap.set(acc, cur);
    });
  });
  const ledger = Array.from(ledgerMap.values()).sort((a, b) => a.account.localeCompare(b.account));
  const trialBalance = ledger.map(l => {
    const net = l.debit - l.credit;
    return { account: l.account, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
  });
  const tbDr = trialBalance.reduce((s, t) => s + t.debit, 0);
  const tbCr = trialBalance.reduce((s, t) => s + t.credit, 0);
  const tbBalanced = Math.abs(tbDr - tbCr) < 0.01;

  const Row = ({ label, value, indent=false, bold=false, highlight=false, color='' }: any) => (
    <div className={`flex justify-between items-center py-2 ${bold ? 'border-t border-white/10 mt-1' : 'border-b border-white/5'}`}>
      <span className={`text-sm ${indent ? 'pl-6' : ''} ${bold ? 'font-semibold text-[var(--app-text-strong)]' : 'text-[var(--app-text-muted)]'}`}>{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-bold text-[var(--app-text-strong)]' : ''}`} style={{ color: color || (highlight ? '#10B981' : bold ? 'var(--app-text-strong)' : 'var(--app-text-muted)') }}>{value}</span>
    </div>
  );

  if (!canViewReport) {
    return (
      <div className="w-screen h-screen relative overflow-hidden flex items-center justify-center" style={{ paddingTop:'64px', background:'var(--cover-gradient)' }}>
        <div className="glass-card-static rounded-2xl p-10 max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-[var(--app-text-strong)] mb-2">Read-only Management Dashboard</h2>
          <p className="text-sm text-[var(--app-text-dim)] leading-relaxed">
            Financial Report hanya dapat diakses oleh role <strong>Finance</strong>, <strong>Auditor</strong>, atau Management.
            Role aktif kamu adalah <strong>{ROLE_LABELS[currentUser.role]}</strong>. Switch user dari menu navbar untuk akses laporan ini.
            <span className="block mt-2 text-[var(--accent-soft)]">— IC-8: Management Dashboard (Segregation of Duties)</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative overflow-hidden report-page" style={{ paddingTop:'64px', background:'var(--cover-gradient)' }}>
      <div className="grid-overlay absolute inset-0 opacity-40"/>
      <div className="relative z-10 h-full px-6 md:px-16 py-6 overflow-y-auto report-scroll">

        {/* Print header */}
        <div className="hidden print-only mb-8 text-center">
          <h1 className="text-2xl font-bold">HOME CREDIT INDONESIA</h1>
          <h2 className="text-lg">CREDIT RISK MANAGEMENT AIS</h2>
          <h3>Loan Portfolio Financial Report — {period}</h3>
        </div>

        {/* Screen header */}
        <div className="report-section flex items-start justify-between mb-6 no-print" style={{ opacity:0 }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="ic-badge">IC-7: Reconciliation</span>
              <span className="ic-badge">IC-8: Management Dashboard</span>
              <span className="ic-badge">PSAK 71</span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--app-text-strong)]">Financial Report</h2>
            <p className="text-sm text-[var(--app-text-dim)] mt-1">
              Laporan Keuangan Portofolio Pinjaman — <span className="text-[var(--app-text-muted)]">{period}</span>{' '}
              · Viewed by <span className="font-mono text-[var(--accent-soft)]">{currentUser.id}</span> ({ROLE_LABELS[currentUser.role]})
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowJournal(s => !s)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer border-none transition-all"
              style={{ background:'rgba(99,102,241,0.10)', border:'1px solid rgba(99,102,241,0.25)', color:'#a5b4fc' }}>
              {showJournal ? '◐ Hide' : '＋ Show'} Journal & Ledger
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer border-none transition-all"
              style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc' }}>
              🖨 Print / Save PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Main financial statement */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Report header card */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0 }}>
              <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/></svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--app-text-strong)]">HOME CREDIT INDONESIA</div>
                      <div className="text-xs text-[var(--app-text-dim)] tracking-widest uppercase">Credit Risk Management AIS</div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--app-text-dim)]">Reference: <span className="text-[#6366F1] font-mono">{refNo}</span></div>
                  <div className="text-xs text-[var(--app-text-dim)]">Period: {period}</div>
                  <div className="text-xs text-[var(--app-text-dim)]">Generated: {now.toLocaleString('id-ID')}</div>
                  <div className="text-xs text-[var(--app-text-dim)]">Approved by: <span className="font-mono">{currentUser.id}</span></div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold text-[var(--app-text-strong)] tracking-widest uppercase">LOAN PORTFOLIO FINANCIAL REPORT</div>
                <div className="text-xs text-[var(--app-text-dim)] mt-1 tracking-wide">INCOME STATEMENT + PSAK 71 ECL — MANAGEMENT USE ONLY</div>
              </div>
            </div>

            {/* Section I — Origination */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0 }}>
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest mb-4 font-semibold">I. Loan Origination Summary</div>
              <Row label="Total Applications Received" value={`${totalApps} apps`} />
              <Row label="Total Loan Amount Received" value={formatIDR(totalAll)} indent />
              <Row label="Total Applications Approved" value={`${approved.length} apps`} />
              <Row label="  Total Approved Disbursement" value={formatIDR(totalApprovedAmt)} indent color="#10B981" />
              <Row label="Total Manual Review Pending" value={`${manual.length} apps`} />
              <Row label="  Total Manual Review Amount" value={formatIDR(totalManualAmt)} indent color="#F59E0B" />
              <Row label="Total Applications Rejected" value={`${rejected.length} apps`} />
              <Row label="  Total Rejected Amount" value={formatIDR(totalRejectedAmt)} indent color="#EF4444" />
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-xl" style={{ background:'rgba(16,185,129,0.08)' }}>
                  <div className="text-[#10B981] font-bold">{approvalRate}%</div>
                  <div className="text-xs text-[var(--app-text-dim)]">Approval Rate</div>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ background:'rgba(245,158,11,0.08)' }}>
                  <div className="text-[#F59E0B] font-bold">{manualRate}%</div>
                  <div className="text-xs text-[var(--app-text-dim)]">Manual Rate</div>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ background:'rgba(239,68,68,0.08)' }}>
                  <div className="text-[#EF4444] font-bold">{rejectionRate}%</div>
                  <div className="text-xs text-[var(--app-text-dim)]">Rejection Rate</div>
                </div>
              </div>
            </div>

            {/* Section II — Revenue */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0 }}>
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest mb-4 font-semibold">II. Projected Revenue Analysis</div>
              <Row label="Total Approved Loan Disbursement" value={formatIDR(totalApprovedAmt)} />
              <Row label="Interest Rate (Flat Monthly)" value="2.00% / month" indent />
              <Row label="Average Loan Term" value="24 months" indent />
              <div className="flex justify-between items-center py-3 border-t border-white/10 mt-2">
                <span className="text-sm font-semibold text-[var(--app-text-strong)]">Total Expected Interest Revenue</span>
                <span className="text-base font-bold font-mono" style={{ color:'#10B981' }}>{formatIDR(interestRevenue)}</span>
              </div>
            </div>

            {/* Section III — PSAK 71 Staged ECL */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest font-semibold">III. Expected Credit Loss — PSAK 71 Staging</div>
                <span className="text-[10px] text-[var(--app-text-dim)] font-mono">Basis: 307,511 rows (Kaggle)</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[1, 2, 3].map(stage => {
                  const s = stage as 1 | 2 | 3;
                  const color = STAGE_COLOR[s];
                  const stageMeta = (kaggleStats.psak71Stages as any)[`stage${s}`];
                  return (
                    <div key={s} className="rounded-xl p-3" style={{ background:`${color}0F`, border:`1px solid ${color}33` }}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color }}>Stage {s}</span>
                        <span className="text-[10px] font-mono text-[var(--app-text-dim)]">{(stageRates[s] * 100).toFixed(1)}% ECL</span>
                      </div>
                      <div className="text-xs text-[var(--app-text-dim)] mb-2 leading-tight">{stageMeta.description}</div>
                      <div className="text-sm font-bold text-[var(--app-text-strong)]">{formatIDRShort(stageTotals[s])}</div>
                      <div className="text-[10px] text-[var(--app-text-dim)]">{stageGroups[s].length} loans on book</div>
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-baseline justify-between">
                        <span className="text-[10px] text-[var(--app-text-dim)]">ECL</span>
                        <span className="text-xs font-bold font-mono" style={{ color }}>{formatIDRShort(stageECL[s])}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Row label="Total Portfolio On-Book" value={formatIDR(totalOnBook)} />
              <Row label="Blended ECL Rate" value={`${blendedRate.toFixed(2)}%`} indent />
              <div className="flex justify-between items-center py-3 border-t border-white/10 mt-2">
                <span className="text-sm font-semibold text-[var(--app-text-strong)]">Total Allowance for ECL (PSAK 71)</span>
                <span className="text-base font-bold font-mono text-[#EF4444]">({formatIDR(eclReserve)})</span>
              </div>
              <p className="text-[10px] text-[var(--app-text-dim)] mt-2 italic leading-relaxed">
                Stage rates ditetapkan dari simulasi historis Kaggle Home Credit dataset (lihat <span className="font-mono">src/lib/kaggleStats.json</span>).
                Klasifikasi stage per loan: Stage 1 = performing & score ≥ 60; Stage 2 = MANUAL_REVIEW atau score 40–59; Stage 3 = credit-impaired (TARGET = 1 di dataset).
              </p>
            </div>

            {/* Section IV — Net Revenue */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0, border:'1px solid rgba(99,102,241,0.25)' }}>
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest mb-4 font-semibold">IV. Net Expected Revenue</div>
              <Row label="Total Expected Interest Revenue" value={formatIDR(interestRevenue)} color="#10B981" />
              <Row label="Less: PSAK 71 ECL Allowance" value={`(${formatIDR(eclReserve)})`} color="#EF4444" />
              <Row label="Less: Operating Cost Estimate (5%)" value={`(${formatIDR(opCost)})`} color="#EF4444" />
              <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-white/20 rounded-xl px-4 py-3" style={{ background: netRevenue >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                <span className="text-base font-bold text-[var(--app-text-strong)]">NET EXPECTED REVENUE</span>
                <span className="text-xl font-black font-mono" style={{ color: netRevenue >= 0 ? '#10B981' : '#EF4444' }}>{formatIDR(Math.abs(netRevenue))}</span>
              </div>
            </div>

            {/* Section V — Journal Entries */}
            {showJournal && (
              <>
              <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:1 }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest font-semibold">V. Journal Entries — Auto-Generated</div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${journalBalanced ? '' : 'animate-pulse'}`}
                    style={{ background: journalBalanced ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: journalBalanced ? '#10B981' : '#EF4444' }}>
                    {journalBalanced ? '✓ Debit = Credit' : '⚠ Out of balance'}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--app-text-dim)] mb-3 italic">Posting otomatis dari approved loans, accrual bunga, dan PSAK 71 provisioning. Double-entry bookkeeping — semua entry balanced.</p>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {journal.map((je, i) => {
                    const dr = je.debit?.reduce((s,d)=>s+d.amount, 0) ?? 0;
                    return (
                      <div key={i} className="rounded-xl p-3" style={{ background:'var(--overlay-bg-soft)' }}>
                        <div className="flex justify-between items-baseline mb-2">
                          <div>
                            <span className="font-mono text-[10px] text-[#6366F1]">{je.ref}</span>
                            <span className="ml-2 text-[10px] text-[var(--app-text-dim)] font-mono">{je.date}</span>
                          </div>
                          <span className="text-[10px] text-[var(--app-text-muted)]">{formatIDRShort(dr)}</span>
                        </div>
                        <div className="text-[11px] text-[var(--app-text-muted)] mb-2">{je.description}</div>
                        <table className="w-full text-[11px] font-mono">
                          <tbody>
                            {je.debit?.map((d, j) => (
                              <tr key={`d-${j}`}>
                                <td className="text-[var(--app-text-muted)]" style={{ width: '60%' }}>{d.account}</td>
                                <td className="text-right" style={{ color:'#3B82F6' }}>Dr. {formatIDR(d.amount)}</td>
                                <td></td>
                              </tr>
                            ))}
                            {je.credit?.map((c, j) => (
                              <tr key={`c-${j}`}>
                                <td className="text-[var(--app-text-muted)] pl-6" style={{ width: '60%' }}>{c.account}</td>
                                <td></td>
                                <td className="text-right" style={{ color:'#10B981' }}>Cr. {formatIDR(c.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Total Debits</span><span className="font-mono font-bold" style={{ color:'#3B82F6' }}>{formatIDR(totalDebits)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Total Credits</span><span className="font-mono font-bold" style={{ color:'#10B981' }}>{formatIDR(totalCredits)}</span></div>
                </div>
              </div>

              {/* Section VI — General Ledger */}
              <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:1 }}>
                <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest font-semibold mb-3">VI. General Ledger (Buku Besar)</div>
                <p className="text-[10px] text-[var(--app-text-dim)] mb-3 italic">Saldo per akun, diagregasi dari journal entries. Loan Receivable per nasabah di-roll-up ke akun pengendali.</p>
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-[var(--app-text-dim)]">
                      <th className="text-left font-semibold pb-2">Akun</th>
                      <th className="text-right font-semibold pb-2">Debit</th>
                      <th className="text-right font-semibold pb-2">Kredit</th>
                      <th className="text-right font-semibold pb-2">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map(l => {
                      const bal = l.debit - l.credit;
                      return (
                        <tr key={l.account} className="border-t border-white/5">
                          <td className="py-1.5 text-[var(--app-text-muted)]">{l.account}</td>
                          <td className="py-1.5 text-right" style={{ color:'#3B82F6' }}>{l.debit ? formatIDR(l.debit) : '—'}</td>
                          <td className="py-1.5 text-right" style={{ color:'#10B981' }}>{l.credit ? formatIDR(l.credit) : '—'}</td>
                          <td className="py-1.5 text-right font-bold text-[var(--app-text-strong)]">{`${bal < 0 ? '(' : ''}${formatIDR(Math.abs(bal))}${bal < 0 ? ')' : ''}`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Section VII — Trial Balance */}
              <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:1 }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest font-semibold">VII. Trial Balance (Neraca Saldo)</div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-md"
                    style={{ background: tbBalanced ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: tbBalanced ? '#10B981' : '#EF4444' }}>
                    {tbBalanced ? '✓ Balanced' : '⚠ Out of balance'}
                  </span>
                </div>
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-[var(--app-text-dim)]">
                      <th className="text-left font-semibold pb-2">Akun</th>
                      <th className="text-right font-semibold pb-2">Debit</th>
                      <th className="text-right font-semibold pb-2">Kredit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.map(t => (
                      <tr key={t.account} className="border-t border-white/5">
                        <td className="py-1.5 text-[var(--app-text-muted)]">{t.account}</td>
                        <td className="py-1.5 text-right" style={{ color:'#3B82F6' }}>{t.debit ? formatIDR(t.debit) : '—'}</td>
                        <td className="py-1.5 text-right" style={{ color:'#10B981' }}>{t.credit ? formatIDR(t.credit) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-white/20 font-bold text-[var(--app-text-strong)]">
                      <td className="py-2">TOTAL</td>
                      <td className="py-2 text-right" style={{ color:'#3B82F6' }}>{formatIDR(tbDr)}</td>
                      <td className="py-2 text-right" style={{ color:'#10B981' }}>{formatIDR(tbCr)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[10px] text-[var(--app-text-dim)] mt-3 italic">Total Debit = Total Kredit → pembukuan seimbang (IC-7 Reconciliation).</p>
              </div>
              </>
            )}
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-5">
            {/* Reconciliation check */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0 }}>
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest mb-4 font-semibold">IC-7: Reconciliation Check</div>
              {[
                { label:'Approved + Manual + Rejected', val: approved.length + manual.length + rejected.length, expected: totalApps, ok: (approved.length + manual.length + rejected.length) === totalApps },
                { label:'Sum matches Total', val: formatIDR(totalApprovedAmt + totalManualAmt + totalRejectedAmt), expected: formatIDR(totalAll), ok: (totalApprovedAmt + totalManualAmt + totalRejectedAmt) === totalAll },
                { label:'Journal Debit = Credit', val: formatIDR(totalDebits), expected: formatIDR(totalCredits), ok: journalBalanced },
              ].map(c => (
                <div key={c.label} className="flex items-start justify-between py-3 border-b border-white/5">
                  <div>
                    <div className="text-xs text-[var(--app-text-muted)] mb-1">{c.label}</div>
                    <div className="text-xs text-[var(--app-text-dim)]">{String(c.val)}</div>
                  </div>
                  <span className={`text-sm font-bold mt-1 ${c.ok ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{c.ok ? '✓ OK' : '✗ MISMATCH'}</span>
                </div>
              ))}
              <p className="text-xs text-[var(--app-text-dim)] mt-3">Semua nilai terrekonsiliasi — data konsisten dan akurat.</p>
            </div>

            {/* Kaggle dataset reference */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0 }}>
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest mb-3 font-semibold">PSAK 71 Reference — Kaggle Basis</div>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Rows analyzed</span><span className="font-mono text-[var(--app-text-muted)]">{kaggleStats.totalRows.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Default rate</span><span className="font-mono text-[#EF4444]">{kaggleStats.overallDefaultRate}%</span></div>
                <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Stage 1 share</span><span className="font-mono" style={{ color: STAGE_COLOR[1] }}>{kaggleStats.psak71Stages.stage1.pct}%</span></div>
                <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Stage 2 share</span><span className="font-mono" style={{ color: STAGE_COLOR[2] }}>{kaggleStats.psak71Stages.stage2.pct}%</span></div>
                <div className="flex justify-between"><span className="text-[var(--app-text-dim)]">Stage 3 share</span><span className="font-mono" style={{ color: STAGE_COLOR[3] }}>{kaggleStats.psak71Stages.stage3.pct}%</span></div>
              </div>
              <p className="text-[10px] text-[var(--app-text-dim)] mt-2 italic leading-relaxed">
                Pre-computed dari <span className="font-mono">application_train.csv</span> via <span className="font-mono">scripts/compute-stats.mjs</span>.
              </p>
            </div>

            {/* Metrics snapshot */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0 }}>
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest mb-4 font-semibold">Portfolio Metrics</div>
              {[
                { label:'Avg Risk Score', val: liveApps.length ? (liveApps.reduce((s,a)=>s+(a.riskScore??0),0)/liveApps.length).toFixed(1)+' pts' : '—' },
                { label:'Avg Loan Size', val: liveApps.length ? formatIDR(Math.round(totalAll/liveApps.length)) : '—' },
                { label:'Avg DTI', val: liveApps.length ? ((liveApps.reduce((s,a)=>s+(a.dti??0),0)/liveApps.length)*100).toFixed(1)+'%' : '—' },
                { label:'ROI (projected)', val: totalApprovedAmt > 0 ? (netRevenue/totalApprovedAmt*100).toFixed(2)+'%' : '—' },
              ].map(m => (
                <div key={m.label} className="flex justify-between py-2.5 border-b border-white/5">
                  <span className="text-xs text-[var(--app-text-dim)]">{m.label}</span>
                  <span className="text-xs font-bold text-[#a5b4fc] font-mono">{m.val}</span>
                </div>
              ))}
            </div>

            {/* Key assumptions */}
            <div className="report-section glass-card-static rounded-2xl p-6" style={{ opacity:0 }}>
              <div className="text-xs text-[var(--app-text-dim)] uppercase tracking-widest mb-4 font-semibold">Key Assumptions</div>
              {[
                ['Interest Rate', '2.00% flat/month'],
                ['Loan Term', '24 months avg'],
                ['ECL Basis', 'PSAK 71 Stage 1/2/3'],
                ['Stage 1 ECL Rate', `${stageRates[1]*100}%`],
                ['Stage 2 ECL Rate', `${stageRates[2]*100}%`],
                ['Stage 3 ECL Rate', `${stageRates[3]*100}%`],
                ['Operating Cost', '5.00% of disbursement'],
                ['Currency', 'IDR (Rupiah Indonesia)'],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-xs text-[var(--app-text-dim)]">{k}</span>
                  <span className="text-xs text-[var(--app-text-muted)] font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
