# Coclaw — Agent Instructions

Project-level rules for Claude when working in this repo. Read before acting.

## Naming

- **Always camelCase** for identifiers AND filenames in this repo. Never kebab-case or snake_case for files you create (e.g. `serviceInstructions.ts`, not `service-instructions.ts`).

## Code Quality

- Run `pnpm --filter <pkg> typecheck` before considering a change done. A change that doesn't typecheck is not done.
- No `any` types — use proper interfaces and types. Import existing types from `@coclaw/shared-types` or the relevant package instead of casting to `any`.
- Treat TypeScript errors, unused imports, and type warnings as real issues, not ignorable noise. Fix them before moving on.
- Before committing, run `pnpm turbo run typecheck` and `pnpm turbo run test` at the root. The build must be green.
- Don't add fields, options, or "future-proofing" beyond what was asked. Minimum needed for the current task.

## Advisor Strategy (Multi-Agent Pattern)

When launching agents for complex tasks, use the **Advisor Strategy**:

- **Executor agents** (Sonnet/Haiku) handle the full task — writing code, calling tools, iterating.
- **Senior/Advisor agents** (Opus) review executor output, resolve ambiguity, and fix integration issues — never write code directly in isolation.
- **Escalation rules**: Executors work independently until they hit a judgment call they can't resolve. Only then escalate to the advisor.
- **Merge + Validate flows**: After parallel executor agents complete, a senior agent merges branches, validates integration, fixes gaps, and runs the build.
- **Cost efficiency**: Most work stays at executor rates. Frontier reasoning (Opus) applies only for review, architecture decisions, and conflict resolution.
- **Max 5 parallel agents** per batch — each gets a worktree for isolation.
- **Every agent must**: read files before editing, follow the code quality rules above, run typecheck, fix all errors.

## Deploy Architecture

This repo deploys **2 Railway services**, not 3:

- `api` — Fastify server + in-process BullMQ worker. Imports `@coclaw/worker` as a library and calls `startWorker({ apiBase: 'http://127.0.0.1:${env.PORT}' })` after `app.listen`.
- `agent` — the "other agent" in the A2A marketplace demo. Must stay a separate service so the A2A narrative holds.

`apps/worker/` still exists as a folder but is a **library package**, not a deployed service. Do not re-add a Railway config for it.

## Monorepo Commands

- Typecheck one package: `pnpm --filter @coclaw/<pkg> typecheck`
- Build one package: `pnpm --filter @coclaw/<pkg> build`
- Run tests for one package: `pnpm --filter @coclaw/<pkg> test`
- Everything at once: `pnpm build`, `pnpm test`, `pnpm typecheck`

## Conventions (this repo)

### Database access
- All Postgres access goes through the **`PrismaStore` class** in `apps/api/src/store.ts`. Route handlers call store methods — they NEVER call `prisma.xxx` directly.
- Prisma client is a singleton in `apps/api/src/prisma.ts` (global on `globalThis` in dev to survive HMR).
- Idempotent operations (e.g. payment events) use explicit `prisma.$transaction(async tx => …)` and rely on unique constraints for duplicate detection.

### Env + config
- Load env **once** at startup via `loadEnv()` from `@coclaw/config` (`packages/config/src/index.ts`). Never read `process.env.X` directly in app code.
- The Zod schema in `packages/config/src/index.ts` is the single source of truth. To add a new env var, add it to that schema — do not sprinkle `process.env` access around.

### Shared types
- Types shared across packages live in `@coclaw/shared-types` (`packages/shared-types/src/index.ts`). Always import from there instead of redefining.
- ID → hex encoding: use `idToHex(value)` (SHA-256 of the trimmed string). Never hash inline.
- USDC amount → atomic units: use `priceToAtomic(price, decimals)`. Stellar USDC uses **7 decimals**. Never compute atomic amounts at call sites.
- Order state transitions: use `canTransition(from, to)`. State machine is `CREATED → PAID → RUNNING → COMPLETED | FAILED`.

