/**
 * Contracts Management API
 * 
 * Law #6: All contracts must pass compliance before execution
 * Law #7: Contract execution recorded in immutable audit ledger
 * 
 * GET  /api/contracts           - List contracts
 * GET  /api/contracts/:id       - Get contract details
 * POST /api/contracts           - Create/upload contract
 * POST /api/contracts/:id/sign  - Sign contract by customer/contractor
 * POST /api/contracts/:id/execute - Execute contract (requires compliance artifact)
 * POST /api/contracts/:id/dispute - File dispute on contract
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/contracts
 * List contracts filtered by project, state, or status
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    const customerId = searchParams.get("customer_id");
    const stateCode = searchParams.get("state") || "CA";
    const status = searchParams.get("status");

    const schemaName = `state_${stateCode.toLowerCase()}`;

    let query = supabase.from("contracts", { schema: schemaName }).select(`
      id,
      project_id,
      customer_id,
      contractor_id,
      document_url,
      terms,
      payment_schedule,
      signed_by_contractor_at,
      signed_by_customer_at,
      executed_at,
      expires_at,
      compliance_artifact_id,
      dispute_flag,
      created_at
    `);

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    if (status) {
      if (status === "unsigned") {
        query = query.or("signed_by_contractor_at.is.null,signed_by_customer_at.is.null");
      } else if (status === "signed") {
        query = query
          .not("signed_by_contractor_at", "is", null)
          .not("signed_by_customer_at", "is", null)
          .is("executed_at", null);
      } else if (status === "executed") {
        query = query.not("executed_at", "is", null);
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(0, 99);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      state: stateCode,
      contracts: data,
      total: count,
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
 * POST /api/contracts
 * Create new contract (uploads document, generates hash)
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
    const {
      projectId,
      customerId,
      contractorId,
      stateCode,
      documentUrl,
      terms,
      paymentSchedule,
    } = body;

    // Validate required fields
    if (!projectId || !customerId || !contractorId || !stateCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const schemaName = `state_${stateCode.toLowerCase()}`;

    // Calculate document hash (Law #7: immutable record)
    const documentHash = createHash("sha256")
      .update(documentUrl || "")
      .digest("hex");

    const { data, error } = await supabase
      .from("contracts", { schema: schemaName })
      .insert({
        project_id: projectId,
        customer_id: customerId,
        contractor_id: contractorId,
        document_url: documentUrl || null,
        document_hash: documentHash,
        terms: terms || null,
        payment_schedule: paymentSchedule || null,
        created_by: body.createdBy,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Log contract creation
    console.log(`Contract created: ${data.id} [${projectId}]`);

    return NextResponse.json(
      {
        contract: data,
        documentHash,
        status: "draft",
        nextSteps: [
          "Wait for contractor signature",
          "Wait for customer signature",
          "Request compliance approval",
          "Execute contract",
        ],
        message: "Contract created. Awaiting signatures.",
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts/:id/sign
 * Sign contract by contractor or customer
 */
