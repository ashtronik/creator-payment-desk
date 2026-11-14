# Creator Payment Desk

A non-custodial payment desk for Web3 creators. Track: NEAR HACKATHON, Real-World Money.

## The problem

Crypto projects pay creators in different tokens on different chains. Creators chase payments and keep messy records. A payment request should make the requested work, amount, and payment path clear without requiring the creator to manage every source chain.

## What it does

- A creator makes an invoice link with an amount and description.
- A client pays from a supported source chain and token; the creator receives USDC on NEAR by default.
- A private desk keeps invoice history, paid and pending totals, and a CSV export.

## NEAR's role

Payments use the NEAR Intents 1Click API at `https://1click.chaindefuser.com` in live mode. The application calls the token-list endpoint, requests a quote, uses the returned deposit address, and polls the status endpoint.

The default destination is the unique USDC asset on the NEAR chain returned by the token list. `DESTINATION_ASSET_ID` can override the destination asset when it is configured.

The application is non-custodial: it does not hold creator or client funds and does not use private keys. The client sends funds to the quote-specific deposit address, and 1Click routes the payment to the creator's NEAR address.

## Try it in demo mode

Demo mode needs no API key and moves no real money. The default `.env.example` sets `DEMO_MODE=true`.

Prerequisite: Node.js. Tested on Node.js v26.13.0. The app uses Node's built-in `node:sqlite`, so use a recent Node.js version.

```bash
git clone https://github.com/ashtronik/creator-payment-desk.git
cd creator-payment-desk
```

Then run:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The local application uses SQLite through Node's built-in `node:sqlite`; the default database path is `data/app.db`.

### Demo steps

1. Create an invoice. Enter an example account such as `creator.example.near`, amount `1.00`, and description `Demo design work`, then click `Create invoice`.
   Expected result: the `Invoice created` block appears with `Pay link (send this to your client)` and `Private desk link (save this)`. The page also says `Save this link! It is shown only once.`

2. Open the pay link. Choose `USDC` under the `near` chain, enter a demo refund address, and click `Get payment details`.
   Expected result: the payment page shows a `DEMO` banner stating `no real money moves. This payment completes automatically in about 10 seconds.` The invoice then reaches `Paid ✓` automatically.

3. Open the private desk link.
   Expected result: the desk shows `Your payment history`, the invoice marked `paid`, the `Paid USD`, `Pending`, and `Invoices` totals, and the `Download CSV` action.

4. Return to the home page and create another invoice using the same example wallet without the desk link.
   Expected result: creation is blocked with `This wallet already has a private desk. Use your desk link to add invoices.`

To repeat the demo, use a new wallet name in step 1, or stop the app and delete `data/app.db`.

## Live mode

Set `DEMO_MODE=false` in `.env.local` and restart the development server. Live mode sends real payments on mainnet. Use a tiny amount for testing; there is no NEAR Intents testnet.

`NEAR_INTENTS_API_KEY` is optional. According to the NEAR HACKATHON rules, requests without a key pay a 0.2% fee. A key can be registered at https://partners.near-intents.org.

Tested end to end: one real $1 payment was paid from Solana, and USDC arrived on NEAR.

The live quote uses `EXACT_OUTPUT`, requests the configured destination asset, supplies the creator's stored NEAR address as the recipient, and includes the client's refund address. The client must send the exact token and chain shown on the payment page.

## Access model

The desk link is the only credential for creator history. A new desk token is generated with 32 random bytes, shown once, and never logged. Only its SHA-256 hash is stored in SQLite.

The wallet address identifies the creator but is not a credential. A wallet address alone never gives access to the desk, invoice history, or CSV export. Desk-protected API calls use the token in the `x-desk-token` header, and revoked links are rejected.

## Tech stack and libraries

- Next.js `16.4.6` with the App Router.
- React `19.3.0` and `react-dom` `19.3.0`.
- TypeScript `^5` and `tsx` `^4.20.6`.
- Tailwind CSS `4.3.3` and `@tailwindcss/turbopack` `4.3.3`.
- ESLint `^9` with `eslint-config-next` `16.4.6`.
- SQLite through Node's built-in `node:sqlite`; SQLite is not a package dependency.

The scripts declared in `package.json` are:

```text
npm run dev
npm run build
npm run start
npm run lint
npm run check:core
```

`NEAR_INTENTS_API_KEY`, `DESTINATION_ASSET_ID`, and `DEMO_MODE` are read from the environment. `RATE_LIMIT_DISABLED` is also recognized for local demos when explicitly set to `true`.

## AI-assisted development

This project was built with help from Codex and Claude, and reviewed and tested by the author.

## Roadmap

- Wallet-signature recovery and sign-in.
- Hosted demo.
- Receipt and layout polish.

Wallet-signature recovery is not built yet. The current access model uses the desk link only.

## Hackathon and license

Built during NEAR HACKATHON. The first commit is dated 2026-11-11.

Licensed under the MIT License. See [LICENSE](LICENSE).
