import { describe, it, expect } from 'vitest';
import { calculateRiskScore, assignECLStage } from './data';

describe('calculateRiskScore — IC-2 Automated Scoring & IC-3 Threshold', () => {
  it('APPROVED bila skor ≥ 60 (C001: income 8jt, loan 50jt, emp 5, ext 0.72)', () => {
    const r = calculateRiskScore(8_000_000, 50_000_000, 5, 0.72);
    expect(r.riskScore).toBe(72.9);
    expect(r.decision).toBe('APPROVED');
    expect(r.dtiFlag).toBe(false);
  });

  it('REJECTED bila skor < 40 (C006: income 2.8jt, loan 55jt, emp 0.5, ext 0.29)', () => {
    const r = calculateRiskScore(2_800_000, 55_000_000, 0.5, 0.29);
    expect(r.riskScore).toBe(35.7);
    expect(r.decision).toBe('REJECTED');
  });

  it('MANUAL_REVIEW bila skor di grey zone 40–59 (C002: income 4.5jt, loan 80jt, emp 2, ext 0.38)', () => {
    const r = calculateRiskScore(4_500_000, 80_000_000, 2, 0.38);
    expect(r.riskScore).toBe(44.1);
    expect(r.decision).toBe('MANUAL_REVIEW');
    expect(r.dtiFlag).toBe(false);
  });

  it('IC-6 DTI Hard Limit: DTI > 50% memaksa MANUAL_REVIEW walau skor ≥ 60', () => {
    const r = calculateRiskScore(3_000_000, 100_000_000, 10, 0.95);
    expect(r.dtiFlag).toBe(true);
    expect(r.riskScore).toBeGreaterThanOrEqual(60); // skor tinggi…
    expect(r.decision).toBe('MANUAL_REVIEW');        // …tapi tetap di-override
  });

  it('empScore di-cap pada 10 tahun masa kerja', () => {
    const a = calculateRiskScore(10_000_000, 30_000_000, 10, 0.5);
    const b = calculateRiskScore(10_000_000, 30_000_000, 25, 0.5);
    expect(a.riskScore).toBe(b.riskScore);
  });
});

describe('assignECLStage — PSAK 71 staging', () => {
  it('REJECTED → tidak masuk on-book (undefined)', () => {
    expect(assignECLStage({ decision: 'REJECTED', riskScore: 30, extScore: 0.2 })).toBeUndefined();
  });

  it('MANUAL_REVIEW → Stage 2', () => {
    expect(assignECLStage({ decision: 'MANUAL_REVIEW', riskScore: 45, extScore: 0.4 })).toBe(2);
  });

  it('APPROVED skor tinggi & ext bagus → Stage 1', () => {
    expect(assignECLStage({ decision: 'APPROVED', riskScore: 84, extScore: 0.81 })).toBe(1);
  });

  it('APPROVED skor ≥ 60 → Stage 1', () => {
    expect(assignECLStage({ decision: 'APPROVED', riskScore: 65, extScore: 0.61 })).toBe(1);
  });

  it('APPROVED-via-manual dengan skor < 60 → tetap Stage 2 (C004)', () => {
    expect(assignECLStage({ decision: 'APPROVED', riskScore: 47.8, extScore: 0.45 })).toBe(2);
  });
});
