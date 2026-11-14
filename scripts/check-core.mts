import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirectory = mkdtempSync(join(tmpdir(), "creator-payment-desk-"));
process.env.DB_PATH = join(tempDirectory, "check.db");

const { countActiveDeskTokens, createCreator, createInvoice, findCreatorByAddress, getCreatorDesk, getInvoicePublic, issueDeskToken, listInvoicesForCreator, revokeDeskToken, revokeOtherDeskTokens, verifyDeskToken } = await import("../lib/db");
const { hashToken, timingSafeEqualHex } = await import("../lib/tokens");
const { rateLimit } = await import("../lib/rate-limit");
const { normalizeDeliverableUrl, validateAmountCents, validateClientName, validateDescription, validateNearAddress } = await import("../lib/validate");
const { createInvoiceForCreator, createInvoiceForWallet } = await import("../lib/invoice-service");
const { createQuoteForInvoice, refreshInvoiceStatus, PaymentInputError } = await import("../lib/payment-service");
const { POST: createDeskToken } = await import("../app/api/desk/tokens/route");
const { POST: createInvoiceRoute } = await import("../app/api/invoices/route");
const { escapeCsvCell } = await import("../app/api/desk/export/route");

try {
  const limiterStart = 1_000_000;
  assert.equal(rateLimit("limiter-allow", 2, 1_000, limiterStart).ok, true);
  assert.equal(rateLimit("limiter-allow", 2, 1_000, limiterStart + 1).ok, true);
  const blockedLimit = rateLimit("limiter-allow", 2, 1_000, limiterStart + 2);
  assert.equal(blockedLimit.ok, false);
  assert.equal(blockedLimit.retryAfterSeconds, 1);
  assert.equal(rateLimit("limiter-allow", 2, 1_000, limiterStart + 1_000).ok, true);

  const capStart = 2_000_000;
  assert.equal(rateLimit("limiter-cap-oldest", 1, 60_000, capStart).ok, true);
  for (let index = 0; index < 9_999; index += 1) {
    assert.equal(rateLimit(`limiter-cap-${index}`, 1, 60_000, capStart).ok, true);
  }
  assert.equal(rateLimit("limiter-cap-overflow", 1, 60_000, capStart).ok, true);
  assert.equal(rateLimit("limiter-cap-oldest", 1, 60_000, capStart).ok, true);

  process.env.RATE_LIMIT_DISABLED = "true";
  assert.equal(rateLimit("limiter-disabled", 1, 60_000, limiterStart).ok, true);
  assert.equal(rateLimit("limiter-disabled", 1, 60_000, limiterStart).ok, true);
  delete process.env.RATE_LIMIT_DISABLED;

  const creatorId = createCreator("alice.near");
  const otherCreatorId = createCreator("bob.near");
  assert.equal(findCreatorByAddress(" alice.near ")?.id, creatorId);

  const token = issueDeskToken(creatorId);
  const secondToken = issueDeskToken(creatorId);
  assert.equal(token.length, 43);
  assert.equal(secondToken.length, 43);
  assert.notEqual(token, secondToken);
  assert.equal(timingSafeEqualHex(hashToken(token), hashToken(token)), true);
  assert.equal(verifyDeskToken(token)?.creatorId, creatorId);
  assert.equal(verifyDeskToken("x".repeat(44)), null);
  assert.equal(verifyDeskToken(""), null);
  assert.equal(verifyDeskToken("x".repeat(43)), null);
  assert.equal(revokeDeskToken(token), true);
  assert.equal(verifyDeskToken(token), null);

  const invoice = createInvoice({
    creatorId,
    amountCents: 1_000,
    description: "  Design work  ",
    deliverableUrl: "https://example.com/deliverable",
    clientName: "  Client  ",
  });
  createInvoice({
    creatorId: otherCreatorId,
    amountCents: 2_000,
    description: "Other work",
    deliverableUrl: "https://example.com/other",
    clientName: "Other client",
  });
  assert.equal(listInvoicesForCreator(creatorId).length, 1);
  assert.equal(listInvoicesForCreator(creatorId)[0]?.id, invoice.id);
  assert.equal(listInvoicesForCreator(otherCreatorId).length, 1);
  const publicInvoice = getInvoicePublic(invoice.id);
  assert(publicInvoice);
  assert.equal(Object.hasOwn(publicInvoice, "creator_id"), false);

  assert.equal(validateNearAddress("alice.near").ok, true);
  assert.equal(validateNearAddress("A.near").ok, false);
  assert.equal(validateAmountCents(100).ok, true);
  assert.equal(validateAmountCents(99).ok, false);
  const emptyUrl = normalizeDeliverableUrl("");
  assert(emptyUrl.ok);
  assert.equal(emptyUrl.value, "");
  const bareUrl = normalizeDeliverableUrl("mysite.com");
  assert(bareUrl.ok);
  assert.equal(bareUrl.value, "https://mysite.com");
  const httpsUrl = normalizeDeliverableUrl("https://a.com/x");
  assert(httpsUrl.ok);
  assert.equal(httpsUrl.value, "https://a.com/x");
  assert.equal(normalizeDeliverableUrl("HTTP://a.com").ok, true);
  assert.equal(normalizeDeliverableUrl("javascript:alert(1)").ok, false);
  assert.equal(normalizeDeliverableUrl("data:text/html,x").ok, false);
  assert.equal(normalizeDeliverableUrl("my portfolio").ok, false);
  assert.equal(normalizeDeliverableUrl("localhost").ok, false);
  assert.equal(normalizeDeliverableUrl("https://a.com@evil.com").ok, false);
  const portUrl = normalizeDeliverableUrl("mysite.com:8080/p");
  assert(portUrl.ok);
  assert.equal(portUrl.value, "https://mysite.com:8080/p");
  const goodDescription = validateDescription("  okay  ");
  assert(goodDescription.ok);
  assert.equal(goodDescription.value, "okay");
  assert.equal(validateDescription("   ").ok, false);
  assert.equal(validateDescription("x".repeat(501)).ok, false);
  assert.equal(validateClientName("x".repeat(101)).ok, false);

  const newWalletInvoice = createInvoiceForWallet({
    wallet: "new-creator.near",
    amountCents: 2_500,
    description: "Initial project delivery",
    deliverableUrl: "https://example.com/initial-delivery",
  });
  assert.equal(newWalletInvoice.kind, "created");
  assert.equal(newWalletInvoice.deskToken.length, 43);
  const newCreator = findCreatorByAddress("new-creator.near");
  assert(newCreator);
  assert.equal(verifyDeskToken(newWalletInvoice.deskToken)?.creatorId, newCreator.id);
  assert.equal(listInvoicesForCreator(newCreator.id).length, 1);
  assert.equal(listInvoicesForCreator(newCreator.id)[0]?.id, newWalletInvoice.invoiceId);

  const duplicateWalletInvoice = createInvoiceForWallet({
    wallet: "new-creator.near",
    amountCents: 2_500,
    description: "Should not be created",
    deliverableUrl: "https://example.com/should-not-exist",
  });
  assert.equal(duplicateWalletInvoice.kind, "desk_exists");
  assert.equal(listInvoicesForCreator(newCreator.id).length, 1);

  const invalidWalletInvoice = createInvoiceForWallet({
    wallet: "invalid wallet",
    amountCents: 1,
    description: "",
    deliverableUrl: "http://example.com",
  });
  assert.equal(invalidWalletInvoice.kind, "invalid");

  const deskCreatorId = createCreator("desk-owner.near");
  const deskTokenA = issueDeskToken(deskCreatorId);
  const deskTokenB = issueDeskToken(deskCreatorId);
  assert.equal(verifyDeskToken(deskTokenA)?.creatorId, verifyDeskToken(deskTokenB)?.creatorId);
  const deskInvoice = createInvoiceForCreator(deskCreatorId, Object.assign({
    amountCents: 3_000,
    description: "Desk-created invoice",
    deliverableUrl: "https://example.com/desk-invoice",
    clientName: "Desk client",
  }, { wallet: "someone-else.near" }));
  assert.equal(deskInvoice.kind, "created");
  assert.equal(listInvoicesForCreator(verifyDeskToken(deskTokenA)!.creatorId)[0]?.id, deskInvoice.kind === "created" ? deskInvoice.invoiceId : "");
  assert.equal(listInvoicesForCreator(verifyDeskToken(deskTokenB)!.creatorId)[0]?.id, deskInvoice.kind === "created" ? deskInvoice.invoiceId : "");
  assert.equal(findCreatorByAddress("someone-else.near"), null);
  assert.equal(getCreatorDesk(deskCreatorId).invoices.length, 1);
  const walletOnlyResponse = await createInvoiceRoute(new Request("http://localhost/api/invoices", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: "desk-owner.near", amountCents: 3_000, description: "No access", deliverableUrl: "https://example.com/no-access", clientName: "" }),
  }));
  assert.equal(walletOnlyResponse.status, 409);
  assert.equal(listInvoicesForCreator(deskCreatorId).length, 1);

  const replacementToken = issueDeskToken(deskCreatorId);
  assert.equal(revokeOtherDeskTokens(deskCreatorId, replacementToken), 2);
  assert.equal(verifyDeskToken(deskTokenA), null);
  assert.equal(verifyDeskToken(deskTokenB), null);
  assert.equal(verifyDeskToken(replacementToken)?.creatorId, deskCreatorId);

  const limitCreatorId = createCreator("limit-owner.near");
  const limitToken = issueDeskToken(limitCreatorId);
  for (let index = 1; index < 10; index += 1) issueDeskToken(limitCreatorId);
  assert.equal(countActiveDeskTokens(limitCreatorId), 10);
  const limitResponse = await createDeskToken(new Request("http://localhost/api/desk/tokens", {
    method: "POST", headers: { "content-type": "application/json", "x-desk-token": limitToken }, body: JSON.stringify({ revokeOthers: false }),
  }));
  assert.equal(limitResponse.status, 409);
  assert.equal(escapeCsvCell("=SUM(A1:A2)"), "'=SUM(A1:A2)");
  assert.equal(escapeCsvCell("+danger"), "'+danger");
  assert.equal(escapeCsvCell("safe, value"), '"safe, value"');

  process.env.DEMO_MODE = "false";
  let calls = 0;
  let quoteBody: Record<string, unknown> | null = null;
  let nextProviderStatus = "PENDING_DEPOSIT";
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls += 1;
    const url = String(input);
    if (url.endsWith("/v0/tokens")) return Response.json([
      { assetId: "usdc.near", decimals: 6, blockchain: "near", symbol: "USDC" },
      { assetId: "eth.usdc", decimals: 6, blockchain: "eth", symbol: "USDC" },
    ]);
    if (url.endsWith("/v0/quote")) {
      quoteBody = JSON.parse(String(init?.body));
      return Response.json({ quote: { depositAddress: "deposit-1", amountIn: "50000000", amountInFormatted: "50 USDC", amountOut: "49990000", deadline: new Date(Date.now() + 60 * 60_000).toISOString(), timeEstimate: 12 }, signature: "signature" });
    }
    return Response.json({ status: nextProviderStatus, swapDetails: { destinationChainTxHashes: [{ hash: "tx-1", explorerUrl: "https://explorer.example/tx-1" }] } });
  };

  const paymentInvoice = createInvoice({
    creatorId,
    amountCents: 4_999,
    description: "Payment test",
    deliverableUrl: "https://example.com/payment-test",
    clientName: "Payment client",
  });
  const quoted = await createQuoteForInvoice(paymentInvoice.id, "eth.usdc", "0xabc", { fetchImpl: fakeFetch, now: Date.now() });
  assert.equal(quoted.payment?.depositAddress, "deposit-1");
  assert(quoteBody);
  const capturedQuoteBody = quoteBody as Record<string, unknown>;
  assert.equal(capturedQuoteBody.amount, "49990000");
  assert.equal(capturedQuoteBody.recipient, "alice.near");
  assert.equal(capturedQuoteBody.swapType, "EXACT_OUTPUT");
  const callsAfterQuote = calls;
  await createQuoteForInvoice(paymentInvoice.id, "eth.usdc", "0xabc", { fetchImpl: fakeFetch, now: Date.now() });
  assert.equal(calls, callsAfterQuote);
  await assert.rejects(() => createQuoteForInvoice(paymentInvoice.id, "not-a-token", "0xabc", { fetchImpl: fakeFetch }), PaymentInputError);

  const statusCases: Array<[string, string]> = [
    ["PENDING_DEPOSIT", "awaiting_deposit"], ["KNOWN_DEPOSIT_TX", "processing"], ["PROCESSING", "processing"],
    ["SUCCESS", "paid"], ["INCOMPLETE_DEPOSIT", "incomplete"], ["REFUNDED", "refunded"], ["FAILED", "failed"],
  ];
  for (const [providerStatus, expected] of statusCases) {
    const statusInvoice = createInvoice({ creatorId, amountCents: 1_000, description: `Status ${providerStatus}`, deliverableUrl: `https://example.com/${providerStatus}`, clientName: "Client" });
    const base = Date.now();
    await createQuoteForInvoice(statusInvoice.id, "eth.usdc", "0xabc", { fetchImpl: fakeFetch, now: base });
    nextProviderStatus = providerStatus;
    const state = await refreshInvoiceStatus(statusInvoice.id, { fetchImpl: fakeFetch, now: base + 4_000 });
    assert.equal(state.status, expected);
    if (providerStatus === "SUCCESS") {
      nextProviderStatus = "FAILED";
      const paidAgain = await refreshInvoiceStatus(statusInvoice.id, { fetchImpl: fakeFetch, now: base + 8_000 });
      assert.equal(paidAgain.status, "paid");
    }
  }

  process.env.DEMO_MODE = "true";
  let demoCalls = 0;
  const demoFetch = async () => { demoCalls += 1; return Response.json({}); };
  const demoInvoice = createInvoice({ creatorId, amountCents: 1_000, description: "Demo payment", deliverableUrl: "https://example.com/demo", clientName: "Demo" });
  const demoStart = Date.now();
  await createQuoteForInvoice(demoInvoice.id, "nep141:usdc.demo.near", "demo-refund", { fetchImpl: demoFetch as typeof fetch, now: demoStart });
  assert.equal((await refreshInvoiceStatus(demoInvoice.id, { fetchImpl: demoFetch as typeof fetch, now: demoStart + 1_000 })).status, "awaiting_deposit");
  assert.equal((await refreshInvoiceStatus(demoInvoice.id, { fetchImpl: demoFetch as typeof fetch, now: demoStart + 6_000 })).status, "processing");
  assert.equal((await refreshInvoiceStatus(demoInvoice.id, { fetchImpl: demoFetch as typeof fetch, now: demoStart + 11_000 })).status, "paid");
  assert.equal(demoCalls, 0);

  console.log("Core checks passed");
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

