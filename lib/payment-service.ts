import {
  getInvoicePaymentState, saveInvoiceQuote, updateInvoicePaymentStatus,
} from "./db";
import {
  getSwapStatus, getTokens, OneClickProviderError, requestQuote, type FetchImplementation,
  type OneClickToken, type QuoteResponse,
} from "./oneclick";

const DEMO_TOKENS: OneClickToken[] = [
  { assetId: "nep141:usdc.demo.near", decimals: 6, blockchain: "near", symbol: "USDC" },
  { assetId: "nep141:usdt.demo.near", decimals: 6, blockchain: "near", symbol: "USDT" },
  { assetId: "native:eth", decimals: 18, blockchain: "eth", symbol: "ETH" },
  { assetId: "native:sol", decimals: 9, blockchain: "sol", symbol: "SOL" },
  { assetId: "native:near", decimals: 24, blockchain: "near", symbol: "NEAR" },
];
const statusThrottle = new Map<string, { at: number; result: PaymentState }>();

export class PaymentInputError extends Error {}
export class InvoiceNotFoundError extends Error {}
export class InvoicePaidError extends Error {}
export { OneClickProviderError };

export type PaymentState = {
  status: string;
  demo: boolean;
  payment: PaymentDisplay | null;
  receipt: { destinationTxUrl: string | null } | null;
};
export type PaymentDisplay = {
  depositAddress: string;
  depositMemo: string | null;
  sendAmount: string;
  symbol: string;
  chain: string;
  deadline: string;
  timeEstimateSeconds: number | null;
};
type ServiceOptions = { fetchImpl?: FetchImplementation; now?: number };

function demoMode(): boolean { return process.env.DEMO_MODE === "true"; }
function nowOf(options?: ServiceOptions): number { return options?.now ?? Date.now(); }
function quoteExpiry(quote: QuoteResponse, fallback: string): string {
  return Number.isNaN(Date.parse(quote.quote.deadline)) ? fallback : quote.quote.deadline;
}
function scaleCents(amountCents: number, decimals: number): string {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || !Number.isInteger(decimals) || decimals < 0) throw new PaymentInputError("Invalid amount");
  if (decimals >= 2) return (BigInt(amountCents) * (BigInt(10) ** BigInt(decimals - 2))).toString();
  const divisor = BigInt(10) ** BigInt(2 - decimals);
  const cents = BigInt(amountCents);
  if (cents % divisor !== BigInt(0)) throw new PaymentInputError("Destination token cannot represent this invoice amount");
  return (cents / divisor).toString();
}
function validRefundTo(value: unknown): value is string { return typeof value === "string" && value.length >= 1 && value.length <= 200 && !/\s/.test(value); }
function readStoredQuote(value: string | null): { response: QuoteResponse; payment: PaymentDisplay; createdAt: number } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { response?: QuoteResponse; payment?: PaymentDisplay; createdAt?: number };
    return parsed.response && parsed.payment && typeof parsed.createdAt === "number" ? parsed as { response: QuoteResponse; payment: PaymentDisplay; createdAt: number } : null;
  } catch { return null; }
}
function receiptFrom(state: { tx_hash: string | null }): { destinationTxUrl: string | null } | null {
  return state.tx_hash ? { destinationTxUrl: state.tx_hash } : null;
}

async function usableTokens(options?: ServiceOptions): Promise<OneClickToken[]> {
  return demoMode() ? DEMO_TOKENS : getTokens(options?.fetchImpl);
}
async function destinationToken(tokens: OneClickToken[]): Promise<OneClickToken> {
  const configured = process.env.DESTINATION_ASSET_ID;
  if (configured) {
    const found = tokens.find((token) => token.assetId === configured);
    if (!found) throw new PaymentInputError("Configured destination asset is unavailable");
    return found;
  }
  const matches = tokens.filter((token) => token.symbol === "USDC" && token.blockchain === "near");
  if (matches.length !== 1) throw new PaymentInputError("Expected exactly one NEAR USDC destination asset");
  return matches[0]!;
}

