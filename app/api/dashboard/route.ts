import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/dashboard
 * Returns aggregate stats for the owner/admin dashboard overview card.
 */
export async function GET() {
  try {
    const supabase = createServerClient();

    const [
      { count: customers },
      { count: projects },
      { count: contractorsActive },
      { data: txData },
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
      supabase
        .from('transactions')
        .select('amount')
        .in('payment_stage', ['deposit_paid', 'final_paid']),
    ]);

    const totalRevenue = (txData ?? []).reduce(
      (sum: number, row: { amount: number }) => sum + Number(row.amount),
      0,
    );

    return NextResponse.json(
      {
        customers: customers ?? 0,
        projects: projects ?? 0,
        contractorsActive: contractorsActive ?? 0,
        totalRevenue,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 },
    );
  }
}
