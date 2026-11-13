import { countActiveDeskTokens, issueDeskToken, revokeOtherDeskTokens, verifyDeskToken } from "@/lib/db";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const token = request.headers.get("x-desk-token");
  const access = token ? verifyDeskToken(token) : null;
  if (!access) return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as Record<string, unknown>).revokeOthers !== "boolean") {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore });
  }
  if (countActiveDeskTokens(access.creatorId) >= 10) return Response.json({ error: "TOKEN_LIMIT" }, { status: 409, headers: noStore });
  const newToken = issueDeskToken(access.creatorId);
  if ((body as { revokeOthers: boolean }).revokeOthers) revokeOtherDeskTokens(access.creatorId, newToken);
  const origin = new URL(request.url).origin;
  return Response.json({ deskUrl: `${origin}/desk/${encodeURIComponent(newToken)}`, deskToken: newToken }, { status: 201, headers: noStore });
}
