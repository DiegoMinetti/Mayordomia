/**
 * PR 3b — Compras (procurement end-to-end with scoring).
 *
 * The heavy lifting (validation of a decision, the scoring math) lives
 * here as pure functions so the UI and Apps Script implementations can
 * stay aligned. The Apps Script port in `apps-script/Purchases.gs`
 * duplicates the algorithm and is exercised in tandem with this module.
 */
export interface PurchaseWeights {
  price: number;
  quality: number;
  delivery: number;
  warranty: number;
  supplierHistory: number;
  technicalFit: number;
}
export interface QuoteAssessment {
  quoteId: string;
  price: number;
  quality: number;
  delivery: number;
  warranty: number;
  supplierHistory: number;
  technicalFit: number;
}
export interface ScoreBreakdownEntry {
  normalized: number;
  weight: number;
  contribution: number;
}
export interface QuoteScore {
  quoteId: string;
  score: number;
  breakdown: Record<keyof PurchaseWeights, ScoreBreakdownEntry>;
}

export const DEFAULT_PURCHASE_WEIGHTS: PurchaseWeights = {
  price: 30,
  quality: 25,
  delivery: 15,
  warranty: 10,
  supplierHistory: 10,
  technicalFit: 10,
};

export const PURCHASE_WEIGHT_LABELS: Record<keyof PurchaseWeights, string> = {
  price: 'Precio',
  quality: 'Calidad',
  delivery: 'Plazo de entrega',
  warranty: 'Garantía',
  supplierHistory: 'Historial del proveedor',
  technicalFit: 'Ajuste técnico',
};

export const PURCHASE_WEIGHT_DESCRIPTIONS: Record<keyof PurchaseWeights, string> = {
  price: 'Relación precio/calidad frente al resto',
  quality: 'Puntuación declarada del proveedor (0-100)',
  delivery: 'Plazo de entrega ofrecido',
  warranty: 'Meses de garantía',
  supplierHistory: 'Reputación histórica del proveedor',
  technicalFit: 'Idoneidad técnica frente al requerimiento',
};

export type PurchaseStatus =
  'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: 'Borrador',
  SUBMITTED: 'En evaluación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  WITHDRAWN: 'Retirada',
};

export function purchaseStatusLabel(status: string): string {
  return PURCHASE_STATUS_LABELS[status as PurchaseStatus] ?? status;
}

export function quoteStatusLabel(status: string): string {
  return QUOTE_STATUS_LABELS[status as QuoteStatus] ?? status;
}

export function purchaseStatusColor(
  status: string,
): 'default' | 'warning' | 'success' | 'error' | 'info' {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'success';
    case 'REJECTED':
    case 'CANCELLED':
      return 'error';
    case 'SUBMITTED':
      return 'warning';
    case 'DRAFT':
      return 'default';
    default:
      return 'info';
  }
}

export function quoteStatusColor(status: string): 'default' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'WITHDRAWN':
      return 'default';
    case 'PENDING':
    default:
      return 'warning';
  }
}

export function scoreQuotes(quotes: QuoteAssessment[], weights: PurchaseWeights): QuoteScore[] {
  if (!quotes.length) return [];
  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0);
  if (weightTotal <= 0 || Object.values(weights).some((w) => w < 0))
    throw new Error('Weights must be non-negative and total more than zero');
  const prices = quotes.map((q) => q.price);
  if (prices.some((p) => p <= 0)) throw new Error('Prices must be positive');
  const minPrice = Math.min(...prices);
  const keys = Object.keys(weights) as (keyof PurchaseWeights)[];
  return quotes
    .map((quote) => {
      const normalized = { ...quote, price: (minPrice / quote.price) * 100 };
      const breakdown = {} as QuoteScore['breakdown'];
      let score = 0;
      for (const key of keys) {
        const value = key === 'price' ? normalized.price : Math.max(0, Math.min(100, quote[key]));
        const contribution = (value * weights[key]) / weightTotal;
        breakdown[key] = {
          normalized: round(value, 4),
          weight: weights[key],
          contribution: round(contribution, 4),
        };
        score += contribution;
      }
      return { quoteId: quote.quoteId, score: round(score, 2), breakdown };
    })
    .sort((a, b) => b.score - a.score);
}

export function validatePurchaseDecision(
  selectedQuoteId: string,
  scores: QuoteScore[],
  reason?: string,
): void {
  const best = scores[0];
  if (!scores.some((s) => s.quoteId === selectedQuoteId)) throw new Error('Unknown quote');
  if (best && selectedQuoteId !== best.quoteId && !reason?.trim())
    throw new Error('A justification is required when selecting a lower-scored quote');
}

/** True if `selectedQuoteId` is not the top-scoring quote. */
export function isOverridingBestQuote(selectedQuoteId: string, scores: QuoteScore[]): boolean {
  if (!scores.length) return false;
  return scores[0].quoteId !== selectedQuoteId;
}

export interface ScoreBreakdownRow {
  key: keyof PurchaseWeights;
  label: string;
  description: string;
  weight: number;
  normalized: number;
  contribution: number;
}

/**
 * Flatten a `QuoteScore.breakdown` into display rows for the UI. Keeps the
 * order in which the weights appear in `PurchaseWeights` and renders their
 * Spanish labels.
 */
export function formatScoreBreakdown(score: QuoteScore): ScoreBreakdownRow[] {
  const keys = Object.keys(DEFAULT_PURCHASE_WEIGHTS) as (keyof PurchaseWeights)[];
  return keys.map((key) => ({
    key,
    label: PURCHASE_WEIGHT_LABELS[key],
    description: PURCHASE_WEIGHT_DESCRIPTIONS[key],
    weight: score.breakdown[key].weight,
    normalized: score.breakdown[key].normalized,
    contribution: score.breakdown[key].contribution,
  }));
}

/** Pretty-print a normalized contribution (0-100) as a percentage. */
export function contributionLabel(value: number): string {
  return `${value.toFixed(2)} pts`;
}

/** Pretty-print a normalized dimension value (0-100) as a percentage. */
export function normalizedLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function isWeightsEqual(a: PurchaseWeights, b: PurchaseWeights): boolean {
  const keys = Object.keys(DEFAULT_PURCHASE_WEIGHTS) as (keyof PurchaseWeights)[];
  return keys.every((k) => a[k] === b[k]);
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
