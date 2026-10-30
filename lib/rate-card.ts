import { LEAD_STATES, type LeadState } from "@/lib/lead-pricing";

export const MAX_PRICE_PER_LEAD = 10_000;
export const MAX_PRICING_BODY_LENGTH = 16_384;
export type RateState = { code: LeadState; name: string; price: number | null };
export type RateCard = { version: string; updatedAt: string | null; states: RateState[] };
export type PriceChange = { code: LeadState; price: number | null };
export type StoredRateCard = { schemaVersion: 1; updatedAt: string; prices: Record<LeadState, number | null> };

export class PricingError extends Error {
  constructor(message: string, public readonly status: 400 | 409 | 503) {
    super(message);
    this.name = "PricingError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validPrice(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0.01 &&
    value <= MAX_PRICE_PER_LEAD && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001);
}

export function defaultRateCard(): RateCard {
  return { version: "initial", updatedAt: null, states: LEAD_STATES.map((state) => ({ ...state })) };
}

export function validateChanges(value: unknown): PriceChange[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > LEAD_STATES.length) {
    throw new PricingError("Provide between 1 and 50 state price changes.", 400);
  }
  const seen = new Set<string>();
  return value.map((change) => {
    if (!isRecord(change) || typeof change.code !== "string" ||
      !LEAD_STATES.some((state) => state.code === change.code) ||
      Object.keys(change).some((key) => key !== "code" && key !== "price")) {
      throw new PricingError("Each change must identify a valid US state and its price.", 400);
    }
    if (seen.has(change.code)) throw new PricingError("Each state may appear only once in a save.", 400);
    if (!validPrice(change.price)) {
      throw new PricingError("Prices must be greater than $0 and no more than $10,000, with up to two decimal places. Use sold out for unavailable states.", 400);
    }
    seen.add(change.code);
    return { code: change.code as LeadState, price: change.price === null ? null : Math.round(change.price * 100) / 100 };
  });
}

export function validateVersion(version: unknown): asserts version is string {
  if (typeof version !== "string" || version.length === 0 || version.length > 256 || /[\r\n]/.test(version)) {
    throw new PricingError("Reload prices before saving your changes.", 400);
  }
}

export function decodeStoredRateCard(value: unknown, version: string): RateCard {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt)) || !isRecord(value.prices) ||
    Object.keys(value.prices).length !== LEAD_STATES.length) {
    throw new PricingError("Saved prices are temporarily unavailable. Please try again later.", 503);
  }
  const prices = value.prices;
  const states = LEAD_STATES.map(({ code, name }) => {
    const price = Object.prototype.hasOwnProperty.call(prices, code) ? prices[code] : undefined;
    if (!validPrice(price)) throw new PricingError("Saved prices are temporarily unavailable. Please try again later.", 503);
    return { code, name, price };
  });
  return { version, updatedAt: value.updatedAt, states };
}

export function applyPriceChanges(card: RateCard, changes: PriceChange[], updatedAt: string): StoredRateCard {
  const changed = new Map(changes.map((change) => [change.code, change.price]));
  const prices = Object.fromEntries(card.states.map((state) => [state.code, changed.has(state.code) ? changed.get(state.code)! : state.price])) as Record<LeadState, number | null>;
  return { schemaVersion: 1, updatedAt, prices };
}
