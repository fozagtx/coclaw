import type { Order } from '@coclaw/shared-types';

export type OrderPaidLog = {
  orderIdHex: string;
  serviceIdHex: string;
  buyer: string;
  supplier: string;
  token: string;
  amountAtomic: bigint;
  txHash: string;
  ledger: number;
};

export function getOrderPaidMismatchReason(order: Order, log: OrderPaidLog): string | null {
  if (order.service_id_hex.toLowerCase() !== log.serviceIdHex.toLowerCase()) {
    return 'service_id_hex mismatch';
  }

  if (order.buyer_wallet !== log.buyer) {
    return 'buyer mismatch';
  }

  if (order.supplier_wallet !== log.supplier) {
    return 'supplier mismatch';
  }

  if (order.token_address !== log.token) {
    return 'token mismatch';
  }

  if (order.amount_atomic !== log.amountAtomic.toString()) {
    return 'amount mismatch';
  }

  return null;
}
