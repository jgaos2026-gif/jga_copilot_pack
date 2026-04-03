import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';

/**
 * GET /api/dashboard
 * Aggregate metrics for the owner/admin dashboard
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    const [clientsResult, projectsResult, transactionsResult, contractorsResult] =
      await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('transactions').select('amount').in('status', ['paid', 'confirmed']),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'contractor'),
      ]);

    const totalRevenue = (transactionsResult.data || []).reduce(
      (sum: number, t: { amount: number }) => sum + (t.amount || 0),
      0
    );

    return NextResponse.json(
      {
        customers: clientsResult.count ?? 0,
        projects: projectsResult.count ?? 0,
        totalRevenue,
        contractorsActive: contractorsResult.count ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Dashboard fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}
