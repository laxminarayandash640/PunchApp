import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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

function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// GET /api/admin/attendance
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

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const statusParam = searchParams.get("status");
    const pageParam = searchParams.get("page") ?? "1";
    const limitParam = searchParams.get("limit") ?? "50";

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(limitParam, 10) || 50));
    const offset = (page - 1) * limit;

    let targetDate = getISTDateString();
    if (dateParam && isValidDate(dateParam)) {
      targetDate = dateParam;
    }

    let attendanceQuery = serviceClient
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
          avatar_url,
          is_active
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
      .eq("attendance_date", targetDate)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusParam) {
      attendanceQuery = attendanceQuery.eq("status", statusParam);
    }

    const { data: records, error: queryError, count } = await attendanceQuery;

    if (queryError) {
      console.error("[admin-attendance] query error:", queryError);
      return NextResponse.json(
        { error: `Failed to fetch attendance records: ${queryError.message}` },
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
    console.error("[admin-attendance] unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
