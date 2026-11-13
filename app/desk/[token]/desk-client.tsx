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

  return <section className="mx-auto w-full max-w-[1080px] space-y-6"><div className="rounded-2xl border border-green/30 bg-green-tint p-5"><p className="eyebrow flex items-center gap-2 text-green"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2"/></svg>Private desk</p><h1 className="display mt-3 text-text">Your payment history</h1><p className="mt-3 text-muted">Only people with this link can see this page.</p></div><div className="grid gap-4 sm:grid-cols-3"><TotalCard label="Paid USD" value={formatUsd(totals.paidCents)} tone="green" /><TotalCard label="Pending" value={`${totals.pendingCount} · ${formatUsd(totals.pendingCents)}`} tone="purple" /><TotalCard label="Invoices" value={String(invoices.length)} tone="ink" /></div><section className="surface p-5 sm:p-8"><h2 className="text-2xl font-bold tracking-[-.03em] text-text">New invoice</h2><form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={createInvoice}><Field label="Amount (USD)" icon="dollar"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="250.00" required className={`${inputClass} mono pl-12`} /></Field><Field label="Client name (optional)" icon="person"><input value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={100} className={`${inputClass} pl-12`} /></Field><div className="sm:col-span-2"><Field label="What did you deliver?" icon="document"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} required className={`${inputClass} min-h-28 resize-y pl-12`} /></Field></div><div className="sm:col-span-2"><Field label="Deliverable link" icon="link"><input value={deliverableUrl} onChange={(event) => setDeliverableUrl(event.target.value)} type="url" placeholder="https://…" required className={`${inputClass} pl-12`} /></Field></div>{formError ? <p className="text-sm text-coral-ink sm:col-span-2">{formError}</p> : null}<button type="submit" disabled={submitting} className={`${primaryButton} sm:col-span-2`}>{submitting ? "Creating invoice…" : "Create invoice"}</button></form></section><section className="surface p-5 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold tracking-[-.03em] text-text">Invoices</h2><button type="button" onClick={() => void downloadCsv()} disabled={downloading} className="button-outline inline-flex items-center gap-2 text-sm disabled:opacity-60"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>{downloading ? "Downloading…" : "Download CSV"}</button></div>{downloadError ? <p className="mt-3 text-sm text-coral-ink">{downloadError}</p> : null}<div className="mt-5 space-y-3">{invoices.length === 0 ? <div className="rounded-xl border border-line bg-card-2 p-6 text-center"><p className="text-2xl text-muted" aria-hidden="true">◌</p><p className="mt-2 text-sm text-muted">No invoices yet. Create your first payment request above.</p></div> : invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} payUrl={`${payOrigin}/pay/${encodeURIComponent(invoice.id)}`} />)}</div></section><section className="surface p-5 sm:p-8"><h2 className="text-2xl font-bold tracking-[-.03em] text-text">Access links</h2><p className="mt-2 text-sm leading-6 text-muted">Create a new private desk link when you need one.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" disabled={linkLoading} onClick={() => void createLink(false)} className="button-coral disabled:opacity-60">Create new link</button><button type="button" disabled={linkLoading} onClick={() => void createLink(true)} className="border-0 bg-transparent px-2 py-3 text-left text-sm font-bold text-coral hover:text-coral-text disabled:opacity-60">Create new link and disable all others</button></div>{linkError ? <p className="mt-3 text-sm text-coral-ink">{linkError}</p> : null}{newLink ? <div className="mt-5 rounded-xl border border-coral/40 border-t-4 border-t-coral bg-danger-bg p-5 text-text"><p className="font-semibold">New desk link</p><p className="mt-3 text-base font-extrabold tracking-wide text-[#FFF1EE] sm:text-lg">SAVE YOUR DESK LINK NOW!!! IT IS SHOWN ONLY ONCE!</p><p className="mt-2 text-sm leading-6 text-[#F0D5CF]">Anyone with this link can see your payment history. Do not share it.</p><CopyRow value={newLink} /></div> : null}</section></section>;
}

const inputClass = "control mt-2";
const primaryButton = "button-primary disabled:opacity-60";

