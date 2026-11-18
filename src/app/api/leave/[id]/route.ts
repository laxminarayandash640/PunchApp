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

type RouteContext = { params: { id: string } };

/** Generates all YYYY-MM-DD dates in [startDate, endDate] inclusive */
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// GET /api/leave/[id] — authenticated user (own) or admin
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: RouteContext) {
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
    const { id } = params;

    const { data: leaveRequest, error: fetchError } = await serviceClient
      .from("leave_requests")
      .select(
        `
        *,
        profiles:employee_id (
          id,
          full_name,
          employee_code,
          department,
          designation
        ),
        approved_by_profile:approved_by (
          id,
          full_name
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("[GET /leave/[id]] fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch leave request." },
        { status: 500 }
      );
    }

    if (!leaveRequest) {
      return NextResponse.json(
        { error: "Leave request not found." },
        { status: 404 }
      );
    }

    // Fetch profile to check role
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    // Employees can only view their own requests
    if (!isAdmin && leaveRequest.employee_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: you can only view your own leave requests." },
        { status: 403 }
      );
    }

    return NextResponse.json({ leaveRequest }, { status: 200 });
  } catch (err) {
    console.error("[GET /leave/[id]] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/leave/[id] — admin only: approve or reject
// Body: { status: "approved" | "rejected", rejection_reason? }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

    // Verify admin role
    const { data: adminProfile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: admin access required." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { status, rejection_reason } = body;

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'approved' or 'rejected'." },
        { status: 400 }
      );
    }

    // Fetch the leave request
    const { data: leaveRequest, error: fetchError } = await serviceClient
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: "Leave request not found." },
        { status: 404 }
      );
    }

    if (leaveRequest.status !== "pending") {
      return NextResponse.json(
        {
          error: `Leave request is already '${leaveRequest.status}'. Only pending requests can be actioned.`,
        },
        { status: 409 }
      );
    }

    const nowUTC = new Date().toISOString();

    // Update leave request
    const { data: updatedRequest, error: updateError } = await serviceClient
      .from("leave_requests")
      .update({
        status,
        approved_by: user.id,
        approved_at: nowUTC,
        rejection_reason: status === "rejected" ? (rejection_reason ?? null) : null,
        updated_at: nowUTC,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /leave/[id]] update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update leave request." },
        { status: 500 }
      );
    }

    // If approved: mark attendance records for those dates as 'leave'
    if (status === "approved") {
      const datesToMark = getDatesInRange(
        leaveRequest.start_date,
        leaveRequest.end_date
      );

      for (const date of datesToMark) {
        // Check if attendance record exists for this date
        const { data: existing } = await serviceClient
          .from("attendance")
          .select("id")
          .eq("employee_id", leaveRequest.employee_id)
          .eq("date", date)
          .maybeSingle();

        if (existing) {
          // Update existing record to 'leave'
          await serviceClient
            .from("attendance")
            .update({ status: "leave", updated_at: nowUTC })
            .eq("id", existing.id);
        } else {
          // Create a new attendance record with status 'leave'
          await serviceClient.from("attendance").insert({
            employee_id: leaveRequest.employee_id,
            date,
            status: "leave",
            total_working_seconds: 0,
            created_at: nowUTC,
            updated_at: nowUTC,
          });
        }
      }
    }

    // Audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: user.id,
      action: `leave_${status}`,
      entity: "leave_requests",
      entity_id: id,
      metadata: {
        employee_id: leaveRequest.employee_id,
        start_date: leaveRequest.start_date,
        end_date: leaveRequest.end_date,
        status,
        rejection_reason: rejection_reason ?? null,
      },
      created_at: nowUTC,
    });

    return NextResponse.json({ leaveRequest: updatedRequest }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /leave/[id]] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
