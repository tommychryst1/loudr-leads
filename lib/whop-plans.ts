import type { Whop, WhopClient } from "@whop/sdk";
import { topUpPaymentConfiguration, topUpPaymentMethods } from "@/lib/payment-methods";
import { topUpMetadata, topUpQuoteKey, type TopUpQuote } from "@/lib/top-up";
import { isLeadQuote, leadMetadata, leadQuoteKey, type LeadQuote } from "@/lib/lead-pricing";

function metadataForQuote(quote: TopUpQuote | LeadQuote, forceUsd: boolean) {
  return isLeadQuote(quote) ? leadMetadata(quote, forceUsd) : topUpMetadata(quote, forceUsd);
}

function matchesMetadata(plan: Pick<Whop.Plan, "metadata">, quote: TopUpQuote | LeadQuote, forceUsd: boolean) {
  return Object.entries(metadataForQuote(quote, forceUsd)).every(([key, value]) => plan.metadata?.[key] === value);
}

export function isTopUpPlanForAmount(plan: Whop.Plan, accountId: string, productId: string, quote: TopUpQuote | LeadQuote, forceUsd = false) {
  return plan.account?.id === accountId &&
    plan.product?.id === productId &&
    plan.currency === quote.currency &&
    plan.plan_type === "one_time" &&
    plan.visibility === "quick_link" &&
    plan.adaptive_pricing_enabled === !forceUsd &&
    plan.metadata?.pricing_mode === (forceUsd ? "forced_usd" : "adaptive") &&
    Math.round(plan.initial_price * 100) === quote.totalCents &&
    plan.metadata?.topup_amount === String(quote.amount) &&
    plan.metadata?.ad_spend_fee_percent === String(quote.feePercent) &&
    plan.metadata?.ad_spend_fee_amount === String(quote.fee) &&
    matchesMetadata(plan, quote, forceUsd) &&
    hasTopUpMethods(plan.payment_method_configuration);
}

function hasTopUpMethods(configuration: Record<string, unknown> | null) {
  if (!configuration || configuration.include_platform_defaults !== false) return false;
  const enabled = configuration.enabled;
  const disabled = configuration.disabled;
  return Array.isArray(enabled) &&
    enabled.length === topUpPaymentMethods.length &&
    topUpPaymentMethods.every((method) => enabled.includes(method)) &&
    Array.isArray(disabled) &&
    disabled.length === topUpPaymentConfiguration.disabled.length &&
    topUpPaymentConfiguration.disabled.every((method) => disabled.includes(method));
}

export async function getTopUpPlan(
  whop: WhopClient,
  accountId: string,
  productId: string,
  quote: TopUpQuote | LeadQuote,
  forceUsd = false,
) {
  const plans = await whop.plans.list({
    account_id: accountId,
    product_ids: [productId],
    plan_types: ["one_time"],
    visibilities: ["quick_link"],
    first: 100,
  });

  for await (const plan of plans) {
    if (plan.currency !== quote.currency || Math.round(plan.initial_price * 100) !== quote.totalCents ||
      plan.metadata?.topup_amount !== String(quote.amount) ||
      plan.metadata?.ad_spend_fee_percent !== String(quote.feePercent) ||
      plan.metadata?.ad_spend_fee_amount !== String(quote.fee) ||
      plan.metadata?.pricing_mode !== (forceUsd ? "forced_usd" : "adaptive") ||
      !matchesMetadata(plan, quote, forceUsd)) continue;
    if (hasTopUpMethods(plan.payment_method_configuration) && plan.adaptive_pricing_enabled === !forceUsd) return plan;
    // This product belongs only to this site's top-ups; other products are untouched.
    return whop.plans.update({ id: plan.id, adaptive_pricing_enabled: !forceUsd, payment_method_configuration: topUpPaymentConfiguration });
  }

  return whop.plans.create({
    account_id: accountId,
    product_id: productId,
    currency: quote.currency,
    initial_price: quote.total,
    adaptive_pricing_enabled: !forceUsd,
    plan_type: "one_time",
    title: isLeadQuote(quote) ? `${quote.leadCount} ${quote.state} leads` : "Ad spend top-up",
    visibility: "quick_link",
    unlimited_stock: true,
    payment_method_configuration: topUpPaymentConfiguration,
    metadata: metadataForQuote(quote, forceUsd),
  }, {
    // Concurrent requests for the same amount reuse the same creation attempt.
    idempotencyKey: isLeadQuote(quote)
      ? `loudr-leads-${accountId}-${productId}-${leadQuoteKey(quote)}-${forceUsd ? "usd" : "adaptive"}-v1`
      : `unlimited-scaling-topup-${topUpQuoteKey(quote)}-${forceUsd ? "usd" : "adaptive"}-v4`,
  });
}
