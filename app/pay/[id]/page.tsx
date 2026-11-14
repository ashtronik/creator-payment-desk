import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getInvoicePaymentDetails } from "@/lib/db";
import { PayPanel } from "./pay-panel";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  return <main className="px-6 py-12 sm:px-10 sm:py-16"><Suspense fallback={<p className="mx-auto max-w-6xl text-sm text-muted">Loading invoice…</p>}><InvoiceDetails params={params} /></Suspense></main>;
}

async function InvoiceDetails({ params }: { params: Promise<{ id: string }> }) {
  await io();
  const { id } = await params;
  const invoice = getInvoicePaymentDetails(id);
  if (!invoice) notFound();
  const deliverableUrl = typeof invoice.deliverable_url === "string" ? invoice.deliverable_url : "";
  const hasDeliverable = /^https?:\/\//i.test(deliverableUrl);
  return <section className="mx-auto grid w-full max-w-6xl items-stretch gap-6 lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]"><article className="surface h-full p-6 sm:p-10"><p className="eyebrow text-green">Payment summary</p><p className="eyebrow mt-5 text-muted">What was delivered</p><p className="mt-2 line-clamp-5 break-words text-xl font-medium leading-7 text-text [overflow-wrap:anywhere]">{invoice.description}</p><p className="mono mt-8 text-5xl font-bold tracking-[-.05em] text-text">{formatUsd(invoice.amount_cents)}</p><p className="mt-1 text-sm font-semibold text-muted">USD, paid in USDC</p>{hasDeliverable ? <a href={deliverableUrl} target="_blank" rel="noopener noreferrer" className="button-outline lift mt-8 inline-flex items-center gap-2 text-base"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2"/></svg>View deliverable</a> : null}<dl className="mt-8 space-y-4 border-t border-line pt-6 text-base"><div className="flex items-start justify-between gap-6"><dt className="text-muted">To</dt><dd className="mono flex items-center gap-2 font-medium text-text">{shortenAddress(invoice.recipient_address)}<span aria-hidden="true" className="text-muted">⧉</span></dd></div>{invoice.client_name ? <div className="flex items-start justify-between gap-6"><dt className="text-muted">Client</dt><dd className="font-medium text-text">{invoice.client_name}</dd></div> : null}</dl></article><PayPanel invoiceId={invoice.id} /></section>;
}

function formatUsd(cents: number): string { return `$${Math.floor(cents / 100).toLocaleString("en-US")}.${String(cents % 100).padStart(2, "0")}`; }
function shortenAddress(address: string): string { return address.length <= 14 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`; }