function parseDollarsToCents(value: string): number | null { const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value.trim()); if (!match) return null; const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0"); return Number.isSafeInteger(cents) ? cents : null; }
function formatUsd(cents: number): string { return `$${Math.floor(cents / 100).toLocaleString("en-US")}.${String(cents % 100).padStart(2, "0")}`; }
function Field({ label, icon, children }: { label: string; icon?: "dollar" | "document" | "link" | "person"; children: React.ReactNode }) { const icons = { dollar: <path d="M12 3v18m4-14.5c0-1.3-1.8-2.5-4-2.5s-4 1.2-4 3 1.8 2.5 4 3 4 1.2 4 3-1.8 3-4 3-4-1.2-4-2.5"/>, document: <path d="M6 3h8l4 4v14H6V3Zm8 0v5h5M9 13h6m-6 4h6"/>, link: <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>, person: <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/> }; return <label className="block text-sm font-medium text-text"><span>{label}</span>{icon ? <span className="relative mt-2 block"><svg aria-hidden="true" viewBox="0 0 24 24" className={`pointer-events-none absolute left-3 h-5 w-5 text-muted ${icon === "document" ? "top-4" : "top-1/2 -translate-y-1/2"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[icon]}</svg>{children}</span> : children}</label>; }
function TotalCard({ label, value, tone }: { label: string; value: string; tone: "green" | "purple" | "ink" }) { const dot = tone === "green" ? "bg-green" : tone === "purple" ? "bg-purple" : "bg-text"; return <div className="surface p-5"><p className="flex items-center gap-2 text-sm font-medium text-muted"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</p><p className="mono mt-3 text-2xl font-bold tracking-[-.04em] text-text">{value}</p></div>; }
function InvoiceRow({ invoice, payUrl }: { invoice: Invoice; payUrl: string }) { const statusTone = invoice.status === "paid" ? "border-green/30 bg-green-tint text-green" : invoice.status === "awaiting_deposit" || invoice.status === "processing" ? "border-purple/30 bg-purple-tint text-purple-text" : invoice.status === "failed" || invoice.status === "refunded" ? "border-coral/30 bg-coral-tint text-coral-text" : "border-line-strong bg-card-2 text-muted"; return <article className="rounded-xl border border-line bg-card-2 p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1 basis-full sm:basis-auto sm:flex sm:items-center sm:gap-3"><p className="shrink-0 text-xs text-muted">{new Date(invoice.created_at).toLocaleDateString()}</p><h3 className="truncate font-semibold text-text">{invoice.description}</h3><p className="mt-1 text-sm text-muted sm:hidden">{invoice.client_name || "No client name"}</p></div><p className="mono font-semibold text-text sm:text-right">{formatUsd(invoice.amount_cents)}</p><span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusTone}`}>{invoice.status.replaceAll("_", " ")}</span><a href={payUrl} target="_blank" rel="noopener noreferrer" className="button-outline inline-flex h-10 min-h-0 w-fit items-center justify-center px-3 py-0 text-xs leading-none">View</a></div><div className="mt-4 flex items-center gap-2 border-t border-line pt-3"><p className="mono min-w-0 flex-1 truncate text-xs text-muted">{payUrl}</p><CopyRow value={payUrl} /></div></article>; }
function CopyRow({ value }: { value: string }) { const [state, setState] = useState<"idle" | "copied" | "failed">("idle"); const timer = useRef<number | null>(null); async function copy() { try { await navigator.clipboard.writeText(value); setState("copied"); } catch { setState("failed"); } if (timer.current !== null) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setState("idle"), 2_000); } const label = state === "copied" ? "Copied ✓" : state === "failed" ? "Press Cmd+C" : "Copy"; return <button type="button" onClick={() => void copy()} className={`inline-flex h-10 shrink-0 items-center justify-center rounded-full border px-3 py-0 text-sm font-medium leading-none motion-reduce:transition-none ${state === "copied" ? "border-green bg-green text-on-green" : state === "failed" ? "border-coral bg-coral-tint text-coral-ink" : "border-green bg-green text-on-green"}`}>{label}</button>; }
