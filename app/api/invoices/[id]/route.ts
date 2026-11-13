import { connection } from "next/server";

import { getInvoicePublic } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  const invoice = getInvoicePublic(id);
  return invoice ? Response.json(invoice) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
}
