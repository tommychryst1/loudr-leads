import { WhopClient } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { paidLeadOrder, slackOrderMessage } from "@/lib/paid-lead-order";
import { deliverSlackOrder } from "@/lib/slack-order-delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const key = process.env.WHOP_WEBHOOK_SECRET;
  if (!key) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const payload = await request.text();
  let event;
  try { event = unwrapWebhook(payload, { headers: Object.fromEntries(request.headers), key }); }
  catch { return Response.json({ error: "Invalid webhook signature." }, { status: 400 }); }
  if (event.type !== "payment.succeeded") return Response.json({ received: true });
  const paymentId = (event.data as { id?: unknown }).id;
  if (typeof paymentId !== "string" || !/^pay_[a-zA-Z0-9]+$/.test(paymentId)) return Response.json({ error: "Invalid payment event." }, { status: 400 });
  const accountId = process.env.WHOP_ACCOUNT_ID;
  const productId = process.env.WHOP_LEADS_PRODUCT_ID;
  if (!accountId || !productId || !process.env.WHOP_API_KEY || !process.env.SLACK_LEAD_ORDERS_WEBHOOK_URL) {
    return Response.json({ error: "Payment notifications are not configured." }, { status: 503 });
  }
  try {
    const whop = new WhopClient({ token: process.env.WHOP_API_KEY });
    const payment = await whop.payments.retrieve({ id: paymentId });
    if (payment.account_id !== accountId || payment.product_id !== productId) return Response.json({ received: true, ignored: true });
    if (!payment.plan_id) throw new Error("Payment plan unavailable.");
    const plan = await whop.plans.retrieve({ id: payment.plan_id });
    const order = paidLeadOrder(payment, plan, accountId, productId);
    // Await delivery before acknowledging so Whop can retry failures.
    const delivery = await deliverSlackOrder(paymentId, slackOrderMessage(order));
    return Response.json({ received: true, delivery });
  } catch {
    console.error("Paid lead notification could not be completed", { paymentId });
    return Response.json({ error: "Notification delivery is temporarily unavailable." }, { status: 503 });
  }
}
