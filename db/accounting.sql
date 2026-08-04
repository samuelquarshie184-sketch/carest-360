CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  parent_code TEXT,
  normal_balance TEXT NOT NULL DEFAULT 'DEBIT',
  usage_note TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journal_date DATE NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'MANUAL_JOURNAL',
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  created_by TEXT NOT NULL REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT,
  description TEXT,
  debit_minor BIGINT NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  CHECK ((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0))
);

CREATE TABLE IF NOT EXISTS accruals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  expense_account TEXT NOT NULL,
  liability_account TEXT NOT NULL,
  start_date DATE NOT NULL,
  reversal_date DATE,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  journal_id TEXT REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name, period_name)
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  UNIQUE (budget_id, account_code)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number_masked TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id TEXT PRIMARY KEY,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  closing_balance_minor BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bank_account_id, statement_date)
);

CREATE INDEX IF NOT EXISTS idx_journals_tenant_date ON journal_entries(tenant_id, journal_date DESC);
CREATE INDEX IF NOT EXISTS idx_accruals_tenant_start ON accruals(tenant_id, start_date DESC);

CREATE TABLE IF NOT EXISTS petty_cash_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  custodian TEXT,
  opening_balance_minor BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS petty_cash_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES petty_cash_accounts(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('INFLOW', 'OUTFLOW')),
  description TEXT NOT NULL,
  reference_number TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  category TEXT,
  recorded_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  in_service_date DATE NOT NULL,
  cost_minor BIGINT NOT NULL CHECK (cost_minor > 0),
  residual_value_minor BIGINT NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL CHECK (useful_life_months > 0),
  depreciation_method TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, asset_code)
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  requested_by TEXT NOT NULL REFERENCES users(id),
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_tenant_date ON petty_cash_transactions(tenant_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_status ON fixed_assets(tenant_id, status);
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS normal_balance TEXT NOT NULL DEFAULT 'DEBIT';
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS usage_note TEXT;

CREATE INDEX IF NOT EXISTS idx_approvals_tenant_status ON approval_requests(tenant_id, status);

CREATE TABLE IF NOT EXISTS cashbook_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('RECEIPT', 'PAYMENT', 'REVERSAL')),
  source_type TEXT NOT NULL,
  source_id TEXT,
  reference_number TEXT,
  registration_application_number TEXT,
  description TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GHS',
  payment_method TEXT,
  account_code TEXT,
  recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'POSTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashbook_tenant_date ON cashbook_entries(tenant_id, entry_date DESC);
