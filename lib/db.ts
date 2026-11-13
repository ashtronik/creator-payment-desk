// Server-only module. Do not import this file from client components.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

import { generateToken, hashToken, timingSafeEqualHex } from "./tokens";
import {
  validateAmountCents,
  validateClientName,
  validateDeliverableUrl,
  validateDescription,
  validateNearAddress,
} from "./validate";

type SqliteRow = Record<string, unknown>;
type SqliteStatement = {
  run(...parameters: unknown[]): { lastInsertRowid: number | bigint; changes: number | bigint };
  get(...parameters: unknown[]): SqliteRow | undefined;
  all(...parameters: unknown[]): SqliteRow[];
};
type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
};

const { DatabaseSync } = (process as unknown as { getBuiltinModule(id: string): unknown })
  .getBuiltinModule("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

export type PublicInvoice = {
  id: string;
  amount_cents: number;
  description: string;
  deliverable_url: string;
  client_name: string;
  status: string;
  deposit_address: string | null;
  origin_asset: string | null;
  quote_expires_at: string | null;
  tx_hash: string | null;
  created_at: string;
  paid_at: string | null;
};

export type InvoicePaymentState = PublicInvoice & {
  recipient_address: string;
  quote_json: string | null;
  deposit_memo: string | null;
  refund_to: string | null;
};

export type CreateInvoiceInput = {
  creatorId: number;
  amountCents: number;
  description: string;
  deliverableUrl: string;
  clientName: string;
  status?: string;
  depositAddress?: string | null;
  originAsset?: string | null;
  quoteExpiresAt?: string | null;
  txHash?: string | null;
  paidAt?: string | null;
};

const databasePath = process.env.DB_PATH || "data/app.db";
let database: SqliteDatabase | null = null;

export function getDatabase(): SqliteDatabase {
  if (database) return database;

  mkdirSync(dirname(databasePath), { recursive: true });
  const openedDatabase = new DatabaseSync(databasePath);
  openedDatabase.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS creators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      near_address TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS desk_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      description TEXT NOT NULL,
      deliverable_url TEXT NOT NULL,
      client_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deposit_address TEXT,
      origin_asset TEXT,
      quote_expires_at TEXT,
      tx_hash TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT
    );
    CREATE INDEX IF NOT EXISTS invoices_creator_id_idx ON invoices(creator_id);
  `);
  // SQLite has no ADD COLUMN IF NOT EXISTS. Inspect first so existing local
  // databases and freshly-created databases follow the same migration path.
  const columns = openedDatabase.prepare("PRAGMA table_info(invoices)").all()
    .map((row) => String(row.name));
  for (const [name, definition] of [
    ["quote_json", "TEXT"],
    ["deposit_memo", "TEXT"],
    ["refund_to", "TEXT"],
  ] as const) {
    if (!columns.includes(name)) openedDatabase.exec(`ALTER TABLE invoices ADD COLUMN ${name} ${definition}`);
  }
  database = openedDatabase;
  return database;
}

function rowToPublicInvoice(row: SqliteRow): PublicInvoice {
  return {
    id: String(row.id),
    amount_cents: Number(row.amount_cents),
    description: String(row.description),
    deliverable_url: String(row.deliverable_url),
    client_name: String(row.client_name),
    status: String(row.status),
    deposit_address: row.deposit_address == null ? null : String(row.deposit_address),
    origin_asset: row.origin_asset == null ? null : String(row.origin_asset),
    quote_expires_at: row.quote_expires_at == null ? null : String(row.quote_expires_at),
    tx_hash: row.tx_hash == null ? null : String(row.tx_hash),
    created_at: String(row.created_at),
    paid_at: row.paid_at == null ? null : String(row.paid_at),
  };
}

export function createCreator(address: string): number {
  const valid = validateNearAddress(address);
  if (!valid.ok) throw new Error(valid.error);

  const database = getDatabase();
  const result = database
    .prepare("INSERT INTO creators (near_address) VALUES (?)")
    .run(valid.value);
  return Number(result.lastInsertRowid);
}

export function findCreatorByAddress(address: string): { id: number; near_address: string; created_at: string } | null {
  const valid = validateNearAddress(address);
  if (!valid.ok) return null;

  const database = getDatabase();
  const row = database
    .prepare("SELECT id, near_address, created_at FROM creators WHERE near_address = ?")
    .get(valid.value);
  if (!row) return null;
  return { id: Number(row.id), near_address: String(row.near_address), created_at: String(row.created_at) };
}

export function issueDeskToken(creatorId: number): string {
  const token = generateToken();
  const database = getDatabase();
  database
    .prepare("INSERT INTO desk_tokens (creator_id, token_hash) VALUES (?, ?)")
    .run(creatorId, hashToken(token));
  return token;
}

export function verifyDeskToken(token: string): { creatorId: number } | null {
  if (typeof token !== "string" || token.length !== 43) return null;

  const database = getDatabase();
  const tokenHash = hashToken(token);
  const candidate = database
    .prepare("SELECT creator_id, token_hash FROM desk_tokens WHERE token_hash = ? AND revoked_at IS NULL")
    .get(tokenHash);
  if (candidate && timingSafeEqualHex(String(candidate.token_hash), tokenHash)) {
    database.prepare("UPDATE desk_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?")
      .run(tokenHash);
    return { creatorId: Number(candidate.creator_id) };
  }

  return null;
}

export function revokeDeskToken(token: string): boolean {
  const database = getDatabase();
  const result = database
    .prepare("UPDATE desk_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL")
    .run(hashToken(token));
  return Number(result.changes ?? 0) > 0;
}

export function createInvoice(input: CreateInvoiceInput): PublicInvoice {
  const amount = validateAmountCents(input.amountCents);
  const description = validateDescription(input.description);
  const deliverableUrl = validateDeliverableUrl(input.deliverableUrl);
  const clientName = validateClientName(input.clientName);
  if (!amount.ok) throw new Error(amount.error);
  if (!description.ok) throw new Error(description.error);
  if (!deliverableUrl.ok) throw new Error(deliverableUrl.error);
  if (!clientName.ok) throw new Error(clientName.error);

  const id = randomBytes(16).toString("base64url");
  const database = getDatabase();
  database.prepare(`
    INSERT INTO invoices (
      id, creator_id, amount_cents, description, deliverable_url, client_name,
      status, deposit_address, origin_asset, quote_expires_at, tx_hash, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.creatorId,
    amount.value,
    description.value,
    deliverableUrl.value,
    clientName.value,
    input.status ?? "pending",
    input.depositAddress ?? null,
    input.originAsset ?? null,
    input.quoteExpiresAt ?? null,
    input.txHash ?? null,
    input.paidAt ?? null,
  );

  return getInvoicePublic(id)!;
}

