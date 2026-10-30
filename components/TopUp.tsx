"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { loadWhop } from "@whop/elements";
import { Checkout, CheckoutElement, WhopElements } from "@whop/elements-react";
import { ArrowIcon, LockIcon } from "@/components/Icons";
import { formatAmount } from "@/lib/top-up";
import { calculateLeadQuote, LEAD_STATES, MAX_LEAD_QUANTITY, leadMetadata, leadQuoteKey, type LeadQuote } from "@/lib/lead-pricing";
import { isValidLeadCount } from "@/lib/leads";
import LeadSelector from "@/components/LeadSelector";
import { createPlanPreparer } from "@/lib/checkout-preparation";

const appearance = {
  theme: { appearance: "dark" as const, accentColor: "yellow" as const, grayColor: "gray" as const },
};

function amountError(value: string, max: number): string | null {
  if (!value.trim()) return "Choose how many leads you’d like.";
  if (!isValidLeadCount(Number(value))) return "Enter a whole number of leads, starting at 1.";
  if (Number(value) > max) return `Choose up to ${max.toLocaleString("en-US")} leads for this state.`;
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function TopUp() {
  const [value, setValue] = useState("");
  const [state, setState] = useState("");
  const [stateTouched, setStateTouched] = useState(false);
  const stateRef = useRef<HTMLSelectElement>(null);
  const currency = "usd" as const;
  const [forceUsd, setForceUsd] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);
  const [checkoutVersion, setCheckoutVersion] = useState(0);
  const [step, setStep] = useState<"amount" | "payment">("amount");
  const [touched, setTouched] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const preparingRef = useRef(false);
  const [loadError, setLoadError] = useState<{ retry: () => void } | null>(null);
  const [elements, setElements] = useState<ReturnType<typeof loadWhop> | null>(null);
  const [preparePlan] = useState(() => createPlanPreparer<LeadQuote>(async (quote, forceUsd) => {
    const result = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: quote.state, quantity: quote.leadCount, forceUsd }),
      signal: AbortSignal.timeout(15_000),
    });
    const response = await result.json();
    if (!result.ok || typeof response.planId !== "string" || !/^plan_[a-zA-Z0-9]+$/.test(response.planId) ||
      response.quote?.state !== quote.state || response.quote?.leadCount !== quote.leadCount || response.quote?.unitPrice !== quote.unitPrice ||
      response.quote?.totalCents !== quote.totalCents || response.quote?.amountCents !== quote.amountCents ||
      response.quote?.feeBasisPoints !== quote.feeBasisPoints || response.quote?.currency !== "usd" || response.forceUsd !== forceUsd) {
      throw new Error(response.error || "We couldn’t load payment options. Please try again.");
    }
    return response.planId as string;
  }, leadQuoteKey));
  const inputRef = useRef<HTMLInputElement>(null);
  const paymentTitleRef = useRef<HTMLHeadingElement>(null);
  const leadCount = Number(value);
  const selectedState = LEAD_STATES.find((item) => item.code === state);
  const maxLeads = MAX_LEAD_QUANTITY;
  const stateError = stateTouched && !selectedState ? "Choose a state to see your price." : selectedState?.price === null ? "California is sold out. Please choose another state." : null;
  const quote = useMemo(() => {
    try { return calculateLeadQuote(state, leadCount); }
    catch { return null; }
  }, [state, leadCount]);
  const checkoutMetadata = useMemo(() => quote ? { ...leadMetadata(quote, forceUsd), order_id: orderId } : undefined, [quote, forceUsd, orderId]);
  const error = (touched ? amountError(value, maxLeads) : null);
  const accountId = process.env.NEXT_PUBLIC_WHOP_ACCOUNT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const configured = Boolean(accountId?.startsWith("biz_") && siteUrl);

  // Load the hosted SDK while the buyer chooses an amount, rather than after Continue.
  useEffect(() => {
    if (configured) setElements(loadWhop());
  }, [configured]);

  useEffect(() => {
    if (!configured || step !== "amount" || !quote) return;
    // Wait for typing to settle; Continue shares this request if it is still in flight.
    const timer = setTimeout(() => { void preparePlan(quote).catch(() => {}); }, 400);
    return () => clearTimeout(timer);
  }, [configured, quote, preparePlan, step]);

  useEffect(() => {
    if (step === "payment") paymentTitleRef.current?.focus();
  }, [step]);

  async function continueToPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    setStateTouched(true);
    if (!selectedState || selectedState.price === null) { stateRef.current?.focus(); return; }
    if (amountError(value, maxLeads)) {
      inputRef.current?.focus();
      return;
    }
    if (!quote) { inputRef.current?.focus(); return; }
    if (preparingRef.current) return;
    preparingRef.current = true;
    setPreparing(true);
    setCheckoutError(null);
    try {
      if (configured) {
        setPlanId(await preparePlan(quote));
        setForceUsd(false);
        setElementError(null);
        setCheckoutLoading(true);
        setCompleted(false);
      }
      setOrderId(`leads_${Date.now().toString(36)}`);
      setStep("payment");
    } catch (error) {
      setCheckoutError(errorMessage(error));
    } finally {
      preparingRef.current = false;
      setPreparing(false);
    }
  }

  function changeAmount() {
    if (preparing || completed) return;
    setPlanId(null);
    setStep("amount");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function makeUsd() {
    if (!quote || forceUsd || preparingRef.current || completed) return;
    preparingRef.current = true;
    setPreparing(true);
    setCheckoutError(null);
    try {
      const usdPlan = await preparePlan(quote, true);
      setPlanId(usdPlan);
      setForceUsd(true);
      setElementError(null);
      setCheckoutLoading(true);
    } catch (error) {
      setCheckoutError(errorMessage(error));
    } finally {
      preparingRef.current = false;
      setPreparing(false);
    }
  }

  return (
    <WhopElements elements={elements} appearance={appearance} onLoadError={(_error, retry) => setLoadError({ retry })}>
    <div className="checkout-wrap">
      <div className="checkout-panel">
        <div className="panel-topline">
          <span className="panel-caption">Your growth, on your terms</span>
          <span className="step-counter">{step === "amount" ? "01" : "02"}<span> / 02</span></span>
        </div>
        {step === "amount" ? (
          <form onSubmit={continueToPayment} noValidate aria-busy={preparing}>
            <h2 className="panel-title">Make room for more.</h2>
            <p className="panel-description">Choose your state and how many leads you’d like.</p>

            <label className="state-label" htmlFor="lead-state">Your state</label>
            <select id="lead-state" className="state-field" ref={stateRef} value={state} disabled={preparing}
              onChange={(event) => { setState(event.target.value); setStateTouched(true); setCheckoutError(null); }}
              onBlur={() => setStateTouched(true)} aria-invalid={Boolean(stateError)}
              aria-describedby={stateError ? "state-error" : undefined}>
              <option value="" disabled>Select your state</option>
              {LEAD_STATES.map((item) => <option key={item.code} value={item.code} disabled={item.price === null}>
                {item.name} ({item.code}) — {item.price === null ? "Sold out" : `${formatAmount(item.price)} / lead`}
              </option>)}
            </select>
            {stateError && <p id="state-error" className="form-error" role="alert">{stateError}</p>}
            <LeadSelector value={value} onChange={(next) => { setValue(next); setTouched(true); setCheckoutError(null); }}
              onBlur={() => setTouched(true)} error={error} disabled={preparing} max={maxLeads} inputRef={inputRef} />

            <div className="quote-summary" aria-live="polite">
              <div><span>Price per lead{selectedState ? ` (${selectedState.code})` : ""}</span><span>{selectedState?.price ? formatAmount(selectedState.price) : "—"}</span></div>
              <div><span>Lead subtotal{quote ? ` (${quote.leadCount} ${quote.leadCount === 1 ? "lead" : "leads"})` : ""}</span><span>{quote ? formatAmount(quote.amount, currency) : "—"}</span></div>
              <div className="quote-total"><span>Total to pay</span><strong>{quote ? formatAmount(quote.total, currency) : "—"}</strong></div>
            </div>
            {checkoutError && <p className="form-error checkout-error" role="alert">{checkoutError}</p>}
            <button className="primary-button" type="submit" disabled={preparing || !quote}>{preparing ? "Loading payment options…" : "Continue to payment"} {!preparing && <ArrowIcon />}</button>
            <p className="panel-footnote">Choose your payment method in the next step.</p>
          </form>
        ) : (
          <>
            <h2 className="panel-title" ref={paymentTitleRef} tabIndex={-1}>One step from momentum.</h2>
            <p className="panel-description">Complete your lead order securely with Whop.</p>
            <div className="payment-summary">
              <div><span>{selectedState?.name} · {leadCount} {leadCount === 1 ? "lead" : "leads"}</span><span>{quote ? formatAmount(quote.amount, currency) : "—"}</span></div>
              <div className="quote-total"><span>USD total</span><strong>{quote ? formatAmount(quote.total, currency) : "—"}</strong></div>
              <button className="text-button" type="button" onClick={changeAmount} disabled={preparing || completed}>Change state or leads</button>
            </div>
            {configured && planId && quote ? (
              <>
                {loadError && (
                  <div className="payment-load-error" role="alert">
                    <p className="form-error">We couldn’t load the secure payment form. Check your connection and try again.</p>
                    <button className="text-button" type="button" onClick={() => { loadError.retry(); setLoadError(null); }}>Reload payment form</button>
                  </div>
                )}
                <p className="currency-note">{forceUsd ? "Payment currency is USD." : "Your local-currency total and eligible bank methods appear below."}</p>
                {elementError && <div className="payment-load-error" role="alert">
                  <p className="form-error">{elementError}</p>
                  <button className="text-button" type="button" onClick={() => { setElementError(null); setCheckoutLoading(true); setCheckoutVersion((version) => version + 1); }}>Reload checkout</button>
                </div>}
                <Checkout key={`${planId}:${checkoutVersion}`} plan={planId}
                  metadata={checkoutMetadata}
                  returnUrl={`${siteUrl}/checkout/return?order=${orderId}`}
                  onLoadingChange={setCheckoutLoading}
                  onComplete={() => setCompleted(true)}>
                  <CheckoutElement fallback={<div className="checkout-loading" role="status">Loading secure checkout…</div>}
                    onReady={() => setCheckoutLoading(false)}
                    onError={(event) => { setElementError(event.message || "Unable to load checkout. Please try again."); setCheckoutLoading(false); }} />
                </Checkout>
                {checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}
                <div className="usd-override">
                  {forceUsd ? <p role="status">Paying in US dollars.</p> : <>
                    <p>Prefer to pay in US dollars?</p>
                    <button className="text-button" type="button" onClick={makeUsd} disabled={preparing || checkoutLoading || completed}>{preparing ? "Switching to USD…" : "Make USD"}</button>
                  </>}
                </div>
              </>
            ) : (
              <div className="configuration-notice" role="status">
                <LockIcon />
                <h3>Payments are being connected.</h3>
                <p>Please check back shortly to complete your lead order.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </WhopElements>
  );
}