### HTTP routes (Fastify, api)
- Routes are registered directly on the Fastify instance in `apps/api/src/app.ts` — flat prefixes (`/v1/services`, `/v1/orders`, `/v1/openclaw/*`, `/v1/internal/*`). No Fastify plugins for route grouping.
- Request validation: inline `z.object({...}).parse(req.body)`. Validation errors throw plain `Error` and are caught to return `400` with `{ message }`.
- `recordMetric({ name, value })` is called inline at meaningful business events (`orders_created_total`, `orders_paid_total`, `callback_auth_failed_total`).

### HMAC callback signing
- Supplier callbacks are signed via `buildSignedCallback(body, secret)` from `@coclaw/sdk-supplier`.
- Algorithm: `sha256(${timestamp}.${nonce}.${JSON.stringify(body)})`, keyed by `CALLBACK_HMAC_SECRET`.
- Headers: `x-callback-timestamp`, `x-callback-nonce`, `x-callback-signature`. Verification uses `timingSafeEqual`, and the nonce is consumed once (DB unique constraint) to prevent replay.
- **Both `api` and `agent` services must share the exact same `CALLBACK_HMAC_SECRET`.**

### Stellar / x402 payments
- Network strings: `"stellar:testnet"` or `"stellar:pubnet"`. Never use chain IDs.
- Stellar addresses are `G...` public keys (56 chars, base32: A-Z, 2-7). Validate with `z.string().regex(/^G[A-Z2-7]{55}$/)`.
- USDC contract: testnet `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`, mainnet `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`.
- x402 facilitator: `https://www.x402.org/facilitator` (testnet, free) or OpenZeppelin Relayer (mainnet, requires API key).
- Payment flow: x402 middleware handles 402 → client signs Soroban auth entry → facilitator verifies + settles on-chain → 200 with resource. No chain polling needed.
- Supplier wallet uses `@stellar/stellar-sdk` (`Keypair`, `Horizon.Server`, `TransactionBuilder`, `Operation`). Key pair derived from `STELLAR_PRIVATE_KEY` (S... secret).
- Network passphrases: testnet `Test SDF Network ; September 2015`, mainnet `Public Global Stellar Network ; September 2015`.

### Logging
- Logger is Pino (`@coclaw/observability`). `pino-pretty` in dev.
- Always use **structured logging**: `logger.info({ order_id, tx_hash }, 'message')`. Never concatenate context into the message string.
- Log levels: `info` for state changes, `warn` for recoverable skips, `error` for unexpected failures (with `err` field carrying the error object).

### Tests
- Vitest, via `pnpm --filter <pkg> test`. Test files live next to source (`*.test.ts`) or under a `test/` directory.
- Fastify routes are tested with `app.inject()` — no HTTP server spin-up. Pattern: `beforeEach(app.ready)`, `afterAll(app.close)`.
- When fixing a bug, add a failing test first, then make it pass.
- Use valid Stellar test addresses in fixtures: 56-char `G` + base32 (A-Z, 2-7).

### Error handling
- `try { … } catch (error) { logger.error({ err: error, …ctx }, 'message'); throw; }` — log with context, then rethrow unless the error is expected.
- Expected "skip" cases (duplicate event, 404 order-not-found) return early with a `warn` log — they don't throw.
- Prisma unique-constraint violations (`P2002`) are caught and turned into idempotent results, not propagated as 500s.
- **Never** swallow an error silently. Every catch must log or rethrow.

## Anti-patterns — never do these

- ❌ `prisma.xxx.findMany()` inside a route handler — go through `PrismaStore`.
- ❌ `process.env.SOMETHING` in app code — go through `loadEnv()`.
- ❌ `as any` or `: any` type annotations — import the real type from `@coclaw/shared-types`.
- ❌ Manual atomic amount math at call sites — use `priceToAtomic`.
- ❌ `createHash('sha256')` at call sites for IDs — use `idToHex`.
- ❌ New Fastify route plugins for grouping — inline on the app instance.
- ❌ Kebab-case filenames — camelCase always.
- ❌ Silent `catch {}` blocks — always log or rethrow.
- ❌ Adding a third Railway service — worker is in-process inside api.
- ❌ Using viem, ethers, or EVM address formats (0x...) — this is a Stellar project.
- ❌ Using `gokite-aa-sdk` or Kite chain references — replaced by `@stellar/stellar-sdk`.
