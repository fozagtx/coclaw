import { loadEnv } from '@coclaw/config';
import { logger } from '@coclaw/observability';
import { buildApp } from './app.js';

async function main() {
  const env = loadEnv();
  const app = buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ port: env.PORT, network: env.STELLAR_NETWORK }, 'api server started');
  } catch (error) {
    logger.error({ err: error }, 'failed to start api server');
    process.exit(1);
  }
}

main();