export async function sign(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const contractId = pathname.split("/").at(-2);

    const body = await request.json();
    const { stateCode, signedBy, signedByName, role } = body;

    if (!stateCode || !signedBy || !signedByName || !role) {
      return NextResponse.json(
        {
          error: "Missing required fields: stateCode, signedBy, signedByName, role",
        },
        { status: 400 }
      );
    }

    const schemaName = `state_${stateCode.toLowerCase()}`;

    // Get current contract
    const { data: contract, error: fetchError } = await supabase
      .from("contracts", { schema: schemaName })
      .select("*")
      .eq("id", contractId)
      .single();

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // Update contract with signature
    const updateData: any = {};
    if (role === "contractor") {
      updateData.signed_by_contractor_at = new Date().toISOString();
      updateData.signed_by_contractor_name = signedByName;
    } else if (role === "customer") {
      updateData.signed_by_customer_at = new Date().toISOString();
      updateData.signed_by_customer_name = signedByName;
    } else {
      return NextResponse.json(
        { error: "Invalid role. Must be 'contractor' or 'customer'" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("contracts", { schema: schemaName })
      .update(updateData)
      .eq("id", contractId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // Check if both parties have signed
    const botSigned =
      updated.signed_by_contractor_at && updated.signed_by_customer_at;

    // Log signature
    console.log(
      `Contract signed by ${role}: ${contractId} [${signedByName}]`
    );

    return NextResponse.json({
      contract: updated,
      signedBy: role,
      bothSigned: botSigned,
      nextStep: botSigned
        ? "Contract fully signed. Request compliance approval before execution."
        : "Awaiting other party's signature",
      message: botSigned
        ? "Contract fully signed by both parties"
        : `Signature recorded. Awaiting ${role === "contractor" ? "customer" : "contractor"} signature`,
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
 * POST /api/contracts/:id/execute
 * Execute contract (requires compliance artifact - Law #6)
 */
export async function execute(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const contractId = pathname.split("/").at(-2);

    const body = await request.json();
    const { stateCode, complianceArtifactId } = body;

    if (!stateCode || !complianceArtifactId) {
      return NextResponse.json(
        {
          error: "Compliance approval required (Law #6)",
          requiresCompliance: true,
        },
        { status: 403 }
      );
    }

    const schemaName = `state_${stateCode.toLowerCase()}`;

    // Get contract
    const { data: contract, error: fetchError } = await supabase
      .from("contracts", { schema: schemaName })
      .select("*")
      .eq("id", contractId)
      .single();

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // Verify both sides have signed
    if (!contract.signed_by_contractor_at || !contract.signed_by_customer_at) {
      return NextResponse.json(
        {
          error: "Contract not fully signed",
          contractorSigned: !!contract.signed_by_contractor_at,
          customerSigned: !!contract.signed_by_customer_at,
        },
        { status: 400 }
      );
    }

    // Verify compliance artifact exists
    const { data: artifact, error: artifactError } = await supabase
      .from("compliance_artifacts", { schema: "compliance" })
      .select("*")
      .eq("id", complianceArtifactId)
      .single();

    if (artifactError || !artifact) {
      return NextResponse.json(
        { error: "Compliance artifact not found" },
        { status: 404 }
      );
    }

    // Check compliance decision (Law #6)
    if (artifact.decision === "blocked") {
      return NextResponse.json(
        {
          error: "Contract blocked by compliance review",
          compliance: artifact,
        },
        { status: 403 }
      );
    }

    // Execute contract
    const { data: updated, error: updateError } = await supabase
      .from("contracts", { schema: schemaName })
      .update({
        executed_at: new Date().toISOString(),
        compliance_artifact_id: complianceArtifactId,
      })
      .eq("id", contractId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // Log execution
    console.log(`Contract executed: ${contractId}`);

    return NextResponse.json({
      contract: updated,
      executedAt: updated.executed_at,
      compliance: {
        decision: artifact.decision,
        riskScore: artifact.risk_score,
        verified: artifact.signature_verified,
      },
      message: "Contract executed successfully",
      nextStep: "You can now activate the project and begin work",
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
 * POST /api/contracts/:id/dispute
 * File dispute on contract
 */
export async function dispute(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const contractId = pathname.split("/").at(-2);

    const body = await request.json();
    const { stateCode, reason } = body;

    if (!reason || !stateCode) {
      return NextResponse.json(
        { error: "Reason for dispute required" },
        { status: 400 }
      );
    }

    const schemaName = `state_${stateCode.toLowerCase()}`;

    // Flag contract as under dispute
    const { data, error } = await supabase
      .from("contracts", { schema: schemaName })
      .update({
        dispute_flag: true,
        dispute_reason: reason,
      })
      .eq("id", contractId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Log dispute
    console.log(`Contract dispute filed: ${contractId} [${reason}]`);

    return NextResponse.json({
      contract: data,
      disputeFiled: true,
      message: "Dispute filed successfully. Awaiting review.",
      nextStep: "JGA team will contact you within 24 hours",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
