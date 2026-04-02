// Copyright (c) 2026 Jay's Graphic Arts LLC. All rights reserved.
// Proprietary and confidential. Unauthorized use, reproduction, or distribution
// of this software is strictly prohibited. See LICENSE for details.

export type PricingInput = { basePrice: number; demandMultiplier: number; urgencyMultiplier: number; loadFactor: number };

export function calculateAdjustedPrice(input: PricingInput) {
	const { basePrice, demandMultiplier, urgencyMultiplier, loadFactor } = input;

	// Basic validation
	if (!isFinite(basePrice) || !isFinite(demandMultiplier) || !isFinite(urgencyMultiplier) || !isFinite(loadFactor)) {
		throw new Error('Pricing inputs must be finite numbers');
	}

	if (basePrice < 0) {
		throw new Error('Base price cannot be negative');
	}

	if (demandMultiplier < 0 || urgencyMultiplier < 0 || loadFactor < 0) {
		throw new Error('Multipliers cannot be negative');
	}

	// Compute adjusted price
	const raw = basePrice * demandMultiplier * urgencyMultiplier * loadFactor;

	// Business rule: do not return negative or NaN
	if (!isFinite(raw) || isNaN(raw)) {
		throw new Error('Calculated price is invalid');
	}

	// Round to 2 decimal places
	return Math.round(raw * 100) / 100;
}

export function validatePrice(price: number): boolean {
	if (!isFinite(price) || isNaN(price)) return false;
	if (price < 0) return false;
	return true;
}
