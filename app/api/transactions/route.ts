import { getServiceClient } from '@/lib/supabase-client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { z } from 'zod';


const transactionSchema = z.object({
  project_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  type: z.enum(['deposit', 'payment', 'refund']),
  amount: z.number().positive(),
  reference_id: z.string(),
  state_code: z.string().length(2),
});

/**
 * GET /api/transactions
 * Get transactions for a project
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    const customerId = request.nextUrl.searchParams.get('customer_id');

    let query = getServiceClient().from('transactions').select('*');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ transactions: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 * Create new transaction (payment/deposit/refund)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transactionData = transactionSchema.parse(body);

    const { data, error } = await getServiceClient()
      .from('transactions')
      .insert({
        project_id: transactionData.project_id,
        customer_id: transactionData.customer_id,
        type: transactionData.type,
        amount: transactionData.amount,
        reference_id: transactionData.reference_id,
        state_code: transactionData.state_code,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, transaction: data[0] },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/transactions
 * Update transaction status
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    const { data, error } = await getServiceClient()
      .from('transactions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, transaction: data[0] },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
