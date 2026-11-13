import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getInvoicePaymentDetails } from "@/lib/db";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PayPage({ params }: { params: Promise<{ id: string }> }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 sm:py-16"><Suspense fallback={<p className="mx-auto max-w-xl text-sm text-slate-600">Loading invoice…</p>}><InvoiceDetails params={params} /></Suspense></main>;
}

async function InvoiceDetails({ params }: { params: Promise<{ id: string }> }) {
  await io();
  const { id } = await params;
  const invoice = getInvoicePaymentDetails(id);
  if (!invoice) notFound();
  return <section className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold tracking-wide text-indigo-700">PAYMENT REQUEST</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{invoice.description}</h1><p className="mt-5 text-4xl font-semibold">{formatUsd(invoice.amount_cents)}</p><dl className="mt-8 space-y-4 border-y border-slate-200 py-5 text-sm"><div className="flex items-start justify-between gap-6"><dt className="text-slate-600">Recipient</dt><dd className="font-medium text-slate-900">{shortenAddress(invoice.recipient_address)}</dd></div><div className="flex items-start justify-between gap-6"><dt className="text-slate-600">Status</dt><dd className="font-medium capitalize text-slate-900">{invoice.status}</dd></div>{invoice.client_name ? <div className="flex items-start justify-between gap-6"><dt className="text-slate-600">Client</dt><dd className="font-medium text-slate-900">{invoice.client_name}</dd></div> : null}</dl><a href={invoice.deliverable_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-6 inline-block text-sm font-semibold text-indigo-700 underline">View deliverable</a><p className="mt-8 rounded-xl bg-slate-100 p-4 text-sm font-medium text-slate-700">Payment options coming next</p></section>;
}

function formatUsd(cents: number): string { return `$${Math.floor(cents / 100).toLocaleString("en-US")}.${String(cents % 100).padStart(2, "0")}`; }
function shortenAddress(address: string): string { return address.length <= 14 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`; }
