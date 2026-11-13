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

  if (statusError && !state) return <Panel><p className="text-sm text-red-700">We couldn’t check payment status. Please try again.</p><button type="button" onClick={() => void loadStatus()} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Retry</button></Panel>;
  if (!state) return <Panel><p className="text-sm text-slate-600" aria-live="polite">Loading payment options…</p></Panel>;

  if (state.status === "paid") return <PaidPanel state={state} />;
  if (!startingAgain && (state.status === "refunded" || state.status === "failed" || state.status === "incomplete" || state.status === "expired")) {
    const message = state.status === "incomplete"
      ? "The amount received was too low. Send the full amount shown."
      : state.status === "expired"
        ? "This payment window expired. If you already sent funds they are refunded automatically."
        : "Your funds were returned to your refund address.";
    return <Panel><p className="font-semibold text-slate-950" aria-live="polite">{message}</p>{state.status === "expired" ? <button type="button" onClick={() => setStartingAgain(true)} className="mt-5 w-full rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white transition hover:bg-indigo-800">Start again</button> : null}</Panel>;
  }

  if (!state.payment) {
    return <Panel><DemoBanner demo={state.demo} /><form className="space-y-5" onSubmit={requestQuote}><label className="block text-sm font-medium text-slate-800"><span>Choose token</span><select value={originAsset} onChange={(event) => setOriginAsset(event.target.value)} disabled={!tokens || tokensError || submitting} required className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">{groupedTokens.map(([chain, chainTokens]) => <optgroup key={chain} label={chain}>{chainTokens.map((token) => <option key={token.assetId} value={token.assetId}>{token.symbol} on {token.blockchain}</option>)}</optgroup>)}</select></label>{tokensError ? <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">We couldn’t load payment tokens. <button type="button" onClick={() => setTokenAttempt((attempt) => attempt + 1)} className="font-semibold underline">Retry</button></div> : null}<label className="block text-sm font-medium text-slate-800"><span>Refund address</span><input value={refundTo} onChange={(event) => setRefundTo(event.target.value)} autoComplete="off" required maxLength={200} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100" /><span className="mt-2 block text-sm font-normal leading-6 text-slate-600">Use an address you control on the SAME chain you are paying from. If the payment fails, your funds return here.</span></label>{formError ? <p className="text-sm text-red-700">{formError}</p> : null}<button type="submit" disabled={submitting || tokensError || !originAsset} className="w-full rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Getting payment details…" : "Get payment details"}</button></form></Panel>;
  }

  return <PaymentInstructions state={state} />;
}

function PaymentInstructions({ state }: { state: PaymentStatus }) {
  const payment = state.payment!;
  return <Panel><DemoBanner demo={state.demo} /><div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4"><p className="text-lg font-bold text-indigo-950">Send exactly {payment.sendAmount} {payment.symbol} on {payment.chain}</p><p className="mt-4 text-sm font-semibold text-indigo-950">Amount to send:</p><CopyRow value={payment.sendAmount} /><p className="mt-5 text-sm font-semibold text-indigo-950">To this address:</p><CopyRow value={payment.depositAddress} /><Countdown deadline={payment.deadline} /></div>{payment.depositMemo !== null ? <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4"><p className="text-xs font-extrabold tracking-wide text-amber-950">REQUIRED MEMO</p><CopyRow value={payment.depositMemo} /></div> : null}<p className="mt-4 text-sm font-bold leading-6 text-slate-950">Send ONLY {payment.symbol} on {payment.chain}. Other tokens or chains can be lost.</p><Progress status={state.status} /></Panel>;
}

function PaidPanel({ state }: { state: PaymentStatus }) {
  const url = state.receipt?.destinationTxUrl;
  const safeReceipt = typeof url === "string" && url.startsWith("https://");
  return <Panel><DemoBanner demo={state.demo} /><div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center"><p className="text-3xl font-bold text-emerald-950" aria-live="polite">Paid ✓</p>{state.payment ? <p className="mt-2 font-semibold text-emerald-900">{state.payment.sendAmount} {state.payment.symbol}</p> : null}{safeReceipt ? <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-block text-sm font-semibold text-indigo-700 underline">View receipt</a> : null}</div><Progress status="paid" /></Panel>;
}

function Progress({ status }: { status: PaymentStatus["status"] }) {
  const current = status === "paid" ? 2 : status === "processing" ? 1 : 0;
  return <div className="mt-6" aria-live="polite"><p className="sr-only">Payment status: {status.replaceAll("_", " ")}</p><ol className="grid grid-cols-3 gap-2 text-center text-xs font-semibold"><Step label="Waiting for deposit" active={current >= 0} complete={current > 0} /><Step label="Processing" active={current >= 1} complete={current > 1} /><Step label="Paid" active={current >= 2} complete={false} /></ol></div>;
}

function Step({ label, active, complete }: { label: string; active: boolean; complete: boolean }) {
  return <li className={active ? "text-indigo-800" : "text-slate-400"}><span className={`mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full ${active ? "bg-indigo-700 text-white" : "bg-slate-200"}`}>{complete ? "✓" : "•"}</span>{label}</li>;
}

function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1_000));
  const text = seconds === 0 ? "Payment window expired" : `Payment window: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} remaining`;
  return <p className="mt-4 text-sm font-medium text-indigo-950" aria-live="polite">{text}</p>;
}

function CopyRow({ value }: { value: string }) {
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
  return <div className="mt-1 flex gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm text-slate-900">{value}</code><button type="button" onClick={() => void copy()} className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition duration-150 motion-reduce:transition-none ${copyState === "copied" ? "border-emerald-500 bg-emerald-100 text-emerald-800" : copyState === "failed" ? "border-amber-500 bg-amber-100 text-amber-900" : "border-slate-300 bg-white text-slate-800"}`}>{label}</button></div>;
}

function DemoBanner({ demo }: { demo: boolean }) {
  return demo ? <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium leading-6 text-amber-950">DEMO MODE: no real money moves. This payment completes automatically in about 10 seconds.</p> : null;
}

function Panel({ children }: { children: React.ReactNode }) { return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{children}</section>; }
