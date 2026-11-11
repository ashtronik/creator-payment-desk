# Creator Payment Desk — Blueprint

## One line
A payment desk for Web3 creators: send an invoice tied to
the work delivered, get paid from any chain in stablecoin,
and keep an automatic income record.

## Hackathon
NEAR Hackathon, Real-World Money track.
Deadline: 14 Nov 2026, 23:59 UTC.
Needs: public repo, X demo post, submission form.

## Problem
Crypto projects pay creators in different tokens on
different chains. Creators chase payments and keep
messy records.

## Users
1. Creator: makes invoices, sees income.
2. Client (project): pays an invoice, no account needed.

## Screens (only 3)
1. Create invoice: amount (USD), description,
   deliverable link (thread/video), creator NEAR address.
2. Pay page (public link): shows the work, client picks
   the token/chain they hold, sees one-time deposit
   address + exact amount, live status until "Paid".
3. Income ledger: paid invoices, totals, CSV download.

## Payment flow (NEAR Intents 1Click API)
tokens list -> quote (preview) -> quote (real, gives
deposit address) -> client sends funds -> poll status
until SUCCESS / FAILED / REFUNDED.
Creator receives exact stablecoin amount on NEAR.
Client supplies a refund address.

## Out of scope
Accounts/passwords, team splits, smart contracts,
AI agents, fiat, recurring billing.

## Tech (my recommendation, can change)
Next.js + TypeScript, SQLite (zero setup, runs locally).

## Decisions
- Non-custodial: we never hold funds or private keys.
- No login: creator gets a secret dashboard link.
- DEMO_MODE env: simulates a paid invoice so anyone
  (including judges' tools) can run it without real money.
- No NEAR Intents testnet: real tests use tiny amounts.

## Security rules
- No keys or .env in GitHub. Add .env to .gitignore.
- Validate NEAR addresses and amounts on the server.
- API token (if used) stays server-side only.

## Build order
M1 Scaffold + create invoice
M2 Pay page + live status
M3 Ledger + CSV
M4 DEMO_MODE, README, demo video, submit

## Judge fit
Real use case, clear UX, uses NEAR Intents,
non-custodial, easy to run.