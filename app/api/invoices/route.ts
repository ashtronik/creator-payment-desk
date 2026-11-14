import { verifyDeskToken } from "@/lib/db";
import { createInvoiceForCreator, createInvoiceForWallet } from "@/lib/invoice-service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";
import { normalizeDeliverableUrl } from "@/lib/validate";

const MAX_BODY_BYTES = 10 * 1024;
const hour = 60 * 60_000;

function rateLimited(retryAfterSeconds: number) {
  return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
}

export async function POST(request: Request) {
  const hasDeskToken = request.headers.has("x-desk-token");
  const deskToken = request.headers.get("x-desk-token");
  const deskAccess = hasDeskToken && deskToken ? verifyDeskToken(deskToken) : null;
  if (hasDeskToken && !deskAccess) {
    const attempt = rateLimit(`desk-token-failure:${clientIp(request)}`, 20, 10 * 60_000);
    if (!attempt.ok) return rateLimited(attempt.retryAfterSeconds);
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const limit = deskAccess && deskToken
    ? rateLimit(`invoice-create-token:${hashToken(deskToken)}`, 60, hour)
    : rateLimit(`invoice-create-ip:${clientIp(request)}`, 10, hour);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json({ errors: { body: "Request body must be 10 KB or smaller" } }, { status: 400 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return Response.json({ errors: { body: "Request body must be 10 KB or smaller" } }, { status: 400 });
    }
    body = JSON.parse(text);
  } catch {
    return Response.json({ errors: { body: "Invalid JSON body" } }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ errors: { body: "JSON body must be an object" } }, { status: 400 });
  }

  try {
    const input = body as Record<string, unknown>;
    const deliverableUrl = normalizeDeliverableUrl(input.deliverableUrl);
    if (!deliverableUrl.ok) return Response.json({ errors: { deliverableUrl: deliverableUrl.error } }, { status: 400 });
    if (deskAccess) {
      const result = createInvoiceForCreator(deskAccess.creatorId, {
        amountCents: input.amountCents,
        description: input.description,
        deliverableUrl: deliverableUrl.value,
        clientName: input.clientName,
      });
      if (result.kind === "invalid") return Response.json({ errors: result.errors }, { status: 400 });
      const origin = new URL(request.url).origin;
      return Response.json({
        invoiceId: result.invoiceId,
        payUrl: `${origin}/pay/${encodeURIComponent(result.invoiceId)}`,
      }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    const result = createInvoiceForWallet({
      wallet: input.wallet,
      amountCents: input.amountCents,
      description: input.description,
      deliverableUrl: deliverableUrl.value,
      clientName: input.clientName,
    });
    if (result.kind === "invalid") return Response.json({ errors: result.errors }, { status: 400 });
    if (result.kind === "desk_exists") return Response.json({ error: "DESK_EXISTS" }, { status: 409 });

    const origin = new URL(request.url).origin;
    return Response.json({
      invoiceId: result.invoiceId,
      payUrl: `${origin}/pay/${encodeURIComponent(result.invoiceId)}`,
      deskUrl: `${origin}/desk/${encodeURIComponent(result.deskToken)}`,
      deskToken: result.deskToken,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to create invoice" }, { status: 500 });
  }
}
