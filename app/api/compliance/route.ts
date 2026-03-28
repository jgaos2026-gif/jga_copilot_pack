/**
 * Compliance API
 * 
 * Law #6: Compliance Gate - All projects must pass compliance checks before activation
 * Law #8: Zero-Trust - Calls to Spine BRIC via mTLS
 * 
 * POST /api/compliance/check          - Run compliance check on project
 * GET  /api/compliance/:artifactId    - Get compliance artifact
 * GET  /api/compliance/risks/:projectId - Get risk assessment
 */

import { NextRequest, NextResponse } from "next/server";
import { InterBricRpcClient, ServiceRegistry } from "@/lib/inter-bric-rpc/client";

/**
 * POST /api/compliance/check
 * 
 * Triggers compliance check via Spine BRIC (Law #6, Law #8)
 * Returns compliance artifact with decision (approved/blocked/review-required)
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { customerId, projectId, stateCode } = body;

    if (!customerId || !stateCode) {
      return NextResponse.json(
        { error: "Missing required fields: customerId, stateCode" },
        { status: 400 }
      );
    }

    // Initialize RPC client to Spine BRIC (Law #8: mTLS)
    const registry = ServiceRegistry.fromEnvironment();
    const spineClient = new InterBricRpcClient(registry.get("spine"));

    // Call Spine to run compliance checks
    const response = await spineClient.request({
      method: "POST",
      path: "/api/compliance/check",
      body: {
        customerId,
        projectId,
        stateCode,
        regulations: ["state-business", "contractor-licensing", "ai-transparency"],
        timestamp: Date.now(),
      },
      headers: {
        "X-Request-ID": crypto.randomUUID?.() || Date.now().toString(),
        "X-Request-Type": "compliance-check",
      },
    });

    if (response.status !== 200) {
      return NextResponse.json(
        {
          error: "Compliance check failed",
          details: response.body,
        },
        { status: response.status }
      );
    }

    const { decision, riskScore, artifact } = response.body;

    // Determine response status
    let resultStatus: "approved" | "blocked" | "review-required" = "review-required";
    if (decision === "approved") {
      resultStatus = "approved";
    } else if (decision === "blocked") {
      resultStatus = "blocked";
    }

    return NextResponse.json({
      decision: resultStatus,
      riskScore,
      artifact,
      message: resultStatus === "approved" ? "Compliance check passed" : 
               resultStatus === "blocked" ? "Compliance check failed - project blocked" :
               "Compliance check requires manual review",
      timestamp: new Date().toISOString(),
    }, {
      status: resultStatus === "approved" ? 200 : resultStatus === "blocked" ? 403 : 202,
    });

  } catch (error: any) {
    console.error("Compliance check error:", error);

    return NextResponse.json(
      {
        error: "Compliance check failed",
        message: error?.message || "Internal server error",
        recommendation: "Try again later or contact support",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/compliance/:artifactId
 * Retrieve a specific compliance artifact (Law #7: immutable in database)
 */
export async function getArtifact(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const artifactId = pathname.split("/").pop();

    if (!artifactId) {
      return NextResponse.json(
        { error: "Artifact ID required" },
        { status: 400 }
      );
    }

    // Query compliance_artifacts table (Law #7: immutable)
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("compliance_artifacts", { schema: "compliance" })
      .select("*")
      .eq("id", artifactId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Compliance artifact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      artifact: data,
      signatureVerified: data.signature_verified,
      verifiedBy: data.verified_by_stitch_at ? "Stitch BRIC Consensus" : "Pending",
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/compliance/risks/:projectId
 * Get risk assessment for a project
 */
export async function getRisks(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const projectId = pathname.split("/").pop();

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      );
    }

    // In production, this would query compliance_artifacts for the project
    // For now, return simulated risk assessment

    const riskFactors = [
      {
        category: "Contractor Licensing",
        risk: "medium",
        description: "Contractor license expires within 90 days",
        mitigation: "Schedule license renewal",
      },
      {
        category: "Geographic Jurisdiction",
        risk: "low",
        description: "Work location in authorized service territory",
        mitigation: "None required",
      },
      {
        category: "AI Transparency",
        risk: "low",
        description: "No AI-assisted work detected in project scope",
        mitigation: "None required",
      },
      {
        category: "Payment Terms",
        risk: "low",
        description: "Payment terms comply with state regulations",
        mitigation: "None required",
      },
    ];

    const overallRisk = 52; // Out of 100

    return NextResponse.json({
      projectId,
      overallRiskScore: overallRisk,
      riskLevel: overallRisk > 75 ? "high" : overallRisk > 50 ? "medium" : "low",
      factors: riskFactors,
      recommendation: overallRisk > 50 ? "Manual review recommended" : "Proceed with project",
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
