export type UserRole = 'LOAN_OFFICER' | 'CREDIT_ANALYST' | 'FINANCE' | 'AUDITOR';

export interface SystemUser {
  id: string;
  name: string;
  role: UserRole;
  initials: string;
}

export const USERS: Record<string, SystemUser> = {
  'OFC-001': { id: 'OFC-001', name: 'Andre Saputra',   role: 'LOAN_OFFICER',   initials: 'AS' },
  'OFC-002': { id: 'OFC-002', name: 'Maya Pratiwi',    role: 'LOAN_OFFICER',   initials: 'MP' },
  'CA-001':  { id: 'CA-001',  name: 'Sari Wulandari',  role: 'CREDIT_ANALYST', initials: 'SW' },
  'CA-002':  { id: 'CA-002',  name: 'Rahmat Hidayat',  role: 'CREDIT_ANALYST', initials: 'RH' },
  'FIN-001': { id: 'FIN-001', name: 'Indra Wijaya',    role: 'FINANCE',        initials: 'IW' },
  'AUD-001': { id: 'AUD-001', name: 'Tini Marlina',    role: 'AUDITOR',        initials: 'TM' },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  LOAN_OFFICER:   'Loan Officer',
  CREDIT_ANALYST: 'Credit Analyst',
  FINANCE:        'Finance',
  AUDITOR:        'Auditor',
};

// PIN demo per role (mock auth untuk memperkuat Segregation of Duties).
// Bukan keamanan sungguhan — hanya simulasi kontrol akses untuk presentasi.
export const ROLE_PINS: Record<UserRole, string> = {
  LOAN_OFFICER:   '1111',
  CREDIT_ANALYST: '2222',
  FINANCE:        '3333',
  AUDITOR:        '4444',
};

export type AuditAction =
  | 'CREATED'
  | 'AUTO_DECISION'
  | 'QUEUED_FOR_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'VIEWED'
  | 'VOIDED';

export interface AuditEntry {
  at: string;
  by: string;
  action: AuditAction;
  reason?: string;
  fromStatus?: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
  toStatus?: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
}

export type ECLStage = 1 | 2 | 3;

export interface Application {
  id: string;
  name: string;
  income: number;
  loan: number;
  purpose: string;
  empYears: number;
  extScore: number;
  date: string;
  riskScore?: number;
  dti?: number;
  dtiFlag?: boolean;
  decision?: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
  // --- IC-5 Audit Trail ---
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decisionNotes?: string;
  statusHistory: AuditEntry[];
  // --- PSAK 71 ECL Staging ---
  eclStage?: ECLStage;
  // --- Void (soft-delete) — record dipertahankan untuk audit, tidak dihapus ---
  voided?: boolean;
  voidReason?: string;
}

export function calculateRiskScore(income: number, loan: number, empYears: number, extScore: number) {
  const monthlyPayment = loan / 60;
  const dti = monthlyPayment / income;
  const empScore = Math.min(empYears / 10, 1.0);
  const rawScore = extScore * 0.50 + (1 - Math.min(dti, 1)) * 0.30 + empScore * 0.20;
  const riskScore = Math.round(rawScore * 100 * 10) / 10;
  const dtiFlag = dti > 0.50;
  let decision: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
  if (dtiFlag) { decision = 'MANUAL_REVIEW'; }
  else if (riskScore >= 60) { decision = 'APPROVED'; }
  else if (riskScore >= 40) { decision = 'MANUAL_REVIEW'; }
  else { decision = 'REJECTED'; }
  return { riskScore, dti: Math.round(dti * 1000) / 1000, empScore, dtiFlag, decision };
}

export function assignECLStage(app: Pick<Application, 'decision' | 'riskScore' | 'extScore'>): ECLStage | undefined {
  if (app.decision === 'REJECTED') return undefined;
  if (app.decision === 'MANUAL_REVIEW') return 2;
  if ((app.riskScore ?? 0) >= 75 && app.extScore >= 0.65) return 1;
  if ((app.riskScore ?? 0) >= 60) return 1;
  return 2;
}

type Seed = Omit<Application, 'riskScore' | 'dti' | 'dtiFlag' | 'decision' | 'statusHistory' | 'eclStage'> & {
  // optional overrides for richer hardcoded scenarios
  reviewedBy?: string;
  reviewedAt?: string;
  decisionNotes?: string;
  extraHistory?: AuditEntry[];
};

