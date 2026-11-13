"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Token = { assetId: string; symbol: string; blockchain: string };
type Payment = {
  depositAddress: string;
  depositMemo: string | null;
  sendAmount: string;
  symbol: string;
  chain: string;
  deadline: string;
  timeEstimateSeconds: number | null;
};
type PaymentStatus = {
  status: "pending" | "awaiting_deposit" | "processing" | "paid" | "incomplete" | "refunded" | "failed" | "expired";
  demo: boolean;
  payment: Payment | null;
  receipt: { destinationTxUrl: string | null } | null;
};

const terminalStatuses = new Set(["paid", "incomplete", "refunded", "failed", "expired"]);

export function PayPanel({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<PaymentStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [tokensError, setTokensError] = useState(false);
  const [tokenAttempt, setTokenAttempt] = useState(0);
  const [originAsset, setOriginAsset] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [startingAgain, setStartingAgain] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/status`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error("status unavailable");
      setState(data as PaymentStatus);
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }, [invoiceId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadStatus(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadStatus]);

  const shouldPoll = Boolean(state?.payment && !terminalStatuses.has(state.status));
  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => { void loadStatus(); }, 4_000);
    return () => window.clearInterval(timer);
  }, [loadStatus, shouldPoll]);

  const needsForm = Boolean(state && !state.payment && (!terminalStatuses.has(state.status) || startingAgain));
  useEffect(() => {
    if (!needsForm) return;
    let active = true;
    async function loadTokens() {
      setTokensError(false);
      try {
        const response = await fetch("/api/tokens", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data)) throw new Error("tokens unavailable");
        if (!active) return;
        const available = data as Token[];
        setTokens(available);
        setOriginAsset((current) => current || available[0]?.assetId || "");
      } catch {
        if (active) setTokensError(true);
      }
    }
    void loadTokens();
    return () => { active = false; };
  }, [needsForm, tokenAttempt]);

  const groupedTokens = useMemo(() => {
    const groups = new Map<string, Token[]>();
    for (const token of tokens ?? []) groups.set(token.blockchain, [...(groups.get(token.blockchain) ?? []), token]);
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [tokens]);

  async function requestQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!originAsset || !refundTo) return;
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originAsset, refundTo }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error("quote unavailable");
      setState(data as PaymentStatus);
      setStartingAgain(false);
    } catch {
      setFormError("We couldn’t get payment details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (statusError && !state) return <Panel><p className="text-sm text-coral-ink">We couldn’t check payment status. Please try again.</p><button type="button" onClick={() => void loadStatus()} className="button-outline mt-4 text-sm">Retry</button></Panel>;
  if (!state) return <Panel><p className="text-sm text-muted" aria-live="polite">Loading payment options…</p></Panel>;

  if (state.status === "paid") return <PaidPanel state={state} />;
  if (!startingAgain && (state.status === "refunded" || state.status === "failed" || state.status === "incomplete" || state.status === "expired")) {
    const message = state.status === "incomplete"
      ? "The amount received was too low. Send the full amount shown."
      : state.status === "expired"
        ? "This payment window expired. If you already sent funds they are refunded automatically."
        : "Your funds were returned to your refund address.";
    return <Panel><StatusBadge status={state.status} /><div className="mt-4 rounded-2xl bg-coral-tint p-5"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coral text-sm font-bold text-on-green">!</span><p className="font-semibold text-coral-ink" aria-live="polite">{message}</p></div>{state.status === "expired" ? <button type="button" onClick={() => setStartingAgain(true)} className="button-outline mt-5 w-full">Start again</button> : null}</div></Panel>;
  }

  if (!state.payment) {
    return <Panel><div className="flex items-center justify-between gap-3"><p className="eyebrow text-green">Payment details</p><StatusBadge status={state.status} /></div><DemoBanner demo={state.demo} /><form className="space-y-6" onSubmit={requestQuote}><fieldset disabled={!tokens || tokensError || submitting}><legend className="text-sm font-semibold text-text">Choose token</legend><div className="mt-3 space-y-3">{groupedTokens.map(([chain, chainTokens]) => <div key={chain}><p className="eyebrow text-muted">{chain}</p><div className="mt-2 flex flex-wrap gap-2">{chainTokens.map((token) => <button type="button" key={token.assetId} onClick={() => setOriginAsset(token.assetId)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${originAsset === token.assetId ? "border-green bg-green-tint text-green" : "border-line-strong bg-card-2 text-text"}`}><span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-[10px]">{token.blockchain.slice(0, 1).toUpperCase()}</span>{token.symbol}</button>)}</div></div>)}</div></fieldset>{tokensError ? <div className="rounded-xl bg-coral-tint p-4 text-sm text-coral-ink">We couldn’t load payment tokens. <button type="button" onClick={() => setTokenAttempt((attempt) => attempt + 1)} className="font-semibold underline">Retry</button></div> : null}<label className="block text-sm font-medium text-text"><span>Refund address</span><input value={refundTo} onChange={(event) => setRefundTo(event.target.value)} autoComplete="off" required maxLength={200} className="control mono mt-2" /><span className="mt-2 block text-sm font-normal leading-6 text-muted">Use an address you control on the SAME chain you are paying from. If the payment fails, your funds return here.</span></label>{formError ? <p className="text-sm text-coral-ink">{formError}</p> : null}<button type="submit" disabled={submitting || tokensError || !originAsset} className="button-primary w-full disabled:opacity-60">{submitting ? "Getting payment details…" : "Get payment details"}</button></form></Panel>;
  }

  return <PaymentInstructions state={state} />;
}

