import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';

/**
 * GET /api/dashboard
 * Returns aggregate stats for the owner/admin dashboard overview
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const [customersRes, projectsRes, transactionsRes, contractorsRes] =
      await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('transactions').select('amount').eq('status', 'completed'),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'contractor'),
      ]);

    const totalRevenue = (transactionsRes.data ?? []).reduce(
      (sum: number, tx: { amount: number }) => sum + (tx.amount ?? 0),
      0
    );

    return NextResponse.json(
      {
        customers: customersRes.count ?? 0,
        projects: projectsRes.count ?? 0,
        totalRevenue,
        contractorsActive: contractorsRes.count ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[dashboard] Failed to fetch dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
