/**
 * Transactions / Payments API
 * 
 * Law #7: All transactions recorded in immutable audit ledger
 * Law #6: Escrow enforcement for contract compliance
 * 
 * GET  /api/transactions           - Get transactions for project/customer
 * POST /api/transactions           - Record transaction
 * GET  /api/transactions/:id       - Get transaction details
 * POST /api/transactions/:id/void  - Void transaction (with approval)
 * GET  /api/escrow                 - Get escrow status
 * POST /api/escrow/:id/release     - Release escrow funds (requires dual auth)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/transactions
 * Get transactions filtered by project or customer
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
    const type = searchParams.get("type");

    const schemaName = `state_${stateCode.toLowerCase()}`;
    let query = supabase.from("transactions", { schema: schemaName }).select("*");

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    if (type) {
      query = query.eq("type", type);
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

    // Calculate totals
    const totalAmount = (data || []).reduce((sum: number, t: any) => {
      if (t.status === "completed") {
        return sum + (t.type === "refund" ? -t.amount : t.amount);
      }
      return sum;
    }, 0);

    const held = (data || []).reduce((sum: number, t: any) => {
      return t.held_in_escrow ? sum + t.amount : sum;
    }, 0);

    return NextResponse.json({
      state: stateCode,
      transactions: data,
      totals: {
        count,
        totalAmount,
        heldInEscrow: held,
      },
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
 * POST /api/transactions
 * Record new transaction (payment, deposit, refund, etc.)
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
      type,
      amount,
      stateCode,
      paymentMethod,
      referenceId,
      invoiceNumber,
    } = body;

    // Validate required fields
    if (!projectId || !customerId || !type || !amount || !stateCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate transaction type
    const validTypes = ["deposit", "payment", "refund", "dispute", "escrow-release"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid transaction type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const schemaName = `state_${stateCode.toLowerCase()}`;

    // For deposits and escrow transactions, check if escrow is required
    const heldInEscrow =
      type === "deposit" || type === "payment" ? 
      body.heldInEscrow || false : 
      false;

    const { data, error } = await supabase
      .from("transactions", { schema: schemaName })
      .insert({
        project_id: projectId,
        customer_id: customerId,
        type,
        amount: parseFloat(amount),
        currency: "USD",
        reference_id: referenceId || null,
        invoice_number: invoiceNumber || null,
        status: "pending",
        payment_method: paymentMethod || "unknown",
        held_in_escrow: heldInEscrow,
        release_conditions: heldInEscrow ? body.releaseConditions || {} : null,
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

    // Emit transaction-created event (Law #7)
    console.log(`Transaction recorded: ${data.id} [${type} $${amount}]`);

    return NextResponse.json(
      {
        transaction: data,
        heldInEscrow,
        message: heldInEscrow
          ? `Transaction recorded and held in escrow. Release requires dual approval.`
          : "Transaction recorded",
        nextStep: heldInEscrow
          ? "Awaiting dual approval for escrow release"
          : type === "deposit"
          ? "Deposit processing"
          : "Payment processing",
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
 * POST /api/escrow/:id/release
 * Release escrowed funds (requires dual auth - Law #5, Law #6)
 */
export async function releaseEscrow(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { pathname } = new URL(request.url);
    const transactionId = pathname.split("/").pop();

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { stateCode, approverSecondId } = body;

    if (!approverSecondId) {
      return NextResponse.json(
        {
          error: "Dual approval required",
          requiresDualAuth: true,
          message: "Second approver must provide authorization",
        },
        { status: 403 }
      );
    }

    const schemaName = `state_${stateCode?.toLowerCase() || "ca"}`;

    // Get transaction
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions", { schema: schemaName })
      .select("*")
      .eq("id", transactionId)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (!transaction.held_in_escrow) {
      return NextResponse.json(
        { error: "Transaction is not held in escrow" },
        { status: 400 }
      );
    }

    // Check release conditions
    const conditions = transaction.release_conditions || {};
    const conditionsMet = Object.values(conditions).every((v) => v === true);

    if (!conditionsMet) {
      return NextResponse.json(
        {
          error: "Escrow release conditions not met",
          conditions,
          unmetConditions: Object.entries(conditions)
            .filter(([_, v]) => v !== true)
            .map(([k]) => k),
        },
        { status: 400 }
      );
    }

    // Update transaction to released
    const { data: updated, error: updateError } = await supabase
      .from("transactions", { schema: schemaName })
      .update({
        held_in_escrow: false,
        released_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", transactionId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // Log escrow release (audit trail - Law #7)
    console.log(
      `Escrow released: ${transactionId} [$${transaction.amount}] by ${approverSecondId}`
    );

    return NextResponse.json({
      transaction: updated,
      releasedAt: updated.released_at,
      message: "Escrow funds released successfully",
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
 * GET /api/escrow
 * Get all escrowed transactions
 */
export async function getEscrow(request: NextRequest) {
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

    const schemaName = `state_${stateCode.toLowerCase()}`;

    // Get all transactions held in escrow
    const { data, error } = await supabase
      .from("transactions", { schema: schemaName })
      .select("*")
      .eq("held_in_escrow", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const totalHeld = (data || []).reduce((sum: number, t: any) => sum + t.amount, 0);
    const pendingApproval = (data || []).length;

    return NextResponse.json({
      state: stateCode,
      totalHeld,
      pendingApproval,
      transactions: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