function PaymentInstructions({ state }: { state: PaymentStatus }) {
  const payment = state.payment!;
  return <Panel><div className="flex items-center justify-between gap-3"><p className="eyebrow text-green">Payment details</p><StatusBadge status={state.status} /></div><DemoBanner demo={state.demo} /><div className="mt-4 rounded-2xl border border-green/30 bg-card-deep-from p-5 text-text sm:p-6"><p className="text-sm font-bold uppercase tracking-[.12em] text-muted">Send exactly</p><p className="mono mt-3 text-3xl font-bold tracking-[-.04em] text-green">{payment.sendAmount}</p><span className="mt-3 inline-block rounded-full border border-line-strong bg-card-2 px-3 py-1 text-xs font-semibold text-text">{payment.symbol} on {payment.chain}</span><p className="mt-6 text-xs font-semibold uppercase tracking-[.12em] text-muted">Deposit address</p><CopyRow value={payment.depositAddress} dark /><Countdown deadline={payment.deadline} /></div>{payment.depositMemo !== null ? <div className="mt-4 rounded-2xl border border-coral/30 bg-coral-tint p-4"><p className="eyebrow text-coral-ink">Required memo</p><CopyRow value={payment.depositMemo} /></div> : null}<div className="mt-4 rounded-xl bg-coral-tint p-4 text-sm font-bold leading-6 text-coral-ink">Send ONLY {payment.symbol} on {payment.chain}. Other tokens or chains can be lost.</div><Progress status={state.status} /></Panel>;
}

function PaidPanel({ state }: { state: PaymentStatus }) {
  const url = state.receipt?.destinationTxUrl;
  const safeReceipt = typeof url === "string" && url.startsWith("https://");
  const amount = state.payment ? (state.payment.sendAmount.trim().endsWith(state.payment.symbol) ? state.payment.sendAmount : `${state.payment.sendAmount} ${state.payment.symbol}`) : null;
  return <Panel><div className="flex justify-end"><StatusBadge status="paid" /></div><DemoBanner demo={state.demo} /><div className="rounded-2xl bg-green-tint p-6 text-center"><span className="mx-auto flex h-15 w-15 items-center justify-center rounded-full bg-green text-on-green shadow-[0_0_28px_rgba(0,236,151,.38)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none"><path d="m5 12 4 4L19 6" className="draw-check" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span><p className="mt-4 text-3xl font-bold text-text" aria-live="polite">Paid ✓</p>{amount ? <p className="mono mt-2 font-semibold text-green">{amount}</p> : null}{safeReceipt ? <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="button-outline mt-5 inline-flex text-sm">View receipt</a> : null}</div><Progress status="paid" /></Panel>;
}

