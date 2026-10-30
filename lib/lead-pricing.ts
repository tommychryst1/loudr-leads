import { type TopUpQuote } from "@/lib/top-up";

export const MAX_LEAD_QUANTITY = 1000;

export const LEAD_STATES = [
  { code: "AL", name: "Alabama", price: 325 },
  { code: "AK", name: "Alaska", price: 325 },
  { code: "AZ", name: "Arizona", price: 450 },
  { code: "AR", name: "Arkansas", price: 175 },
  { code: "CA", name: "California", price: null },
  { code: "CO", name: "Colorado", price: 400 },
  { code: "CT", name: "Connecticut", price: 285 },
  { code: "DE", name: "Delaware", price: 150 },
  { code: "FL", name: "Florida", price: 375 },
  { code: "GA", name: "Georgia", price: 400 },
  { code: "HI", name: "Hawaii", price: 100 },
  { code: "ID", name: "Idaho", price: 250 },
  { code: "IL", name: "Illinois", price: 350 },
  { code: "IN", name: "Indiana", price: 285 },
  { code: "IA", name: "Iowa", price: 250 },
  { code: "KS", name: "Kansas", price: 240 },
  { code: "KY", name: "Kentucky", price: 250 },
  { code: "LA", name: "Louisiana", price: 225 },
  { code: "ME", name: "Maine", price: 150 },
  { code: "MD", name: "Maryland", price: 300 },
  { code: "MA", name: "Massachusetts", price: 290 },
  { code: "MI", name: "Michigan", price: 325 },
  { code: "MN", name: "Minnesota", price: 250 },
  { code: "MS", name: "Mississippi", price: 175 },
  { code: "MO", name: "Missouri", price: 285 },
  { code: "MT", name: "Montana", price: 225 },
  { code: "NE", name: "Nebraska", price: 325 },
  { code: "NV", name: "Nevada", price: 375 },
  { code: "NH", name: "New Hampshire", price: 150 },
  { code: "NJ", name: "New Jersey", price: 350 },
  { code: "NM", name: "New Mexico", price: 280 },
  { code: "NY", name: "New York", price: 400 },
  { code: "NC", name: "North Carolina", price: 325 },
  { code: "ND", name: "North Dakota", price: 250 },
  { code: "OH", name: "Ohio", price: 250 },
  { code: "OK", name: "Oklahoma", price: 235 },
  { code: "OR", name: "Oregon", price: 350 },
  { code: "PA", name: "Pennsylvania", price: 265 },
  { code: "RI", name: "Rhode Island", price: 235 },
  { code: "SC", name: "South Carolina", price: 300 },
  { code: "SD", name: "South Dakota", price: 250 },
  { code: "TN", name: "Tennessee", price: 275 },
  { code: "TX", name: "Texas", price: 500 },
  { code: "UT", name: "Utah", price: 375 },
  { code: "VT", name: "Vermont", price: 100 },
  { code: "VA", name: "Virginia", price: 225 },
  { code: "WA", name: "Washington", price: 425 },
  { code: "WV", name: "West Virginia", price: 160 },
  { code: "WI", name: "Wisconsin", price: 250 },
  { code: "WY", name: "Wyoming", price: 250 },
] as const;

export type LeadState = typeof LEAD_STATES[number]["code"];
export type LeadQuote = TopUpQuote & { state: LeadState; stateName: string; leadCount: number; unitPrice: number; quantity: number; pricePerLead: number };

export function isValidLeadState(value: unknown): value is LeadState {
  return typeof value === "string" && LEAD_STATES.some((state) => state.code === value);
}

export function calculateLeadQuote(state: unknown, leadCount: unknown): LeadQuote {
  const selection = LEAD_STATES.find((item) => item.code === state);
  if (!selection) throw new Error("Choose a valid state.");
  if (selection.price === null) throw new Error("California leads are currently sold out. Please choose another state.");
  if (typeof leadCount !== "number" || !Number.isSafeInteger(leadCount) || leadCount < 1) {
    throw new Error("Enter a whole number of leads, starting at 1.");
  }
  if (leadCount > MAX_LEAD_QUANTITY) throw new Error(`The maximum order is ${MAX_LEAD_QUANTITY.toLocaleString("en-US")} leads.`);
  const amountCents = selection.price * 100 * leadCount;
  return { currency: "usd", amountCents, totalCents: amountCents, feeCents: 0, feeBasisPoints: 0,
    amount: amountCents / 100, total: amountCents / 100, feePercent: 0, fee: 0,
    state: selection.code, stateName: selection.name, leadCount, unitPrice: selection.price, quantity: leadCount, pricePerLead: selection.price };

}

export function isLeadQuote(quote: TopUpQuote | LeadQuote): quote is LeadQuote {
  return "state" in quote && "leadCount" in quote && "unitPrice" in quote;
}

export function leadQuoteKey(quote: LeadQuote): string {
  return `${quote.state}-${quote.leadCount}-${quote.unitPrice}-${quote.currency}-${quote.totalCents}`;
}

export function leadMetadata(quote: LeadQuote, forceUsd = false) {
  return { source: "loudr-leads-site", currency: quote.currency,
    pricing_mode: forceUsd ? "forced_usd" : "adaptive", state: quote.state, state_name: quote.stateName,
    quantity: String(quote.leadCount), price_per_lead: String(quote.unitPrice), total_amount: String(quote.total) };
}

export function requestedLeadCount(input: Record<string, unknown>): unknown {
  if (input.quantity !== undefined && input.leadCount !== undefined && input.quantity !== input.leadCount) {
    throw new Error("Quantity and lead count must match.");
  }
  return input.quantity !== undefined ? input.quantity : input.leadCount;
}
