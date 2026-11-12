# Creator Payment Desk: Blueprint (final)

## One line
A payment desk for Web3 creators: send an invoice tied to
the work delivered, get paid from any chain in stablecoin,
and keep a private, automatic income record.

## Hackathon
NEAR Hackathon, Real-World Money track.
Deadline: 14 Nov 2026, 23:59 UTC.
Needs: public repo, X demo post, submission form.

## Problem
Crypto projects pay creators in different tokens on
different chains. Creators chase payments and keep
messy records.

## Users
1. Creator: makes invoices, sees private income history.
2. Client: pays an invoice, no account needed.

## Screens
1. Create invoice (public home page)
2. Pay page: /pay/[id] (public, one invoice)
3. Private desk: /desk/[token] (all of one creator's history)

## Access model
Two separate concepts:
1. Creator identity: the NEAR receiving address. Says whose
   invoices they are. Public. NEVER a credential.
2. Desk access: a random secret token in the desk URL.
   The ONLY credential.
A creator's history belongs to the creator, not to a token.
Any valid token shows the same full history.

## Data (SQLite, 3 tables)
creators: id, near_address (UNIQUE), created_at
desk_tokens: id, creator_id, token_hash (UNIQUE),
  created_at, last_used_at, revoked_at
invoices: id (random, unguessable), creator_id,
  amount_cents, description, deliverable_url, client_name,
  status, deposit_address, origin_asset, quote_expires_at,
  tx_hash, created_at, paid_at
The payment recipient always comes from the database
(creators.near_address), never from the request.

## Token rules
32 random bytes (crypto), base64url. Shown once. Store only
the SHA-256 hash. Constant-time compare. Revoked = rejected.
Never log tokens. Desk URL: /desk/[token]. APIs take the
token in the header x-desk-token, never in a query string.

## Invoice creation (POST /api/invoices)
A. Wallet is new: create creator + first token. Return
   payUrl + deskUrl (token shown once).
B. Valid desk token: add invoice to that creator. The wallet
   comes from the creator record, not the form.
C. Wallet exists, no valid token: reject (409). Nothing
   created, no token issued.
Another link: generated from inside the desk (needs a valid
token). Lost every link: wallet-signature recovery
(STRETCH, recovery only, never normal access).

## Payment flow (NEAR Intents 1Click API)
tokens list -> quote (preview) -> quote (real, gives
deposit address) -> client sends funds -> poll status
until SUCCESS / FAILED / REFUNDED.
Creator receives the exact stablecoin amount on NEAR.
Client supplies a refund address.

## Routes
POST /api/invoices        flows A, B, C
GET  /api/invoices/[id]   public pay-page data only
POST /api/quote           recipient from DB
GET  /api/status          poll payment
GET  /api/desk            full history + totals (token)
GET  /api/desk/export     CSV (token)
POST /api/desk/tokens     new link; option to revoke others

## Ledger
All invoices for the creator, across every token. Totals
by status. CSV export. A new link shows the same history.
Old links keep working unless revoked.

## Security
- A wallet address alone never grants access to anything.
- Invalid, revoked or unknown token: same generic 404.
- Desk pages: Referrer-Policy no-referrer, no-store, noindex.
- Public invoice data never includes creator_id or tokens.
- Rate-limit token attempts and invoice creation.
- CSV cells starting with = + - @ are escaped.
- No private keys, no custody, no passwords.
- No keys or .env in GitHub. Validate all input on the server.

## Out of scope
Accounts/passwords, wallet login, team splits, smart
contracts, AI agents, fiat, recurring billing.

## Tech (can change)
Next.js + TypeScript, SQLite (zero setup, runs locally).

## Other decisions
- DEMO_MODE env: simulates a paid invoice so anyone can
  run it without real money.
- No NEAR Intents testnet: real tests use tiny amounts.

## Cut line
MUST: create invoice, token desk, pay flow, paid status,
README, demo. NICE: CSV, QR code, wallet-signature recovery.
Cut NICE first. Never cut README or demo.