export type Listing = {
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
