"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Invoice = { id: string; amount_cents: number; description: string; deliverable_url: string; client_name: string; status: string; created_at: string };
type Totals = { paidCents: number; pendingCount: number; pendingCents: number; byStatus: Record<string, number> };

export function DeskClient({ deskToken, payOrigin, invoices, totals }: { deskToken: string; payOrigin: string; invoices: Invoice[]; totals: Totals }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [newLink, setNewLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseDollarsToCents(amount);
    if (amountCents === null) { setFormError("Enter a dollar amount with no more than two decimal places."); return; }
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json", "x-desk-token": deskToken }, body: JSON.stringify({ amountCents, description, deliverableUrl, clientName }) });
      if (!response.ok) throw new Error("create failed");
      setAmount(""); setDescription(""); setDeliverableUrl(""); setClientName("");
      router.refresh();
    } catch { setFormError("We couldn’t create this invoice. Please try again."); } finally { setSubmitting(false); }
  }

  async function createLink(revokeOthers: boolean) {
    if (revokeOthers && !window.confirm("This will disable the current link and every other desk link. Continue?")) return;
    setLinkLoading(true); setLinkError(""); setNewLink(null);
    try {
      const response = await fetch("/api/desk/tokens", { method: "POST", headers: { "Content-Type": "application/json", "x-desk-token": deskToken }, body: JSON.stringify({ revokeOthers }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data.deskUrl !== "string") throw new Error("link failed");
      setNewLink(data.deskUrl);
    } catch { setLinkError("We couldn’t create a new access link. Please try again."); } finally { setLinkLoading(false); }
  }

  async function downloadCsv() {
    setDownloading(true); setDownloadError("");
    try {
      const response = await fetch("/api/desk/export", { headers: { "x-desk-token": deskToken } });
      if (!response.ok) throw new Error("download failed");
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href; link.download = "invoices.csv"; link.click();
      URL.revokeObjectURL(href);
    } catch { setDownloadError("We couldn’t download your CSV. Please try again."); } finally { setDownloading(false); }
  }

  return <section className="mx-auto w-full max-w-5xl space-y-6"><div><p className="text-sm font-semibold tracking-wide text-indigo-700">PRIVATE CREATOR DESK</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your payment history</h1></div><div className="grid gap-4 sm:grid-cols-3"><TotalCard label="Paid USD" value={formatUsd(totals.paidCents)} /><TotalCard label="Pending" value={`${totals.pendingCount} · ${formatUsd(totals.pendingCents)}`} /><TotalCard label="Total invoices" value={String(invoices.length)} /></div><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><h2 className="text-xl font-semibold">New invoice</h2><form className="mt-5 space-y-5" onSubmit={createInvoice}><Field label="Amount (USD)"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="250.00" required className={inputClass} /></Field><Field label="What did you deliver?"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} required className={`${inputClass} resize-y`} /></Field><Field label="Deliverable link"><input value={deliverableUrl} onChange={(event) => setDeliverableUrl(event.target.value)} type="url" placeholder="https://…" required className={inputClass} /></Field><Field label="Client name (optional)"><input value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={100} className={inputClass} /></Field>{formError ? <p className="text-sm text-red-700">{formError}</p> : null}<button type="submit" disabled={submitting} className={primaryButton}>{submitting ? "Creating invoice…" : "Create invoice"}</button></form></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Invoices</h2><button type="button" onClick={() => void downloadCsv()} disabled={downloading} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60">{downloading ? "Downloading…" : "Download CSV"}</button></div>{downloadError ? <p className="mt-3 text-sm text-red-700">{downloadError}</p> : null}<div className="mt-5 space-y-3">{invoices.length === 0 ? <p className="text-sm text-slate-600">No invoices yet.</p> : invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} payUrl={`${payOrigin}/pay/${encodeURIComponent(invoice.id)}`} />)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><h2 className="text-xl font-semibold">Access links</h2><p className="mt-2 text-sm leading-6 text-slate-600">Create a new private desk link when you need one.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" disabled={linkLoading} onClick={() => void createLink(false)} className={primaryButton}>Create new link</button><button type="button" disabled={linkLoading} onClick={() => void createLink(true)} className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-60">Create new link and disable all others</button></div>{linkError ? <p className="mt-3 text-sm text-red-700">{linkError}</p> : null}{newLink ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-950">New desk link</p><p className="mt-3 text-base font-extrabold tracking-wide text-amber-950 sm:text-lg">SAVE YOUR DESK LINK NOW!!! IT IS SHOWN ONLY ONCE!</p><p className="mt-2 text-sm leading-6 text-emerald-950">Anyone with this link can see your payment history. Do not share it.</p><CopyRow value={newLink} /></div> : null}</section></section>;
}

const inputClass = "mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100";
const primaryButton = "rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60";

function parseDollarsToCents(value: string): number | null { const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim()); if (!match) return null; const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0"); return Number.isSafeInteger(cents) ? cents : null; }
function formatUsd(cents: number): string { return `$${Math.floor(cents / 100).toLocaleString("en-US")}.${String(cents % 100).padStart(2, "0")}`; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-800"><span>{label}</span>{children}</label>; }
function TotalCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div>; }
function InvoiceRow({ invoice, payUrl }: { invoice: Invoice; payUrl: string }) { return <article className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{invoice.description}</h3><p className="mt-1 text-sm text-slate-600">{invoice.client_name || "No client name"} · {new Date(invoice.created_at).toLocaleDateString()}</p></div><div className="text-right"><p className="font-semibold">{formatUsd(invoice.amount_cents)}</p><span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">{invoice.status.replaceAll("_", " ")}</span></div></div><p className="mt-4 break-all text-sm text-indigo-800 underline">{payUrl}</p><CopyRow value={payUrl} /></article>; }
function CopyRow({ value }: { value: string }) { const [state, setState] = useState<"idle" | "copied" | "failed">("idle"); const timer = useRef<number | null>(null); async function copy() { try { await navigator.clipboard.writeText(value); setState("copied"); } catch { setState("failed"); } if (timer.current !== null) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setState("idle"), 2_000); } const label = state === "copied" ? "Copied ✓" : state === "failed" ? "Press Cmd+C" : "Copy"; return <button type="button" onClick={() => void copy()} className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium transition duration-150 motion-reduce:transition-none ${state === "copied" ? "border-emerald-500 bg-emerald-100 text-emerald-800" : state === "failed" ? "border-amber-500 bg-amber-100 text-amber-900" : "border-slate-300 bg-white text-slate-800"}`}>{label}</button>; }
