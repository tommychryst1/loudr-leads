import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { applyPriceChanges, decodeStoredRateCard, defaultRateCard, MAX_PRICING_BODY_LENGTH, PricingError, validateChanges, validateVersion, type RateCard } from "@/lib/rate-card";

export { PricingError } from "@/lib/rate-card";
export type { RateCard, RateState, PriceChange } from "@/lib/rate-card";

const pathname = "pricing/state-prices.json";
const unavailable = () => new PricingError("Prices are temporarily unavailable. Please try again shortly.", 503);
const conflict = () => new PricingError("Prices changed since you opened this page. Reload the latest prices before saving.", 409);

function storageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function readRateCard(): Promise<RateCard> {
  if (!storageConfigured()) {
    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) return defaultRateCard();
    throw unavailable();
  }
  try {
    // Bypass both Next's data cache and Blob's CDN: every checkout reads current prices.
    const result = await get(pathname, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(15_000) });
    if (!result) return defaultRateCard();
    if (result.statusCode !== 200 || result.blob.size > MAX_PRICING_BODY_LENGTH ||
      !result.blob.etag || result.blob.etag.length > 256) throw unavailable();
    const text = await new Response(result.stream).text();
    if (text.length > MAX_PRICING_BODY_LENGTH) throw unavailable();
    return decodeStoredRateCard(JSON.parse(text), result.blob.etag);
  } catch (error) {
    if (error instanceof PricingError) throw error;
    throw unavailable();
  }
}

export async function saveRateChanges(version: unknown, input: unknown): Promise<RateCard> {
  validateVersion(version);
  const changes = validateChanges(input);
  if (!storageConfigured()) throw unavailable();
  const current = await readRateCard();
  if (current.version !== version) throw conflict();
  const document = applyPriceChanges(current, changes, new Date().toISOString());
  try {
    // Initial creation is also conditional: two initial saves cannot overwrite each other.
    const result = await put(pathname, JSON.stringify(document), {
      access: "private", addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60,
      ...(version === "initial" ? { allowOverwrite: false } : { allowOverwrite: true, ifMatch: version }),
      abortSignal: AbortSignal.timeout(15_000),
    });
    if (!result.etag) throw unavailable();
    return decodeStoredRateCard(document, result.etag);
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw conflict();
    if (version === "initial") {
      // Blob reports an already-created pathname as a general error. Confirm the
      // competing creation without exposing provider errors or masking outages.
      const latest = await readRateCard();
      if (latest.version !== "initial") throw conflict();
    }
    if (error instanceof PricingError) throw error;
    throw unavailable();
  }
}
