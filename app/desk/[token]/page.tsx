import type { Metadata } from "next";
import { io } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCreatorDesk, verifyDeskToken } from "@/lib/db";
import { refreshInvoiceStatus } from "@/lib/payment-service";
import { DeskClient } from "./desk-client";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function DeskPage({ params }: { params: Promise<{ token: string }> }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 sm:py-16"><Suspense fallback={<p className="mx-auto max-w-5xl text-sm text-slate-600">Loading desk…</p>}><DeskDetails params={params} /></Suspense></main>;
}

async function DeskDetails({ params }: { params: Promise<{ token: string }> }) {
  await io();
  const { token } = await params;
  const access = verifyDeskToken(token);
  if (!access) notFound();
  const initialDesk = getCreatorDesk(access.creatorId);
  await Promise.all(initialDesk.invoices
    .filter((invoice) => invoice.status === "awaiting_deposit" || invoice.status === "processing")
    .slice(0, 10)
    .map((invoice) => refreshInvoiceStatus(invoice.id).catch(() => undefined)));
  const desk = getCreatorDesk(access.creatorId);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const payOrigin = host ? `${protocol}://${host}` : "";
  return <DeskClient deskToken={token} payOrigin={payOrigin} invoices={desk.invoices} totals={desk.totals} />;
}
