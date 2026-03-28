import { NextRequest, NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 * Used for monitoring and liveness probes
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: String(error) },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Echo back the request for testing
    return NextResponse.json(
      {
        status: 'ok',
        received: body,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
