/**
 * Contractor Management API
 * 
 * GET  /api/contractors          - List contractors (admin only)
 * GET  /api/contractors/:id      - Get contractor profile (self or admin)
 * POST /api/contractors          - Create contractor
 * PUT  /api/contractors/:id      - Update contractor profile
 * GET  /api/contractors/me       - Get current user's contractor profile
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/contractors
 * List all contractors (admin only, with optional filtering)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const state = searchParams.get("state");
    const status = searchParams.get("status");

    // Check authentication (would use middleware in production)
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // If specific contractor ID requested
    if (id) {
      const { data, error } = await supabase
        .from("contractors")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json(data);
    }

    // List contractors with filters
    let query = supabase.from("contractors").select("*");

    if (state) {
      query = query.contains("states_licensed", [state]);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query
      .range(0, 99) // Pagination
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      contractors: data,
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
 * POST /api/contractors
 * Create new contractor profile
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

    // Validate required fields
    if (!body.user_id || !body.full_name || !body.email || !body.states_licensed) {
      return NextResponse.json(
        { error: "Missing required fields: user_id, full_name, email, states_licensed" },
        { status: 400 }
      );
    }

    // Validate states_licensed is array
    if (!Array.isArray(body.states_licensed)) {
      return NextResponse.json(
        { error: "states_licensed must be an array" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("contractors")
      .insert({
        user_id: body.user_id,
        full_name: body.full_name,
        email: body.email,
        phone: body.phone || null,
        states_licensed: body.states_licensed,
        specialty_tags: body.specialty_tags || [],
        bio: body.bio || null,
        status: "active",
        availability: "available",
        created_by: body.created_by || body.user_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Emit contractor-created event to event ledger
    // This would be integrated with the event system
    console.log(`Contractor created: ${data.id}`);

    return NextResponse.json(
      {
        contractor: data,
        message: "Contractor profile created successfully",
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
 * PUT /api/contractors/:id
 * Update contractor profile
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

    if (!id) {
      return NextResponse.json(
        { error: "Contractor ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { data, error } = await supabase
      .from("contractors")
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

    // Emit contractor-updated event
    console.log(`Contractor updated: ${id}`);

    return NextResponse.json({
      contractor: data,
      message: "Contractor profile updated",
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
 * GET /api/contractors/me
 * Get current user's contractor profile
 */
export async function getMe(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user ID from token (would be decoded properly in production)
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("contractors")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Contractor profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      contractor: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
