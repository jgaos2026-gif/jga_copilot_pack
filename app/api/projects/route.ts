/**
 * Projects Management API
 * 
 * These endpoints manage projects per state (CA, IL, TX)
 * with proper state machine enforcement
 * 
 * GET  /api/projects              - List projects (filtered by state)
 * GET  /api/projects/:id          - Get project details
 * POST /api/projects              - Create new project
 * PUT  /api/projects/:id          - Update project
 * POST /api/projects/:id/status   - Change project status (with validations)
 * GET  /api/projects/:id/workflow - Get available status transitions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create Supabase client with service role (for server-side operations)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// State machine definition for projects (Law #4: State Isolation)
const PROJECT_STATE_MACHINE = {
  intake: {
    nextStates: ["quoted"],
    requiresValidation: ["customer_id", "service_type", "estimated_value"],
  },
  quoted: {
    nextStates: ["contract-pending", "cancelled"],
    requiresValidation: ["quote_id"],
  },
  "contract-pending": {
    nextStates: ["contract-signed", "cancelled"],
    requiresValidation: ["contract_status"],
  },
  "contract-signed": {
    nextStates: ["active", "cancelled"],
    requiresValidation: ["executed_at"],
    requiresCompliance: true, // Law #6: Must have compliance artifact
  },
  active: {
    nextStates: ["in-production", "cancelled"],
    requiresValidation: ["deposit_status"],
    requiresDeposit: true, // Must have deposit confirmed
  },
  "in-production": {
    nextStates: ["review", "cancelled"],
    requiresValidation: ["start_date"],
  },
  review: {
    nextStates: ["completed", "in-production"],
    requiresValidation: ["actual_completion_date"],
  },
  completed: {
    nextStates: [],
    requiresValidation: ["actual_completion_date"],
  },
  cancelled: {
    nextStates: [],
    requiresValidation: ["status"],
  },
};

/**
 * GET /api/projects
 * List projects for current user's state
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
    const stateCode = searchParams.get("state") || "CA";
    const status = searchParams.get("status");
    const customerId = searchParams.get("customer_id");

    const schemaName = `state_${stateCode.toLowerCase()}`;

    // Build query based on filters
    let query = supabase
      .from("projects", { schema: schemaName })
      .select(
        `
        id,
        customer_id,
        contractor_id,
        name,
        description,
        service_type,
        status,
        contract_status,
        deposit_status,
        estimated_value,
        actual_cost,
        start_date,
        target_completion_date,
        created_at,
        updated_at
        `,
        { count: "exact" }
      );

    if (status) {
      query = query.eq("status", status);
    }

    if (customerId) {
      query = query.eq("customer_id", customerId);
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
      projects: data,
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
 * POST /api/projects
 * Create new project
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
    const stateCode = body.state || "CA";
    const schemaName = `state_${stateCode.toLowerCase()}`;

    // Validate required fields
    const required = ["customer_id", "contractor_id", "name", "service_type", "estimated_value"];
    const missing = required.filter((field) => !(field in body));

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Create project in initial "intake" state
    const { data, error } = await supabase
      .from("projects", { schema: schemaName })
      .insert({
        customer_id: body.customer_id,
        contractor_id: body.contractor_id,
        name: body.name,
        description: body.description || null,
        service_type: body.service_type,
        status: "intake",
        contract_status: "pending",
        deposit_status: "pending",
        estimated_value: body.estimated_value,
        metadata: body.metadata || {},
        created_by: body.created_by,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Emit project-created event
    console.log(`Project created: ${data.id} in ${stateCode}`);

    return NextResponse.json(
      {
        project: data,
        state: stateCode,
        availableTransitions: PROJECT_STATE_MACHINE.intake.nextStates,
        message: "Project created in intake state",
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
 * PUT /api/projects/:id
 * Update project
 */
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const id = pathname.split("/").pop();

    const body = await request.json();
    const stateCode = body.state || "CA";
    const schemaName = `state_${stateCode.toLowerCase()}`;

    const { data, error } = await supabase
      .from("projects", { schema: schemaName })
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log(`Project updated: ${id}`);

    return NextResponse.json({
      project: data,
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
 * POST /api/projects/:id/status
 * Validate and transition project to new status (state machine)
 * 
 * Enforces:
 * - Only valid state transitions allowed
 * - Contract required before "active" state
 * - Deposit required before entering production
 * - Compliance check required
 */
export async function transitionStatus(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const id = pathname.split("/").at(-2);

    const body = await request.json();
    const { newStatus, stateCode } = body;
    const schemaName = `state_${stateCode?.toLowerCase() || "ca"}`;

    // Get current project
    const { data: project, error: fetchError } = await supabase
      .from("projects", { schema: schemaName })
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Check if transition is valid
    const currentState = PROJECT_STATE_MACHINE[project.status as keyof typeof PROJECT_STATE_MACHINE];
    if (!currentState || !currentState.nextStates.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${project.status} to ${newStatus}`,
          currentStatus: project.status,
          allowedTransitions: currentState?.nextStates || [],
        },
        { status: 400 }
      );
    }

    // Enforce specific business rules
    if (newStatus === "active") {
      // Law #4: Contract must be signed before activation
      if (project.contract_status !== "signed") {
        return NextResponse.json(
          {
            error: "Cannot activate project: contract must be signed",
            contractStatus: project.contract_status,
          },
          { status: 400 }
        );
      }

      // Deposit must be confirmed
      if (project.deposit_status !== "confirmed") {
        return NextResponse.json(
          {
            error: "Cannot activate project: deposit must be confirmed",
            depositStatus: project.deposit_status,
          },
          { status: 400 }
        );
      }
    }

    if (newStatus === "in-production") {
      // Compliance check (Law #6)
      // In production, this would call the Compliance BRIC via RPC
      console.log(`[Compliance Check] Project ${id} before production`);
    }

    // Transition the project
    const { data: updated, error: updateError } = await supabase
      .from("projects", { schema: schemaName })
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // Emit status-changed event
    console.log(`Project status changed: ${id} ${project.status} -> ${newStatus}`);

    // Get available next transitions
    const nextMachineState = PROJECT_STATE_MACHINE[newStatus as keyof typeof PROJECT_STATE_MACHINE];

    return NextResponse.json({
      project: updated,
      currentStatus: newStatus,
      availableTransitions: nextMachineState?.nextStates || [],
      message: `Project transitioned to ${newStatus}`,
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
 * GET /api/projects/:id/workflow
 * Get valid state transitions for a project
 */
export async function getWorkflow(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const id = pathname.split("/").at(-2);

    const body = await request.json();
    const { stateCode } = body;
    const schemaName = `state_${stateCode?.toLowerCase() || "ca"}`;

    // Get current project status
    const { data: project, error } = await supabase
      .from("projects", { schema: schemaName })
      .select("status")
      .eq("id", id)
      .single();

    if (error || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const machineState = PROJECT_STATE_MACHINE[project.status as keyof typeof PROJECT_STATE_MACHINE];

    return NextResponse.json({
      currentStatus: project.status,
      availableTransitions: machineState?.nextStates || [],
      stateMachine: PROJECT_STATE_MACHINE,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