function buildApplication(seed: Seed): Application {
  const s = calculateRiskScore(seed.income, seed.loan, seed.empYears, seed.extScore);
  const history: AuditEntry[] = [
    { at: seed.createdAt, by: seed.createdBy, action: 'CREATED' },
    {
      at: seed.createdAt,
      by: 'SYSTEM',
      action: 'AUTO_DECISION',
      toStatus: s.decision,
      reason:
        s.decision === 'APPROVED'
          ? `Risk score ${s.riskScore} ≥ 60 (IC-3)`
          : s.decision === 'MANUAL_REVIEW'
          ? s.dtiFlag
            ? `DTI ${(s.dti * 100).toFixed(1)}% > 50% — IC-6 hard limit triggered`
            : `Risk score ${s.riskScore} dalam grey zone 40–59 (IC-4 Dual Control)`
          : `Risk score ${s.riskScore} < 40 — di bawah threshold (IC-3)`,
    },
  ];
  if (s.decision === 'MANUAL_REVIEW') {
    history.push({
      at: seed.createdAt,
      by: 'SYSTEM',
      action: 'QUEUED_FOR_REVIEW',
      reason: 'Diteruskan ke Credit Analyst untuk dual control',
    });
  }
  if (seed.extraHistory) history.push(...seed.extraHistory);

  // If a manual review reached a terminal decision (extraHistory contains APPROVED/REJECTED),
  // the final decision should reflect the last such action — not the initial auto-decision.
  const finalAction = [...history].reverse().find(e => e.action === 'APPROVED' || e.action === 'REJECTED');
  const finalDecision: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED' =
    finalAction ? (finalAction.action as 'APPROVED' | 'REJECTED') : s.decision;

  const merged: Application = {
    ...seed,
    ...s,
    decision: finalDecision,
    statusHistory: history,
  };
  merged.eclStage = assignECLStage(merged);
  return merged;
}

// Helper for ISO timestamps in WIB-flavored local strings (Asia/Jakarta UTC+7)
const ts = (d: string) => `${d}+07:00`;

export const INITIAL_APPLICATIONS: Application[] = [
  buildApplication({
    id: 'C001', name: 'Budi Santoso',  income: 8000000,  loan: 50000000,  purpose: 'Electronics', empYears: 5,   extScore: 0.72,
    date: '2025-05-02', createdBy: 'OFC-001', createdAt: ts('2025-05-02T09:14:22'),
  }),
  buildApplication({
    id: 'C002', name: 'Siti Rahayu',   income: 4500000,  loan: 80000000,  purpose: 'Home Repair', empYears: 2,   extScore: 0.38,
    date: '2025-05-03', createdBy: 'OFC-002', createdAt: ts('2025-05-03T10:42:11'),
    extraHistory: [
      { at: ts('2025-05-03T14:08:55'), by: 'CA-001', action: 'VIEWED' },
    ],
  }),
  buildApplication({
    id: 'C003', name: 'Ahmad Fauzi',   income: 12000000, loan: 60000000,  purpose: 'Car',         empYears: 8,   extScore: 0.81,
    date: '2025-05-05', createdBy: 'OFC-001', createdAt: ts('2025-05-05T08:30:00'),
  }),
  buildApplication({
    id: 'C004', name: 'Dewi Lestari',  income: 3000000,  loan: 40000000,  purpose: 'Medical',     empYears: 1,   extScore: 0.45,
    date: '2025-05-06', createdBy: 'OFC-002', createdAt: ts('2025-05-06T11:22:38'),
    reviewedBy: 'CA-001', reviewedAt: ts('2025-05-06T15:47:02'),
    decisionNotes: 'Income terverifikasi via slip gaji 3 bulan terakhir. Dapat lanjut dengan tenor diperpanjang ke 72 bulan.',
    extraHistory: [
      { at: ts('2025-05-06T15:47:02'), by: 'CA-001', action: 'APPROVED',
        fromStatus: 'MANUAL_REVIEW', toStatus: 'APPROVED',
        reason: 'Verifikasi slip gaji clear, restructure tenor 72 bln' },
    ],
  }),
  buildApplication({
    id: 'C005', name: 'Rizky Pratama', income: 9500000,  loan: 45000000,  purpose: 'Education',   empYears: 6,   extScore: 0.68,
    date: '2025-05-07', createdBy: 'OFC-001', createdAt: ts('2025-05-07T13:05:19'),
  }),
  buildApplication({
    id: 'C006', name: 'Lia Marlina',   income: 2800000,  loan: 55000000,  purpose: 'Electronics', empYears: 0.5, extScore: 0.29,
    date: '2025-05-08', createdBy: 'OFC-002', createdAt: ts('2025-05-08T16:51:44'),
  }),
  buildApplication({
    id: 'C007', name: 'Doni Setiawan', income: 15000000, loan: 100000000, purpose: 'Business',    empYears: 10,  extScore: 0.77,
    date: '2025-05-09', createdBy: 'OFC-001', createdAt: ts('2025-05-09T09:00:12'),
  }),
  buildApplication({
    id: 'C008', name: 'Nina Kurnia',   income: 5500000,  loan: 30000000,  purpose: 'Home Repair', empYears: 4,   extScore: 0.61,
    date: '2025-05-12', createdBy: 'OFC-002', createdAt: ts('2025-05-12T14:33:09'),
  }),
  buildApplication({
    id: 'C009', name: 'Hendra Wijaya', income: 6000000,  loan: 90000000,  purpose: 'Car',         empYears: 3,   extScore: 0.41,
    date: '2025-05-13', createdBy: 'OFC-001', createdAt: ts('2025-05-13T10:18:55'),
    extraHistory: [
      { at: ts('2025-05-13T16:02:14'), by: 'CA-002', action: 'VIEWED' },
    ],
  }),
  buildApplication({
    id: 'C010', name: 'Ratna Dewi',    income: 7200000,  loan: 35000000,  purpose: 'Education',   empYears: 7,   extScore: 0.74,
    date: '2025-05-14', createdBy: 'OFC-002', createdAt: ts('2025-05-14T08:47:31'),
  }),
];

