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

async function requireAdmin(
  userClient: ReturnType<typeof createSupabaseUserClient>,
  serviceClient: ReturnType<typeof createSupabaseServiceClient>
): Promise<
  | { user: { id: string } }
  | NextResponse
> {
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

  return { user };
}

type RouteContext = { params: { id: string } };

// ---------------------------------------------------------------------------
// GET /api/employees/[id] — admin only
// Returns employee profile with 30-day attendance summary
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const userClient = createSupabaseUserClient();
    const serviceClient = createSupabaseServiceClient();

    const authResult = await requireAdmin(userClient, serviceClient);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = params;

    // Fetch profile
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (profileError) {
      console.error("[GET /employees/[id]] profile fetch error:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch employee." },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    // 30-day attendance summary
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    const { data: attendanceSummary, error: summaryError } =
      await serviceClient
        .from("attendance")
        .select("attendance_date, status, total_working_seconds")
        .eq("employee_id", id)
        .gte("attendance_date", startDate)
        .lte("attendance_date", today)
        .order("attendance_date", { ascending: false });

    if (summaryError) {
      console.error("[GET /employees/[id]] summary error:", summaryError);
    }

    const summary = attendanceSummary ?? [];
    const presentDays = summary.filter((r) => r.status === "present").length;
    const leaveDays = summary.filter((r) => r.status === "leave").length;
    const absentDays = summary.filter((r) => r.status === "absent").length;
    const totalWorkingSeconds = summary.reduce(
      (s, r) => s + (r.total_working_seconds ?? 0),
      0
    );

    return NextResponse.json(
      {
        profile,
        attendanceSummary: summary,
        stats: {
          presentDays,
          leaveDays,
          absentDays,
          totalWorkingSeconds,
          avgDailySeconds:
            presentDays > 0 ? Math.floor(totalWorkingSeconds / presentDays) : 0,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /employees/[id]] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/employees/[id] — admin only
// Updateable fields: full_name, department, designation, phone, role, is_active
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userClient = createSupabaseUserClient();
    const serviceClient = createSupabaseServiceClient();

    const authResult = await requireAdmin(userClient, serviceClient);
    if (authResult instanceof NextResponse) return authResult;
    const { user: adminUser } = authResult as { user: { id: string } };

    const { id } = params;

    // Confirm employee exists
    const { data: existing, error: existError } = await serviceClient
      .from("profiles")
      .select("id, is_active")
      .eq("id", id)
      .maybeSingle();

    if (existError || !existing) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Allowlist updatable fields
    const allowed = [
      "full_name",
      "department",
      "designation",
      "phone",
      "role",
      "avatar_url",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update." },
        { status: 400 }
      );
    }

    if ("role" in updates) {
      const allowedRoles = ["employee", "admin", "manager"];
      if (!allowedRoles.includes(updates.role as string)) {
        return NextResponse.json(
          { error: `Invalid role. Allowed: ${allowedRoles.join(", ")}.` },
          { status: 400 }
        );
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedProfile, error: updateError } = await serviceClient
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /employees/[id]] update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update employee." },
        { status: 500 }
      );
    }

    // Also update auth user metadata if role changed
    if ("role" in updates) {
      await serviceClient.auth.admin.updateUserById(id, {
        user_metadata: { role: updates.role },
      });
    }

    // Audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: adminUser.id,
      action: "update_employee",
      target_table: "profiles",
      target_id: id,
      details: { changes: updates },
      created_at: updates.updated_at,
    });

    return NextResponse.json({ profile: updatedProfile }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /employees/[id]] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/employees/[id] — admin only (soft delete: is_active = false)
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const userClient = createSupabaseUserClient();
    const serviceClient = createSupabaseServiceClient();

    const authResult = await requireAdmin(userClient, serviceClient);
    if (authResult instanceof NextResponse) return authResult;
    const { user: adminUser } = authResult as { user: { id: string } };

    const { id } = params;

    // Prevent self-deactivation
    if (id === adminUser.id) {
      return NextResponse.json(
        { error: "Admins cannot deactivate their own account." },
        { status: 400 }
      );
    }

    const { data: existing, error: existError } = await serviceClient
      .from("profiles")
      .select("id, is_active, full_name")
      .eq("id", id)
      .maybeSingle();

    if (existError || !existing) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    if (!existing.is_active) {
      return NextResponse.json(
        { error: "Employee is already deactivated." },
        { status: 409 }
      );
    }

    const nowUTC = new Date().toISOString();

    const { data: deactivated, error: deactivateError } = await serviceClient
      .from("profiles")
      .update({ is_active: false, updated_at: nowUTC })
      .eq("id", id)
      .select()
      .single();

    if (deactivateError) {
      console.error("[DELETE /employees/[id]] deactivate error:", deactivateError);
      return NextResponse.json(
        { error: "Failed to deactivate employee." },
        { status: 500 }
      );
    }

    // Revoke Supabase auth session (ban user)
    await serviceClient.auth.admin.updateUserById(id, {
      ban_duration: "876600h", // ~100 years effectively permanent
    });

    // Audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: adminUser.id,
      action: "deactivate_employee",
      target_table: "profiles",
      target_id: id,
      details: { full_name: existing.full_name },
      created_at: nowUTC,
    });

    return NextResponse.json(
      { message: "Employee deactivated successfully.", profile: deactivated },
      { status: 200 }
    );
  } catch (err) {
    console.error("[DELETE /employees/[id]] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
