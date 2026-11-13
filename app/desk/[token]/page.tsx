import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { getCreatorDesk, verifyDeskToken } from "@/lib/db";
import { refreshInvoiceStatus } from "@/lib/payment-service";
import { rateLimit } from "@/lib/rate-limit";
import { DeskClient } from "./desk-client";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export const instant = false;

export default async function DeskPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const [{ token }, requestHeaders] = await Promise.all([params, headers()]);
  const access = verifyDeskToken(token);
  if (!access) {
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    rateLimit(`desk-token-failure:${ip}`, 20, 10 * 60_000);
    notFound();
  }
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const payOrigin = host ? `${protocol}://${host}` : "";

  return <main className="px-4 py-12 sm:px-6 sm:py-16"><Suspense fallback={<p className="mx-auto max-w-[1080px] text-sm text-muted">Loading desk…</p>}><DeskDetails creatorId={access.creatorId} deskToken={token} payOrigin={payOrigin} /></Suspense></main>;
}

async function DeskDetails({ creatorId, deskToken, payOrigin }: { creatorId: number; deskToken: string; payOrigin: string }) {
  const initialDesk = getCreatorDesk(creatorId);
  await Promise.all(initialDesk.invoices
    .filter((invoice) => invoice.status === "awaiting_deposit" || invoice.status === "processing")
    .slice(0, 10)
    .map((invoice) => refreshInvoiceStatus(invoice.id).catch(() => undefined)));
  const desk = getCreatorDesk(creatorId);
  return <DeskClient deskToken={deskToken} payOrigin={payOrigin} invoices={desk.invoices} totals={desk.totals} />;
}
