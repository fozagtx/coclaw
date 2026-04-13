import { createHash } from 'node:crypto';
import { z } from 'zod';

export const ORDER_STATES = [
  'CREATED',
  'PAID',
  'RUNNING',
  'COMPLETED',
  'FAILED'
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const ALLOWED_TRANSITIONS: Readonly<Record<OrderState, readonly OrderState[]>> = {
  CREATED: ['PAID'],
  PAID: ['RUNNING'],
  RUNNING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: []
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: OrderState, to: OrderState): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid transition: ${from} -> ${to}`);
  }
}

export function idToHex(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('id cannot be empty');
  }
  return createHash('sha256').update(normalized).digest('hex');
}

export const DEFAULT_TOKEN_DECIMALS = 7;

export function priceToAtomic(price: string, decimals = DEFAULT_TOKEN_DECIMALS): bigint {
  if (!Number.isInteger(decimals) || decimals <= 0) {
    throw new Error('decimals must be a positive integer');
  }

  const normalized = price.trim();
  if (!normalized) {
    throw new Error('price must be a positive decimal string');
  }

  const [intPart, fracPart = ''] = normalized.split('.');
  const fracPadded = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const combined = `${intPart}${fracPadded}`;
  const atomic = BigInt(combined);

  if (atomic <= 0n) {
    throw new Error('price must be greater than zero');
  }

  return atomic;
}

export const STELLAR_NETWORKS = {
  'stellar:testnet': {
    passphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    usdcContract: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
  },
  'stellar:pubnet': {
    passphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    usdcContract: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'
  }
} as const;

export type StellarNetwork = keyof typeof STELLAR_NETWORKS;

const stellarAddressSchema = z.string().regex(/^G[A-Z2-7]{55}$/, 'invalid Stellar public key');

const stellarHexSchema = z.string().regex(/^[a-fA-F0-9]{64}$/, 'invalid hex hash');

export const serviceManifestSchema = z.object({
  service_id: z.string().min(3),
  service_id_hex: stellarHexSchema.optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  input_schema: z.record(z.string(), z.unknown()),
  output_schema: z.record(z.string(), z.unknown()),
  price_usdt: z.string(),
  price_atomic: z.string().optional(),
  token_decimals: z.number().int().positive().default(DEFAULT_TOKEN_DECIMALS),
  endpoint: z.url(),
  supplier_wallet: stellarAddressSchema,
  version: z.string().default('1.0.0'),
  is_active: z.boolean().default(true)
});

export type ServiceManifest = z.infer<typeof serviceManifestSchema>;

export const orderSchema = z.object({
  order_id: z.string().min(3),
  order_id_hex: stellarHexSchema,
  service_id: z.string().min(3),
  service_id_hex: stellarHexSchema,
  buyer_wallet: stellarAddressSchema,
  supplier_wallet: stellarAddressSchema,
  amount_usdt: z.string(),
  amount_atomic: z.string(),
  token_decimals: z.number().int().positive().default(DEFAULT_TOKEN_DECIMALS),
  token_address: z.string(),
  network: z.string(),
  status: z.enum(ORDER_STATES),
  input_payload: z.record(z.string(), z.unknown()),
  result_payload: z.record(z.string(), z.unknown()).nullable(),
  error_message: z.string().nullable(),
  tx_hash: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type Order = z.infer<typeof orderSchema>;

export const paymentProofSchema = z.object({
  order_id: z.string().min(3),
  order_id_hex: stellarHexSchema,
  service_id: z.string().min(3),
  service_id_hex: stellarHexSchema,
  tx_hash: z.string(),
  buyer: stellarAddressSchema,
  supplier: stellarAddressSchema,
  token: z.string(),
  amount_atomic: z.string(),
  verified_at: z.string().datetime()
});

export type PaymentProof = z.infer<typeof paymentProofSchema>;

export const createOrderRequestSchema = z.object({
  service_id: z.string().min(3),
  buyer_wallet: stellarAddressSchema,
  input_payload: z.record(z.string(), z.unknown())
});

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const callbackHeadersSchema = z.object({
  'x-callback-timestamp': z.string(),
  'x-callback-nonce': z.string(),
  'x-callback-signature': z.string()
});

export const orderCallbackSchema = z.object({
  order_id: z.string().min(3),
  status: z.enum(['COMPLETED', 'FAILED']),
  output: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional()
});

export type OrderCallback = z.infer<typeof orderCallbackSchema>;
