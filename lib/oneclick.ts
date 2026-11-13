// Server-only boundary for the NEAR Intents 1Click API. Keep this module out
// of client components: it reads server environment variables and calls 1Click.

export const ONECLICK_URL = "https://1click.chaindefuser.com";
export const SUPPORTED_BLOCKCHAINS = new Set(["near", "eth", "base", "arb", "sol"]);
export const SUPPORTED_SYMBOLS = new Set(["USDC", "USDT", "ETH", "SOL", "NEAR"]);

export type OneClickToken = {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
};

export type QuoteResponse = {
  quote: {
    depositAddress: string;
    depositMemo?: string | null;
    amountIn: string;
    amountInFormatted: string;
    minAmountIn?: string;
    amountOut: string;
    deadline: string;
    timeEstimate?: number;
  };
  signature: string;
  [key: string]: unknown;
};

export type SwapStatusResponse = {
  status: "PENDING_DEPOSIT" | "KNOWN_DEPOSIT_TX" | "PROCESSING" | "SUCCESS" | "INCOMPLETE_DEPOSIT" | "REFUNDED" | "FAILED";
  swapDetails?: { destinationChainTxHashes?: Array<{ hash: string; explorerUrl?: string }> };
};

export type FetchImplementation = typeof fetch;
export class OneClickProviderError extends Error {}

type CacheEntry = { tokens: OneClickToken[]; expiresAt: number };
const defaultCache: { value: CacheEntry | null } = { value: null };
const injectedCaches = new WeakMap<FetchImplementation, CacheEntry>();

function isAllowedToken(token: unknown): token is OneClickToken {
  if (!token || typeof token !== "object") return false;
  const item = token as Record<string, unknown>;
  return typeof item.assetId === "string" && typeof item.decimals === "number" &&
    Number.isInteger(item.decimals) && item.decimals >= 0 && typeof item.blockchain === "string" &&
    typeof item.symbol === "string" && SUPPORTED_BLOCKCHAINS.has(item.blockchain) && SUPPORTED_SYMBOLS.has(item.symbol);
}

async function providerFetch(path: string, init: RequestInit, fetchImpl: FetchImplementation): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const apiKey = process.env.NEAR_INTENTS_API_KEY;
  if (apiKey) headers.set("X-API-Key", apiKey);
  try {
    const response = await fetchImpl(`${ONECLICK_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new OneClickProviderError("1Click request failed");
    return response;
  } catch (error) {
    if (error instanceof OneClickProviderError) throw error;
    throw new OneClickProviderError("1Click request failed");
  }
}

export async function getTokens(fetchImpl: FetchImplementation = fetch): Promise<OneClickToken[]> {
  const now = Date.now();
  const cache = fetchImpl === fetch ? defaultCache.value : injectedCaches.get(fetchImpl);
  if (cache && cache.expiresAt > now) return cache.tokens;
  const response = await providerFetch("/v0/tokens", { method: "GET" }, fetchImpl);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new OneClickProviderError("Invalid 1Click tokens response"); }
  if (!Array.isArray(payload)) throw new OneClickProviderError("Invalid 1Click tokens response");
  const tokens = payload.filter(isAllowedToken);
  const entry = { tokens, expiresAt: now + 10 * 60_000 };
  if (fetchImpl === fetch) defaultCache.value = entry;
  else injectedCaches.set(fetchImpl, entry);
  return tokens;
}

export async function requestQuote(body: Record<string, unknown>, fetchImpl: FetchImplementation = fetch): Promise<QuoteResponse> {
  const response = await providerFetch("/v0/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, fetchImpl);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new OneClickProviderError("Invalid 1Click quote response"); }
  const quote = (payload as { quote?: unknown })?.quote as Record<string, unknown> | undefined;
  if (!quote || typeof quote.depositAddress !== "string" || typeof quote.amountInFormatted !== "string" || typeof quote.deadline !== "string") {
    throw new OneClickProviderError("Invalid 1Click quote response");
  }
  return payload as QuoteResponse;
}

export async function getSwapStatus(depositAddress: string, depositMemo: string | null, fetchImpl: FetchImplementation = fetch): Promise<SwapStatusResponse> {
  const search = new URLSearchParams({ depositAddress });
  if (depositMemo) search.set("depositMemo", depositMemo);
  const response = await providerFetch(`/v0/status?${search.toString()}`, { method: "GET" }, fetchImpl);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new OneClickProviderError("Invalid 1Click status response"); }
  const status = (payload as { status?: unknown })?.status;
  if (typeof status !== "string" || !["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS", "INCOMPLETE_DEPOSIT", "REFUNDED", "FAILED"].includes(status)) {
    throw new OneClickProviderError("Invalid 1Click status response");
  }
  return payload as SwapStatusResponse;
}
