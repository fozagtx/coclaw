import { createHash } from 'node:crypto';
import { z } from 'zod';

const DEFAULT_TOKEN_DECIMALS = 7;

export function idToHex(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('id cannot be empty');
  }
  return createHash('sha256').update(normalized).digest('hex');
}

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

export const orderCallbackSchema = z.object({
  order_id: z.string().min(3),
  status: z.enum(['COMPLETED', 'FAILED']),
  output: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional()
});

export type OrderCallback = z.infer<typeof orderCallbackSchema>;
