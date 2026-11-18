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

// GET /api/attendance/today
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
    const todayIST = getISTDateString();

    // 2. Query attendance record for today (attendance_date)
    const { data: attendance, error: attendanceError } = await serviceClient
      .from("attendance")
      .select("*")
      .eq("employee_id", user.id)
      .eq("attendance_date", todayIST)
      .maybeSingle();

    if (attendanceError) {
      console.error("[today] fetch attendance error:", attendanceError);
      return NextResponse.json(
        { error: `Failed to fetch attendance record: ${attendanceError.message}` },
        { status: 500 }
      );
    }

    if (!attendance) {
      return NextResponse.json(
        {
          attendance: null,
          sessions: [],
          hasActiveSession: false,
          totalSeconds: 0,
        },
        { status: 200 }
      );
    }

    // 3. Query all sessions for this attendance record
    const { data: sessions, error: sessionsError } = await serviceClient
      .from("attendance_sessions")
      .select("*")
      .eq("attendance_id", attendance.id)
      .order("punch_in", { ascending: true });

    if (sessionsError) {
      console.error("[today] fetch sessions error:", sessionsError);
      return NextResponse.json(
        { error: "Failed to fetch sessions." },
        { status: 500 }
      );
    }

    const sessionList = sessions ?? [];
    const hasActiveSession = sessionList.some((s) => s.punch_out === null);

    const completedSeconds = sessionList.reduce(
      (sum, s) => sum + (s.duration_seconds ?? 0),
      0
    );

    const activeSession = sessionList.find((s) => s.punch_out === null);
    const liveElapsed = activeSession
      ? Math.floor((Date.now() - new Date(activeSession.punch_in).getTime()) / 1000)
      : 0;

    const totalSeconds = completedSeconds + liveElapsed;

    return NextResponse.json(
      {
        attendance: {
          ...attendance,
          sessions: sessionList,
        },
        sessions: sessionList,
        hasActiveSession,
        totalSeconds,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[today] unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
