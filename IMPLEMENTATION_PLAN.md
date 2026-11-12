# Creator Payment Desk: Implementation Plan (final)
Source of truth with BLUEPRINT.md. Dates are UTC.
Deadline: Nov 14, 23:59. Target: submit by midday Nov 14.

## Cut line
MUST: create invoice, token desk, pay flow, paid status,
README, demo.
NICE: CSV, QR code, wallet-signature recovery.
Cut NICE first. Never cut README or demo.

## PHASE 0: Environment (done) — main
- [x] Node and Git installed, name/email set
- [x] Project folder, git started, .gitignore
- [x] Public GitHub repo live
- [x] Antigravity installed, X account ready, Notion page ready
- [ ] NEAR wallet created (moved to Phase 5)

## PHASE 1: Scaffold (done) — feat/scaffold
- [x] Next.js app generated and running locally
- [x] .env.example added
- [x] Committed, pushed, merged into main

## PHASE 1b: Plan revision (Nov 12) — docs/revise-plan
- [ ] BLUEPRINT.md replaced with the final version
- [ ] IMPLEMENTATION_PLAN.md replaced with this version
- [ ] Commit, push, merge into main

## PHASE 2: Creators + invoices (Nov 12) — feat/invoices
- [ ] Database set up with 3 tables (creators, desk_tokens, invoices)
- [ ] Token helpers: generate, hash, verify
- [ ] Input checks: NEAR address, amount, https link, lengths
- [ ] POST /api/invoices: flow A (new wallet) and flow C (blocked)
- [ ] Create-invoice form
- [ ] Desk link shown ONCE with a save-this warning
- [ ] Pay page shows the invoice (no payment yet)
- [ ] Pay page data has no creator_id or tokens
- [ ] Lint and build pass; commit, push, merge

## PHASE 3: Pay flow (Nov 12–13) — feat/pay-flow
- [ ] Fetch supported tokens from 1Click, cache them
- [ ] Token/chain picker on the pay page
- [ ] Client enters a refund address
- [ ] Quote: recipient comes from the database
- [ ] Show deposit address + exact amount
- [ ] Quote countdown
- [ ] Poll status: waiting / processing / paid / refunded / failed
- [ ] On success: mark paid, show receipt
- [ ] DEMO_MODE simulates payment without real money
- [ ] Lint and build pass; commit, push, merge

## PHASE 4: Private desk (Nov 13) — feat/desk
- [ ] /desk/[token] works; bad or revoked token gives a generic 404
- [ ] Desk shows ALL the creator's invoices + totals
- [ ] New invoice inside the desk (flow B, no wallet field)
- [ ] Generate a new access link; option to revoke the others
- [ ] Desk pages: no-referrer, no-store, noindex
- [ ] CSV export with cell escaping (NICE)
- [ ] Lint and build pass; commit, push, merge

## PHASE 4b: Recovery by wallet signature (STRETCH)
- [ ] Only if time is left; skip otherwise

## PHASE 5: Harden + real test (Nov 13) — fix/hardening
- [ ] A wallet address in a URL gets nothing
- [ ] Same wallet, no token: blocked
- [ ] A new link shows the same history
- [ ] A revoked link returns 404
- [ ] Rate limits on invoice creation and token attempts
- [ ] No secrets in the repo (search the code)
- [ ] Clear error messages, empty states, mobile layout
- [ ] NEAR wallet created (recovery phrase on paper only)
- [ ] One real tiny payment tested end to end
- [ ] Fresh clone runs from README steps alone
- [ ] Commit, push, merge

## PHASE 6: Ship (Nov 14) — docs/readme
- [ ] README: problem, how it works, NEAR's role, run steps,
      DEMO_MODE, access model
- [ ] Repo is public and final
- [ ] Demo video, 60–90 sec: problem, create, pay, desk
- [ ] X post: built at NEAR HACKATHON, tags @NEARProtocol
      #NEARHackathon, video attached
- [ ] Submission form filled in (wallet, repo link, post link)
- [ ] Submitted by midday Nov 14, confirmation screenshot