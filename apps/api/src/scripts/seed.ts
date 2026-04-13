import { PrismaClient } from '@prisma/client';
import { idToHex, priceToAtomic } from '@coclaw/shared-types';
import { loadEnv } from '@coclaw/config';

const prisma = new PrismaClient();
const env = loadEnv();

const SUPPLIER_WALLET = env.SUPPLIER_WALLET ?? 'GAXIVISOBDOMLXN6MPCTHKHSPC5W2JOUPE227ML4H7ZRTHY47YICIRDD';
const AGENT_ENDPOINT = `${env.AGENT_PUBLIC_URL}/task`;
const TOKEN_DECIMALS = 7;

const listings = [
  {
    serviceId: 'svc_ai_summarizer',
    name: 'AI Document Summarizer',
    description: 'Summarizes long documents into concise bullet points using LLM inference.',
    priceUsdt: '0.5',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, max_points: { type: 'number' } } },
    outputSchema: { type: 'object', properties: { summary: { type: 'string' }, bullet_points: { type: 'array', items: { type: 'string' } } } }
  },
  {
    serviceId: 'svc_code_reviewer',
    name: 'Code Review Agent',
    description: 'Reviews source code for bugs, security issues, and style violations.',
    priceUsdt: '1.0',
    inputSchema: { type: 'object', properties: { code: { type: 'string' }, language: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { issues: { type: 'array' } }, score: { type: 'number' } }
  },
  {
    serviceId: 'svc_data_enricher',
    name: 'Data Enrichment Service',
    description: 'Takes raw data records and enriches them with AI-generated context and classification.',
    priceUsdt: '0.75',
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
        endpoint: AGENT_ENDPOINT,
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
        endpoint: AGENT_ENDPOINT,
        supplierWallet: SUPPLIER_WALLET,
        isActive: true
      }
    });

    console.log(`Seeded: ${listing.serviceId} (${listing.name}) -> ${AGENT_ENDPOINT}`);
  }

  console.log(`\nDone. ${listings.length} listings seeded.`);
  await prisma.$disconnect();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
