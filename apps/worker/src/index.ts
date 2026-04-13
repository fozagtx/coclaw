import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv } from '@coclaw/config';
import { logger, recordMetric } from '@coclaw/observability';
import type { Order, ServiceManifest } from '@coclaw/shared-types';

const env = loadEnv();
let apiBase = env.API_BASE_URL;
const callbackBase = env.CALLBACK_BASE_URL;

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const dispatchQueue = new Queue<{ orderId: string }>('dispatch', { connection: redis });

const enqueuedOrderIds = new Set<string>();

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': env.CALLBACK_HMAC_SECRET
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST ${path} failed with ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

async function enqueuePaidOrders(): Promise<void> {
  const paidOrders = await apiGet<Order[]>('/v1/orders?status=PAID');

  for (const order of paidOrders) {
    if (enqueuedOrderIds.has(order.order_id)) {
      continue;
    }

    await dispatchQueue.add(
      'dispatch-order',
      { orderId: order.order_id },
      {
        attempts: env.DISPATCH_MAX_RETRY + 1,
        removeOnComplete: true,
        removeOnFail: false,
        jobId: `dispatch-${order.order_id}`
      }
    );

    enqueuedOrderIds.add(order.order_id);
    logger.info({ order_id: order.order_id }, 'enqueued paid order for dispatch');
  }
}

function startDispatchWorker(): Worker<{ orderId: string }> {
  return new Worker(
    'dispatch',
    async (job) => {
      const order = await apiGet<Order>(`/v1/orders/${job.data.orderId}`);
      if (order.status !== 'PAID') {
        logger.info({ order_id: order.order_id, status: order.status }, 'skip dispatch for non-paid order');
        return;
      }

      await apiPost<Order>(`/v1/internal/orders/${order.order_id}/transition`, { to: 'RUNNING' });

      const service = await apiGet<ServiceManifest>(`/v1/services/${order.service_id}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.SUPPLIER_TIMEOUT_MS);

      try {
        const response = await fetch(service.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            order_id: order.order_id,
            service_id: order.service_id,
            input: order.input_payload,
            callback_url: `${callbackBase}/v1/orders/${order.order_id}/callback`
          })
        });

        if (!response.ok) {
          throw new Error(`supplier endpoint returned ${response.status}`);
        }

        logger.info({ order_id: order.order_id }, 'supplier dispatch accepted');
      } catch (error) {
        await apiPost<Order>(`/v1/internal/orders/${order.order_id}/transition`, { to: 'FAILED', error_message: (error as Error).message });
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    {
      connection: redis,
      concurrency: 5
    }
  );
}

export type StartWorkerOptions = {
  apiBase?: string;
};

export async function startWorker(options: StartWorkerOptions = {}): Promise<void> {
  if (options.apiBase) {
    apiBase = options.apiBase;
  }

  const dispatchWorker = startDispatchWorker();
  dispatchWorker.on('failed', (job, error) => {
    logger.error({ err: error, jobId: job?.id }, 'dispatch job failed');
  });

  setInterval(() => {
    void enqueuePaidOrders().catch((error) => {
      logger.error({ err: error }, 'failed to enqueue paid orders');
    });
  }, 3_000);

  logger.info(
    {
      network: env.STELLAR_NETWORK,
      facilitator_url: env.FACILITATOR_URL
    },
    'worker started (x402 stellar, no chain polling)'
  );
}

export function getPaymentListenerState(): { isRunning: boolean; lastSettledTxHash: string | null; lastError: string | null; lastPollAt: string | null } {
  return {
    isRunning: true,
    lastSettledTxHash: null,
    lastError: null,
    lastPollAt: new Date().toISOString()
  };
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  startWorker().catch((error) => {
    logger.error({ err: error }, 'worker crashed at startup');
    process.exit(1);
  });
}
