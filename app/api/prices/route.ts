import { PricingError, readRateCard } from "@/lib/pricing-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return Response.json(await readRateCard(), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof PricingError ? error.message : "Prices are temporarily unavailable." }, {
      status: error instanceof PricingError ? error.status : 503, headers,
    });
  }
}
