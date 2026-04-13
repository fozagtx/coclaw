import { describe, expect, it } from 'vitest';
import type { Order } from '@coclaw/shared-types';
import { getOrderPaidMismatchReason, type OrderPaidLog } from '../src/payment-event.js';

const baseOrder: Order = {
  order_id: 'ord_demo_001',
  order_id_hex: '1111111111111111111111111111111111111111111111111111111111111111',
  service_id: 'svc_demo_v1',
  service_id_hex: '2222222222222222222222222222222222222222222222222222222222222222',
  buyer_wallet: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  supplier_wallet: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  amount_usdt: '1.0',
  amount_atomic: '10000000',
  token_decimals: 7,
  token_address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  network: 'stellar:testnet',
  status: 'CREATED',
  input_payload: { prompt: 'hello' },
  result_payload: null,
  error_message: null,
  tx_hash: null,
  created_at: '2026-02-06T00:00:00.000Z',
  updated_at: '2026-02-06T00:00:00.000Z'
};

function buildLog(overrides?: Partial<OrderPaidLog>): OrderPaidLog {
  return {
    orderIdHex: baseOrder.order_id_hex,
    serviceIdHex: baseOrder.service_id_hex,
    buyer: baseOrder.buyer_wallet,
    supplier: baseOrder.supplier_wallet,
    token: baseOrder.token_address,
    amountAtomic: 10_000_000n,
    txHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    ledger: 12345,
    ...overrides
  };
}

describe('payment-event helpers', () => {
  it('returns mismatch reason when order fields differ', () => {
    const log = buildLog({ amountAtomic: 20_000_000n });
    expect(getOrderPaidMismatchReason(baseOrder, log)).toBe('amount mismatch');
  });

  it('returns mismatch for wrong service_id_hex', () => {
    const log = buildLog({ serviceIdHex: 'ff'.repeat(32) });
    expect(getOrderPaidMismatchReason(baseOrder, log)).toBe('service_id_hex mismatch');
  });

  it('returns mismatch for wrong buyer', () => {
    const log = buildLog({ buyer: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCU' });
    expect(getOrderPaidMismatchReason(baseOrder, log)).toBe('buyer mismatch');
  });

  it('returns mismatch for wrong supplier', () => {
    const log = buildLog({ supplier: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCU' });
    expect(getOrderPaidMismatchReason(baseOrder, log)).toBe('supplier mismatch');
  });

  it('returns mismatch for wrong token', () => {
    const log = buildLog({ token: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75' });
    expect(getOrderPaidMismatchReason(baseOrder, log)).toBe('token mismatch');
  });

  it('passes when order and log are consistent', () => {
    const log = buildLog();
    expect(getOrderPaidMismatchReason(baseOrder, log)).toBeNull();
  });
});
