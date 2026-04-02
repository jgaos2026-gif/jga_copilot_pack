// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { calculateAdjustedPrice } from '../lib/pricing';

describe('calculateAdjustedPrice',()=>{
  it('calculates price',()=>{
    expect(calculateAdjustedPrice({basePrice:500,demandMultiplier:1.1,urgencyMultiplier:1,loadFactor:1.05})).toBe(577.5);
  });
});
