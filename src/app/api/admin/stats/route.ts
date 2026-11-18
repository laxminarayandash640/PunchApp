import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

// GET /api/admin/stats — admin only
export async function GET() {
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

    const todayIST = getISTDateString();

    const [
      totalEmployeesResult,
      presentTodayResult,
      currentlyWorkingResult,
      attendanceRecordsToday,
    ] = await Promise.all([
      // Total active employees
      serviceClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      // Present today (column is attendance_date)
      serviceClient
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("attendance_date", todayIST)
        .eq("status", "present"),

      // Currently working (active punch-in sessions where punch_out is null)
      serviceClient
        .from("attendance_sessions")
        .select("id", { count: "exact", head: true })
        .is("punch_out", null),

      // All attendance for today to sum working seconds
      serviceClient
        .from("attendance")
        .select("total_working_seconds")
        .eq("attendance_date", todayIST),
    ]);

    const totalEmployees = totalEmployeesResult.count ?? 0;
    const presentToday = presentTodayResult.count ?? 0;
    const currentlyWorking = currentlyWorkingResult.count ?? 0;
    const absentToday = Math.max(0, totalEmployees - presentToday);

    const totalWorkingHoursToday = (attendanceRecordsToday.data ?? []).reduce(
      (sum, r) => sum + (r.total_working_seconds ?? 0),
      0
    );

    return NextResponse.json(
      {
        stats: {
          totalEmployees,
          presentToday,
          absentToday,
          currentlyWorking,
          totalWorkingHoursToday,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[admin-stats] unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
