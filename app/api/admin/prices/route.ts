import { requireAdmin, checkMutationOrigin } from "@/lib/admin-auth";
import { PricingError, readRateCard, saveRateChanges } from "@/lib/pricing-store";
import { MAX_PRICING_BODY_LENGTH } from "@/lib/rate-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

function failure(error: unknown): Response {
  return Response.json({ error: error instanceof PricingError ? error.message : "Prices are temporarily unavailable." }, {
    status: error instanceof PricingError ? error.status : 503, headers,
  });
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return Response.json(await readRateCard(), { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const wrongOrigin = checkMutationOrigin(request);
  if (wrongOrigin) return wrongOrigin;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Send prices as JSON." }, { status: 415, headers });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_PRICING_BODY_LENGTH) return Response.json({ error: "Price changes are too large." }, { status: 413, headers });
  let input: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_PRICING_BODY_LENGTH) return Response.json({ error: "Price changes are too large." }, { status: 413, headers });
    input = JSON.parse(text);
  } catch {
    return Response.json({ error: "Send a valid JSON price update." }, { status: 400, headers });
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return Response.json({ error: "Send a price version and the state changes." }, { status: 400, headers });
  }
  try {
    const body = input as Record<string, unknown>;
    return Response.json(await saveRateChanges(body.version, body.changes), { headers });
  } catch (error) {
    return failure(error);
  }
}
