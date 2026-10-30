const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-ts.cjs');
const pricing = loadTypeScript('lib/top-up.ts');
const leads = loadTypeScript('lib/lead-pricing.ts', { '@/lib/top-up': pricing });
const preferences = loadTypeScript('lib/payment-methods.ts');
const plans = loadTypeScript('lib/whop-plans.ts', { '@/lib/payment-methods': preferences, '@/lib/top-up': pricing, '@/lib/lead-pricing': leads });
const env = { WHOP_API_KEY: 'test-key', WHOP_ACCOUNT_ID: 'biz_test', WHOP_LEADS_PRODUCT_ID: 'prod_test', NEXT_PUBLIC_SITE_URL: 'https://example.com' };
const request = (body) => new Request('https://example.com/api/test', { method: 'POST', body: JSON.stringify(body) });
function checkoutRoute() {
  const calls = [];
  const { POST } = loadTypeScript('app/api/checkout/route.ts', {
    '@/lib/top-up': pricing, '@/lib/lead-pricing': leads,
    '@/lib/whop-plans': { getTopUpPlan: async (_, account, product, quote, forceUsd) => { calls.push({ account, product, quote, forceUsd }); return { id: 'plan_test' }; } },
    '@whop/sdk': { WhopClient: class {} }, 'next/cache': { unstable_cache: (fn) => fn },
  }, { process: { env } });
  return { POST, calls };
}
function payRoute(planChange = {}) {
  const quote = leads.calculateLeadQuote('TX', 2);
  const plan = { id: 'plan_test', account: { id: 'biz_test' }, product: { id: 'prod_test' }, currency: 'usd', initial_price: 1000,
    plan_type: 'one_time', visibility: 'quick_link', adaptive_pricing_enabled: true, metadata: leads.leadMetadata(quote), payment_method_configuration: preferences.topUpPaymentConfiguration, ...planChange };
  const charges = [];
  const client = { confirmationTokens: { retrieve: async () => ({ status: 'pending' }) }, plans: { retrieve: async () => plan },
    payments: { create: async (input) => { charges.push(input); return { id: 'pay_test', status: 'pending' }; } } };
  const { POST } = loadTypeScript('app/api/pay/route.ts', {
    '@/lib/top-up': pricing, '@/lib/lead-pricing': leads, '@/lib/whop-plans': plans,
    '@whop/sdk': { WhopClient: class { constructor() { return client; } } },
  }, { process: { env } });
  return { POST, charges };
}
const validPayment = { state: 'TX', leadCount: 2, feePercent: 2.5, currency: 'usd', confirmationToken: 'ctok_test', orderId: 'leads_test', planId: 'plan_test' };
test('checkout calculates total on the server and ignores a supplied fake total', async () => {
  const { POST, calls } = checkoutRoute();
  const response = await POST(request({ state: 'TX', leadCount: 2, feePercent: 2.5, amount: 1, unitPrice: 1, total: 1 }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.quote.total, 1000);
  assert.equal(calls[0].quote.currency, 'usd');
  assert.equal(calls[0].forceUsd, false);
  assert.equal(calls[0].account, 'biz_test');
});
test('both endpoints reject nominal currency and malformed USD override before calling Whop', async () => {
  for (const extra of [{ currency: 'gbp' }, { currency: 'eur' }, { forceUsd: 'true' }]) {
    const checkout = checkoutRoute();
    const pay = payRoute();
    assert.equal((await checkout.POST(request({ ...validPayment, ...extra }))).status, 400);
    assert.equal((await pay.POST(request({ ...validPayment, ...extra }))).status, 400);
    assert.equal(checkout.calls.length, 0);
    assert.equal(pay.charges.length, 0);
  }
});
test('charge uses the no-fee lead plan and live-compatible order metadata', async () => {
  const { POST, charges } = payRoute();
  assert.equal((await POST(request({ ...validPayment, total: 1 }))).status, 200);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].plan_id, 'plan_test');
  assert.equal(charges[0].metadata.topup_amount, undefined);
  assert.equal(charges[0].metadata.state, 'TX');
  assert.equal(charges[0].metadata.quantity, '2');
  assert.equal(charges[0].metadata.price_per_lead, '500');
  assert.equal(charges[0].metadata.ad_spend_fee_percent, undefined);
  assert.equal(charges[0].metadata.ad_spend_fee_amount, undefined);
  assert.equal(charges[0].metadata.total_amount, '1000');
});
test('charge rejects a wrong price or another business', async () => {
  for (const change of [{ initial_price: 1025 }, { account: { id: 'biz_old' } }, { metadata: { topup_amount: '1000', ad_spend_fee_percent: '5' } }]) {
    const { POST, charges } = payRoute(change);
    assert.equal((await POST(request(validPayment))).status, 400);
    assert.equal(charges.length, 0);
  }
});

test('checkout accepts the USD override without adding fees', async () => {
  const { POST, calls } = checkoutRoute();
  const response = await POST(request({ state: 'TX', leadCount: 200, feePercent: 5, forceUsd: true }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.forceUsd, true);
  assert.equal(body.quote.total, 100000);
  assert.equal(calls[0].quote.currency, 'usd');
  assert.equal(calls[0].forceUsd, true);
});

test('both endpoints reject sold-out states, invalid counts and old amount-only requests before Whop', async () => {
  for (const extra of [{ state: 'CA' }, { state: 'DC' }, { state: null }, { state: 'tx' }, { leadCount: 0 }, { leadCount: 1.5 }, { leadCount: '2' }, { leadCount: 1001 }, { state: undefined, leadCount: undefined, amount: 1000 }]) {
    const checkout = checkoutRoute();
    const pay = payRoute();
    assert.equal((await checkout.POST(request({ ...validPayment, ...extra }))).status, 400);
    assert.equal((await pay.POST(request({ ...validPayment, ...extra }))).status, 400);
    assert.equal(checkout.calls.length, 0);
    assert.equal(pay.charges.length, 0);
  }
});
test('charge rejects another lead order even when its monetary total matches', async () => {
  for (const replacement of [leads.calculateLeadQuote('HI', 10, 2.5), leads.calculateLeadQuote('VT', 10, 2.5)]) {
    const { POST, charges } = payRoute({ metadata: leads.leadMetadata(replacement) });
    assert.equal((await POST(request(validPayment))).status, 400);
    assert.equal(charges.length, 0);
  }
});


test('live quantity field is accepted, aliases agree and conflicting quantities are rejected', async () => {
  const checkout = checkoutRoute();
  const result = await checkout.POST(request({ state: 'FL', quantity: 10, feePercent: 99, total: 1 }));
  assert.equal(result.status, 200);
  const { quote } = await result.json();
  assert.equal(quote.total, 3750);
  assert.equal(quote.fee, 0);
  assert.equal(quote.quantity, 10);
  assert.equal(quote.leadCount, 10);
  assert.equal(quote.pricePerLead, 375);
  const payment = payRoute();
  assert.equal((await payment.POST(request({ ...validPayment, leadCount: undefined, quantity: 2 }))).status, 200);
  for (const route of [checkoutRoute(), payRoute()]) {
    assert.equal((await route.POST(request({ ...validPayment, quantity: 3 }))).status, 400);
  }
});
