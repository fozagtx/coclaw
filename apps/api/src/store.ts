import { PrismaClient, Prisma, type Service as PrismaServiceRecord } from '@prisma/client';
import {
  idToHex,
  priceToAtomic,
  serviceManifestSchema,
  type ServiceManifest
} from '@coclaw/shared-types';

type NormalizedServiceManifest = ServiceManifest & {
  service_id_hex: string;
  price_atomic: string;
};

export interface Store {
  readonly provider: 'in-memory' | 'postgres';
  registerService(input: unknown): Promise<ServiceManifest>;
  listServices(): Promise<ServiceManifest[]>;
  getService(serviceId: string): Promise<ServiceManifest | null>;
  close?(): Promise<void>;
}

function ensureObjectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function normalizeServiceManifest(input: unknown): NormalizedServiceManifest {
  const manifest = serviceManifestSchema.parse(input);
  return {
    ...manifest,
    service_id_hex: manifest.service_id_hex ?? idToHex(manifest.service_id),
    price_atomic: manifest.price_atomic ?? priceToAtomic(manifest.price_usdt, manifest.token_decimals).toString()
  };
}

function serviceFromPrisma(record: PrismaServiceRecord): ServiceManifest {
  return serviceManifestSchema.parse({
    service_id: record.serviceId,
    service_id_hex: record.serviceIdHex,
    name: record.name,
    description: record.description,
    input_schema: ensureObjectRecord(record.inputSchema, 'input_schema'),
    output_schema: ensureObjectRecord(record.outputSchema, 'output_schema'),
    price_usdt: record.priceUsdt,
    price_atomic: record.priceAtomic,
    token_decimals: record.tokenDecimals,
    endpoint: record.endpoint,
    supplier_wallet: record.supplierWallet,
    version: record.version,
    is_active: record.isActive
  });
}

export class InMemoryStore implements Store {
  readonly provider = 'in-memory' as const;
  private readonly services = new Map<string, ServiceManifest>();

  async registerService(input: unknown): Promise<ServiceManifest> {
    const normalized = normalizeServiceManifest(input);
    this.services.set(normalized.service_id, normalized);
    return normalized;
  }

  async listServices(): Promise<ServiceManifest[]> {
    return [...this.services.values()].filter((service) => service.is_active);
  }

  async getService(serviceId: string): Promise<ServiceManifest | null> {
    return this.services.get(serviceId) ?? null;
  }
}

export class PrismaStore implements Store {
  readonly provider = 'postgres' as const;

  constructor(private readonly prisma: PrismaClient) {}

  async registerService(input: unknown): Promise<ServiceManifest> {
    const normalized = normalizeServiceManifest(input);
    const saved = await this.prisma.service.upsert({
      where: { serviceId: normalized.service_id },
      create: {
        serviceId: normalized.service_id,
        serviceIdHex: normalized.service_id_hex,
        name: normalized.name,
        description: normalized.description,
        inputSchema: normalized.input_schema as Prisma.InputJsonValue,
        outputSchema: normalized.output_schema as Prisma.InputJsonValue,
        priceUsdt: normalized.price_usdt,
        priceAtomic: normalized.price_atomic,
        tokenDecimals: normalized.token_decimals,
        endpoint: normalized.endpoint,
        supplierWallet: normalized.supplier_wallet,
        version: normalized.version,
        isActive: normalized.is_active
      },
      update: {
        serviceIdHex: normalized.service_id_hex,
        name: normalized.name,
        description: normalized.description,
        inputSchema: normalized.input_schema as Prisma.InputJsonValue,
        outputSchema: normalized.output_schema as Prisma.InputJsonValue,
        priceUsdt: normalized.price_usdt,
        priceAtomic: normalized.price_atomic,
        tokenDecimals: normalized.token_decimals,
        endpoint: normalized.endpoint,
        supplierWallet: normalized.supplier_wallet,
        version: normalized.version,
        isActive: normalized.is_active
      }
    });

    return serviceFromPrisma(saved);
  }

  async listServices(): Promise<ServiceManifest[]> {
    const rows = await this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    return rows.map(serviceFromPrisma);
  }

  async getService(serviceId: string): Promise<ServiceManifest | null> {
    const row = await this.prisma.service.findUnique({ where: { serviceId } });
    return row ? serviceFromPrisma(row) : null;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
