import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getISTDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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
// GET /api/admin/attendance — admin only
// Query params: date (default today), department, status, page, limit
// Returns: all employees' attendance with profiles joined, ordered by last activity DESC
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

    // 2. Verify admin role
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin access required." },
        { status: 403 }
      );
    }

    // 3. Parse query params
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const departmentParam = searchParams.get("department");
    const statusParam = searchParams.get("status");
    const pageParam = searchParams.get("page") ?? "1";
    const limitParam = searchParams.get("limit") ?? "20";

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20));
    const offset = (page - 1) * limit;

    // Validate and resolve target date
    let targetDate = getISTDateString();
    if (dateParam) {
      if (!isValidDate(dateParam)) {
        return NextResponse.json(
          { error: "Invalid 'date' parameter. Expected YYYY-MM-DD." },
          { status: 400 }
        );
      }
      targetDate = dateParam;
    }

    // Validate status filter
    const allowedStatuses = ["present", "absent", "leave", "half_day", "holiday"];
    if (statusParam && !allowedStatuses.includes(statusParam)) {
      return NextResponse.json(
        {
          error: `Invalid 'status'. Allowed: ${allowedStatuses.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // 4. Build attendance query with sessions + profiles joined
    //    We want all attendance records for the given date with sessions
    let attendanceQuery = serviceClient
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
          avatar_url,
          is_active
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
      .eq("date", targetDate)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusParam) {
      attendanceQuery = attendanceQuery.eq("status", statusParam);
    }

    const {
      data: attendanceRecords,
      error: attendanceError,
      count: attendanceCount,
    } = await attendanceQuery;

    if (attendanceError) {
      console.error("[GET /admin/attendance] attendance query error:", attendanceError);
      return NextResponse.json(
        { error: "Failed to fetch attendance records." },
        { status: 500 }
      );
    }

    // 5. If department filter is applied, filter client-side since profiles is a join
    //    (Supabase does not support filtering on joined tables directly in this pattern)
    let records = attendanceRecords ?? [];
    if (departmentParam) {
      records = records.filter(
        (r: { profiles?: { department?: string } }) =>
          r.profiles?.department === departmentParam
      );
    }

    // Filter out records for inactive employees (unless explicitly querying all)
    records = records.filter(
      (r: { profiles?: { is_active?: boolean } }) =>
        r.profiles?.is_active !== false
    );

    // 6. For each attendance record, compute live total_seconds
    //    (completed sessions + live active session if punch_out IS NULL)
    const enrichedRecords = records.map(
      (record: {
        total_working_seconds: number;
        attendance_sessions: Array<{
          punch_in: string;
          punch_out: string | null;
          duration_seconds: number | null;
        }>;
        [key: string]: unknown;
      }) => {
        const sessions = record.attendance_sessions ?? [];

        const completedSeconds = sessions.reduce(
          (sum: number, s: { duration_seconds: number | null }) =>
            sum + (s.duration_seconds ?? 0),
          0
        );

        const activeSession = sessions.find(
          (s: { punch_out: string | null }) => s.punch_out === null
        );
        const liveElapsed = activeSession
          ? Math.floor(
              (Date.now() - new Date(activeSession.punch_in).getTime()) / 1000
            )
          : 0;

        const hasActiveSession = !!activeSession;
        const liveTotalSeconds = completedSeconds + liveElapsed;

        // Determine last activity timestamp
        const sortedSessions = [...sessions].sort(
          (
            a: { punch_in: string; punch_out: string | null },
            b: { punch_in: string; punch_out: string | null }
          ) =>
            new Date(b.punch_out ?? b.punch_in).getTime() -
            new Date(a.punch_out ?? a.punch_in).getTime()
        );
        const lastActivity =
          sortedSessions.length > 0
            ? sortedSessions[0].punch_out ?? sortedSessions[0].punch_in
            : null;

        return {
          ...record,
          liveTotalSeconds,
          hasActiveSession,
          lastActivity,
        };
      }
    );

    // Sort by last activity DESC (most recently active first),
    // pushing records without any activity to the end
    enrichedRecords.sort(
      (
        a: { lastActivity: string | null },
        b: { lastActivity: string | null }
      ) => {
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return (
          new Date(b.lastActivity).getTime() -
          new Date(a.lastActivity).getTime()
        );
      }
    );

    // 7. Fetch employees absent today (no attendance record exists)
    //    Build a list of employee IDs present in records to find the absent ones
    const presentEmployeeIds = new Set(
      enrichedRecords.map(
        (r: { employee_id: string }) => r.employee_id
      )
    );

    // Only fetch absent employees if no specific status filter, or if status=absent
    let absentEmployees: Array<Record<string, unknown>> = [];
    if (!statusParam || statusParam === "absent") {
      let absentQuery = serviceClient
        .from("profiles")
        .select(
          "id, full_name, employee_code, department, designation, avatar_url"
        )
        .eq("role", "employee")
        .eq("is_active", true);

      if (departmentParam) {
        absentQuery = absentQuery.eq("department", departmentParam);
      }

      const { data: allEmployees } = await absentQuery;

      absentEmployees = (allEmployees ?? [])
        .filter((emp: { id: string }) => !presentEmployeeIds.has(emp.id))
        .map((emp) => ({
          employee_id: emp.id,
          date: targetDate,
          status: "absent",
          total_working_seconds: 0,
          liveTotalSeconds: 0,
          hasActiveSession: false,
          lastActivity: null,
          attendance_sessions: [],
          profiles: emp,
        }));
    }

    // Merge present/leave/etc + absent, respecting pagination
    const allRecords =
      !statusParam || statusParam === "absent"
        ? [...enrichedRecords, ...absentEmployees]
        : enrichedRecords;

    const totalRecords =
      !statusParam || statusParam === "absent"
        ? (attendanceCount ?? 0) + absentEmployees.length
        : attendanceCount ?? 0;

    const totalPages = Math.ceil(totalRecords / limit);

    // 8. Summary counts for the requested date
    const [presentCount, leaveCount, activeSessionsCount] = await Promise.all([
      serviceClient
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("date", targetDate)
        .eq("status", "present"),

      serviceClient
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("date", targetDate)
        .eq("status", "leave"),

      serviceClient
        .from("attendance_sessions")
        .select("id", { count: "exact", head: true })
        .eq("date", targetDate)
        .is("punch_out", null),
    ]);

    return NextResponse.json(
      {
        data: allRecords,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        summary: {
          date: targetDate,
          present: presentCount.count ?? 0,
          onLeave: leaveCount.count ?? 0,
          currentlyWorking: activeSessionsCount.count ?? 0,
        },
        filters: {
          date: targetDate,
          department: departmentParam ?? null,
          status: statusParam ?? null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /admin/attendance] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
