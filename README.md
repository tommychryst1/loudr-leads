# LOUDR Leads

Next.js 15 / React 19 / TypeScript lead ordering for LOUDR Media, with Whop Elements 1.9.0 and Whop SDK 2.6.0 checkout.

## Local development

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

Open `http://localhost:3000`. Without payment environment variables, state selection, quantities, prices and guidance work; the payment step displays a setup message.

## Lead pricing and guidance

`lib/lead-pricing.ts` is the shared rate card for all 50 states. California is sold out and rejected by both payment endpoints. The UI offers 1, 5, 10, 15 and 25 leads, plus custom whole-number quantities. Guidance starts after a quantity is entered and progresses to green at 50 leads. Guidance describes opportunity, not a promised conversion rate.

The base price is the selected state's per-lead price multiplied by the lead count. The existing fee behavior is retained: 2.5% by default, editable from 2.5% to 5%, with up to two decimal places. Fees round once to cents. For example, 5 Texas leads at $500 each cost $2,500 plus $62.50 at 2.5%, for $2,562.50 total. The maximum base order is $500,000; each state's quantity limit follows from its price.

## Payment configuration

Set these variables in `.env.local` locally and in the intended Vercel project's environment settings:

| Variable | Purpose |
| --- | --- |
| `WHOP_API_KEY` | Server-only Whop credential with payment and plan permissions. |
| `WHOP_ACCOUNT_ID` | LOUDR's intended merchant account (`biz_…`). |
| `WHOP_TOPUP_PRODUCT_ID` | Dedicated LOUDR lead product (`prod_…`); the existing variable name is retained for deployment compatibility. |
| `NEXT_PUBLIC_WHOP_ACCOUNT_ID` | Same merchant account, used by the payment elements. |
| `WHOP_WEBHOOK_SECRET` | Server-only signing secret for the payment webhook. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; `https://loudr-leads.vercel.app` for that production origin. |

Public variables are embedded at build time. Rebuild after changing them. The repository was inherited from an Unlimited Scaling ad-spend checkout; do not assume the inherited merchant or product belongs to LOUDR. Confirm the account, dedicated lead product and environment values before enabling live payments.

`/api/checkout` and the lower-level `/api/pay` accept `state`, `leadCount`, `feePercent` and the optional boolean `forceUsd`. Prices are recomputed from the server rate card; client-supplied amounts, unit prices and totals are not trusted. Missing/unknown states, California, fractional quantities, invalid fees and oversized orders are rejected before calling Whop. Old amount-only requests are no longer accepted.

Server-created plan metadata records state, quantity and unit price, along with base amount and fee. Plan matching, browser/server cache keys and creation idempotency distinguish state, quantity, price, fee and adaptive versus forced-USD mode. Orders with the same total but different states or quantities cannot reuse each other's plans. Legacy `topup_amount` and `ad_spend_fee_*` metadata names remain for compatibility; `source: loudr-leads` and `lead_state`, `lead_count`, `lead_unit_price` identify lead orders.

Whop's adaptive pricing handles eligible local currencies. The Make USD button creates or selects a separate non-adaptive plan. Only EUR bank transfer, SEPA, USD bank wire and ACH are enabled, preserving the original payment-method configuration.

## Deployment and fulfillment

Intended public site: `https://loudr-leads.vercel.app`. The actual Vercel project connection and deployment credentials must be verified before publishing. The repository's prior documentation referred to a different project, `unlimitedscalingwhop`; that is not a deployment target for these changes.

Register `payment.succeeded` at `https://loudr-leads.vercel.app/api/webhooks/whop` and configure its signing secret. The webhook verifies signatures and logs payment metadata only. It does **not** deliver leads or credit balances. Fulfillment must retrieve and verify the payment and its server-authored plan (merchant, product, state, quantity, price and any currency conversion), map the buyer to a customer, and deduplicate durable work on `payment.id`. Checkout-provided metadata and return-page query parameters are not fulfillment authority.

Run HTTPS checkout and signed webhook smoke checks against the intended configured merchant before accepting live lead orders. Unit tests and local builds do not establish live payment or fulfillment readiness.

## Branding

The interface uses black, white and LOUDR yellow. `components/Brand.tsx` references the original logo published on `loudrmedia.com`, with a text fallback if the CDN image fails. A local original logo asset can replace this dependency when available.
