import { waitUntil } from "@vercel/functions";
import { unwrapWebhook } from "@whop/sdk/helpers";

export const runtime = "nodejs";

async function recordPayment(payment: Record<string, unknown>) {
  const metadata = payment.metadata as Record<string, unknown> | null | undefined;
  // TODO: Lead fulfillment must retrieve the payment and its associated plan,
  // verify server-authored state/count/unit-price metadata and account/product,
  // and deduplicate by payment.id. Checkout metadata can be buyer-controlled.
  // This handler currently logs only; it does not deliver leads or credit balances.
  // This verified webhook is the only trusted place to credit the client's
  // balance. Replace this log with a durable ledger transaction, deduplicated by
  // payment.id, that verifies the USD amount/account and links a known client.
  // Whop retries webhooks: make that transaction idempotent before going live.
  // Never credit a balance from query parameters or from the return page.
  console.log("Verified payment received", {
    source: metadata?.source,
    lead_state: metadata?.lead_state,
    lead_count: metadata?.lead_count,
    lead_unit_price: metadata?.lead_unit_price,
    payment_id: payment.id,
    order_id: metadata?.order_id,
    topup_amount_usd: metadata?.topup_amount_usd,
    topup_amount: metadata?.topup_amount,
    currency: metadata?.currency,
    ad_spend_fee_percent: metadata?.ad_spend_fee_percent,
    ad_spend_fee_amount: metadata?.ad_spend_fee_amount,
    total_amount: metadata?.total_amount,
    customer_email: payment.customer_email,
  });
}

export async function POST(request: Request) {
  const key = process.env.WHOP_WEBHOOK_SECRET;
  if (!key) return Response.json({ error: "Webhook is not configured." }, { status: 503 });

  const payload = await request.text();
  let event;
  try {
    event = unwrapWebhook(payload, {
      headers: Object.fromEntries(request.headers),
      key,
    });
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "payment.succeeded") {
    waitUntil(recordPayment(event.data as unknown as Record<string, unknown>));
  }
  return Response.json({ received: true });
}
