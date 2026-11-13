"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";

export type CreatedInvoice = { invoiceId: string; payUrl: string; deskUrl: string; deskToken: string };

function parseDollarsToCents(value: string): number | null {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = dollars * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) ? cents : null;
}

export function CreateInvoiceForm({ onCreated, onCreating }: { onCreated: (invoice: CreatedInvoice) => void; onCreating: () => void }) {
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deskExists, setDeskExists] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreating();
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
      if (response.status === 201 && data) onCreated(data as CreatedInvoice);
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
    <div className="surface p-6 sm:p-10">
      <form className="space-y-5" onSubmit={submit}>
        <Field label="Your NEAR wallet" error={errors.wallet} icon="wallet"><input value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="creator.near" autoComplete="off" required className="control mono" /></Field>
        <Field label="Amount (USD)" error={errors.amount ?? errors.amountCents} icon="dollar"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="250.00" required className="control mono" /></Field>
        <Field label="What did you deliver?" error={errors.description} icon="document"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} required rows={4} className="control min-h-30 resize-y" /></Field>
        <Field label="Deliverable link" error={errors.deliverableUrl} icon="link"><input value={deliverableUrl} onChange={(event) => setDeliverableUrl(event.target.value)} type="url" placeholder="https://…" required className="peer control pr-10" /></Field>
        <Field label="Client name (optional)" error={errors.clientName} icon="person"><input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Optional" maxLength={100} className="peer control pr-10" /></Field>
        {errors.form ? <p className="text-sm text-coral-ink">{errors.form}</p> : null}
        <button type="submit" disabled={submitting} className="button-primary w-full disabled:opacity-60">{submitting ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" />Creating invoice…</span> : "Create invoice"}</button>
      </form>
      {deskExists ? <p className="mt-6 rounded-xl bg-coral-tint p-4 text-sm leading-6 text-coral-ink">This wallet already has a private desk. Use your desk link to add invoices.</p> : null}
    </div>
  );
}

function Field({ label, error, icon, children }: { label: string; error?: string; icon: "wallet" | "dollar" | "document" | "link" | "person"; children: ReactNode }) {
  const icons = { wallet: <path d="M4 7h15a1 1 0 0 1 1 1v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13M16 13h.01"/>, dollar: <path d="M12 3v18m4-14.5c0-1.3-1.8-2.5-4-2.5s-4 1.2-4 3 1.8 2.5 4 3 4 1.2 4 3-1.8 3-4 3-4-1.2-4-2.5"/>, document: <path d="M6 3h8l4 4v14H6V3Zm8 0v5h5M9 13h6m-6 4h6"/>, link: <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>, person: <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/> };
  const labelIcon = icon === "wallet" || icon === "dollar";
  const inputIcon = icon === "link" || icon === "person";
  return <label className="field-label block text-text"><span className="flex items-center gap-2">{labelIcon ? icon === "dollar" ? <span aria-hidden="true" className="mono text-lg font-bold leading-none text-green">$</span> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-green" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[icon]}</svg> : null}{label}</span><span className="relative mt-2 block">{children}{inputIcon ? <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted opacity-0 peer-placeholder-shown:opacity-100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[icon]}</svg> : null}</span>{error ? <span className="mt-1 block text-sm font-normal text-coral-ink">{error}</span> : null}</label>;
}

