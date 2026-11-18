-- =============================================================================
-- Employee Attendance & Timesheet Management System
-- Supabase PostgreSQL Schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- gen_random_uuid() is built-in since PG 13 (Supabase default), but
-- uuid-ossp gives us uuid_generate_v4() as a fallback.

-- ---------------------------------------------------------------------------
-- 1. PROFILES  (extends auth.users 1-to-1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  employee_id     text        UNIQUE NOT NULL,
  full_name       text        NOT NULL,
  email           text        NOT NULL,
  department      text,
  designation     text,
  role            text        NOT NULL DEFAULT 'employee'
                              CHECK (role IN ('admin', 'employee')),
  joining_date    date,
  is_active       boolean     NOT NULL DEFAULT true,
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS 'One-to-one extension of auth.users with HR data.';
COMMENT ON COLUMN public.profiles.role IS 'admin | employee';

-- ---------------------------------------------------------------------------
-- 2. ATTENDANCE  (one record per employee per calendar day)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id            uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  attendance_date        date        NOT NULL,
  status                 text        NOT NULL DEFAULT 'present'
                                     CHECK (status IN ('present','absent','leave','holiday')),
  total_working_seconds  integer     NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, attendance_date)
);

COMMENT ON TABLE  public.attendance IS 'Aggregated daily attendance record per employee.';
COMMENT ON COLUMN public.attendance.total_working_seconds IS 'Sum of duration_seconds across all sessions for that day.';

