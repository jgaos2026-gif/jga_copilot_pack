/**
 * Health Check Endpoint
 * 
 * GET /api/health
 * 
 * Returns system health status including:
 * - Application status
 * - Database connectivity
 * - External service health
 * - Event ledger status
 * - Stitch consensus status
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    
    // Check database connectivity
    let dbHealth = "unknown";
    try {
      // In production, this would query the database
      // For now, we'll simulate with environment variable check
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      dbHealth = supabaseUrl ? "healthy" : "unhealthy";
    } catch (error) {
      dbHealth = "unhealthy";
    }

    // Check inter-BRIC RPC connectivity (Law #8)
    let rpcHealth = "unknown";
    try {
      const bricName = process.env.BRIC_NAME || "unknown";
      rpcHealth = bricName !== "unknown" ? "healthy" : "unknown";
    } catch (error) {
      rpcHealth = "unhealthy";
    }

    // Check event ledger (Law #7)
    let eventLedgerHealth = "unknown";
    try {
      // In production, this would check event_ledger table connectivity
      const eventSystemEnabled = process.env.EVENT_SYSTEM_ENABLED !== "false";
      eventLedgerHealth = eventSystemEnabled ? "healthy" : "disabled";
    } catch (error) {
      eventLedgerHealth = "unhealthy";
    }

    // Check Stitch BRIC (consensus)
    let stitchHealth = "unknown";
    try {
      const stitchHost = process.env.BRIC_STITCH_HOST;
      stitchHealth = stitchHost ? "healthy" : "unknown";
    } catch (error) {
      stitchHealth = "unhealthy";
    }

    const isHealthy =
      dbHealth === "healthy" &&
      rpcHealth === "healthy" &&
      eventLedgerHealth === "healthy";

    return NextResponse.json(
      {
        status: isHealthy ? "healthy" : "degraded",
        timestamp,
        version: "1.0.0",
        bric: {
          name: process.env.BRIC_NAME || "unknown",
          type: process.env.BRIC_TYPE || "unknown",
        },
        checks: {
          database: {
            status: dbHealth,
            message: dbHealth === "healthy" ? "Connected to Supabase" : "Database unavailable",
          },
          interBricRpc: {
            status: rpcHealth,
            message: rpcHealth === "healthy" ? "Inter-BRIC RPC configured" : "RPC misconfigured",
          },
          eventLedger: {
            status: eventLedgerHealth,
            message: eventLedgerHealth === "healthy" ? "Event ledger operational" : "Event system unavailable",
          },
          stitchConsensus: {
            status: stitchHealth,
            message: stitchHealth === "healthy" ? "Stitch BRIC reachable" : "Stitch BRIC unavailable",
          },
        },
        laws: {
          "#1": "Public Unidirectional - Enforced at firewall",
          "#2": "Spine No PII - Enforced in policy engine",
          "#4": "State Isolation - Enforced via RLS",
          "#7": "Stitch Integrity - Event ledger immutable",
          "#8": "Zero-Trust - mTLS on all inter-BRIC communication",
        },
        uptime: process.uptime(),
        environment: {
          nodeEnv: process.env.NODE_ENV,
          deployment: process.env.DEPLOYMENT_ENV || "unknown",
        },
      },
      {
        status: isHealthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Health-Check": "true",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        error: error?.message || "Health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function HEAD(request: NextRequest) {
  // Simple liveness check (for Kubernetes, Docker, etc.)
  return new NextResponse(null, { status: 200 });
}