function Progress({ status }: { status: PaymentStatus["status"] }) {
  const current = status === "processing" ? 1 : status === "awaiting_deposit" ? 0 : -1;
  return <div className="mt-7" aria-live="polite"><p className="sr-only">Payment status: {status.replaceAll("_", " ")}</p><ol className="grid grid-cols-3 gap-2 text-center text-xs font-semibold"><Step label="Deposit" active={current === 0} complete={status === "paid" || current > 0} /><Step label="Processing" active={current === 1} complete={status === "paid" || current > 1} /><Step label="Paid" active={false} complete={status === "paid"} /></ol></div>;
}

function Step({ label, active, complete }: { label: string; active: boolean; complete: boolean }) {
  return <li className={complete ? "text-green" : active ? "text-purple-ink" : "text-muted"}><span className={`mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full border ${complete ? "border-green bg-green text-ink" : active ? "pulse-current border-purple bg-purple-tint text-purple-ink" : "border-black/10 bg-black/5"}`}>{complete ? "✓" : "•"}</span>{label}</li>;
}

function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1_000));
  const text = seconds === 0 ? "Payment window expired" : `Payment window: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} remaining`;
  return <p className="mono mt-5 text-sm font-medium text-white/80" aria-live="polite">{text}</p>;
}

function CopyRow({ value, dark = false }: { value: string; dark?: boolean }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const timeout = useRef<number | null>(null);
  useEffect(() => () => { if (timeout.current !== null) window.clearTimeout(timeout.current); }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch { setCopyState("failed"); }
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => setCopyState("idle"), 2_000);
  }
  const label = copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Press Cmd+C" : "Copy";
  return <div className="mt-2 flex gap-2"><code className={`mono min-w-0 flex-1 break-all rounded-xl px-3 py-3 text-sm ${dark ? "border border-line-strong bg-card-2 text-text" : "border border-line-strong bg-card-2 text-text"}`}>{value}</code><button type="button" onClick={() => void copy()} className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold motion-reduce:transition-none ${copyState === "copied" ? "border-green bg-green text-on-green" : copyState === "failed" ? "border-coral bg-coral-tint text-coral-ink" : "border-green bg-green text-on-green"}`}>{label}</button></div>;
}

function DemoBanner({ demo }: { demo: boolean }) {
  return demo ? <p className="mt-3 mb-5 rounded-xl bg-purple-tint p-3 text-sm font-medium leading-6 text-purple-ink"><span className="mr-2 rounded-full bg-purple px-2 py-0.5 text-[10px] font-bold tracking-[.12em] text-ink">DEMO</span>no real money moves. This payment completes automatically in about 10 seconds.</p> : null;
}

function StatusBadge({ status }: { status: PaymentStatus["status"] }) { const tone = status === "paid" ? "border-green/35 bg-green-tint text-green" : status === "awaiting_deposit" || status === "processing" ? "border-purple/35 bg-purple-tint text-purple-text" : status === "failed" || status === "refunded" || status === "incomplete" || status === "expired" ? "border-coral/35 bg-coral-tint text-coral-text" : "border-line-strong bg-card-2 text-muted"; return <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${tone}`}>{status.replaceAll("_", " ")}</span>; }
function Panel({ children }: { children: React.ReactNode }) { return <section className="surface payment-panel p-5 sm:p-6">{children}</section>; }
