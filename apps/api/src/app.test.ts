import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '@coclaw/config';
import { buildApp } from './app.js';
import { InMemoryStore } from './store.js';

const testEnv = loadEnv({
  CALLBACK_HMAC_SECRET: 'dev-secret',
  STELLAR_NETWORK: 'stellar:testnet',
  STELLAR_USDC_CONTRACT: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  FACILITATOR_URL: 'https://www.x402.org/facilitator',
  PAY_TO_ADDRESS: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org'
});

const STELLAR_WALLET_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const servicePayload = {
  service_id: 'svc_demo_v1',
  name: 'Demo Service',
  description: 'Demo',
  input_schema: { type: 'object' },
  output_schema: { type: 'object' },
  price_usdt: '1.0',
  endpoint: 'http://localhost:3003/task',
  supplier_wallet: STELLAR_WALLET_A,
  version: '1.0.0',
  is_active: true
};

describe('api app', () => {
  const app = buildApp({ store: new InMemoryStore(), env: testEnv });

  beforeEach(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns health', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('registers and lists services', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: servicePayload
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().service_id).toBe('svc_demo_v1');

    const listRes = await app.inject({ method: 'GET', url: '/v1/services' });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown service', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/services/nope' });
    expect(res.statusCode).toBe(404);
  });

  it('lists openclaw listings', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: servicePayload
    });

    const res = await app.inject({ method: 'GET', url: '/v1/openclaw/listings' });
    expect(res.statusCode).toBe(200);
    const listings = res.json() as Array<{ listing_id: string }>;
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0]?.listing_id).toBe(servicePayload.service_id);
  });

  it('returns single openclaw listing', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: servicePayload
    });

    const res = await app.inject({ method: 'GET', url: `/v1/openclaw/listings/${servicePayload.service_id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().listing_id).toBe(servicePayload.service_id);
  });
});
