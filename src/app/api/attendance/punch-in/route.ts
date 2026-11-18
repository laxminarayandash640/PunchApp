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
// POST /api/attendance/punch-in
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
    const todayIST = getISTDateString(); // "YYYY-MM-DD"
    const nowUTC = new Date().toISOString();

    // 2. Check for an existing active session (punch_out IS NULL) today
    const { data: activeSessions, error: activeSessionError } =
      await serviceClient
        .from("attendance_sessions")
        .select("id")
        .eq("employee_id", user.id)
        .eq("date", todayIST)
        .is("punch_out", null)
        .limit(1);

    if (activeSessionError) {
      console.error("[punch-in] active session check error:", activeSessionError);
      return NextResponse.json(
        { error: "Failed to check active session." },
        { status: 500 }
      );
    }

    if (activeSessions && activeSessions.length > 0) {
      return NextResponse.json(
        { error: "Already punched in. Please punch out first." },
        { status: 409 }
      );
    }

    // 3. Get or create attendance record for today
    let attendance: Record<string, unknown> | null = null;

    const { data: existingAttendance, error: fetchAttendanceError } =
      await serviceClient
        .from("attendance")
        .select("*")
        .eq("employee_id", user.id)
        .eq("date", todayIST)
        .maybeSingle();

    if (fetchAttendanceError) {
      console.error("[punch-in] fetch attendance error:", fetchAttendanceError);
      return NextResponse.json(
        { error: "Failed to fetch attendance record." },
        { status: 500 }
      );
    }

    if (existingAttendance) {
      // Update status to present and touch updated_at
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
      // Create a fresh attendance record
      const { data: createdAttendance, error: createAttendanceError } =
        await serviceClient
          .from("attendance")
          .insert({
            employee_id: user.id,
            date: todayIST,
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
          { error: "Failed to create attendance record." },
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
        attendance_id: (attendance as { id: string }).id,
        date: todayIST,
        punch_in: nowUTC,
        punch_out: null,
        duration_seconds: null,
        created_at: nowUTC,
        updated_at: nowUTC,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("[punch-in] insert session error:", sessionError);
      return NextResponse.json(
        { error: "Failed to create punch-in session." },
        { status: 500 }
      );
    }

    // 5. Insert audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: user.id,
      action: "punch_in",
      entity: "attendance_sessions",
      entity_id: session.id,
      metadata: {
        date: todayIST,
        punch_in: nowUTC,
        attendance_id: (attendance as { id: string }).id,
      },
      created_at: nowUTC,
    });

    return NextResponse.json(
      { session, attendance },
      { status: 201 }
    );
  } catch (err) {
    console.error("[punch-in] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
