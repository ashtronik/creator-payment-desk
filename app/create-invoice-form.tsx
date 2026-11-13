"use client";

import type { FormEvent, ReactNode } from "react";
import { useRef, useState } from "react";

type CreatedInvoice = { invoiceId: string; payUrl: string; deskUrl: string; deskToken: string };

function parseDollarsToCents(value: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = dollars * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) ? cents : null;
}

export function CreateInvoiceForm() {
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<CreatedInvoice | null>(null);
  const [deskExists, setDeskExists] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreated(null);
    setDeskExists(false);
    const amountCents = parseDollarsToCents(amount);
    if (amountCents === null) {
      setErrors({ amount: "Enter a dollar amount with no more than two decimal places." });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amountCents, description, deliverableUrl, clientName }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 201 && data) setCreated(data as CreatedInvoice);
      else if (response.status === 409) setDeskExists(true);
      else if (response.status === 400 && data?.errors) setErrors(data.errors as Record<string, string>);
      else setErrors({ form: "We could not create this invoice. Please try again." });
    } catch {
      setErrors({ form: "We could not create this invoice. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <form className="space-y-5" onSubmit={submit}>
        <Field label="Your NEAR wallet" error={errors.wallet}><input value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="creator.near" autoComplete="off" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" /></Field>
        <Field label="Amount (USD)" error={errors.amount ?? errors.amountCents}><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="250.00" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" /></Field>
        <Field label="What did you deliver?" error={errors.description}><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} required rows={4} className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" /></Field>
        <Field label="Deliverable link" error={errors.deliverableUrl}><input value={deliverableUrl} onChange={(event) => setDeliverableUrl(event.target.value)} type="url" placeholder="https://…" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" /></Field>
        <Field label="Client name (optional)" error={errors.clientName}><input value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={100} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" /></Field>
        {errors.form ? <p className="text-sm text-red-700">{errors.form}</p> : null}
        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Creating invoice…" : "Create invoice"}</button>
      </form>
      {deskExists ? <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">This wallet already has a private desk. Use your desk link to add invoices.</p> : null}
      {created ? <section className="mt-6 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-950">Invoice created</p><LinkRow label="Pay link: send this to your client" href={created.payUrl} /><div className="rounded-xl border-2 border-amber-500 bg-amber-100 p-4 text-amber-950"><p className="text-base font-extrabold tracking-wide sm:text-lg">SAVE YOUR DESK LINK NOW!!! IT IS SHOWN ONLY ONCE!</p><p className="mt-2 text-sm leading-6">Anyone with this link can see your payment history. Do not share it.</p></div><LinkRow label="Desk link: PRIVATE, only for you" href={created.deskUrl} /></section> : null}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-slate-800"><span>{label}</span><span className="mt-2 block">{children}</span>{error ? <span className="mt-1 block text-sm font-normal text-red-700">{error}</span> : null}</label>;
}

function LinkRow({ label, href }: { label: string; href: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const linkRef = useRef<HTMLAnchorElement>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(href);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2_000);
    } catch {
      const selection = window.getSelection();
      if (selection && linkRef.current) {
        const range = document.createRange();
        range.selectNodeContents(linkRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setCopyStatus("failed");
    }
  }

  const buttonLabel = copyStatus === "copied" ? "Copied ✓" : copyStatus === "failed" ? "Press Cmd+C" : "Copy";
  const buttonClass = copyStatus === "copied"
    ? "scale-105 border-emerald-500 bg-emerald-100 text-emerald-800"
    : copyStatus === "failed"
      ? "border-amber-500 bg-amber-100 text-amber-900"
      : "border-emerald-300 bg-white text-emerald-950";

  return <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{label}</p><div className="mt-1 flex gap-2"><a ref={linkRef} href={href} className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm text-indigo-800 underline" target="_blank" rel="noopener noreferrer">{href}</a><button type="button" onClick={() => void copyLink()} className={`rounded-lg border px-3 py-2 text-sm font-medium transition duration-150 motion-reduce:transition-none ${buttonClass}`}>{buttonLabel}</button></div><span className="sr-only" aria-live="polite">{copyStatus === "idle" ? "" : buttonLabel}</span></div>;
}
