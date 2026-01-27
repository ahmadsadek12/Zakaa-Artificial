-- Migration: Add Role & Employee Support to Users Table
-- Adds role_scope, employee_role, and employee_permissions columns
-- Maps existing user_type values to role_scope for backward compatibility

USE zakaa_db;

-- Step 1: Add new columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_scope ENUM(
    'platform_admin',
    'business_owner',
    'branch_operator',
    'employee',
    'customer'
  ) NOT NULL DEFAULT 'customer' AFTER user_type,
  ADD COLUMN IF NOT EXISTS employee_role ENUM(
    'manager',
    'waiter',
    'cashier',
    'support',
    'delivery',
    'custom'
  ) NULL AFTER role_scope,
  ADD COLUMN IF NOT EXISTS employee_permissions JSON NULL AFTER employee_role;

-- Step 2: Migrate existing data - Map user_type to role_scope
UPDATE users
SET role_scope = CASE
  WHEN user_type = 'admin' THEN 'platform_admin'
  WHEN user_type = 'business' THEN 'business_owner'
  WHEN user_type = 'branch' THEN 'branch_operator'
  WHEN user_type = 'customer' THEN 'customer'
  ELSE 'customer'
END
WHERE role_scope = 'customer' OR role_scope IS NULL;

-- Step 3: Add index for role_scope
ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_role_scope (role_scope);

-- Step 4: Add constraint: Employees must have parent_user_id
-- Note: This is enforced in application code, not as a DB constraint
-- because we need to allow NULL parent_user_id for other roles

-- Step 5: Add constraint: Customers cannot be employees
-- This is also enforced in application code
