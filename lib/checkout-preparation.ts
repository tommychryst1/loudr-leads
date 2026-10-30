import { topUpQuoteKey, type TopUpQuote } from "@/lib/top-up";

// Only public plan IDs are cached. Payment tokens and payment results are never cached.
export function createPlanPreparer<Quote extends TopUpQuote = TopUpQuote>(
  resolve: (quote: Quote, forceUsd: boolean) => Promise<string>,
  quoteKey: (quote: Quote) => string = topUpQuoteKey,
) {
  const plans = new Map<string, { promise: Promise<string>; expires: number }>();

  return function prepare(quote: Quote, forceUsd = false): Promise<string> {
    const key = `${quoteKey(quote)}-${forceUsd ? "usd" : "adaptive"}`;
    const existing = plans.get(key);
    if (existing && existing.expires > Date.now()) return existing.promise;

    const promise = resolve(quote, forceUsd);
    plans.delete(key);
    plans.set(key, { promise, expires: Date.now() + 300_000 });
    if (plans.size > 20) plans.delete(plans.keys().next().value!);
    // A failed background request must not prevent an explicit retry.
    void promise.catch(() => {
      if (plans.get(key)?.promise === promise) plans.delete(key);
    });
    return promise;
  };
}

