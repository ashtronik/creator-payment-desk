import { InvoiceNotFoundError, OneClickProviderError, refreshInvoiceStatus } from "@/lib/payment-service";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const limit = rateLimit(`invoice-status-ip:${clientIp(request)}`, 120, 60_000);
  if (!limit.ok) return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const { id } = await context.params;
    return Response.json(await refreshInvoiceStatus(id), { headers: noStore });
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });
    if (error instanceof OneClickProviderError) return Response.json({ error: "PAYMENT_PROVIDER_ERROR" }, { status: 502, headers: noStore });
    return Response.json({ error: "PAYMENT_PROVIDER_ERROR" }, { status: 502, headers: noStore });
  }
}
