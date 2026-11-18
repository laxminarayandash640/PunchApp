import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

// ---------------------------------------------------------------------------
// GET /api/admin/stats — admin only
// ---------------------------------------------------------------------------
export async function GET() {
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

    const todayIST = getISTDateString();

    // 3. Run all queries in parallel using Promise.all
    const [
      totalEmployeesResult,
      presentTodayResult,
      onLeaveTodayResult,
      currentlyWorkingResult,
      workingSecondsResult,
      pendingLeaveResult,
      newEmployeesResult,
    ] = await Promise.all([
      // Total active employees with role='employee'
      serviceClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "employee")
        .eq("is_active", true),

      // Present today
      serviceClient
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("date", todayIST)
        .eq("status", "present"),

      // On leave today
      serviceClient
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("date", todayIST)
        .eq("status", "leave"),

      // Currently working (active punch-in sessions today)
      serviceClient
        .from("attendance_sessions")
        .select("id", { count: "exact", head: true })
        .eq("date", todayIST)
        .is("punch_out", null),

      // Sum of total_working_seconds for today
      serviceClient
        .from("attendance")
        .select("total_working_seconds")
        .eq("date", todayIST)
        .eq("status", "present"),

      // Pending leave requests
      serviceClient
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      // New employees this month
      serviceClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "employee")
        .eq("is_active", true)
        .gte(
          "created_at",
          new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ).toISOString()
        ),
    ]);

    const totalEmployees = totalEmployeesResult.count ?? 0;
    const presentToday = presentTodayResult.count ?? 0;
    const onLeave = onLeaveTodayResult.count ?? 0;
    const currentlyWorking = currentlyWorkingResult.count ?? 0;
    const absentToday = Math.max(0, totalEmployees - presentToday - onLeave);
    const pendingLeaveCount = pendingLeaveResult.count ?? 0;
    const newEmployeesThisMonth = newEmployeesResult.count ?? 0;

    // Sum working seconds from result rows
    const totalWorkingSecondsToday = (
      workingSecondsResult.data ?? []
    ).reduce(
      (sum: number, row: { total_working_seconds: number | null }) =>
        sum + (row.total_working_seconds ?? 0),
      0
    );

    const totalWorkingHoursToday = +(totalWorkingSecondsToday / 3600).toFixed(2);

    // Attendance rate (% of employees who punched in today)
    const attendanceRate =
      totalEmployees > 0
        ? +((presentToday / totalEmployees) * 100).toFixed(1)
        : 0;

    return NextResponse.json(
      {
        stats: {
          totalEmployees,
          presentToday,
          absentToday,
          onLeave,
          currentlyWorking,
          totalWorkingSecondsToday,
          totalWorkingHoursToday,
          attendanceRate,
          pendingLeaveRequests: pendingLeaveCount,
          newEmployeesThisMonth,
        },
        generatedAt: new Date().toISOString(),
        dateIST: todayIST,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /admin/stats] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
