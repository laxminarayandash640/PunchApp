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
