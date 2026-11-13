import { createCreatorWithFirstInvoice } from "./db";
import { validateAmountCents, validateClientName, validateDeliverableUrl, validateDescription, validateNearAddress } from "./validate";

export type CreateInvoiceForWalletInput = {
  wallet?: unknown;
  amountCents?: unknown;
  description?: unknown;
  deliverableUrl?: unknown;
  clientName?: unknown;
};

export type CreateInvoiceForWalletResult =
  | { kind: "created"; invoiceId: string; deskToken: string }
  | { kind: "desk_exists" }
  | { kind: "invalid"; errors: Record<string, string> };

export function createInvoiceForWallet(input: CreateInvoiceForWalletInput): CreateInvoiceForWalletResult {
  const wallet = validateNearAddress(input.wallet);
  const amountCents = validateAmountCents(input.amountCents);
  const description = validateDescription(input.description);
  const deliverableUrl = validateDeliverableUrl(input.deliverableUrl);
  const clientName = validateClientName(input.clientName ?? "");
  const errors: Record<string, string> = {};

  if (!wallet.ok) errors.wallet = wallet.error;
  if (!amountCents.ok) errors.amountCents = amountCents.error;
  if (!description.ok) errors.description = description.error;
  if (!deliverableUrl.ok) errors.deliverableUrl = deliverableUrl.error;
  if (!clientName.ok) errors.clientName = clientName.error;
  if (Object.keys(errors).length > 0) return { kind: "invalid", errors };

  return createCreatorWithFirstInvoice({
    nearAddress: wallet.ok ? wallet.value : "",
    amountCents: amountCents.ok ? amountCents.value : 0,
    description: description.ok ? description.value : "",
    deliverableUrl: deliverableUrl.ok ? deliverableUrl.value : "",
    clientName: clientName.ok ? clientName.value : "",
  });
}
