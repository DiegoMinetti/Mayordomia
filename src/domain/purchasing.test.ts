import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PURCHASE_WEIGHTS,
  contributionLabel,
  formatScoreBreakdown,
  isOverridingBestQuote,
  isWeightsEqual,
  normalizedLabel,
  purchaseStatusColor,
  purchaseStatusLabel,
  quoteStatusColor,
  quoteStatusLabel,
  scoreQuotes,
  validatePurchaseDecision,
  type PurchaseWeights,
  type QuoteAssessment,
} from './purchasing';

const weights: PurchaseWeights = { ...DEFAULT_PURCHASE_WEIGHTS };

const sampleQuotes: QuoteAssessment[] = [
  {
    quoteId: 'q1',
    price: 1000,
    quality: 90,
    delivery: 5,
    warranty: 12,
    supplierHistory: 80,
    technicalFit: 70,
  },
  {
    quoteId: 'q2',
    price: 1200,
    quality: 95,
    delivery: 3,
    warranty: 24,
    supplierHistory: 90,
    technicalFit: 85,
  },
  {
    quoteId: 'q3',
    price: 1500,
    quality: 80,
    delivery: 10,
    warranty: 6,
    supplierHistory: 60,
    technicalFit: 75,
  },
];

describe('scoreQuotes', () => {
  it('orders quotes by total score descending', () => {
    const scores = scoreQuotes(sampleQuotes, weights);
    // q1 is the cheapest (price normalized to 100) and has decent other
    // dimensions; q3 is the most expensive and the weakest overall.
    expect(scores[0].quoteId).toBe('q1');
    expect(scores[2].quoteId).toBe('q3');
  });

  it('uses normalized price (min/quote)*100 as the price dimension', () => {
    const scores = scoreQuotes(sampleQuotes, weights);
    const cheapest = scores.find((s) => s.quoteId === 'q1')!;
    expect(cheapest.breakdown.price.normalized).toBe(100);
    const expensive = scores.find((s) => s.quoteId === 'q3')!;
    expect(expensive.breakdown.price.normalized).toBeCloseTo((1000 / 1500) * 100, 4);
  });

  it('produces a breakdown for every weight key', () => {
    const scores = scoreQuotes(sampleQuotes, weights);
    const keys = Object.keys(weights) as (keyof PurchaseWeights)[];
    for (const s of scores) {
      for (const k of keys) {
        expect(s.breakdown[k]).toBeDefined();
        expect(typeof s.breakdown[k].contribution).toBe('number');
      }
    }
  });

  it('throws when prices are non-positive', () => {
    expect(() => scoreQuotes([{ ...sampleQuotes[0], price: 0 }], weights)).toThrow(
      /Prices must be positive/,
    );
  });

  it('throws when weights total is zero', () => {
    const zero: PurchaseWeights = {
      price: 0,
      quality: 0,
      delivery: 0,
      warranty: 0,
      supplierHistory: 0,
      technicalFit: 0,
    };
    expect(() => scoreQuotes(sampleQuotes, zero)).toThrow(/total more than zero/);
  });

  it('throws when any weight is negative', () => {
    expect(() => scoreQuotes(sampleQuotes, { ...weights, price: -1 })).toThrow(/non-negative/);
  });
});

describe('validatePurchaseDecision', () => {
  const scores = scoreQuotes(sampleQuotes, weights);
  const bestId = scores[0].quoteId;

  it('accepts the top-scoring quote without a reason', () => {
    expect(() => validatePurchaseDecision(bestId, scores)).not.toThrow();
  });

  it('demands a justification when overriding the best', () => {
    // Pick any non-top id.
    const otherId = scores.find((s) => s.quoteId !== bestId)!.quoteId;
    expect(() => validatePurchaseDecision(otherId, scores)).toThrow(/justification/);
  });

  it('accepts the override when a justification is provided', () => {
    const otherId = scores.find((s) => s.quoteId !== bestId)!.quoteId;
    expect(() => validatePurchaseDecision(otherId, scores, 'Mejor warranty')).not.toThrow();
  });

  it('rejects unknown quote ids', () => {
    expect(() => validatePurchaseDecision('unknown', scores, 'reason')).toThrow(/Unknown quote/);
  });
});

