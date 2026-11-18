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

// GET /api/employees
export async function GET(request: NextRequest) {
  try {
    const serviceClient = createSupabaseServiceClient();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department");
    const search = searchParams.get("search");

    let query = serviceClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (department && department !== "all") {
      query = query.eq("department", department);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,employee_id.ilike.%${search}%`
      );
    }

    const { data: employees, error } = await query;

    if (error) {
      console.error("[GET /employees] error:", error);
      return NextResponse.json(
        { error: "Failed to fetch employees." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { employees: employees ?? [] },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[GET /employees] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// POST /api/employees
export async function POST(request: NextRequest) {
  try {
    const serviceClient = createSupabaseServiceClient();
    const body = await request.json();
    const { email, password, full_name, role = "employee", department, designation, employee_id, joining_date } = body;

    if (!email || !full_name) {
      return NextResponse.json(
        { error: "Missing required fields: email, full_name." },
        { status: 400 }
      );
    }

    // 1. Create Supabase Auth user
    const { data: authData, error: authCreateError } =
      await serviceClient.auth.admin.createUser({
        email,
        password: password || "Welcome@123",
        email_confirm: true,
        user_metadata: { full_name, role },
      });

    if (authCreateError || !authData?.user) {
      console.error("[POST /employees] auth error:", authCreateError);
      return NextResponse.json(
        { error: authCreateError?.message || "Failed to create user account." },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // 2. Upsert profile record
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .upsert({
        id: userId,
        email,
        full_name,
        role,
        department: department || "Engineering",
        designation: designation || "Staff",
        employee_id: employee_id || `EMP${Math.floor(Math.random() * 900 + 100)}`,
        joining_date: joining_date || new Date().toISOString().split("T")[0],
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error("[POST /employees] profile error:", profileError);
    }

    return NextResponse.json({ employee: profile }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /employees] error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error." }, { status: 500 });
  }
}
