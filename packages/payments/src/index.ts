import type { Order } from '@coclaw/shared-types';

export type PayableOrder = Pick<
  Order,
  | 'order_id'
  | 'order_id_hex'
  | 'service_id'
  | 'service_id_hex'
  | 'buyer_wallet'
  | 'supplier_wallet'
  | 'amount_atomic'
  | 'token_address'
  | 'network'
>;

export type PaymentProviderContext = {
  network: string;
  usdcContract: string;
  payToAddress: string;
  facilitatorUrl: string;
  facilitatorApiKey: string | undefined;
  fetcher?: typeof fetch;
};

export type PreparedPayment = {
  kind: PaymentProviderKind;
  purchase_id: string;
  purchase_id_hex: string;
  listing_id: string;
  listing_id_hex: string;
  network: string;
  token_address: string;
  pay_to: string;
  amount_atomic: string;
  supplier_wallet: string;
  price: string;
  facilitator_url: string;
  provider_metadata?: Record<string, unknown>;
};

export type PaymentProviderKind = 'x402-stellar';

export interface PaymentProvider {
  readonly kind: PaymentProviderKind;
  prepare(order: PayableOrder, context: PaymentProviderContext): Promise<PreparedPayment> | PreparedPayment;
}

export const x402StellarProvider: PaymentProvider = {
  kind: 'x402-stellar',
  prepare(order, context) {
    const atomicAmount = BigInt(order.amount_atomic);
    const decimals = 7;
    const wholePart = atomicAmount / BigInt(10 ** decimals);
    const fracPart = atomicAmount % BigInt(10 ** decimals);
    const fracStr = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '');
    const price = fracStr ? `$${wholePart}.${fracStr}` : `$${wholePart}`;

    return {
      kind: 'x402-stellar',
      purchase_id: order.order_id,
      purchase_id_hex: order.order_id_hex,
      listing_id: order.service_id,
      listing_id_hex: order.service_id_hex,
      network: order.network,
      token_address: order.token_address,
      pay_to: context.payToAddress,
      amount_atomic: order.amount_atomic,
      supplier_wallet: order.supplier_wallet,
      price,
      facilitator_url: context.facilitatorUrl,
      provider_metadata: {
        scheme: 'exact',
        network: order.network,
        payTo: context.payToAddress,
        usdcContract: context.usdcContract
      }
    };
  }
};

export const providerRegistry: Record<PaymentProviderKind, PaymentProvider> = {
  'x402-stellar': x402StellarProvider
};

export function resolveProvider(kind: string | undefined): PaymentProvider {
  return x402StellarProvider;
}