const publicInvoiceSelect = `
  SELECT id, amount_cents, description, deliverable_url, client_name, status,
    deposit_address, origin_asset, quote_expires_at, tx_hash, created_at, paid_at
  FROM invoices
`;

export function getInvoicePublic(id: string): PublicInvoice | null {
  const database = getDatabase();
  const row = database.prepare(`${publicInvoiceSelect} WHERE id = ?`).get(id);
  return row ? rowToPublicInvoice(row) : null;
}

export function listInvoicesForCreator(creatorId: number): PublicInvoice[] {
  const database = getDatabase();
  return database
    .prepare(`${publicInvoiceSelect} WHERE creator_id = ? ORDER BY created_at DESC, id DESC`)
    .all(creatorId)
    .map(rowToPublicInvoice);
}

export function createCreatorWithFirstInvoice(input: {
  nearAddress: string;
  amountCents: number;
  description: string;
  deliverableUrl: string;
  clientName: string;
}): { kind: "created"; invoiceId: string; deskToken: string } | { kind: "desk_exists" } {
  const database = getDatabase();
  let transactionOpen = false;

  try {
    database.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const creatorResult = database.prepare("INSERT INTO creators (near_address) VALUES (?)").run(input.nearAddress);
    const creatorId = Number(creatorResult.lastInsertRowid);
    const deskToken = generateToken();
    database.prepare("INSERT INTO desk_tokens (creator_id, token_hash) VALUES (?, ?)").run(creatorId, hashToken(deskToken));

    const invoiceId = randomBytes(16).toString("base64url");
    database.prepare(`
      INSERT INTO invoices (id, creator_id, amount_cents, description, deliverable_url, client_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(invoiceId, creatorId, input.amountCents, input.description, input.deliverableUrl, input.clientName);

    database.exec("COMMIT");
    transactionOpen = false;
    return { kind: "created", invoiceId, deskToken };
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK");
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return { kind: "desk_exists" };
    }
    throw error;
  }
}

export function getInvoicePaymentDetails(id: string): (PublicInvoice & { recipient_address: string }) | null {
  const database = getDatabase();
  const row = database.prepare(`
    SELECT invoices.id, invoices.amount_cents, invoices.description, invoices.deliverable_url,
      invoices.client_name, invoices.status, invoices.deposit_address, invoices.origin_asset,
      invoices.quote_expires_at, invoices.tx_hash, invoices.created_at, invoices.paid_at,
      creators.near_address AS recipient_address
    FROM invoices INNER JOIN creators ON creators.id = invoices.creator_id
    WHERE invoices.id = ?
  `).get(id);
  return row ? { ...rowToPublicInvoice(row), recipient_address: String(row.recipient_address) } : null;
}

export function getInvoicePaymentState(id: string): InvoicePaymentState | null {
  const database = getDatabase();
  const row = database.prepare(`
    SELECT invoices.id, invoices.amount_cents, invoices.description, invoices.deliverable_url,
      invoices.client_name, invoices.status, invoices.deposit_address, invoices.origin_asset,
      invoices.quote_expires_at, invoices.tx_hash, invoices.created_at, invoices.paid_at,
      invoices.quote_json, invoices.deposit_memo, invoices.refund_to,
      creators.near_address AS recipient_address
    FROM invoices INNER JOIN creators ON creators.id = invoices.creator_id
    WHERE invoices.id = ?
  `).get(id);
  if (!row) return null;
  return {
    ...rowToPublicInvoice(row),
    recipient_address: String(row.recipient_address),
    quote_json: row.quote_json == null ? null : String(row.quote_json),
    deposit_memo: row.deposit_memo == null ? null : String(row.deposit_memo),
    refund_to: row.refund_to == null ? null : String(row.refund_to),
  };
}

export function saveInvoiceQuote(id: string, input: {
  quoteJson: string;
  depositAddress: string;
  depositMemo: string | null;
  originAsset: string;
  refundTo: string;
  quoteExpiresAt: string;
}): void {
  getDatabase().prepare(`
    UPDATE invoices SET quote_json = ?, deposit_address = ?, deposit_memo = ?, origin_asset = ?,
      refund_to = ?, quote_expires_at = ?, status = 'awaiting_deposit'
    WHERE id = ? AND status != 'paid'
  `).run(input.quoteJson, input.depositAddress, input.depositMemo, input.originAsset, input.refundTo, input.quoteExpiresAt, id);
}

export function updateInvoicePaymentStatus(id: string, status: string, txHash: string | null): InvoicePaymentState {
  const database = getDatabase();
  if (status === "paid") {
    database.prepare(`
      UPDATE invoices SET status = 'paid', tx_hash = COALESCE(?, tx_hash),
        paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
      WHERE id = ? AND status != 'paid'
    `).run(txHash, id);
  } else {
    database.prepare("UPDATE invoices SET status = ? WHERE id = ? AND status != 'paid'").run(status, id);
  }
  const invoice = getInvoicePaymentState(id);
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

