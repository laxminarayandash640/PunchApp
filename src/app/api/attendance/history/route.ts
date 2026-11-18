import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSupabaseUserClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

function createSupabaseServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );
}

function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// ---------------------------------------------------------------------------
// GET /api/attendance/history
// Query params: start, end, employee_id (admin only), page, limit
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const userClient = createSupabaseUserClient();
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: valid session required." },
        { status: 401 }
      );
    }

    const serviceClient = createSupabaseServiceClient();

    // 2. Fetch the user's profile to determine role
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Could not determine user role." },
        { status: 403 }
      );
    }

    const isAdmin = profile.role === "admin";

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const employeeIdParam = searchParams.get("employee_id");
    const pageParam = searchParams.get("page") ?? "1";
    const limitParam = searchParams.get("limit") ?? "20";

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20));
    const offset = (page - 1) * limit;

    // 4. Validate date params
    if (startParam && !isValidDate(startParam)) {
      return NextResponse.json(
        { error: "Invalid 'start' date. Expected YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (endParam && !isValidDate(endParam)) {
      return NextResponse.json(
        { error: "Invalid 'end' date. Expected YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (startParam && endParam && startParam > endParam) {
      return NextResponse.json(
        { error: "'start' date must be before or equal to 'end' date." },
        { status: 400 }
      );
    }

    // 5. Determine target employee_id based on role
    let targetEmployeeId: string | null = null;

    if (isAdmin) {
      // Admin can query a specific employee or all employees
      targetEmployeeId = employeeIdParam ?? null;
    } else {
      // Employees can only see their own records
      targetEmployeeId = user.id;
    }

    // 6. Build attendance query with profile join
    let query = serviceClient
      .from("attendance")
      .select(
        `
        *,
        profiles:employee_id (
          id,
          full_name,
          employee_code,
          department,
          designation,
          avatar_url
        ),
        attendance_sessions (
          id,
          punch_in,
          punch_out,
          duration_seconds,
          created_at,
          updated_at
        )
      `,
        { count: "exact" }
      )
      .order("date", { ascending: false })
      .order("punch_in", {
        referencedTable: "attendance_sessions",
        ascending: true,
      })
      .range(offset, offset + limit - 1);

    if (targetEmployeeId) {
      query = query.eq("employee_id", targetEmployeeId);
    }
    if (startParam) {
      query = query.gte("date", startParam);
    }
    if (endParam) {
      query = query.lte("date", endParam);
    }

    const { data: records, error: queryError, count } = await query;

    if (queryError) {
      console.error("[history] query error:", queryError);
      return NextResponse.json(
        { error: "Failed to fetch attendance history." },
        { status: 500 }
      );
    }

    const totalRecords = count ?? 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return NextResponse.json(
      {
        data: records ?? [],
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        filters: {
          start: startParam ?? null,
          end: endParam ?? null,
          employee_id: targetEmployeeId,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[history] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
