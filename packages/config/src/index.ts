import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/coclaw'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  STELLAR_NETWORK: z.literal('stellar:testnet').default('stellar:testnet'),
  STELLAR_RPC_URL: z.literal('https://soroban-testnet.stellar.org').default('https://soroban-testnet.stellar.org'),
  STELLAR_USDC_CONTRACT: z.literal('CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA').default('CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'),
  STELLAR_PRIVATE_KEY: z.string().optional(),
  FACILITATOR_URL: z.string().default('https://www.x402.org/facilitator'),
  FACILITATOR_API_KEY: z.string().optional(),
  SUPPLIER_TIMEOUT_MS: z.coerce.number().default(30000),
  DISPATCH_MAX_RETRY: z.coerce.number().default(1),
  CALLBACK_HMAC_SECRET: z.string().default('dev-secret'),
  API_BASE_URL: z.string().default('https://coclawapi-production.up.railway.app'),
  CALLBACK_BASE_URL: z.string().default('https://coclawapi-production.up.railway.app'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o-mini'),
  SUPPLIER_PORT: z.coerce.number().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides?: Record<string, string | undefined>): AppEnv {
  const merged = {
    ...process.env,
    ...overrides
  };
  return envSchema.parse(merged);
}
