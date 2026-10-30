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

`lib/lead-pricing.ts` contains the supplied rate card for all 50 states. California is sold out and rejected by both payment endpoints. Presets are 1, 5, 10, 15 and 25 leads; custom whole-number quantities from 1 through 1,000 are supported. Guidance starts after a quantity is entered and progresses to green at 50 leads. It describes opportunity, not a promised conversion rate.

The price is the selected state's per-lead price multiplied by quantity, with **no service fee**, preserving the existing production checkout. For example, 10 Florida leads at $375 each cost $3,750. Prices are calculated using integer cents.

## Payment configuration

Configure these variables in `.env.local` for local development and in the intended Vercel project for deployment:

| Variable | Purpose |
| --- | --- |
| `WHOP_API_KEY` | Server-only Whop credential with payment and plan permissions. |
| `WHOP_ACCOUNT_ID` | Intended merchant account (`biz_…`). |
| `WHOP_LEADS_PRODUCT_ID` | Dedicated LOUDR lead product (`prod_…`), matching production. |
| `NEXT_PUBLIC_WHOP_ACCOUNT_ID` | Same merchant account, used by payment elements. |
| `WHOP_WEBHOOK_SECRET` | Server-only signing secret for the payment webhook. |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; `https://loudr-leads.vercel.app` in production. |

Public variables are embedded at build time; rebuild after changing them. Existing Vercel production settings are retained. The unused ad-spend helper remains for compatibility tests but is not used to price lead orders.

`/api/checkout` and the lower-level `/api/pay` accept `state`, `quantity` (or `leadCount`) and optional boolean `forceUsd`. If both quantity aliases are present, they must match. Amounts, unit prices, fee percentages and totals supplied by clients cannot alter the server price. Unknown states, California, missing/fractional quantities, quantities above 1,000 and non-USD nominal prices are rejected before calling Whop.

Server-created plan metadata uses production-compatible `state`, `state_name`, `quantity`, `price_per_lead` and `pricing_mode` keys, plus `source: loudr-leads-site`, `currency` and `total_amount`. Plan lookup verifies merchant, product, order and pricing mode. Cache keys and idempotency distinguish state, quantity and unit price, including orders that share a total. A legacy ad-spend plan cannot be reused or repaired as a lead plan.

Whop handles eligible local currencies. Make USD selects a separate non-adaptive plan without changing another buyer's adaptive plan. EUR bank transfer, SEPA, USD bank wire and ACH remain enabled; other payment methods remain disabled.

## Deployment and fulfillment

Production: `https://loudr-leads.vercel.app`, project `prj_laSEpueJ84xcCcFItcwPSWCFTnc1`, team `team_nJJFw2mdvFrhMqsbZGUEOqsc` (Tommy Chryst's projects). Deploy only to this project for this repository. The older repository README's Unlimited Scaling project is unrelated to this release.

The signed `payment.succeeded` webhook logs payment metadata only. It does **not** deliver leads or credit balances. Fulfillment must retrieve and verify the payment and server-authored plan, map the buyer, and deduplicate durable work on `payment.id`. Checkout-provided metadata and return-page query parameters are not fulfillment authority.

Unit tests validate pricing, unavailable states, quantity boundaries, no-fee totals, cache separation and plan verification. A production build is required before deployment. Payment verification must not create a real buyer charge merely to test a release.

## Branding

Black, white and LOUDR yellow are used throughout. The header uses LOUDR's published logo with a text fallback if the image fails. Quantity guidance becomes more encouraging across 1, 5, 10, 15, 25 and 50+ leads.
