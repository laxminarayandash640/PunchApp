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
// GET /api/leave
// Employee: returns own requests
// Admin: returns all with optional filters (employee_id, status, start, end)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
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
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10))
    );
    const offset = (page - 1) * limit;

    const statusFilter = searchParams.get("status");
    const startFilter = searchParams.get("start");
    const endFilter = searchParams.get("end");
    const employeeIdFilter = searchParams.get("employee_id");

    let query = serviceClient
      .from("leave_requests")
      .select(
        `
        *,
        profiles:employee_id (
          id,
          full_name,
          employee_id,
          department,
          designation
        ),
        approved_by_profile:approved_by (
          id,
          full_name
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Scope to own records for employees
    if (!isAdmin) {
      query = query.eq("employee_id", user.id);
    } else if (employeeIdFilter) {
      query = query.eq("employee_id", employeeIdFilter);
    }

    if (statusFilter) query = query.eq("status", statusFilter);
    if (startFilter && isValidDate(startFilter))
      query = query.gte("start_date", startFilter);
    if (endFilter && isValidDate(endFilter))
      query = query.lte("end_date", endFilter);

    const { data: requests, error: queryError, count } = await query;

    if (queryError) {
      console.error("[GET /leave] query error:", queryError);
      return NextResponse.json(
        { error: "Failed to fetch leave requests." },
        { status: 500 }
      );
    }

    const totalRecords = count ?? 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return NextResponse.json(
      {
        data: requests ?? [],
        pagination: { page, limit, totalRecords, totalPages },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /leave] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/leave — employee: apply for leave
// Body: { leave_type, start_date, end_date, reason? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
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
    const body = await request.json();
    const { leave_type, start_date, end_date, reason } = body;

    // Validate required fields
    if (!leave_type || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Missing required fields: leave_type, start_date, end_date." },
        { status: 400 }
      );
    }

    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (start_date > end_date) {
      return NextResponse.json(
        { error: "start_date must be before or equal to end_date." },
        { status: 400 }
      );
    }

    // Reject past leave applications (must start today or in the future)
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date());

    if (start_date < today) {
      return NextResponse.json(
        { error: "Cannot apply for leave in the past." },
        { status: 400 }
      );
    }

    const allowedLeaveTypes = [
      "casual",
      "sick",
      "earned",
      "maternity",
      "paternity",
      "unpaid",
      "other",
    ];
    if (!allowedLeaveTypes.includes(leave_type)) {
      return NextResponse.json(
        { error: `Invalid leave_type. Allowed: ${allowedLeaveTypes.join(", ")}.` },
        { status: 400 }
      );
    }

    // Check for overlapping approved/pending leave requests
    const { data: overlapping, error: overlapError } = await serviceClient
      .from("leave_requests")
      .select("id, start_date, end_date, status")
      .eq("employee_id", user.id)
      .in("status", ["pending", "approved"])
      .lte("start_date", end_date)
      .gte("end_date", start_date)
      .limit(1);

    if (overlapError) {
      console.error("[POST /leave] overlap check error:", overlapError);
      return NextResponse.json(
        { error: "Failed to validate leave dates." },
        { status: 500 }
      );
    }

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        {
          error: "You already have a pending or approved leave overlapping these dates.",
          conflictingRequest: overlapping[0],
        },
        { status: 409 }
      );
    }

    // Calculate number of days (inclusive)
    const startMs = new Date(start_date).getTime();
    const endMs = new Date(end_date).getTime();
    const totalDays =
      Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

    const nowUTC = new Date().toISOString();

    const { data: leaveRequest, error: insertError } = await serviceClient
      .from("leave_requests")
      .insert({
        employee_id: user.id,
        leave_type,
        start_date,
        end_date,
        total_days: totalDays,
        reason: reason ?? null,
        status: "pending",
        approved_by: null,
        approved_at: null,
        created_at: nowUTC,
        updated_at: nowUTC,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[POST /leave] insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to submit leave request." },
        { status: 500 }
      );
    }

    // Audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: user.id,
      action: "apply_leave",
      target_table: "leave_requests",
      target_id: leaveRequest.id,
      details: { leave_type, start_date, end_date, total_days: totalDays },
      created_at: nowUTC,
    });

    return NextResponse.json({ leaveRequest }, { status: 201 });
  } catch (err) {
    console.error("[POST /leave] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
