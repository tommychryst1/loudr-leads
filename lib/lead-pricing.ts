import { calculateTopUp, isValidFeePercent, MAX_TOP_UP, topUpMetadata, topUpQuoteKey, type TopUpQuote } from "@/lib/top-up";

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
export type LeadQuote = TopUpQuote & { state: LeadState; leadCount: number; unitPrice: number };

export function isValidLeadState(value: unknown): value is LeadState {
  return typeof value === "string" && LEAD_STATES.some((state) => state.code === value);
}

export function calculateLeadQuote(state: unknown, leadCount: unknown, feePercent: unknown): LeadQuote {
  const selection = LEAD_STATES.find((item) => item.code === state);
  if (!selection) throw new Error("Choose a valid state.");
  if (selection.price === null) throw new Error("California leads are currently sold out. Please choose another state.");
  if (typeof leadCount !== "number" || !Number.isSafeInteger(leadCount) || leadCount < 1) {
    throw new Error("Enter a whole number of leads, starting at 1.");
  }
  const maxCount = Math.floor(MAX_TOP_UP / selection.price);
  if (leadCount > maxCount) throw new Error(`The maximum order for ${selection.name} is ${maxCount.toLocaleString("en-US")} leads.`);
  if (!isValidFeePercent(feePercent)) throw new Error("Service fee must be between 2.5% and 5%, with no more than two decimal places.");
  return { ...calculateTopUp(selection.price * leadCount, feePercent), state: selection.code, leadCount, unitPrice: selection.price };
}

export function isLeadQuote(quote: TopUpQuote | LeadQuote): quote is LeadQuote {
  return "state" in quote && "leadCount" in quote && "unitPrice" in quote;
}

export function leadQuoteKey(quote: LeadQuote): string {
  return `${quote.state}-${quote.leadCount}-${quote.unitPrice}-${topUpQuoteKey(quote)}`;
}

export function leadMetadata(quote: LeadQuote, forceUsd = false) {
  return { ...topUpMetadata(quote, forceUsd), source: "loudr-leads", lead_state: quote.state,
    lead_count: String(quote.leadCount), lead_unit_price: String(quote.unitPrice) };
}
