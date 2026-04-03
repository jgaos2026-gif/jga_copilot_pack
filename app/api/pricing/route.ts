import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateAdjustedPrice } from '@/lib/pricing';
import { createServerClient } from '@/lib/supabase.server';

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
 * Supabase PostgREST error code returned when `.single()` finds no rows.
 */
const PGRST116 = 'PGRST116';

/**
 * GET /api/pricing?tier=basic&urgency=standard&demandMultiplier=1&loadFactor=1
 * Returns a calculated quote from the pricing engine.
 *
 * Frontend must always call this endpoint — no hardcoded pricing on the client.
 *
 * Error handling:
 *  - 404 when the requested tier does not exist (PostgREST code PGRST116).
 *  - 500 for any other Supabase/DB error (e.g., network issues, timeout).
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

    if (error) {
      // PGRST116 means no row matched — the tier doesn't exist.
      if (error.code === PGRST116 || !service) {
        return NextResponse.json(
          { error: `Service tier '${tier}' not found` },
          { status: 404 },
        );
      }
      // Any other error is a transient DB/network issue — return 500.
      return NextResponse.json(
        { error: 'Pricing service temporarily unavailable' },
        { status: 500 },
      );
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
      return NextResponse.json(
        { error: 'Invalid pricing parameters', issues: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Pricing calculation failed' }, { status: 500 });
  }
}
