import { getTokens } from "@/lib/oneclick";

export async function GET() {
  try {
    if (process.env.DEMO_MODE === "true") {
      return Response.json([
        { assetId: "nep141:usdc.demo.near", symbol: "USDC", blockchain: "near" },
        { assetId: "nep141:usdt.demo.near", symbol: "USDT", blockchain: "near" },
        { assetId: "native:eth", symbol: "ETH", blockchain: "eth" },
        { assetId: "native:sol", symbol: "SOL", blockchain: "sol" },
        { assetId: "native:near", symbol: "NEAR", blockchain: "near" },
      ], { headers: { "Cache-Control": "no-store" } });
    }
    const tokens = await getTokens();
    return Response.json(tokens.map(({ assetId, symbol, blockchain }) => ({ assetId, symbol, blockchain })), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "PAYMENT_PROVIDER_ERROR" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
