import { InvoiceNotFoundError, OneClickProviderError, refreshInvoiceStatus } from "@/lib/payment-service";

const noStore = { "Cache-Control": "no-store" };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(await refreshInvoiceStatus(id), { headers: noStore });
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });
    if (error instanceof OneClickProviderError) return Response.json({ error: "PAYMENT_PROVIDER_ERROR" }, { status: 502, headers: noStore });
    return Response.json({ error: "PAYMENT_PROVIDER_ERROR" }, { status: 502, headers: noStore });
  }
}
