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
