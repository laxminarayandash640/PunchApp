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
// POST /api/attendance/punch-out
// ---------------------------------------------------------------------------
export async function POST() {
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
    const nowUTC = new Date().toISOString();

    // 2. Find the active session (punch_out IS NULL) for today
    const { data: activeSession, error: sessionFetchError } =
      await serviceClient
        .from("attendance_sessions")
        .select("*")
        .eq("employee_id", user.id)
        .eq("date", todayIST)
        .is("punch_out", null)
        .order("punch_in", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (sessionFetchError) {
      console.error("[punch-out] fetch session error:", sessionFetchError);
      return NextResponse.json(
        { error: "Failed to find active session." },
        { status: 500 }
      );
    }

    if (!activeSession) {
      return NextResponse.json(
        { error: "No active punch-in session found. Please punch in first." },
        { status: 409 }
      );
    }

    // 3. Calculate duration in seconds
    const punchInTime = new Date(activeSession.punch_in).getTime();
    const punchOutTime = new Date(nowUTC).getTime();
    const durationSeconds = Math.floor((punchOutTime - punchInTime) / 1000);

    // 4. Update the session record with punch_out and duration
    const { data: updatedSession, error: updateSessionError } =
      await serviceClient
        .from("attendance_sessions")
        .update({
          punch_out: nowUTC,
          duration_seconds: durationSeconds,
          updated_at: nowUTC,
        })
        .eq("id", activeSession.id)
        .select()
        .single();

    if (updateSessionError) {
      console.error("[punch-out] update session error:", updateSessionError);
      return NextResponse.json(
        { error: "Failed to record punch-out." },
        { status: 500 }
      );
    }

    // 5. Recalculate total working seconds: sum of all completed sessions today
    const { data: allSessions, error: allSessionsError } = await serviceClient
      .from("attendance_sessions")
      .select("duration_seconds")
      .eq("employee_id", user.id)
      .eq("date", todayIST)
      .not("duration_seconds", "is", null);

    if (allSessionsError) {
      console.error("[punch-out] fetch all sessions error:", allSessionsError);
      return NextResponse.json(
        { error: "Failed to recalculate total working time." },
        { status: 500 }
      );
    }

    const totalWorkingSeconds = (allSessions ?? []).reduce(
      (sum, s) => sum + (s.duration_seconds ?? 0),
      0
    );

    // 6. Update attendance record
    const { data: updatedAttendance, error: updateAttendanceError } =
      await serviceClient
        .from("attendance")
        .update({
          total_working_seconds: totalWorkingSeconds,
          updated_at: nowUTC,
        })
        .eq("employee_id", user.id)
        .eq("date", todayIST)
        .select()
        .single();

    if (updateAttendanceError) {
      console.error("[punch-out] update attendance error:", updateAttendanceError);
      return NextResponse.json(
        { error: "Failed to update attendance totals." },
        { status: 500 }
      );
    }

    // 7. Insert audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: user.id,
      action: "punch_out",
      entity: "attendance_sessions",
      entity_id: updatedSession.id,
      metadata: {
        date: todayIST,
        punch_in: activeSession.punch_in,
        punch_out: nowUTC,
        duration_seconds: durationSeconds,
        total_working_seconds: totalWorkingSeconds,
      },
      created_at: nowUTC,
    });

    return NextResponse.json(
      {
        session: updatedSession,
        attendance: updatedAttendance,
        totalSeconds: totalWorkingSeconds,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[punch-out] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
