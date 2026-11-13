import { InvoiceNotFoundError, InvoicePaidError, OneClickProviderError, PaymentInputError, createQuoteForInvoice } from "@/lib/payment-service";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 5 * 1024;
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ipLimit = rateLimit(`invoice-quote-ip:${clientIp(request)}`, 15, 60 * 60_000);
  const invoiceLimit = rateLimit(`invoice-quote-id:${id}`, 3, 60 * 60_000);
  if (!ipLimit.ok || !invoiceLimit.ok) {
    return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "Retry-After": String(Math.max(ipLimit.retryAfterSeconds, invoiceLimit.retryAfterSeconds)) } });
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore });
  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("too large");
    body = JSON.parse(text);
  } catch { return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore });
  try {
    const input = body as Record<string, unknown>;
    const result = await createQuoteForInvoice(id, input.originAsset, input.refundTo);
    return Response.json(result, { headers: noStore });
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });
    if (error instanceof InvoicePaidError) return Response.json({ error: "ALREADY_PAID" }, { status: 409, headers: noStore });
    if (error instanceof PaymentInputError) return Response.json({ error: "INVALID_INPUT" }, { status: 400, headers: noStore });
    if (error instanceof OneClickProviderError) return Response.json({ error: "PAYMENT_PROVIDER_ERROR" }, { status: 502, headers: noStore });
    return Response.json({ error: "PAYMENT_PROVIDER_ERROR" }, { status: 502, headers: noStore });
  }
}
