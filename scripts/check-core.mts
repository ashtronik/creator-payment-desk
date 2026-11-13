import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirectory = mkdtempSync(join(tmpdir(), "creator-payment-desk-"));
process.env.DB_PATH = join(tempDirectory, "check.db");

const { createCreator, createInvoice, findCreatorByAddress, getInvoicePublic, issueDeskToken, listInvoicesForCreator, revokeDeskToken, verifyDeskToken } = await import("../lib/db");
const { hashToken, timingSafeEqualHex } = await import("../lib/tokens");
const { validateAmountCents, validateClientName, validateDeliverableUrl, validateDescription, validateNearAddress } = await import("../lib/validate");
const { createInvoiceForWallet } = await import("../lib/invoice-service");

try {
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
  const goodUrl = validateDeliverableUrl(" https://example.com ");
  assert(goodUrl.ok);
  assert.equal(goodUrl.value, "https://example.com");
  assert.equal(validateDeliverableUrl("http://example.com").ok, false);
  assert.equal(validateDeliverableUrl("https://user:password@example.com").ok, false);
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

  console.log("Core checks passed");
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

