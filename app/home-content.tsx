"use client";

import { useEffect, useRef, useState } from "react";
import { CreateInvoiceForm, type CreatedInvoice } from "./create-invoice-form";

export function HomeContent() {
  const [created, setCreated] = useState<CreatedInvoice | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (created) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [created]);

  return <main className="flex-1 overflow-hidden py-12 lg:py-16"><div className="mx-auto w-full max-w-6xl px-6 sm:px-10"><div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_470px] lg:gap-16"><section className="relative lg:sticky lg:top-24"><p className="eyebrow inline-flex rounded-full border border-green/35 bg-green-tint px-3 py-2 text-green">For web3 creators</p><h1 className="page-title mt-5 max-w-xl text-text">Get paid from <span className="text-green">any chain.</span></h1><p className="mt-5 max-w-lg text-lg leading-8 text-muted">Create one clear payment request, share it with your client, and receive the exact stablecoin amount you earned.</p><ol className="relative mt-10 grid max-w-xl gap-7 sm:grid-cols-3 sm:gap-4">{[["01", "Create invoice"], ["02", "Share the link"], ["03", "Get paid in USDC"]].map(([number, label], index) => <li key={number} className="relative"><span className="mono flex h-9 w-9 items-center justify-center rounded-full border border-green text-sm text-green">{number}</span>{index < 2 ? <span aria-hidden="true" className="absolute left-9 top-4 hidden h-px w-[calc(100%-2.25rem)] bg-green/35 sm:block" /> : null}<p className="mt-3 font-semibold tracking-[-.02em] text-text">{label}</p></li>)}</ol></section><section className="min-w-0"><p className="eyebrow mb-3 text-muted">New payment request</p><CreateInvoiceForm onCreating={() => setCreated(null)} onCreated={setCreated} />{created ? <section ref={resultRef} className="animate-enter mt-6 w-full min-w-0 scroll-mt-24 border-l-[3px] border-green pl-5"><h2 className="inline-flex items-center gap-3 whitespace-nowrap text-3xl font-bold text-text">Invoice created <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 text-green" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path className="draw-check" d="m5 12 4 4L19 6" /></svg></h2><div className="mt-6 grid gap-6"><div><h3 className="text-sm font-semibold text-muted">Pay link (send this to your client)</h3><LinkRow href={created.payUrl} /></div><div><h3 className="text-sm font-semibold text-muted">Private desk link (save this)</h3><LinkRow href={created.deskUrl} /><p className="mt-3 text-base font-bold text-coral-ink">Save this link! It is shown only once.</p></div></div></section> : null}</section></div></div></main>;
}

function LinkRow({ href }: { href: string }) {
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
  return <div className="mt-3 flex w-full min-w-0 items-center gap-3"><a ref={linkRef} href={href} className="mono min-w-0 flex-1 truncate text-sm text-text no-underline" target="_blank" rel="noopener noreferrer">{href}</a><button type="button" onClick={() => void copyLink()} className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold leading-none ${copyStatus === "copied" ? "border-green bg-green text-on-green" : copyStatus === "failed" ? "border-coral bg-coral-tint text-coral-ink" : "border-green bg-green text-on-green"}`}>{buttonLabel}</button><span className="sr-only" aria-live="polite">{copyStatus === "idle" ? "" : buttonLabel}</span></div>;
}
