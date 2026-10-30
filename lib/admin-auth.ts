// Temporary open-access rollout explicitly requested by the site owner.
// Replace this guard with verified Whop session + business team membership.
export async function requireAdmin(_request: Request): Promise<Response | null> {
  if (process.env.ADMIN_ACCESS_MODE === "open") return null;
  return Response.json({ error: "Admin access is not enabled." }, { status: 403, headers: { "Cache-Control": "no-store" } });
}

export function checkMutationOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (origin !== new URL(request.url).origin || contentType !== "application/json") {
    return Response.json({ error: "Save prices from this site's admin page." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}
