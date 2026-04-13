import { PrismaClient } from '@prisma/client';
import { idToHex, priceToAtomic } from '@coclaw/shared-types';

const prisma = new PrismaClient();

const SUPPLIER_WALLET = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TOKEN_DECIMALS = 7;

const listings = [
  {
    serviceId: 'svc_ai_summarizer',
    name: 'AI Document Summarizer',
    description: 'Summarizes long documents into concise bullet points using LLM inference.',
    priceUsdt: '0.5',
    endpoint: 'http://coclawagent.railway.internal/task',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, max_points: { type: 'number' } } },
    outputSchema: { type: 'object', properties: { summary: { type: 'string' }, bullet_points: { type: 'array', items: { type: 'string' } } } }
  },
  {
    serviceId: 'svc_code_reviewer',
    name: 'Code Review Agent',
    description: 'Reviews source code for bugs, security issues, and style violations.',
    priceUsdt: '1.0',
    endpoint: 'http://coclawagent.railway.internal/task',
    inputSchema: { type: 'object', properties: { code: { type: 'string' }, language: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { issues: { type: 'array' } }, score: { type: 'number' } }
  },
  {
    serviceId: 'svc_data_enricher',
    name: 'Data Enrichment Service',
    description: 'Takes raw data records and enriches them with AI-generated context and classification.',
    priceUsdt: '0.75',
    endpoint: 'http://coclawagent.railway.internal/task',
    inputSchema: { type: 'object', properties: { records: { type: 'array' }, context: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { enriched: { type: 'array' }, categories: { type: 'array' } } }
  }
];

async function seed(): Promise<void> {
  const deleted = await prisma.service.deleteMany({});
  console.log(`Cleared ${deleted.count} existing listings.`);

  for (const listing of listings) {
    const priceAtomic = priceToAtomic(listing.priceUsdt, TOKEN_DECIMALS).toString();
    const serviceIdHex = idToHex(listing.serviceId);

    await prisma.service.upsert({
      where: { serviceId: listing.serviceId },
      create: {
        serviceId: listing.serviceId,
        serviceIdHex,
        name: listing.name,
        description: listing.description,
        inputSchema: listing.inputSchema,
        outputSchema: listing.outputSchema,
        priceUsdt: listing.priceUsdt,
        priceAtomic,
        tokenDecimals: TOKEN_DECIMALS,
        endpoint: listing.endpoint,
        supplierWallet: SUPPLIER_WALLET,
        version: '1.0.0',
        isActive: true
      },
      update: {
        name: listing.name,
        description: listing.description,
        inputSchema: listing.inputSchema,
        outputSchema: listing.outputSchema,
        priceUsdt: listing.priceUsdt,
        priceAtomic,
        endpoint: listing.endpoint,
        supplierWallet: SUPPLIER_WALLET,
        isActive: true
      }
    });

    console.log(`Seeded: ${listing.serviceId} (${listing.name})`);
  }

  console.log(`\nDone. ${listings.length} listings seeded.`);
  await prisma.$disconnect();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
