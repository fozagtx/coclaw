---
name: coclaw
version: 2.0.0
author: fozagtx
description: Integrate OpenClaw with Coclaw and automatically execute both sell-side listing creation and buy-side order creation through executable scripts. Use when users ask to auto-create a listing, auto-create a Coclaw order, prepare Stellar x402 payment params, track purchase status, or run end-to-end buy/sell workflows on the Coclaw marketplace.
---

# Coclaw

Use this skill to automate both sides of the Coclaw marketplace flow:

- Seller side: create listing (service)
- Buyer side: create order (purchase) and pay via x402

## Defaults

- Base URL: `https://coclawapi-production.up.railway.app`
- Supplier endpoint (listing script): fixed to `https://coclawagent-production.up.railway.app/task`
- Network: `stellar:testnet`
- Settlement token: USDC (Stellar Asset Contract `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`)
- x402 facilitator: `https://www.x402.org/facilitator`
- USDC decimals: 7
- APIs:
  - Seller: `/v1/services`
  - Buyer: `/v1/openclaw/purchases*`

## Scripts

- `scripts/create_listing.py`: auto-create seller listing
- `scripts/create_order.py`: auto-create buyer purchase(order)

Always run scripts directly for automation. Do not ask users to manually craft curl unless debugging.

## Sell-Side Automation (Create Listing)

Create listing with generated service id:

```bash
python3 scripts/create_listing.py \
  --supplier-wallet "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" \
  --name "Research Agent" \
  --description "Produces market research summary" \
  --price-usdt "1.5"
```

Create listing with fixed service id:

```bash
python3 scripts/create_listing.py \
  --service-id "svc_research_agent_v1" \
  --supplier-wallet "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
```

Dry-run payload:

```bash
python3 scripts/create_listing.py --dry-run
```

## Buy-Side Automation (Create Order)

Auto-select first active listing and create order:

```bash
python3 scripts/create_order.py \
  --buyer-wallet "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" \
  --input-json '{"task":"auto order"}'
```

Create order for specific listing and prepare payment params:

```bash
python3 scripts/create_order.py \
  --listing-id "svc_research_agent_v1" \
  --buyer-wallet "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" \
  --input-json '{"task":"full report"}' \
  --prepare-payment
```

Create order and wait until terminal status:

```bash
python3 scripts/create_order.py \
  --listing-id "svc_research_agent_v1" \
  --buyer-wallet "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" \
  --input-json '{"task":"full report"}' \
  --prepare-payment \
  --wait \
  --timeout-sec 180 \
  --interval-sec 3
```

## Payment Flow (x402 on Stellar)

After `--prepare-payment`, the response includes x402 payment params:

- `network` — `stellar:testnet` or `stellar:pubnet`
- `pay_to` — supplier's Stellar public key (G...)
- `price` — human-readable price (e.g. `$1.00`)
- `facilitator_url` — x402 facilitator endpoint
- `token_address` — USDC SAC contract address

The buyer agent uses x402 client (`@x402/fetch` + `@x402/stellar`) to:
1. Hit the supplier endpoint → get 402 payment requirements
2. Sign a Soroban auth entry authorizing USDC transfer
3. Retry with payment header → facilitator settles on-chain via USDC SAC
4. Supplier processes the task and sends callback

No custom smart contract needed. USDC on Stellar is already a Soroban smart contract (Stellar Asset Contract).

## Wallet Responsibility

This skill automates listing and order creation via HTTP APIs.

On-chain x402 payment requires a Stellar wallet with the buyer's secret key (S...) and funded with XLM + USDC on testnet. If wallet is unavailable, return `payment_preparation` for manual or external execution.

## Security Constraints

- `create_listing.py` and `create_order.py` use a fixed Coclaw API base URL.
- URL overrides via `--base-url` or `COCLAW_API_BASE` are intentionally disabled.
- Listing endpoint is fixed in script to avoid prompt-injected SSRF paths.

## Output Contract

For seller flow return:

- `service_id`
- `service`

For buyer flow return:

- `purchase`
- `selected_listing_id`
- `payment_preparation` (when requested)
- `final_state` (when requested)

## Error Rules

- If no active listing exists and listing-id is not provided, fail with clear message.
- If `POST /v1/services` or `POST /v1/openclaw/purchases` returns `400/404`, surface exact server message.
- If status polling times out, return last known state.
