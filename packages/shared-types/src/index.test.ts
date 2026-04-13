import { describe, expect, it } from 'vitest';
import { idToHex, priceToAtomic } from './index.js';

describe('id mapping', () => {
  it('maps same id to same hash', () => {
    const a = idToHex('ord_20260206_0001');
    const b = idToHex('ord_20260206_0001');
    expect(a).toBe(b);
  });

  it('maps different ids to different hashes', () => {
    const a = idToHex('ord_a');
    const b = idToHex('ord_b');
    expect(a).not.toBe(b);
  });
});

describe('price conversion', () => {
  it('converts display price to atomic', () => {
    expect(priceToAtomic('1.0', 6)).toBe(1000000n);
  });

  it('defaults to 7 decimals for Stellar USDC', () => {
    expect(priceToAtomic('0.1')).toBe(1000000n);
  });
});