export function buildApplicationFromForm(input: {
  id: string;
  name: string;
  income: number;
  loan: number;
  purpose: string;
  empYears: number;
  extScore: number;
  date: string;
  createdBy: string;
}): Application {
  const createdAt = new Date().toISOString();
  return buildApplication({ ...input, createdAt });
}

export function appendAuditEntry(app: Application, entry: AuditEntry): Application {
  return { ...app, statusHistory: [...app.statusHistory, entry] };
}

export function manualReviewDecision(
  app: Application,
  decision: 'APPROVED' | 'REJECTED',
  reviewerId: string,
  notes: string,
): Application {
  const now = new Date().toISOString();
  const next: Application = {
    ...app,
    decision,
    reviewedBy: reviewerId,
    reviewedAt: now,
    decisionNotes: notes,
    statusHistory: [
      ...app.statusHistory,
      {
        at: now,
        by: reviewerId,
        action: decision,
        fromStatus: 'MANUAL_REVIEW',
        toStatus: decision,
        reason: notes,
      },
    ],
  };
  next.eclStage = assignECLStage(next);
  return next;
}

// Void = soft-delete. Record tetap disimpan (audit trail utuh), tapi dikecualikan
// dari portfolio aktif, statistik, dan financial report. Prinsip akuntansi:
// "void, jangan hapus" — jejak transaksi tidak boleh hilang.
export function voidApplication(app: Application, byUserId: string, reason: string): Application {
  const now = new Date().toISOString();
  return {
    ...app,
    voided: true,
    voidReason: reason,
    statusHistory: [
      ...app.statusHistory,
      { at: now, by: byUserId, action: 'VOIDED', reason },
    ],
  };
}

export function formatIDR(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

export function formatIDRShort(amount: number): string {
  if (amount >= 1_000_000_000) return 'Rp ' + (amount / 1_000_000_000).toFixed(1) + 'M';
  if (amount >= 1_000_000) return 'Rp ' + (amount / 1_000_000).toFixed(0) + 'jt';
  return formatIDR(amount);
}

export function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

export function describeUser(userId: string): string {
  if (userId === 'SYSTEM') return 'SYSTEM';
  return USERS[userId] ? `${USERS[userId].name} (${userId})` : userId;
}
