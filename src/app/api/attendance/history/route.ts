import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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

// GET /api/attendance/history
export async function GET(request: NextRequest) {
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

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const employeeIdParam = searchParams.get("employee_id");
    const pageParam = searchParams.get("page") ?? "1";
    const limitParam = searchParams.get("limit") ?? "20";

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20));
    const offset = (page - 1) * limit;

    let targetEmployeeId: string | null = null;
    if (isAdmin) {
      targetEmployeeId = employeeIdParam ?? null;
    } else {
      targetEmployeeId = user.id;
    }

    let query = serviceClient
      .from("attendance")
      .select(
        `
        *,
        profile:employee_id (
          id,
          full_name,
          employee_id,
          department,
          designation,
          avatar_url
        ),
        sessions:attendance_sessions (
          id,
          punch_in,
          punch_out,
          duration_seconds,
          created_at
        )
      `,
        { count: "exact" }
      )
      .order("attendance_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (targetEmployeeId) {
      query = query.eq("employee_id", targetEmployeeId);
    }
    if (startParam && isValidDate(startParam)) {
      query = query.gte("attendance_date", startParam);
    }
    if (endParam && isValidDate(endParam)) {
      query = query.lte("attendance_date", endParam);
    }

    const { data: records, error: queryError, count } = await query;

    if (queryError) {
      console.error("[history] query error:", queryError);
      return NextResponse.json(
        { error: `Failed to fetch attendance history: ${queryError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        records: records ?? [],
        total: count ?? 0,
        page,
        limit,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[history] unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
