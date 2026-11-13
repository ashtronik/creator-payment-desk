import { listInvoicesForCreator, verifyDeskToken } from "@/lib/db";

function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export { escapeCsvCell };

function formatUsd(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const token = request.headers.get("x-desk-token");
  const access = token ? verifyDeskToken(token) : null;
  if (!access) return Response.json({ error: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const header = ["invoice_id", "created_at", "description", "client_name", "amount_usd", "status", "paid_at", "tx_hash"];
  const rows = listInvoicesForCreator(access.creatorId).map((invoice) => [
    invoice.id, invoice.created_at, invoice.description, invoice.client_name, formatUsd(invoice.amount_cents), invoice.status, invoice.paid_at ?? "", invoice.tx_hash ?? "",
  ].map((value) => escapeCsvCell(value)).join(","));
  return new Response([header.join(","), ...rows].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="invoices.csv"', "Cache-Control": "no-store" },
  });
}
