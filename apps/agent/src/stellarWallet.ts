import { Keypair, Horizon, TransactionBuilder, Networks, Operation, Asset, BASE_FEE } from '@stellar/stellar-sdk';
import { loadEnv } from '@coclaw/config';
import { logger } from '@coclaw/observability';

const env = loadEnv();

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';

let keypair: Keypair | null = null;
let publicKey: string | null = null;

function getKeypair(): Keypair | null {
  if (!env.STELLAR_PRIVATE_KEY) {
    return null;
  }
  if (!keypair) {
    keypair = Keypair.fromSecret(env.STELLAR_PRIVATE_KEY);
    publicKey = keypair.publicKey();
  }
  return keypair;
}

export function isStellarConfigured(): boolean {
  return !!env.STELLAR_PRIVATE_KEY;
}

export function getStellarPublicKey(): string | null {
  if (!isStellarConfigured()) return null;
  return getKeypair()?.publicKey() ?? null;
}

export async function getStellarStatus(): Promise<Record<string, unknown>> {
  if (!isStellarConfigured()) {
    return { configured: false };
  }

  const kp = getKeypair()!;
  const server = new Horizon.Server(HORIZON_TESTNET);

  try {
    const account = await server.loadAccount(kp.publicKey());
    const xlmBalance = account.balances.find(
      (b) => b.asset_type === 'native'
    );

    return {
      configured: true,
      publicKey: kp.publicKey(),
      xlmBalance: xlmBalance?.balance ?? '0',
      network: env.STELLAR_NETWORK
    };
  } catch {
    return {
      configured: true,
      publicKey: kp.publicKey(),
      funded: false,
      network: env.STELLAR_NETWORK
    };
  }
}

export async function sendStellarPayment(
  destination: string,
  amount: string,
  assetCode: string = 'USDC',
  assetIssuer: string = env.STELLAR_USDC_CONTRACT
): Promise<string | null> {
  if (!isStellarConfigured()) {
    logger.warn('stellar wallet not configured, skipping payment');
    return null;
  }

  const kp = getKeypair()!;
  const server = new Horizon.Server(HORIZON_TESTNET);

  const account = await server.loadAccount(kp.publicKey());
  const paymentAsset = new Asset(assetCode, assetIssuer);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: paymentAsset,
        amount
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(kp);

  const result = await server.submitTransaction(tx);
  logger.info({ tx_hash: result.hash, destination, amount }, 'stellar payment submitted');

  return result.hash;
}
