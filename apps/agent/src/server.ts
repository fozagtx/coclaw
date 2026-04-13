import express from 'express';
import { paymentMiddlewareFromConfig } from '@x402/express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactStellarScheme } from '@x402/stellar/exact/server';
import { loadEnv } from '@coclaw/config';
import { logger } from '@coclaw/observability';
import { buildSignedCallback } from '@coclaw/sdk-supplier';
import { buildSystemPrompt } from './serviceInstructions.js';
import { getStellarPublicKey, getStellarStatus, isStellarConfigured } from './stellarWallet.js';

const env = loadEnv();
const port = env.SUPPLIER_PORT ?? env.PORT;
const openRouterApiKey = env.OPENROUTER_API_KEY ?? '';
const openRouterModel = env.OPENROUTER_MODEL;
const openRouterBaseUrl = 'https://openrouter.ai/api/v1/chat/completions';
const supplierPublicKey = getStellarPublicKey();

if (!supplierPublicKey) {
  logger.error('STELLAR_PRIVATE_KEY is required for the supplier agent');
  process.exit(1);
}

type TaskRequest = {
  order_id: string;
  service_id: string;
  input: Record<string, unknown>;
  callback_url: string;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

async function callOpenRouter(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(openRouterBaseUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${openRouterApiKey}`,
      'http-referer': 'https://coclaw.ai',
      'x-title': 'Coclaw Supplier Agent'
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages,
      max_tokens: 1024,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? '';
}

async function executeTask(task: TaskRequest, res: express.Response): Promise<void> {
  const inputStr = JSON.stringify(task.input, null, 2);
  const systemPrompt = buildSystemPrompt(task.service_id);

  if (!systemPrompt) {
    const callback = buildSignedCallback(
      { order_id: task.order_id, status: 'FAILED', output: null, error: `unknown service_id: ${task.service_id}` },
      env.CALLBACK_HMAC_SECRET
    );
    await fetch(task.callback_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...callback.headers },
      body: JSON.stringify(callback.payload)
    });
    logger.warn({ order_id: task.order_id, service_id: task.service_id }, 'rejected unknown service_id');
    return;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Order: ${task.order_id}\nInput:\n${inputStr}` }
  ];

  try {
    const llmOutput = await callOpenRouter(messages);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(llmOutput); } catch { parsed = { result: llmOutput }; }

    const callback = buildSignedCallback(
      { order_id: task.order_id, status: 'COMPLETED', output: parsed, error: null },
      env.CALLBACK_HMAC_SECRET
    );
    await fetch(task.callback_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...callback.headers },
      body: JSON.stringify(callback.payload)
    });
    logger.info({ order_id: task.order_id }, 'task completed and callback sent');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const callback = buildSignedCallback(
      { order_id: task.order_id, status: 'FAILED', output: null, error: errorMessage },
      env.CALLBACK_HMAC_SECRET
    );
    try {
      await fetch(task.callback_url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...callback.headers },
        body: JSON.stringify(callback.payload)
      });
    } catch (callbackError) {
      logger.error({ err: callbackError, order_id: task.order_id }, 'callback delivery failed');
    }
    logger.error({ err: error, order_id: task.order_id }, 'task execution failed');
  }
}

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  const stellarStatus = isStellarConfigured() ? await getStellarStatus() : { configured: false };
  res.json({
    ok: true,
    agent: 'agent',
    model: openRouterModel,
    stellar: stellarStatus,
    x402_paywall: true,
    ts: new Date().toISOString()
  });
});

const facilitatorClient = new HTTPFacilitatorClient({
  url: env.FACILITATOR_URL,
  ...(env.FACILITATOR_API_KEY
    ? {
        createAuthHeaders: async () => {
          const h = { Authorization: `Bearer ${env.FACILITATOR_API_KEY}` };
          return { verify: h, settle: h, supported: h };
        }
      }
    : {})
});

app.use(
  paymentMiddlewareFromConfig(
    {
      'POST /task': {
        accepts: {
          scheme: 'exact',
          price: '$0.01',
          network: env.STELLAR_NETWORK,
          payTo: supplierPublicKey
        }
      }
    },
    facilitatorClient,
    [{ network: env.STELLAR_NETWORK, server: new ExactStellarScheme() }]
  )
);

app.post('/task', async (req, res) => {
  const body = req.body as TaskRequest;
  logger.info({ order_id: body.order_id, service_id: body.service_id }, 'task received (payment settled), executing async');
  void executeTask(body, res);
  res.status(202).json({ accepted: true, order_id: body.order_id });
});

app.listen(port, '0.0.0.0', () => {
  logger.info({ port, model: openRouterModel, stellar_pubkey: supplierPublicKey, network: env.STELLAR_NETWORK }, 'agent started with x402 paywall');
});
