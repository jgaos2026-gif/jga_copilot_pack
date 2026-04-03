import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-client';

/**
 * GET /api/contracts
 * Get contracts for a project
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');

    let query = getSupabaseClient().from('contracts').select('*');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ contracts: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch contracts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts
 * Create new contract
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, contractor_id, terms, amount, state_code } = body;

    const { data, error } = await getSupabaseClient()
      .from('contracts')
      .insert({
        project_id,
        contractor_id,
        terms,
        amount,
        state_code,
        status: 'draft',
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
      { success: true, contract: data[0] },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create contract' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contracts
 * Update contract
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    const { data, error } = await getSupabaseClient()
      .from('contracts')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, contract: data[0] },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update contract' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contracts
 * Delete contract
 */
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Contract ID required' },
        { status: 400 }
      );
    }

    const { error } = await getSupabaseClient()
      .from('contracts')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete contract' },
      { status: 500 }
    );
  }
}
