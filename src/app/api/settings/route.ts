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

// ---------------------------------------------------------------------------
// GET /api/settings — any authenticated user
// ---------------------------------------------------------------------------
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

    const { data: settings, error: settingsError } = await serviceClient
      .from("company_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("[GET /settings] fetch error:", settingsError);
      return NextResponse.json(
        { error: "Failed to fetch settings." },
        { status: 500 }
      );
    }

    // Return default settings structure if none exist yet
    if (!settings) {
      return NextResponse.json(
        {
          settings: {
            company_name: "",
            work_start_time: "09:00",
            work_end_time: "18:00",
            work_hours_per_day: 8,
            timezone: "Asia/Kolkata",
            weekend_days: ["Saturday", "Sunday"],
            casual_leave_per_year: 12,
            sick_leave_per_year: 12,
            earned_leave_per_year: 15,
            allow_early_punch_in_minutes: 30,
            auto_punch_out_enabled: false,
            auto_punch_out_time: "23:59",
            notify_on_late_arrival: true,
            late_arrival_threshold_minutes: 15,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    console.error("[GET /settings] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/settings — admin only: upsert single settings row
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();

    // Allowlist updatable settings keys
    const allowedKeys = [
      "company_name",
      "work_start_time",
      "work_end_time",
      "work_hours_per_day",
      "timezone",
      "weekend_days",
      "casual_leave_per_year",
      "sick_leave_per_year",
      "earned_leave_per_year",
      "allow_early_punch_in_minutes",
      "auto_punch_out_enabled",
      "auto_punch_out_time",
      "notify_on_late_arrival",
      "late_arrival_threshold_minutes",
      "logo_url",
      "address",
      "contact_email",
      "contact_phone",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid settings fields provided." },
        { status: 400 }
      );
    }

    // Validate time formats (HH:MM)
    const timeFields = ["work_start_time", "work_end_time", "auto_punch_out_time"];
    for (const field of timeFields) {
      if (field in updates && !/^\d{2}:\d{2}$/.test(updates[field] as string)) {
        return NextResponse.json(
          { error: `Invalid time format for '${field}'. Expected HH:MM.` },
          { status: 400 }
        );
      }
    }

    // Validate weekend_days
    if ("weekend_days" in updates) {
      const validDays = [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday",
      ];
      const days = updates.weekend_days as string[];
      if (!Array.isArray(days) || days.some((d) => !validDays.includes(d))) {
        return NextResponse.json(
          { error: "Invalid weekend_days. Must be an array of valid day names." },
          { status: 400 }
        );
      }
    }

    const nowUTC = new Date().toISOString();
    updates.updated_at = nowUTC;
    updates.updated_by = user.id;

    // Fetch existing settings row id for upsert
    const { data: existing } = await serviceClient
      .from("company_settings")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let upsertData: Record<string, unknown>;

    if (existing) {
      upsertData = { id: existing.id, ...updates };
    } else {
      upsertData = { ...updates, created_at: nowUTC };
    }

    const { data: upserted, error: upsertError } = await serviceClient
      .from("company_settings")
      .upsert(upsertData, { onConflict: "id" })
      .select()
      .single();

    if (upsertError) {
      console.error("[PATCH /settings] upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to update settings." },
        { status: 500 }
      );
    }

    // Audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: user.id,
      action: "update_settings",
      entity: "company_settings",
      entity_id: upserted.id,
      metadata: { changes: updates },
      created_at: nowUTC,
    });

    return NextResponse.json({ settings: upserted }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /settings] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