describe('purchaseStatusLabel / quoteStatusLabel', () => {
  it('maps every known purchase status to a Spanish label', () => {
    expect(purchaseStatusLabel('DRAFT')).toBe('Borrador');
    expect(purchaseStatusLabel('SUBMITTED')).toBe('En evaluación');
    expect(purchaseStatusLabel('APPROVED')).toBe('Aprobada');
    expect(purchaseStatusLabel('REJECTED')).toBe('Rechazada');
    expect(purchaseStatusLabel('CANCELLED')).toBe('Cancelada');
    expect(purchaseStatusLabel('COMPLETED')).toBe('Completada');
  });

  it('falls back to the raw value for unknown statuses', () => {
    expect(purchaseStatusLabel('WEIRD')).toBe('WEIRD');
  });

  it('maps every known quote status to a Spanish label', () => {
    expect(quoteStatusLabel('PENDING')).toBe('Pendiente');
    expect(quoteStatusLabel('ACCEPTED')).toBe('Aceptada');
    expect(quoteStatusLabel('REJECTED')).toBe('Rechazada');
    expect(quoteStatusLabel('WITHDRAWN')).toBe('Retirada');
  });
});

describe('status color helpers', () => {
  it('maps purchase statuses to a color hint', () => {
    expect(purchaseStatusColor('APPROVED')).toBe('success');
    expect(purchaseStatusColor('REJECTED')).toBe('error');
    expect(purchaseStatusColor('SUBMITTED')).toBe('warning');
    expect(purchaseStatusColor('DRAFT')).toBe('default');
  });

  it('maps quote statuses to a color hint', () => {
    expect(quoteStatusColor('ACCEPTED')).toBe('success');
    expect(quoteStatusColor('REJECTED')).toBe('error');
    expect(quoteStatusColor('PENDING')).toBe('warning');
    expect(quoteStatusColor('WITHDRAWN')).toBe('default');
  });
});

describe('formatScoreBreakdown / display helpers', () => {
  it('flattens a quote score into UI rows preserving weight order', () => {
    const scores = scoreQuotes(sampleQuotes, weights);
    const rows = formatScoreBreakdown(scores[0]);
    expect(rows.map((r) => r.key)).toEqual([
      'price',
      'quality',
      'delivery',
      'warranty',
      'supplierHistory',
      'technicalFit',
    ]);
    for (const r of rows) {
      expect(typeof r.label).toBe('string');
      expect(r.label.length).toBeGreaterThan(0);
    }
  });

  it('contributionLabel and normalizedLabel format numbers', () => {
    expect(contributionLabel(15.236)).toBe('15.24 pts');
    expect(normalizedLabel(78.456)).toBe('78.5%');
  });
});

describe('isOverridingBestQuote / isWeightsEqual', () => {
  it('isOverridingBestQuote returns true when not picking the top score', () => {
    const scores = scoreQuotes(sampleQuotes, weights);
    const bestId = scores[0].quoteId;
    const otherId = scores.find((s) => s.quoteId !== bestId)!.quoteId;
    expect(isOverridingBestQuote(otherId, scores)).toBe(true);
    expect(isOverridingBestQuote(bestId, scores)).toBe(false);
  });

  it('isWeightsEqual detects identical weight objects', () => {
    const a: PurchaseWeights = {
      price: 1,
      quality: 2,
      delivery: 3,
      warranty: 4,
      supplierHistory: 5,
      technicalFit: 6,
    };
    const b: PurchaseWeights = {
      price: 1,
      quality: 2,
      delivery: 3,
      warranty: 4,
      supplierHistory: 5,
      technicalFit: 6,
    };
    const c: PurchaseWeights = { ...a, price: 99 };
    expect(isWeightsEqual(a, b)).toBe(true);
    expect(isWeightsEqual(a, c)).toBe(false);
  });
});
