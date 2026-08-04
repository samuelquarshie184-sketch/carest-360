CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  timezone TEXT NOT NULL DEFAULT 'Africa/Accra',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'finance_officer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tenant_status ON password_reset_requests(tenant_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  length TEXT,
  detail TEXT,
  color TEXT NOT NULL DEFAULT 'blue',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, label)
);

CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  academic_year_id TEXT REFERENCES academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_on DATE,
  ends_on DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, academic_year_id, name)
);

CREATE TABLE IF NOT EXISTS student_registrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_number TEXT NOT NULL,
  student_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  residential_address TEXT,
  city TEXT,
  region TEXT,
  programme TEXT NOT NULL,
  intake TEXT,
  academic_year TEXT,
  semester TEXT,
  guardian_name TEXT,
  guardian_relationship TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, application_number),
  UNIQUE (tenant_id, student_number)
);

CREATE INDEX IF NOT EXISTS idx_registrations_tenant_created ON student_registrations(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS student_number_counters (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year_code TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year_code)
);

CREATE TABLE IF NOT EXISTS receipt_counters (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year_code TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year_code)
);

CREATE TABLE IF NOT EXISTS fee_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS revenue_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS manual_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  registration_application_number TEXT,
  fee_category_code TEXT,
  revenue_category_code TEXT,
  student_name TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  bank_name TEXT,
  deposit_slip_number TEXT,
  teller_number TEXT,
  payment_date DATE NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  payment_method TEXT NOT NULL,
  fee_category TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  recorded_by TEXT NOT NULL REFERENCES users(id),
  supporting_document_key TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED',
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS manual_expenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  expense_category TEXT NOT NULL,
  expense_category_code TEXT,
  expense_account_code TEXT,
  payment_method TEXT NOT NULL,
  expense_date DATE NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  department TEXT,
  recorded_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'POSTED',
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, reference_number)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id TEXT REFERENCES manual_payments(id) ON DELETE SET NULL,
  expense_id TEXT REFERENCES manual_expenses(id) ON DELETE SET NULL,
  account_code TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forward-compatible columns for databases created before review/edit/void controls were added.
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS registration_application_number TEXT;
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS fee_category_code TEXT;
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS revenue_category_code TEXT;
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS expense_category_code TEXT;
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS expense_account_code TEXT;
ALTER TABLE student_registrations ADD COLUMN IF NOT EXISTS semester TEXT;
ALTER TABLE student_registrations ADD COLUMN IF NOT EXISTS student_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_number_unique ON student_registrations(tenant_id, student_number) WHERE student_number IS NOT NULL;
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE manual_payments ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE manual_expenses ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS expense_id TEXT REFERENCES manual_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_tenant_date ON manual_payments(tenant_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON manual_expenses(tenant_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_created ON ledger_entries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_events(tenant_id, created_at DESC);
