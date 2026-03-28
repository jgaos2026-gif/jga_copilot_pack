import { describe, expect, it } from 'vitest';
import { calculateAdjustedPrice } from '../lib/pricing';

describe('calculateAdjustedPrice - edge cases', () => {
  it('throws on negative basePrice', () => {
    expect(() => calculateAdjustedPrice({ basePrice: -1, demandMultiplier: 1, urgencyMultiplier: 1, loadFactor: 1 })).toThrow();
  });

  it('throws on negative multipliers', () => {
    expect(() => calculateAdjustedPrice({ basePrice: 100, demandMultiplier: -1, urgencyMultiplier: 1, loadFactor: 1 })).toThrow();
  });

  it('handles very large numbers without producing NaN', () => {
    const price = calculateAdjustedPrice({ basePrice: 1e6, demandMultiplier: 10, urgencyMultiplier: 10, loadFactor: 10 });
    expect(Number.isFinite(price)).toBe(true);
  });

  it('rounds to 2 decimal places', () => {
    const price = calculateAdjustedPrice({ basePrice: 123.4567, demandMultiplier: 1.1, urgencyMultiplier: 1.234, loadFactor: 1.01 });
    // ensure two decimals
    expect(Math.round(price * 100) / 100).toBe(price);
  });
});
