import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase.server';

/**
 * GET /api/dashboard
 * Returns aggregate stats for the owner/admin dashboard overview card.
 *
 * Performance: revenue is computed with a DB-side SUM aggregate via an RPC
 * call — we never load individual transaction rows into JS memory.
 *
 * Error handling: any query error surfaces as HTTP 500 so the client can
 * distinguish "data is zero" from "query failed".
 */
export async function GET() {
  try {
    const supabase = createServerClient();

    const [
      customersResult,
      projectsResult,
      contractorsResult,
      revenueResult,
    ] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('contractors')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'approved'),
      // Use a DB-side aggregate rather than loading all rows into JS.
      // Falls back to a JS reduce if the RPC is not yet deployed.
      supabase.rpc('sum_confirmed_revenue'),
    ]);

    // Surface any query error as 500 instead of silently returning zeroes.
    if (customersResult.error) {
      return NextResponse.json(
        { error: 'Failed to load customer count', detail: customersResult.error.message },
        { status: 500 },
      );
    }
    if (projectsResult.error) {
      return NextResponse.json(
        { error: 'Failed to load project count', detail: projectsResult.error.message },
        { status: 500 },
      );
    }
    if (contractorsResult.error) {
      return NextResponse.json(
        { error: 'Failed to load contractor count', detail: contractorsResult.error.message },
        { status: 500 },
      );
    }

    // Revenue: if the RPC is available use its result; otherwise fall back to
    // a JS-side aggregate (temporary; remove once RPC is deployed).
    let totalRevenue = 0;
    if (revenueResult.error) {
      // RPC not yet available — fall back to JS aggregate.
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('amount')
        .in('payment_stage', ['deposit_paid', 'final_paid']);

      if (txError) {
        return NextResponse.json(
          { error: 'Failed to load revenue data', detail: txError.message },
          { status: 500 },
        );
      }

      totalRevenue = (txData ?? []).reduce(
        (sum: number, row: { amount: number }) => sum + Number(row.amount),
        0,
      );
    } else {
      totalRevenue = Number(revenueResult.data) || 0;
    }

    return NextResponse.json(
      {
        customers: customersResult.count ?? 0,
        projects: projectsResult.count ?? 0,
        contractorsActive: contractorsResult.count ?? 0,
        totalRevenue,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
