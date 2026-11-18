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
  | { user: { id: string }; profile: { role: string } }
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

  return { user, profile };
}

/** Generate next employee code like EMP001, EMP002 */
async function generateEmployeeCode(
  serviceClient: ReturnType<typeof createSupabaseServiceClient>
): Promise<string> {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("employee_code")
    .not("employee_code", "is", null)
    .order("employee_code", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.employee_code) {
    return "EMP001";
  }

  const match = data.employee_code.match(/^EMP(\d+)$/);
  if (!match) return "EMP001";

  const nextNum = parseInt(match[1], 10) + 1;
  return `EMP${String(nextNum).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// GET /api/employees — admin only
// Query params: page, limit, department, is_active, search
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const userClient = createSupabaseUserClient();
    const serviceClient = createSupabaseServiceClient();

    const authResult = await requireAdmin(userClient, serviceClient);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10))
    );
    const offset = (page - 1) * limit;
    const department = searchParams.get("department");
    const isActiveParam = searchParams.get("is_active");
    const search = searchParams.get("search");

    let query = serviceClient
      .from("profiles")
      .select("*", { count: "exact" })
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (department) query = query.eq("department", department);
    if (isActiveParam !== null) {
      query = query.eq("is_active", isActiveParam === "true");
    }
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,employee_code.ilike.%${search}%`
      );
    }

    const { data: employees, error, count } = await query;

    if (error) {
      console.error("[GET /employees] query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch employees." },
        { status: 500 }
      );
    }

    const totalRecords = count ?? 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return NextResponse.json(
      {
        data: employees ?? [],
        pagination: { page, limit, totalRecords, totalPages },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /employees] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/employees — admin only
// Body: { email, full_name, role, department, designation, phone, employee_code? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const userClient = createSupabaseUserClient();
    const serviceClient = createSupabaseServiceClient();

    const authResult = await requireAdmin(userClient, serviceClient);
    if (authResult instanceof NextResponse) return authResult;

    const { user: adminUser } = authResult as {
      user: { id: string };
      profile: { role: string };
    };

    const body = await request.json();
    const { email, full_name, role, department, designation, phone } = body;
    let { employee_code } = body;

    // Validate required fields
    if (!email || !full_name) {
      return NextResponse.json(
        { error: "Missing required fields: email, full_name." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    const allowedRoles = ["employee", "admin", "manager"];
    const resolvedRole = allowedRoles.includes(role) ? role : "employee";

    // Auto-generate employee_code if not provided
    if (!employee_code) {
      employee_code = await generateEmployeeCode(serviceClient);
    }

    // Check employee_code uniqueness
    const { data: existingCode } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("employee_code", employee_code)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json(
        { error: `Employee code '${employee_code}' is already in use.` },
        { status: 409 }
      );
    }

    // Create Supabase Auth user via admin API (service role)
    const { data: authData, error: authCreateError } =
      await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name, role: resolvedRole },
      });

    if (authCreateError || !authData?.user) {
      console.error("[POST /employees] auth create error:", authCreateError);
      if (authCreateError?.message?.includes("already registered")) {
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create auth user." },
        { status: 500 }
      );
    }

    const newUserId = authData.user.id;
    const nowUTC = new Date().toISOString();

    // Insert profile record
    const { data: profile, error: profileInsertError } = await serviceClient
      .from("profiles")
      .insert({
        id: newUserId,
        email,
        full_name,
        role: resolvedRole,
        department: department ?? null,
        designation: designation ?? null,
        phone: phone ?? null,
        employee_code,
        is_active: true,
        created_at: nowUTC,
        updated_at: nowUTC,
      })
      .select()
      .single();

    if (profileInsertError) {
      console.error("[POST /employees] profile insert error:", profileInsertError);
      // Attempt cleanup of auth user
      await serviceClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: "Failed to create employee profile." },
        { status: 500 }
      );
    }

    // Send password setup invitation email
    const { error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/set-password`,
      });

    if (inviteError) {
      // Non-fatal: profile is created, just log the warning
      console.warn("[POST /employees] invite email warning:", inviteError.message);
    }

    // Audit log
    await serviceClient.from("audit_logs").insert({
      actor_id: adminUser.id,
      action: "create_employee",
      entity: "profiles",
      entity_id: newUserId,
      metadata: { email, full_name, role: resolvedRole, employee_code },
      created_at: nowUTC,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    console.error("[POST /employees] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
