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
export interface QuoteScore {
  quoteId: string;
  score: number;
  breakdown: Record<
    keyof PurchaseWeights,
    { normalized: number; weight: number; contribution: number }
  >;
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
        breakdown[key] = { normalized: value, weight: weights[key], contribution };
        score += contribution;
      }
      return { quoteId: quote.quoteId, score: Math.round(score * 100) / 100, breakdown };
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
