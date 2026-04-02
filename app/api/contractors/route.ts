import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-client';

/**
 * GET /api/contractors
 * List all contractors (admin only)
 */
export async function GET() {
  try {
    const { data, error } = await getServiceClient()
      .from('users')
      .select('*')
      .eq('role', 'contractor');

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ contractors: data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch contractors' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contractors
 * Create new contractor (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, stateCode, licenseNumber } = body;

    // Insert contractor record
    const { data, error } = await getServiceClient()
      .from('users')
      .insert({
        email,
        full_name: fullName,
        role: 'contractor',
        state_code: stateCode,
        metadata: { license_number: licenseNumber },
      })
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, contractor: data[0] },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create contractor' },
      { status: 500 }
    );
  }
}
