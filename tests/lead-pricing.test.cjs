const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-ts.cjs');
const topup = loadTypeScript('lib/top-up.ts');
const { LEAD_STATES, calculateLeadQuote, leadQuoteKey, leadMetadata } = loadTypeScript('lib/lead-pricing.ts', { '@/lib/top-up': topup });
const expected = { AL:325, AK:325, AZ:450, AR:175, CA:null, CO:400, CT:285, DE:150, FL:375, GA:400, HI:100, ID:250, IL:350, IN:285, IA:250, KS:240, KY:250, LA:225, ME:150, MD:300, MA:290, MI:325, MN:250, MS:175, MO:285, MT:225, NE:325, NV:375, NH:150, NJ:350, NM:280, NY:400, NC:325, ND:250, OH:250, OK:235, OR:350, PA:265, RI:235, SC:300, SD:250, TN:275, TX:500, UT:375, VT:100, VA:225, WA:425, WV:160, WI:250, WY:250 };
test('all 50 state prices match the supplied rate card', () => {
  assert.equal(LEAD_STATES.length, 50);
  assert.deepEqual(Object.fromEntries(LEAD_STATES.map(({code, price}) => [code, price])), expected);
  for (const [state, price] of Object.entries(expected)) {
    if (price === null) { assert.throws(() => calculateLeadQuote(state, 1, 2.5)); continue; }
    const quote = calculateLeadQuote(state, 25, 2.5);
    assert.equal(quote.amount, price * 25);
    assert.equal(quote.unitPrice, price);
    assert.equal(quote.feeCents, Math.round(price * 25 * 100 * 0.025));
  }
});
test('rejects sold-out states, missing states, fractional/invalid counts, invalid fees and oversized orders', () => {
  for (const state of ['CA', 'DC', 'tx', '', undefined, null, 1]) assert.throws(() => calculateLeadQuote(state, 1, 2.5));
  for (const count of [undefined, null, '1', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => calculateLeadQuote('TX', count, 2.5));
  for (const fee of [undefined, null, '2.5', 2.49, 5.01, 2.555]) assert.throws(() => calculateLeadQuote('TX', 1, fee));
  assert.equal(calculateLeadQuote('TX', 1000, 5).amount, 500000);
  assert.throws(() => calculateLeadQuote('TX', 1001, 5));
  assert.equal(calculateLeadQuote('HI', 5000, 2.5).amount, 500000);
});
test('same total across states or counts remains a distinct order identity', () => {
  const tx = calculateLeadQuote('TX', 1, 2.5);
  const hi = calculateLeadQuote('HI', 5, 2.5);
  const vt = calculateLeadQuote('VT', 5, 2.5);
  assert.equal(tx.total, hi.total);
  assert.notEqual(leadQuoteKey(tx), leadQuoteKey(hi));
  assert.notEqual(leadQuoteKey(hi), leadQuoteKey(vt));
  assert.equal(leadMetadata(tx).lead_state, 'TX');
  assert.equal(leadMetadata(tx).lead_count, '1');
  assert.equal(leadMetadata(tx).lead_unit_price, '500');
});