export async function createQuoteForInvoice(invoiceId: string, originAsset: unknown, refundTo: unknown, options?: ServiceOptions): Promise<PaymentState> {
  const invoice = getInvoicePaymentState(invoiceId);
  if (!invoice) throw new InvoiceNotFoundError();
  if (invoice.status === "paid") throw new InvoicePaidError();
  if (!validRefundTo(refundTo)) throw new PaymentInputError("Invalid refund address");
  const now = nowOf(options);
  // Validate the requested asset even when a reusable quote exists; otherwise
  // an unsupported request could appear to succeed by reusing prior state.
  const tokens = await usableTokens(options);
  const origin = tokens.find((token) => token.assetId === originAsset);
  if (!origin) throw new PaymentInputError("Unsupported origin asset");
  const stored = readStoredQuote(invoice.quote_json);
  if (stored && Date.parse(stored.payment.deadline) > now) {
    return { status: invoice.status, demo: demoMode(), payment: stored.payment, receipt: receiptFrom(invoice) };
  }
  const destination = await destinationToken(tokens);
  const deadline = new Date(now + 60 * 60_000).toISOString();
  let response: QuoteResponse;
  if (demoMode()) {
    response = { quote: { depositAddress: "demo-deposit-address", amountIn: scaleCents(invoice.amount_cents, destination.decimals), amountInFormatted: `${(invoice.amount_cents / 100).toFixed(2)} ${origin.symbol}`, amountOut: scaleCents(invoice.amount_cents, destination.decimals), deadline, timeEstimate: 10 }, signature: "demo" };
  } else {
    response = await requestQuote({ dry: false, swapType: "EXACT_OUTPUT", slippageTolerance: 100, originAsset: origin.assetId, depositType: "ORIGIN_CHAIN", destinationAsset: destination.assetId, amount: scaleCents(invoice.amount_cents, destination.decimals), refundTo, refundType: "ORIGIN_CHAIN", recipient: invoice.recipient_address, recipientType: "DESTINATION_CHAIN", deadline }, options?.fetchImpl);
  }
  const payment: PaymentDisplay = { depositAddress: response.quote.depositAddress, depositMemo: response.quote.depositMemo ?? null, sendAmount: response.quote.amountInFormatted, symbol: origin.symbol, chain: origin.blockchain, deadline: quoteExpiry(response, deadline), timeEstimateSeconds: response.quote.timeEstimate ?? null };
  saveInvoiceQuote(invoiceId, { quoteJson: JSON.stringify({ response, payment, createdAt: now }), depositAddress: payment.depositAddress, depositMemo: payment.depositMemo, originAsset: origin.assetId, refundTo, quoteExpiresAt: payment.deadline });
  return { status: "awaiting_deposit", demo: demoMode(), payment, receipt: null };
}

export async function refreshInvoiceStatus(invoiceId: string, options?: ServiceOptions): Promise<PaymentState> {
  const now = nowOf(options);
  const throttled = statusThrottle.get(invoiceId);
  if (throttled && now - throttled.at < 3_000) return throttled.result;
  const invoice = getInvoicePaymentState(invoiceId);
  if (!invoice) throw new InvoiceNotFoundError();
  const stored = readStoredQuote(invoice.quote_json);
  if (invoice.status === "paid") return { status: "paid", demo: demoMode(), payment: stored?.payment ?? null, receipt: receiptFrom(invoice) };
  if (!stored || !invoice.deposit_address) return { status: invoice.status, demo: demoMode(), payment: null, receipt: null };
  let nextStatus: string = invoice.status;
  let txHash: string | null = null;
  let txUrl: string | null = null;
  if (demoMode()) {
    const age = now - stored.createdAt;
    nextStatus = age >= 10_000 ? "paid" : age >= 5_000 ? "processing" : "awaiting_deposit";
    if (nextStatus === "paid") { txHash = "demo-transaction"; txUrl = "demo-transaction"; }
  } else {
    const provider = await getSwapStatus(invoice.deposit_address, invoice.deposit_memo, options?.fetchImpl);
    const first = provider.swapDetails?.destinationChainTxHashes?.[0];
    txHash = first?.hash ?? null;
    txUrl = first?.explorerUrl ?? txHash;
    nextStatus = ({ PENDING_DEPOSIT: "awaiting_deposit", KNOWN_DEPOSIT_TX: "processing", PROCESSING: "processing", SUCCESS: "paid", INCOMPLETE_DEPOSIT: "incomplete", REFUNDED: "refunded", FAILED: "failed" } as Record<string, string>)[provider.status] ?? invoice.status;
    if (provider.status === "PENDING_DEPOSIT" && Date.parse(stored.payment.deadline) <= now) nextStatus = "expired";
  }
  const updated = updateInvoicePaymentStatus(invoiceId, nextStatus, txHash);
  const result: PaymentState = { status: updated.status, demo: demoMode(), payment: stored.payment, receipt: updated.status === "paid" ? { destinationTxUrl: txUrl ?? updated.tx_hash } : null };
  statusThrottle.set(invoiceId, { at: now, result });
  return result;
}

export { scaleCents };