-- ---------------------------------------------------------------------------
-- 3. ATTENDANCE_SESSIONS  (individual punch-in / punch-out pairs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id     uuid        REFERENCES public.attendance (id) ON DELETE CASCADE,
  employee_id       uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  punch_in          timestamptz NOT NULL,
  punch_out         timestamptz,
  duration_seconds  integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.attendance_sessions IS 'Individual clock-in / clock-out events within a working day.';
COMMENT ON COLUMN public.attendance_sessions.duration_seconds IS 'Populated automatically when punch_out is recorded.';

-- ---------------------------------------------------------------------------
-- 4. LEAVE_REQUESTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  start_date   date        NOT NULL,
  end_date     date        NOT NULL,
  reason       text,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected')),
  approved_by  uuid        REFERENCES public.profiles (id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.leave_requests IS 'Employee leave applications and their approval state.';

-- ---------------------------------------------------------------------------
-- 5. COMPANY_SETTINGS  (single-row configuration table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_settings (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name             text        NOT NULL DEFAULT 'My Company',
  work_start_time          time        NOT NULL DEFAULT '09:00:00',
  work_end_time            time        NOT NULL DEFAULT '18:00:00',
  expected_working_hours   numeric(4,2) NOT NULL DEFAULT 8.0,
  grace_period_minutes     integer     NOT NULL DEFAULT 15,
  timezone                 text        NOT NULL DEFAULT 'Asia/Kolkata',
  working_days             integer[]   NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  allow_multiple_sessions  boolean     NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.company_settings IS 'Global company / policy configuration. Should contain exactly one row.';
COMMENT ON COLUMN public.company_settings.working_days IS '1=Mon … 7=Sun (ISO DOW). Default Mon-Fri.';

-- ---------------------------------------------------------------------------
-- 6. AUDIT_LOGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid        REFERENCES public.profiles (id) ON DELETE SET NULL,
  action       text        NOT NULL,
  target_table text,
  target_id    uuid,
  details      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 'Immutable append-only log of significant system actions.';

-- ---------------------------------------------------------------------------
-- 7. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date
  ON public.attendance (employee_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_attendance_id
  ON public.attendance_sessions (attendance_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_employee_id
  ON public.attendance_sessions (employee_id);

CREATE INDEX IF NOT EXISTS idx_profiles_employee_id
  ON public.profiles (employee_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status
  ON public.leave_requests (employee_id, status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (actor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. HELPER: generic updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach updated_at trigger to tables that have the column
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','attendance','leave_requests','company_settings']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;
       CREATE TRIGGER trg_set_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();',
      t, t
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. TRIGGER: auto-create profile row when a new auth user signs up
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id text;
BEGIN
  -- Generate a sequential employee ID like EMP0001
  SELECT 'EMP' || LPAD(CAST(COUNT(*) + 1 AS text), 4, '0')
  INTO   v_emp_id
  FROM   public.profiles;

  INSERT INTO public.profiles (
    id,
    employee_id,
    full_name,
    email,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_emp_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- ---------------------------------------------------------------------------
-- 10. TRIGGER: calculate duration_seconds when punch_out is set/updated
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_calculate_session_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only recalculate when punch_out changes from NULL or is updated
  IF NEW.punch_out IS NOT NULL THEN
    NEW.duration_seconds := GREATEST(0,
      EXTRACT(EPOCH FROM (NEW.punch_out - NEW.punch_in))::integer
    );
  ELSE
    NEW.duration_seconds := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_session_duration ON public.attendance_sessions;
CREATE TRIGGER trg_calc_session_duration
  BEFORE INSERT OR UPDATE OF punch_out ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fn_calculate_session_duration();

-- ---------------------------------------------------------------------------
-- 11. FUNCTION: recalculate total_working_seconds for an attendance record
--     Called from API routes (service role) after any session change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_attendance_total(p_attendance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.attendance a
  SET    total_working_seconds = COALESCE(
           (SELECT SUM(s.duration_seconds)
            FROM   public.attendance_sessions s
            WHERE  s.attendance_id = p_attendance_id
              AND  s.duration_seconds IS NOT NULL),
           0
         ),
         updated_at = now()
  WHERE  a.id = p_attendance_id;
END;
$$;

-- Convenience trigger variant: auto-update parent attendance total
-- whenever a session's duration_seconds changes.
CREATE OR REPLACE FUNCTION public.fn_sync_attendance_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_att_id uuid;
BEGIN
  v_att_id := COALESCE(NEW.attendance_id, OLD.attendance_id);
  IF v_att_id IS NOT NULL THEN
    PERFORM public.fn_update_attendance_total(v_att_id);
  END IF;
  RETURN NULL; -- AFTER trigger; return value ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_attendance_total ON public.attendance_sessions;
CREATE TRIGGER trg_sync_attendance_total
  AFTER INSERT OR UPDATE OF duration_seconds OR DELETE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_attendance_total();

-- ---------------------------------------------------------------------------
-- 12. Seed default company_settings row (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.company_settings (
  company_name,
  work_start_time,
  work_end_time,
  expected_working_hours,
  grace_period_minutes,
  timezone,
  working_days,
  allow_multiple_sessions
)
SELECT
  'My Company',
  '09:00:00'::time,
  '18:00:00'::time,
  8.0,
  15,
  'Asia/Kolkata',
  ARRAY[1,2,3,4,5],
  false
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- ---------------------------------------------------------------------------
-- END OF SCHEMA
-- ---------------------------------------------------------------------------
  
-- =============================================================================
-- Employee Attendance & Timesheet Management System
-- Row Level Security (RLS) Policies
-- Run AFTER schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: is_admin()
--    Returns true if the calling JWT belongs to a user whose profile.role
--    is 'admin'.  SECURITY DEFINER so it bypasses RLS on profiles itself.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id   = auth.uid()
      AND  role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service" ON public.profiles;

-- SELECT: every authenticated user can read their own row
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- SELECT: admins can read any profile
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- UPDATE: users can update their own non-sensitive columns
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id   = auth.uid()
    -- Prevent self-escalation: an employee cannot change their own role
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- UPDATE: admins can update any profile (including role changes)
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT: restricted to service_role only (the fn_handle_new_user trigger
--         runs as SECURITY DEFINER and bypasses RLS; this policy blocks
--         direct client inserts).
CREATE POLICY "profiles_insert_service"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. ATTENDANCE
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select_own"   ON public.attendance;
DROP POLICY IF EXISTS "attendance_select_admin" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_own"   ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_admin" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_service" ON public.attendance;

-- SELECT: employees see only their own records
CREATE POLICY "attendance_select_own"
  ON public.attendance
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- SELECT: admins see all
CREATE POLICY "attendance_select_admin"
  ON public.attendance
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: employees can create their own attendance record
CREATE POLICY "attendance_insert_own"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- INSERT: admins can insert for any employee
CREATE POLICY "attendance_insert_admin"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE: only the service_role (API routes) may update attendance.
--         Direct client UPDATEs are intentionally blocked for employees.
CREATE POLICY "attendance_update_service"
  ON public.attendance
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. ATTENDANCE_SESSIONS
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select_own"     ON public.attendance_sessions;
DROP POLICY IF EXISTS "sessions_select_admin"   ON public.attendance_sessions;
DROP POLICY IF EXISTS "sessions_insert_service" ON public.attendance_sessions;
DROP POLICY IF EXISTS "sessions_update_service" ON public.attendance_sessions;

-- SELECT: employees see only their own sessions
CREATE POLICY "sessions_select_own"
  ON public.attendance_sessions
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- SELECT: admins see all sessions
CREATE POLICY "sessions_select_admin"
  ON public.attendance_sessions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: via service_role only (API routes handle punch-in logic)
CREATE POLICY "sessions_insert_service"
  ON public.attendance_sessions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE: via service_role only (API routes handle punch-out)
CREATE POLICY "sessions_update_service"
  ON public.attendance_sessions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. LEAVE_REQUESTS
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_select_own"    ON public.leave_requests;
DROP POLICY IF EXISTS "leave_select_admin"  ON public.leave_requests;
DROP POLICY IF EXISTS "leave_insert_own"    ON public.leave_requests;
DROP POLICY IF EXISTS "leave_insert_admin"  ON public.leave_requests;
DROP POLICY IF EXISTS "leave_update_own"    ON public.leave_requests;
DROP POLICY IF EXISTS "leave_update_admin"  ON public.leave_requests;

-- SELECT: employees see only their own requests
CREATE POLICY "leave_select_own"
  ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- SELECT: admins see all requests
CREATE POLICY "leave_select_admin"
  ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: employees can submit their own leave requests
CREATE POLICY "leave_insert_own"
  ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- INSERT: admins can insert on behalf of any employee
CREATE POLICY "leave_insert_admin"
  ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE: employees can only retract/modify their OWN PENDING requests
CREATE POLICY "leave_update_own"
  ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING  (employee_id = auth.uid() AND status = 'pending')
  WITH CHECK (
    employee_id = auth.uid()
    -- Employees may not self-approve
    AND status IN ('pending')
  );

-- UPDATE: admins can approve / reject any request
CREATE POLICY "leave_update_admin"
  ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. COMPANY_SETTINGS
-- ---------------------------------------------------------------------------
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_authenticated" ON public.company_settings;
DROP POLICY IF EXISTS "settings_write_admin"          ON public.company_settings;

-- SELECT: any authenticated user can read global settings
CREATE POLICY "settings_select_authenticated"
  ON public.company_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT / UPDATE / DELETE: admins only
CREATE POLICY "settings_write_admin"
  ON public.company_settings
  FOR ALL          -- covers INSERT, UPDATE, DELETE
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. AUDIT_LOGS
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin"        ON public.audit_logs;
DROP POLICY IF EXISTS "audit_insert_authenticated" ON public.audit_logs;

-- SELECT: admins only
CREATE POLICY "audit_select_admin"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: any authenticated user (append-only; no UPDATE/DELETE granted)
CREATE POLICY "audit_insert_authenticated"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Actor must be the caller themselves (no impersonation)
    actor_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- END OF RLS POLICIES
-- ---------------------------------------------------------------------------
  
-- =============================================================================
-- Employee Attendance & Timesheet Management System
-- Seed Data
-- Run AFTER schema.sql AND rls.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Default Company Settings
--    (schema.sql already inserts one row via its own idempotent INSERT,
--     but we keep this here for standalone seed runs.)
-- ---------------------------------------------------------------------------
INSERT INTO public.company_settings (
  company_name,
  work_start_time,
  work_end_time,
  expected_working_hours,
  grace_period_minutes,
  timezone,
  working_days,
  allow_multiple_sessions
)
SELECT
  'My Company',
  '09:00:00'::time,
  '18:00:00'::time,
  8.0,
  15,
  'Asia/Kolkata',
  ARRAY[1,2,3,4,5],   -- Mon=1 … Fri=5 (ISO DOW)
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_settings
);

-- ---------------------------------------------------------------------------
-- 2. How to create the first Admin user
-- ---------------------------------------------------------------------------
-- STEP A — Create the user via Supabase Auth Dashboard
-- -------------------------------------------------------
-- 1. Open your Supabase project → Authentication → Users → "Add user".
-- 2. Enter the admin's email (e.g. admin@mycompany.com) and a strong password.
-- 3. Click "Create user".
-- 4. Supabase will fire the trg_on_auth_user_created trigger and automatically
--    insert a row into public.profiles with:
--      • role       = 'employee'  (the default)
--      • employee_id = 'EMP0001'  (auto-generated)
--      • full_name  = the part before '@' in the email
--
-- STEP B — Promote the user to Admin
-- -------------------------------------------------------
-- After creating the auth user, run the following SQL in the Supabase SQL
-- editor, replacing the email with the one you just created:

/*
UPDATE public.profiles
SET
  role        = 'admin',
  employee_id = 'ADMIN001',
  full_name   = 'System Administrator',   -- adjust as needed
  department  = 'IT',
  designation = 'System Administrator'
WHERE email = 'admin@mycompany.com';
*/

-- STEP C — Verify
-- -------------------------------------------------------
-- Run this query to confirm the admin row looks correct:

/*
SELECT id, employee_id, full_name, email, role
FROM   public.profiles
WHERE  role = 'admin';
*/

-- ---------------------------------------------------------------------------
-- 3. Optional: Sample Departments lookup (pure reference comment)
-- ---------------------------------------------------------------------------
-- You may add a departments table later. For now departments are free-text
-- strings on the profiles table. Suggested starting values:
--   'Engineering', 'Product', 'Design', 'HR', 'Finance', 'Operations', 'Sales'

-- ---------------------------------------------------------------------------
-- 4. Optional: Insert a sample holiday for testing
-- ---------------------------------------------------------------------------
-- To mark a company-wide holiday, insert an attendance row for every active
-- employee with status = 'holiday'. Example for a single test employee:

/*
-- Replace <employee_uuid> with a real profiles.id value.
INSERT INTO public.attendance (employee_id, attendance_date, status)
VALUES ('<employee_uuid>', CURRENT_DATE, 'holiday')
ON CONFLICT (employee_id, attendance_date)
DO UPDATE SET status = 'holiday', updated_at = now();
*/

-- ---------------------------------------------------------------------------
-- END OF SEED
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 13. Schema Permissions
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Promote admin@punchapp.com to admin role
UPDATE public.profiles
SET role = 'admin', employee_id = 'ADMIN001'
WHERE email = 'admin@punchapp.com';
