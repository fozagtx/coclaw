import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { loadEnv, type AppEnv } from '@coclaw/config';
import { logger } from '@coclaw/observability';
import {
  idToHex,
  priceToAtomic,
  type ServiceManifest
} from '@coclaw/shared-types';
import { InMemoryStore, PrismaStore, type Store } from './store.js';
import { prisma } from './prisma.js';

export type BuildAppOptions = {
  env?: AppEnv;
  store?: Store;
};

type OpenClawListing = {
  listing_id: string;
  listing_id_hex: string;
  title: string;
  description: string;
  price_usdt: string;
  price_atomic: string;
  token_decimals: number;
  supplier_wallet: string;
  endpoint: string;
  version: string;
  is_active: boolean;
};

function toOpenClawListing(service: ServiceManifest): OpenClawListing {
  return {
    listing_id: service.service_id,
    listing_id_hex: service.service_id_hex ?? idToHex(service.service_id),
    title: service.name,
    description: service.description,
    price_usdt: service.price_usdt,
    price_atomic: service.price_atomic ?? priceToAtomic(service.price_usdt, service.token_decimals).toString(),
    token_decimals: service.token_decimals,
    supplier_wallet: service.supplier_wallet,
    endpoint: service.endpoint,
    version: service.version,
    is_active: service.is_active
  };
}

function createDefaultStore(): Store {
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryStore();
  }
  return new PrismaStore(prisma);
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance<any, any, any, any, any> {
  const env = options.env ?? loadEnv();
  const store = options.store ?? createDefaultStore();
  const app = Fastify({ loggerInstance: logger });

  app.register(cors, { origin: true });
  app.addHook('onClose', async () => {
    await store.close?.();
  });

  app.get('/v1/health', async () => ({
    ok: true,
    db: store.provider,
    timestamp: new Date().toISOString()
  }));

  app.post('/v1/services', async (request, reply) => {
    try {
      const service = await store.registerService(request.body);
      return reply.code(201).send(service);
    } catch (error) {
      return reply.code(400).send({ message: (error as Error).message });
    }
  });

  app.get('/v1/services', async () => store.listServices());

  app.get('/v1/services/:service_id', async (request, reply) => {
    const params = request.params as { service_id: string };
    const service = await store.getService(params.service_id);
    if (!service) {
      return reply.code(404).send({ message: 'service not found' });
    }
    return service;
  });

  app.get('/v1/openclaw/listings', async () => {
    const services = await store.listServices();
    return services.map(toOpenClawListing);
  });

  app.get('/v1/openclaw/listings/:listing_id', async (request, reply) => {
    const params = request.params as { listing_id: string };
    const service = await store.getService(params.listing_id);

    if (!service) {
      return reply.code(404).send({ message: 'listing not found' });
    }

    return toOpenClawListing(service);
  });

  return app;
}
