import { describe, it, expect } from 'vitest';
import { x402StellarProvider, resolveProvider, type PayableOrder, type PaymentProviderContext } from './index.js';

const order: PayableOrder = {
  order_id: 'ord_test123',
  order_id_hex: 'ab'.repeat(32),
  service_id: 'svc_test',
  service_id_hex: 'cd'.repeat(32),
  buyer_wallet: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  supplier_wallet: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  amount_atomic: '10000000',
  token_address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  network: 'stellar:testnet'
};

const ctx: PaymentProviderContext = {
  network: 'stellar:testnet',
  usdcContract: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  payToAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  facilitatorUrl: 'https://www.x402.org/facilitator',
  facilitatorApiKey: undefined
};

describe('x402StellarProvider', () => {
  it('returns correct kind and fields', () => {
    const r = x402StellarProvider.prepare(order, ctx) as Awaited<ReturnType<typeof x402StellarProvider['prepare']>> & { kind: string };
    expect(r.kind).toBe('x402-stellar');
    expect(r.purchase_id).toBe(order.order_id);
    expect(r.pay_to).toBe(ctx.payToAddress);
    expect(r.amount_atomic).toBe('10000000');
    expect(r.network).toBe('stellar:testnet');
    expect(r.facilitator_url).toBe('https://www.x402.org/facilitator');
  });

  it('formats price from atomic amount', () => {
    const r = x402StellarProvider.prepare(order, ctx) as Awaited<ReturnType<typeof x402StellarProvider['prepare']>>;
    expect(r.price).toBe('$1');
  });
});

describe('resolveProvider', () => {
  it('always returns x402-stellar', () => {
    expect(resolveProvider(undefined).kind).toBe('x402-stellar');
    expect(resolveProvider('x402-stellar').kind).toBe('x402-stellar');
    expect(resolveProvider('bogus').kind).toBe('x402-stellar');
  });
});
