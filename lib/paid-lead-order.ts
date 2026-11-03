import type { Whop } from "@whop/sdk";
import { calculateLeadQuote, LEAD_STATES } from "@/lib/lead-pricing";
import { requestedPaymentMode } from "@/lib/payment-methods";
import { isTopUpPlanForAmount } from "@/lib/whop-plans";

// Use merchant-created plan metadata and historical prices, never buyer metadata.
export function paidLeadOrder(payment: Whop.Payment, plan: Whop.Plan, accountId: string, productId: string) {
  if (payment.status !== "paid" || !payment.paid_at || !/^pay_[a-zA-Z0-9]+$/.test(payment.id) ||
    payment.account_id !== accountId || payment.product_id !== productId || payment.plan_id !== plan.id) throw new Error("Not a paid lead order.");
  const m = plan.metadata;
  const state = LEAD_STATES.find((item) => item.code === m?.state);
  if (!state || !m || typeof m.quantity !== "string" || !/^\d+$/.test(m.quantity) ||
    typeof m.price_per_lead !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(m.price_per_lead) ||
    (m.payment_mode !== "bank" && m.payment_mode !== "card") ||
    (m.pricing_mode !== "forced_usd" && m.pricing_mode !== "adaptive")) throw new Error("Invalid lead metadata.");
  const quote = calculateLeadQuote(state.code, Number(m.quantity), [{ ...state, price: Number(m.price_per_lead) }], requestedPaymentMode(m.payment_mode));
  if (!isTopUpPlanForAmount(plan, accountId, productId, quote, m.pricing_mode === "forced_usd")) throw new Error("Plan does not match order.");
  return { paymentId: payment.id, state: quote.state, stateName: quote.stateName, quantity: quote.leadCount,
    orderTotalUsd: quote.total, paymentMode: quote.paymentMode };
}

export function slackOrderMessage(order: ReturnType<typeof paidLeadOrder>) {
  return { text: `Paid LOUDR lead order\nState: ${order.stateName} (${order.state})\nLeads: ${order.quantity}\nOrder total (USD): $${order.orderTotalUsd.toFixed(2)}\nCheckout: ${order.paymentMode === "card" ? "Card" : "Wire & ACH"}\nPayment ID: ${order.paymentId}`,
    unfurl_links: false, unfurl_media: false };
}
