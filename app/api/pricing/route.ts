import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateAdjustedPrice } from '@/lib/pricing';
import { createServerClient } from '@/lib/supabase';

const pricingQuerySchema = z.object({
  tier: z.string().min(1),
  urgency: z.enum(['standard', 'rush', 'emergency']).default('standard'),
  demandMultiplier: z.coerce.number().min(0.5).max(3).default(1),
  loadFactor: z.coerce.number().min(0.5).max(2).default(1),
});

const urgencyMultipliers: Record<string, number> = {
  standard: 1.0,
  rush: 1.25,
  emergency: 1.75,
};

/**
 * GET /api/pricing?tier=basic&urgency=standard&demandMultiplier=1&loadFactor=1
 * Returns a calculated quote from the pricing engine.
 * Frontend must always call this endpoint — no hardcoded pricing on the client.
 */
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const { tier, urgency, demandMultiplier, loadFactor } = pricingQuerySchema.parse(params);

    const supabase = createServerClient();
    const { data: service, error } = await supabase
      .from('services')
      .select('base_price, description, revision_limits')
      .eq('tier', tier)
      .eq('is_active', true)
      .single();

    if (error || !service) {
      return NextResponse.json({ error: `Service tier '${tier}' not found` }, { status: 404 });
    }

    const adjustedPrice = calculateAdjustedPrice({
      basePrice: Number(service.base_price),
      demandMultiplier,
      urgencyMultiplier: urgencyMultipliers[urgency],
      loadFactor,
    });

    return NextResponse.json(
      {
        tier,
        urgency,
        basePrice: Number(service.base_price),
        adjustedPrice,
        description: service.description,
        revisionLimits: service.revision_limits,
        demandMultiplier,
        urgencyMultiplier: urgencyMultipliers[urgency],
        loadFactor,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid pricing parameters', issues: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Pricing calculation failed' }, { status: 500 });
  }
}
