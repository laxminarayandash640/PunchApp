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

// POST /api/attendance/punch-in
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
    const todayIST = getISTDateString(); // "YYYY-MM-DD"
    const nowUTC = new Date().toISOString();

    // 2. Check for an existing active session (punch_out IS NULL)
    const { data: activeSessions, error: activeSessionError } =
      await serviceClient
        .from("attendance_sessions")
        .select("id")
        .eq("employee_id", user.id)
        .is("punch_out", null)
        .limit(1);

    if (activeSessionError) {
      console.error("[punch-in] active session check error:", activeSessionError);
      return NextResponse.json(
        { error: `Failed to check active session: ${activeSessionError.message}` },
        { status: 500 }
      );
    }

    if (activeSessions && activeSessions.length > 0) {
      return NextResponse.json(
        { error: "Already punched in. Please punch out first." },
        { status: 409 }
      );
    }

    // 3. Get or create attendance record for today (column is attendance_date)
    let attendance: any = null;

    const { data: existingAttendance, error: fetchAttendanceError } =
      await serviceClient
        .from("attendance")
        .select("*")
        .eq("employee_id", user.id)
        .eq("attendance_date", todayIST)
        .maybeSingle();

    if (fetchAttendanceError) {
      console.error("[punch-in] fetch attendance error:", fetchAttendanceError);
      return NextResponse.json(
        { error: `Failed to fetch attendance record: ${fetchAttendanceError.message}` },
        { status: 500 }
      );
    }

    if (existingAttendance) {
      const { data: updatedAttendance, error: updateAttendanceError } =
        await serviceClient
          .from("attendance")
          .update({ status: "present", updated_at: nowUTC })
          .eq("id", existingAttendance.id)
          .select()
          .single();

      if (updateAttendanceError) {
        console.error("[punch-in] update attendance error:", updateAttendanceError);
        return NextResponse.json(
          { error: "Failed to update attendance record." },
          { status: 500 }
        );
      }
      attendance = updatedAttendance;
    } else {
      const { data: createdAttendance, error: createAttendanceError } =
        await serviceClient
          .from("attendance")
          .insert({
            employee_id: user.id,
            attendance_date: todayIST,
            status: "present",
            total_working_seconds: 0,
            created_at: nowUTC,
            updated_at: nowUTC,
          })
          .select()
          .single();

      if (createAttendanceError) {
        console.error("[punch-in] create attendance error:", createAttendanceError);
        return NextResponse.json(
          { error: `Failed to create attendance record: ${createAttendanceError.message}` },
          { status: 500 }
        );
      }
      attendance = createdAttendance;
    }

    // 4. Insert new attendance_session
    const { data: session, error: sessionError } = await serviceClient
      .from("attendance_sessions")
      .insert({
        employee_id: user.id,
        attendance_id: attendance.id,
        punch_in: nowUTC,
        punch_out: null,
        duration_seconds: null,
        created_at: nowUTC,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("[punch-in] insert session error:", sessionError);
      return NextResponse.json(
        { error: `Failed to create punch-in session: ${sessionError.message}` },
        { status: 500 }
      );
    }

    // 5. Insert audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: user.id,
      action: "punch_in",
      target_table: "attendance_sessions",
      target_id: session.id,
      details: {
        date: todayIST,
        punch_in: nowUTC,
        attendance_id: attendance.id,
      },
      created_at: nowUTC,
    });

    return NextResponse.json(
      { session, attendance },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[punch-in] unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
