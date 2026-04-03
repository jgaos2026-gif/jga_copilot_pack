/**
 * validatePrice unit tests
 * Tests for the validatePrice helper in lib/pricing.ts.
 */

import { describe, it, expect } from 'vitest';
import { validatePrice } from '../lib/pricing';

describe('validatePrice', () => {
  it('returns true for zero (floor price)', () => {
    expect(validatePrice(0)).toBe(true);
  });

  it('returns true for a positive integer price', () => {
    expect(validatePrice(100)).toBe(true);
    expect(validatePrice(9999)).toBe(true);
  });

  it('returns true for a positive decimal price', () => {
    expect(validatePrice(0.01)).toBe(true);
    expect(validatePrice(499.99)).toBe(true);
  });

  it('returns true for a very large finite price', () => {
    expect(validatePrice(1e15)).toBe(true);
  });

  it('returns false for a negative price', () => {
    expect(validatePrice(-1)).toBe(false);
    expect(validatePrice(-0.01)).toBe(false);
    expect(validatePrice(-1000)).toBe(false);
  });

  it('returns false for NaN', () => {
    expect(validatePrice(NaN)).toBe(false);
  });

  it('returns false for positive Infinity', () => {
    expect(validatePrice(Infinity)).toBe(false);
  });

  it('returns false for negative Infinity', () => {
    expect(validatePrice(-Infinity)).toBe(false);
  });

  it('returns false for the result of 0 / 0 (NaN)', () => {
    expect(validatePrice(0 / 0)).toBe(false);
  });

  it('returns false for a value produced by multiplying Infinity', () => {
    expect(validatePrice(1e308 * 10)).toBe(false);
  });
});
