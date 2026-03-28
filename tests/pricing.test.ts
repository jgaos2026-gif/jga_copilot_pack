import { describe, expect, it } from 'vitest';
import { calculateAdjustedPrice } from '../lib/pricing';

describe('calculateAdjustedPrice',()=>{
  it('calculates price',()=>{
    expect(calculateAdjustedPrice({basePrice:500,demandMultiplier:1.1,urgencyMultiplier:1,loadFactor:1.05})).toBe(577.5);
  });
});
