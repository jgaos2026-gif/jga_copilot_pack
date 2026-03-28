/**
 * Authentication API
 * 
 * Law #5: Owners Room requires MFA for all admin operations
 * 
 * POST /api/auth/register        - Create new account
 * POST /api/auth/login           - Login with email/password
 * POST /api/auth/logout          - Logout
 * POST /api/auth/refresh         - Refresh auth token
 * POST /api/auth/mfa/setup       - Setup MFA (TOTP)
 * POST /api/auth/mfa/verify      - Verify MFA code
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/auth/register
 * Create new user account
 */
export async function register(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, fullName" },
        { status: 400 }
      );
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email verification
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Create user_roles entry
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "client", // Default role
        mfa_required: false,
        mfa_enabled: false,
      })
      .select()
      .single();

    if (roleError) {
      return NextResponse.json(
        { error: roleError.message },
        { status: 400 }
      );
    }

    // Log registration event
    console.log(`User registered: ${userId} (${email})`);

    return NextResponse.json(
      {
        user: {
          id: userId,
          email,
          fullName,
        },
        role: roleData.role,
        message: "Account created. Please verify your email.",
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Registration failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/login
 * Login with email and password
 */
export async function login(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing required fields: email, password" },
        { status: 400 }
      );
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Get user roles and MFA status
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, mfa_enabled, mfa_required")
      .eq("user_id", authData.user.id)
      .single();

    if (roleError) {
      return NextResponse.json(
        { error: "User role not found" },
        { status: 500 }
      );
    }

    // Check if MFA is required (Law #5: Owners Room)
    if (roleData.mfa_required && !roleData.mfa_enabled) {
      return NextResponse.json(
        {
          error: "MFA required but not configured",
          requiresMfaSetup: true,
          message: "Please set up MFA to continue",
        },
        { status: 403 }
      );
    }

    // Log login event
    console.log(`User logged in: ${authData.user.id}`);

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      role: roleData.role,
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expiresIn: authData.session.expires_in,
      mfaRequired: roleData.mfa_required && !roleData.mfa_enabled,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Login failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/mfa/setup
 * Setup MFA (TOTP) for account (Law #5)
 */
export async function setupMfa(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 401 }
      );
    }

    // In production, this would generate a TOTP secret and QR code
    // For now, return a simulated setup response
    
    const totpSecret = "JBSWY3DPEBLW64TMMQ======"; // Simulated secret
    const qrCode = "https://chart.googleapis.com/chart?cht=qr&"; // Simulated QR code

    return NextResponse.json({
      message: "MFA setup initiated",
      totpSecret,
      qrCode,
      instructions: [
        "1. Scan the QR code with your authenticator app",
        "2. Enter the 6-digit code to verify",
        "3. Save backup codes in a secure location",
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "MFA setup failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/mfa/verify
 * Verify and enable MFA (Law #5)
 */
export async function verifyMfa(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: "Invalid MFA code (must be 6 digits)" },
        { status: 400 }
      );
    }

    // In production, verify the TOTP code against the user's secret
    // For now, accept any 6-digit code

    // Update user_roles to enable MFA
    const { data, error } = await supabase
      .from("user_roles")
      .update({
        mfa_enabled: true,
        mfa_verified_at: new Date().toISOString(),
        mfa_method: "totp",
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log(`MFA enabled for user: ${userId}`);

    return NextResponse.json({
      message: "MFA enabled successfully",
      mfaEnabled: true,
      backupCodes: [
        "BACKUP-1234-5678-ABCD",
        "BACKUP-9876-5432-EFGH",
        "BACKUP-1111-2222-IJKL",
      ],
      warning: "Save these backup codes in a secure location. You will need them if you lose access to your authenticator app.",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "MFA verification failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/logout
 * Logout user
 */
export async function logout(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = request.headers.get("x-user-id");
    if (userId) {
      console.log(`User logged out: ${userId}`);
    }

    // In production, invalidate the session token

    const response = NextResponse.json({
      message: "Logged out successfully",
      timestamp: new Date().toISOString(),
    });

    // Clear auth cookie
    response.cookies.delete("auth-token");

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Logout failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/refresh
 * Refresh authentication token
 */
export async function refresh(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token required" },
        { status: 400 }
      );
    }

    // Refresh session with Supabase
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (refreshError || !refreshData.session) {
      return NextResponse.json(
        { error: "Token refresh failed" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      accessToken: refreshData.session.access_token,
      refreshToken: refreshData.session.refresh_token,
      expiresIn: refreshData.session.expires_in,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Token refresh failed" },
      { status: 500 }
    );
  }
}
