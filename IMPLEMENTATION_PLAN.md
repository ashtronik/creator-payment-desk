# Creator Payment Desk — Implementation Plan

## Architecture (how the pieces connect)
Browser pages (Next.js) <-> Server routes (Next.js API)
Server routes <-> SQLite database (invoices)
Server routes <-> NEAR Intents 1Click API (quotes, status)
We never touch private keys or hold funds.

## Data (one table: invoices)
id, creator_near_address, amount_usd, description,
deliverable_url, client_name, status, deposit_address,
origin_token, tx_hash, dashboard_token, created_at, paid_at

## Pages
/            create invoice
/pay/[id]    client pay page
/desk/[token] creator income ledger

## Server routes
POST /api/invoices      create
GET  /api/invoices/[id] read one
POST /api/quote         get 1Click quote
GET  /api/status        poll payment status
GET  /api/ledger        creator's paid list + CSV

## Cut line (if time runs short)
MUST: create invoice, pay flow, paid status, README, demo.
NICE: ledger CSV, QR code, polish.
Cut NICE items first. Never cut README or demo.

## PHASE 0: Environment (Nov 11) — branch: main
- [x] Node installed
- [x] Git installed + name/email set
- [x] Project folder created, git started
- [x] .gitignore added
- [x] Blueprint committed, public GitHub repo live
- [ ] Antigravity installed, opened on the same folder
- [ ] NEAR wallet created (needed to receive payments + submit)
- [ ] X account ready for the demo post
- [ ] Notion page created with this plan

## PHASE 1: Scaffold (Nov 11) — branch: feat/scaffold
- [ ] Create branch
- [ ] Generate Next.js + TypeScript project in the folder
- [ ] Install packages, run locally, see starter page
- [ ] Add .env.example (no real secrets)
- [ ] Commit, push, merge into main

## PHASE 2: Invoices (Nov 12) — branch: feat/invoices
- [ ] Database set up, invoice table created
- [ ] Create-invoice form (amount, description, link, address)
- [ ] Server checks: valid NEAR address, sane amount, valid URL
- [ ] Invoice saved; shareable pay link + secret desk link shown
- [ ] Pay page shows invoice details (no payment yet)
- [ ] Commit, push, merge

## PHASE 3: Pay flow (Nov 12–13) — branch: feat/pay-flow
- [ ] Fetch supported tokens from 1Click, cache them
- [ ] Token/chain picker on pay page
- [ ] Client enters refund address
- [ ] Get quote -> show deposit address + exact amount
- [ ] Quote countdown (expires ~10 min)
- [ ] Poll status: waiting / processing / paid / refunded / failed
- [ ] On success: mark invoice paid, show receipt
- [ ] DEMO_MODE: simulate payment without real money
- [ ] Commit, push, merge

## PHASE 4: Ledger (Nov 13) — branch: feat/ledger
- [ ] Desk page opens via secret link only
- [ ] List of invoices with status
- [ ] Totals (paid, pending)
- [ ] CSV download (NICE)
- [ ] Commit, push, merge

## PHASE 5: Harden + real test (Nov 13) — branch: fix/hardening
- [ ] No secrets in repo (search the code)
- [ ] Errors handled with clear messages
- [ ] Empty states + mobile layout checked
- [ ] One real tiny payment tested end to end
- [ ] Fresh clone runs from README steps alone
- [ ] Commit, push, merge

## PHASE 6: Ship (Nov 14) — branch: docs/readme
- [ ] README: problem, how it works, NEAR's role, run steps, DEMO_MODE
- [ ] Repo is public and final
- [ ] Demo video (60–90 sec): problem, create, pay, ledger
- [ ] X post: says built at NEAR HACKATHON, tags @NEARProtocol #NEARHackathon, video attached
- [ ] Submission form: name, lead, email, size, track, wallet, repo link, post link, description
- [ ] Submitted by midday Nov 14 (UTC), screenshot of confirmation