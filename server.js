import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseUrl = process.env.DATABASE_URL;
let Pool = null;
let bcrypt = null;
let jwt = {
  sign(payload) {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  },
  verify(token) {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  }
};
if (databaseUrl) {
  const pgModule = await import('pg');
  const bcryptModule = await import('bcryptjs');
  const jwtModule = await import('jsonwebtoken');
  Pool = pgModule.default?.Pool || pgModule.Pool;
  bcrypt = bcryptModule.default || bcryptModule;
  jwt = jwtModule.default || jwtModule;
}
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(__dirname, 'public');
const dbDir = join(__dirname, 'db');
const port = process.env.PORT || 3000;
const appVersion = '2.2.15';
const jwtSecret = process.env.JWT_SECRET || 'carest-local-development-secret-change-me';
const tenantId = process.env.TENANT_ID || 'carest';
const tenantName = process.env.INSTITUTION_NAME || 'CAREST College of Health';
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.PG_POOL_MAX || 10),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    })
  : null;
let dbReady = false;

const seed = {
  overview: {
    university: tenantName,
    location: 'Hohoe · Volta Region · Ghana',
    stats: [
      { value: '01', label: 'finance system of record' },
      { value: '∞', label: 'admin-defined income categories' },
      { value: '100%', label: 'manual-payment ready in phase one' },
      { value: '24/7', label: 'clearer financial visibility' }
    ],
    applicationWindow: 'Current programmes and registration information available online'
  },
  academicYears: [
    { id: 'ay_2026_27', label: '2026/27', startsOn: '2026-08-01', endsOn: '2027-07-31', active: true },
    { id: 'ay_2027_28', label: '2027/28', startsOn: '2027-08-01', endsOn: '2028-07-31', active: true }
  ],
  semesters: [
    { id: 'sem_1', name: 'Semester 1', academicYearId: 'ay_2026_27', active: true },
    { id: 'sem_2', name: 'Semester 2', academicYearId: 'ay_2026_27', active: true }
  ],
  programs: [
    { id: '01', title: 'BSc. Business Administration', type: 'BSc', length: 'Bachelor programme', detail: 'Build leadership, management and entrepreneurial skills for today’s business world.', color: 'orange' },
    { id: '02', title: 'BSc Computer Science', type: 'BSc', length: 'Bachelor programme', detail: 'Learn computing, programming and software development to shape the future of technology.', color: 'blue' },
    { id: '03', title: 'HND Medical Laboratory Technology', type: 'HND / Diploma', length: 'HND programme', detail: 'Learn to test, diagnose and help save lives through hands-on laboratory training.', color: 'green' },
    { id: '04', title: 'Diploma in Security and Artificial Intelligence', type: 'HND / Diploma', length: 'Diploma programme', detail: 'Build knowledge in AI technologies, cybersecurity systems and digital protection.', color: 'violet' },
    { id: '05', title: 'Diploma in Catering, Hotel & Institutional Management', type: 'HND / Diploma', length: 'Diploma programme', detail: 'Master cooking, hospitality and hotel operations through practical experience.', color: 'red' },
    { id: '06', title: 'Medicine Counter Assistant / Pharmacy Assistant', type: 'Professional', length: 'Professional programme', detail: 'Learn to dispense medicines safely, assist pharmacists and serve with care.', color: 'yellow' }
  ],
  events: [
    { day: '14', month: 'SEP', title: 'Finance configuration review', time: '10:00 — 12:00', type: 'Finance team' },
    { day: '22', month: 'SEP', title: 'Manual payment control clinic', time: '18:00 — 19:00', type: 'Online' },
    { day: '04', month: 'OCT', title: 'Month-end reporting workshop', time: '17:30 — 20:00', type: 'Finance team' }
  ],
  activity: [
    { initials: 'FA', name: 'Finance Admin', action: 'posted a verified bank payment', time: '2m ago', tone: 'purple' },
    { initials: 'AR', name: 'Accounts Review', action: 'reconciled a revenue category', time: '8m ago', tone: 'orange' },
    { initials: 'YL', name: 'Year Ledger', action: 'opened the 2026 / 27 fee schedule', time: '14m ago', tone: 'green' }
  ],
  feeTypes: [
    { id: 'fee_tuition', code: 'TUITION', name: 'Tuition Fees', active: true, recurring: true },
    { id: 'fee_registration', code: 'REGISTRATION', name: 'Registration Fees', active: true, recurring: false },
    { id: 'fee_exam', code: 'EXAMINATION', name: 'Examination Fees', active: true, recurring: false },
    { id: 'fee_medical', code: 'MEDICAL', name: 'Medical Fees', active: true, recurring: false },
    { id: 'fee_ict', code: 'ICT', name: 'ICT Fees', active: true, recurring: false },
    { id: 'fee_hostel', code: 'HOSTEL', name: 'Hostel Fees', active: true, recurring: true },
    { id: 'fee_other', code: 'OTHER', name: 'Other Auxiliary Fees', active: true, recurring: false }
  ],
  revenueCategories: [
    { id: 'rev_student_tuition', code: 'STUDENT_TUITION', name: 'Student Tuition', active: true },
    { id: 'rev_admission', code: 'ADMISSION', name: 'Admission Fees', active: true },
    { id: 'rev_hostel', code: 'HOSTEL_INCOME', name: 'Hostel Income', active: true },
    { id: 'rev_short_courses', code: 'SHORT_COURSES', name: 'Short Professional Courses', active: true },
    { id: 'rev_grants', code: 'RESEARCH_GRANTS', name: 'Research Grants', active: true },
    { id: 'rev_donations', code: 'DONATIONS', name: 'Donations', active: true },
    { id: 'rev_facility', code: 'FACILITY_RENTAL', name: 'Facility Rental', active: true },
    { id: 'rev_other', code: 'OTHER_REVENUE', name: 'Other Revenue', active: true }
  ],
  expenseCategories: [
    { id: 'exp_personnel', code: 'PERSONNEL', name: 'Personnel', active: true },
    { id: 'exp_learning', code: 'LEARNING_RESOURCES', name: 'Learning Resources', active: true },
    { id: 'exp_facilities', code: 'FACILITIES', name: 'Facilities & Utilities', active: true },
    { id: 'exp_other', code: 'OTHER_EXPENSE', name: 'Other Expense', active: true }
  ],
  accounts: [
    { code: '1000-CASH-BANK', name: 'Cash and bank', accountType: 'ASSET', normalBalance: 'DEBIT', usageNote: 'Main bank and cash control account.', active: true },
    { code: '1100-CASH-BANK', name: 'External payment clearing', accountType: 'ASSET', normalBalance: 'DEBIT', usageNote: 'Temporary clearing for verified receipts.', active: true },
    { code: '1200-RECEIVABLES', name: 'Student and customer receivables', accountType: 'ASSET', normalBalance: 'DEBIT', usageNote: 'Amounts owed to the College.', active: true },
    { code: '2000-ACCRUED-LIABILITIES', name: 'Accrued liabilities', accountType: 'LIABILITY', normalBalance: 'CREDIT', usageNote: 'Costs incurred but not yet paid.', active: true },
    { code: '3000-RETAINED-RESULT', name: 'Retained result', accountType: 'EQUITY', normalBalance: 'CREDIT', usageNote: 'Accumulated institutional result.', active: true },
    { code: '4000-TUITION', name: 'Tuition income', accountType: 'INCOME', normalBalance: 'CREDIT', usageNote: 'Tuition and student fee income.', active: true },
    { code: '5000-PERSONNEL', name: 'Personnel expenses', accountType: 'EXPENSE', normalBalance: 'DEBIT', usageNote: 'Staff and personnel costs.', active: true },
    { code: '5000-FACILITIES_UTILITIES', name: 'Facilities and utilities', accountType: 'EXPENSE', normalBalance: 'DEBIT', usageNote: 'Utilities, repairs and facility operations.', active: true }
  ],
  payments: [],
  expenses: [],
  ledger: [],
  journals: [],
  accruals: [],
  registrations: [],
  pettyCash: [],
  bankReconciliations: [],
  budgets: [],
  assets: [],
  approvals: [],
  cashbook: [],
  resetRequests: [],
  nextReceiptNumber: 1
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function sendError(res, statusCode, message, details) {
  return sendJson(res, statusCode, { ok: false, message, ...(details ? { details } : {}) });
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2_000_000) throw new Error('Request body too large.');
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanCode(input, fallback = 'OTHER') {
  return String(input || fallback).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || fallback;
}

function amountToMinor(input) {
  const raw = input.amountPaidMinor ?? input.amountMinor ?? (input.amountPaid !== undefined ? Number(input.amountPaid) * 100 : NaN);
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

function amountFromMinor(value) {
  return Number(value || 0) / 100;
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index === -1) return [part.trim(), ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function tokenFromRequest(req) {
  const authorization = String(req.headers.authorization || '');
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  return parseCookies(req.headers.cookie).carest_access_token;
}

function signUser(user) {
  return jwt.sign({ sub: user.id, tenantId: user.tenantId, role: user.role, email: user.email }, jwtSecret, { expiresIn: '8h' });
}

async function getAuthenticatedUser(req) {
  const token = tokenFromRequest(req);
  if (!token) return null;
  try {
    const claims = jwt.verify(token, jwtSecret);
    if (!dbReady) return claims;
    const { rows } = await pool.query('SELECT id, tenant_id AS "tenantId", email, name, role, active FROM users WHERE id = $1 AND active = TRUE', [claims.sub]);
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function requireUser(req, res, roles = []) {
  const user = !dbReady && !pool
    ? { id: 'demo-user', tenantId, email: 'demo@carestcollegeofhealth.edu.gh', name: 'Demo Finance Admin', role: 'finance_admin' }
    : await getAuthenticatedUser(req);
  if (!user) {
    sendError(res, 401, 'Authentication is required for this finance action.');
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    sendError(res, 403, 'Your account does not have permission for this action.');
    return null;
  }
  return user;
}

function authCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `carest_access_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`;
}


async function requestPasswordReset(input, req) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Enter a valid finance email address.');
  const request = { id: createId('reset'), email, reason: String(input.reason || 'Password reset requested').trim(), status: 'PENDING', requestedAt: new Date().toISOString() };
  if (!dbReady) { seed.resetRequests.unshift(request); return request; }
  await pool.query(`INSERT INTO password_reset_requests (id, tenant_id, email, reason) VALUES ($1, $2, $3, $4)`, [request.id, tenantId, request.email, request.reason]);
  return request;
}

async function getPasswordResetRequests() {
  if (!dbReady) return seed.resetRequests;
  const { rows } = await pool.query(`SELECT id, email, reason, status, requested_at AS "requestedAt", reviewed_at AS "reviewedAt" FROM password_reset_requests WHERE tenant_id = $1 ORDER BY requested_at DESC LIMIT 100`, [tenantId]);
  return rows;
}

async function approvePasswordReset(id, input, user, req) {
  const newPassword = String(input.newPassword || '');
  if (newPassword.length < 12) throw new Error('New password must be at least 12 characters.');
  if (!dbReady) {
    const request = seed.resetRequests.find((item) => item.id === id);
    if (!request) throw new Error('Password reset request not found.');
    request.status = 'APPROVED';
    request.reviewedBy = user.id;
    request.reviewedAt = new Date().toISOString();
    return request;
  }
  const request = await pool.query(`SELECT * FROM password_reset_requests WHERE id = $1 AND tenant_id = $2 AND status = 'PENDING'`, [id, tenantId]);
  if (!request.rowCount) throw new Error('Pending password reset request not found.');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const account = await pool.query(`UPDATE users SET password_hash = $1, active = TRUE WHERE tenant_id = $2 AND email = $3 RETURNING id, email`, [passwordHash, tenantId, request.rows[0].email]);
  if (!account.rowCount) throw new Error('No active user account exists for this email.');
  const updated = await pool.query(`UPDATE password_reset_requests SET status = 'APPROVED', reviewed_by = $3, reviewed_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id, email, reason, status, requested_at AS "requestedAt", reviewed_at AS "reviewedAt"`, [id, tenantId, user.id]);
  await addAudit(user, 'APPROVE_PASSWORD_RESET', 'password_reset_request', id, updated.rows[0], req);
  return updated.rows[0];
}

async function seedDatabase() {
  await pool.query(
    `INSERT INTO tenants (id, name, slug, currency, timezone)
     VALUES ($1, $2, $3, 'GHS', $4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [tenantId, tenantName, tenantId, process.env.INSTITUTION_TIMEZONE || 'Africa/Accra']
  );

  const defaultAccounts = [
    ['1000-CASH-BANK', 'Cash and bank', 'ASSET', 'DEBIT', 'Main bank and cash control account.'],
    ['1100-CASH-BANK', 'External payment clearing', 'ASSET', 'DEBIT', 'Temporary clearing for verified receipts.'],
    ['1200-RECEIVABLES', 'Student and customer receivables', 'ASSET', 'DEBIT', 'Amounts owed to the College.'],
    ['2000-ACCRUED-LIABILITIES', 'Accrued liabilities', 'LIABILITY', 'CREDIT', 'Costs incurred but not yet paid.'],
    ['3000-RETAINED-RESULT', 'Retained result', 'EQUITY', 'CREDIT', 'Accumulated institutional result.'],
    ['4000-TUITION', 'Tuition income', 'INCOME', 'CREDIT', 'Tuition and student fee income.'],
    ['5000-PERSONNEL', 'Personnel expenses', 'EXPENSE', 'DEBIT', 'Staff and personnel costs.'],
    ['5000-FACILITIES_UTILITIES', 'Facilities and utilities', 'EXPENSE', 'DEBIT', 'Utilities, repairs and facility operations.']
  ];
  for (const [code, name, accountType, normalBalance, usageNote] of defaultAccounts) {
    await pool.query(
      `INSERT INTO chart_of_accounts (id, tenant_id, code, name, account_type, normal_balance, usage_note) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, account_type = EXCLUDED.account_type, normal_balance = EXCLUDED.normal_balance, usage_note = EXCLUDED.usage_note`,
      [createId('account'), tenantId, code, name, accountType, normalBalance, usageNote]
    );
  }

  for (const year of seed.academicYears) {
    await pool.query(`INSERT INTO academic_years (id, tenant_id, label, starts_on, ends_on, active) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on, active = EXCLUDED.active`, [year.id, tenantId, year.label, year.startsOn, year.endsOn, year.active]);
  }
  for (const semester of seed.semesters) {
    await pool.query(`INSERT INTO semesters (id, tenant_id, academic_year_id, name, active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active`, [semester.id, tenantId, semester.academicYearId, semester.name, semester.active]);
  }

  for (const program of seed.programs) {
    await pool.query(
      `INSERT INTO programs (id, tenant_id, code, title, type, length, detail, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, length = EXCLUDED.length, detail = EXCLUDED.detail, color = EXCLUDED.color`,
      [program.id, tenantId, `PROGRAM_${program.id}`, program.title, program.type, program.length, program.detail, program.color]
    );
  }

  for (const item of seed.feeTypes) {
    await pool.query(
      `INSERT INTO fee_types (id, tenant_id, code, name, active, recurring)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, tenantId, item.code, item.name, item.active, item.recurring]
    );
  }
  for (const item of seed.revenueCategories) {
    await pool.query(
      `INSERT INTO revenue_categories (id, tenant_id, code, name, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, tenantId, item.code, item.name, item.active]
    );
  }
  for (const item of seed.expenseCategories) {
    await pool.query(
      `INSERT INTO expense_categories (id, tenant_id, code, name, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, tenantId, item.code, item.name, item.active]
    );
  }

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await pool.query(
      `INSERT INTO users (id, tenant_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'finance_admin')
       ON CONFLICT (tenant_id, email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'finance_admin', active = TRUE`,
      ['user_bootstrap_admin', tenantId, adminEmail.trim().toLowerCase(), 'CAREST Finance Administrator', passwordHash]
    );
    console.log(`Bootstrap finance admin is ready for ${adminEmail}.`);
  } else {
    console.warn('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are not set; no production login was created.');
  }
}

async function initializeDatabase() {
  if (!pool) return false;
  const schema = await readFile(join(dbDir, 'schema.sql'), 'utf8');
  const accounting = await readFile(join(dbDir, 'accounting.sql'), 'utf8');
  await pool.query(schema);
  await pool.query(accounting);
  await seedDatabase();
  dbReady = true;
  return true;
}

async function getFinanceConfig() {
  if (!dbReady) {
    return {
      feeTypes: seed.feeTypes,
      revenueCategories: seed.revenueCategories,
      expenseCategories: seed.expenseCategories,
      chartOfAccounts: seed.accounts,
      academicYears: seed.academicYears,
      semesters: seed.semesters
    };
  }
  const [fees, revenues, expenses, accounts, years, semesters] = await Promise.all([
    pool.query('SELECT id, code, name, active, recurring FROM fee_types WHERE tenant_id = $1 ORDER BY name', [tenantId]),
    pool.query('SELECT id, code, name, active FROM revenue_categories WHERE tenant_id = $1 ORDER BY name', [tenantId]),
    pool.query('SELECT id, code, name, active FROM expense_categories WHERE tenant_id = $1 ORDER BY name', [tenantId]),
    pool.query('SELECT code, name, account_type AS "accountType", normal_balance AS "normalBalance", usage_note AS "usageNote", active FROM chart_of_accounts WHERE tenant_id = $1 ORDER BY code', [tenantId]),
    pool.query('SELECT id, label, starts_on AS "startsOn", ends_on AS "endsOn", active FROM academic_years WHERE tenant_id = $1 AND active = TRUE ORDER BY starts_on DESC', [tenantId]),
    pool.query('SELECT id, name, academic_year_id AS "academicYearId", active FROM semesters WHERE tenant_id = $1 AND active = TRUE ORDER BY name', [tenantId])
  ]);
  return { feeTypes: fees.rows, revenueCategories: revenues.rows, expenseCategories: expenses.rows, chartOfAccounts: accounts.rows, academicYears: years.rows, semesters: semesters.rows };
}

async function addAudit(user, action, entityType, entityId, afterJson, req) {
  if (!dbReady) return;
  await pool.query(
    `INSERT INTO audit_events (id, tenant_id, user_id, action, entity_type, entity_id, after_json, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [createId('audit'), tenantId, user.id, action, entityType, entityId, JSON.stringify(afterJson), String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')]
  );
}

async function listPrograms() {
  if (!dbReady) return seed.programs;
  const { rows } = await pool.query(
    `SELECT id, title, type, length, detail, color FROM programs WHERE tenant_id = $1 AND active = TRUE ORDER BY code`,
    [tenantId]
  );
  return rows;
}

async function createProgram(input, user, req) {
  const title = String(input.title || '').trim();
  if (!title) throw new Error('Programme title is required.');
  const allowedTypes = ['BSc', 'HND / Diploma', 'Professional'];
  const allowedColors = ['orange', 'blue', 'green', 'violet', 'red', 'yellow'];
  const program = {
    id: createId('program'),
    title,
    type: allowedTypes.includes(input.type) ? input.type : 'Professional',
    length: String(input.length || 'To be configured').trim(),
    detail: String(input.detail || 'A future-ready CAREST programme.').trim(),
    color: allowedColors.includes(input.color) ? input.color : 'blue'
  };
  if (!dbReady) {
    seed.programs.push(program);
    return program;
  }
  await pool.query(
    `INSERT INTO programs (id, tenant_id, code, title, type, length, detail, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [program.id, tenantId, cleanCode(program.id), program.title, program.type, program.length, program.detail, program.color]
  );
  await addAudit(user, 'CREATE', 'program', program.id, program, req);
  return program;
}

async function createFeeType(input, user, req) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Fee type name is required.');
  const item = {
    id: createId('fee'),
    code: cleanCode(input.code || name),
    name,
    description: String(input.description || '').trim(),
    active: input.active !== false,
    recurring: input.recurring === true || input.recurring === 'true'
  };
  if (!dbReady) {
    seed.feeTypes.push(item);
    return item;
  }
  await pool.query(
    `INSERT INTO fee_types (id, tenant_id, code, name, description, active, recurring)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [item.id, tenantId, item.code, item.name, item.description, item.active, item.recurring]
  );
  await addAudit(user, 'CREATE', 'fee_type', item.id, item, req);
  return item;
}

async function createRevenueCategory(input, user, req) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Revenue category name is required.');
  const item = { id: createId('revenue'), code: cleanCode(input.code || name), name, active: input.active !== false };
  if (!dbReady) {
    seed.revenueCategories.push(item);
    return item;
  }
  await pool.query(
    `INSERT INTO revenue_categories (id, tenant_id, code, name, active)
     VALUES ($1, $2, $3, $4, $5)`,
    [item.id, tenantId, item.code, item.name, item.active]
  );
  await addAudit(user, 'CREATE', 'revenue_category', item.id, item, req);
  return item;
}

async function createExpenseCategory(input, user, req) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Expense category name is required.');
  const item = { id: createId('expense'), code: cleanCode(input.code || name), name, active: input.active !== false };
  if (!dbReady) {
    seed.expenseCategories.push(item);
    return item;
  }
  await pool.query(
    `INSERT INTO expense_categories (id, tenant_id, code, name, active)
     VALUES ($1, $2, $3, $4, $5)`,
    [item.id, tenantId, item.code, item.name, item.active]
  );
  await addAudit(user, 'CREATE', 'expense_category', item.id, item, req);
  return item;
}


async function chartOfAccounts() {
  if (!dbReady) return seed.accounts;
  const { rows } = await pool.query('SELECT code, name, account_type AS "accountType", normal_balance AS "normalBalance", usage_note AS "usageNote", active FROM chart_of_accounts WHERE tenant_id = $1 ORDER BY code', [tenantId]);
  return rows;
}

async function createAccount(input, user, req) {
  const code = cleanCode(input.code, 'OTHER_ACCOUNT');
  const name = String(input.name || '').trim();
  const accountType = String(input.accountType || 'EXPENSE').trim().toUpperCase();
  if (!name) throw new Error('Account name is required.');
  if (!['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].includes(accountType)) throw new Error('Account type must be asset, liability, equity, income or expense.');
  const normalBalance = String(input.normalBalance || (['LIABILITY', 'EQUITY', 'INCOME'].includes(accountType) ? 'CREDIT' : 'DEBIT')).toUpperCase();
  const usageNote = String(input.usageNote || '').trim();
  const account = { code, name, accountType, normalBalance, usageNote, active: input.active !== false };
  if (!dbReady) {
    if (seed.accounts.some((item) => item.code === code)) throw new Error('This account code already exists.');
    seed.accounts.push(account);
    return account;
  }
  await pool.query(`INSERT INTO chart_of_accounts (id, tenant_id, code, name, account_type, normal_balance, usage_note, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [createId('account'), tenantId, code, name, accountType, normalBalance, usageNote, account.active]);
  await addAudit(user, 'CREATE', 'chart_of_account', code, account, req);
  return account;
}

function normalizeJournalLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) throw new Error('A journal must contain at least two lines.');
  const normalized = lines.map((line) => {
    const debitMinor = Math.max(0, Math.round(Number(line.debitMinor ?? (line.debit !== undefined ? Number(line.debit) * 100 : 0)) || 0));
    const creditMinor = Math.max(0, Math.round(Number(line.creditMinor ?? (line.credit !== undefined ? Number(line.credit) * 100 : 0)) || 0));
    if ((debitMinor > 0 && creditMinor > 0) || (debitMinor === 0 && creditMinor === 0)) throw new Error('Each journal line must contain either a debit or a credit.');
    return { accountCode: cleanCode(line.accountCode, 'UNSPECIFIED'), accountName: String(line.accountName || '').trim(), description: String(line.description || '').trim(), debitMinor, creditMinor };
  });
  const debitTotal = normalized.reduce((sum, line) => sum + line.debitMinor, 0);
  const creditTotal = normalized.reduce((sum, line) => sum + line.creditMinor, 0);
  if (debitTotal <= 0 || debitTotal !== creditTotal) throw new Error('Journal debits and credits must balance exactly.');
  return { normalized, debitTotal, creditTotal };
}

async function createJournal(input, user, req) {
  const { normalized, debitTotal, creditTotal } = normalizeJournalLines(input.lines);
  const journal = {
    id: createId('journal'),
    journalDate: String(input.journalDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
    description: String(input.description || 'Manual journal').trim(),
    sourceType: String(input.sourceType || 'MANUAL_JOURNAL'),
    status: 'PENDING_REVIEW',
    debitTotal,
    creditTotal,
    lines: normalized
  };
  if (!dbReady) {
    seed.journals.unshift(journal);
    return journal;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO journal_entries (id, tenant_id, journal_date, description, source_type, source_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_REVIEW', $7)`,
      [journal.id, tenantId, journal.journalDate, journal.description, journal.sourceType, input.sourceId || null, user.id]
    );
    for (const line of normalized) {
      await client.query(
        `INSERT INTO journal_lines (id, journal_id, account_code, account_name, description, debit_minor, credit_minor)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [createId('journal_line'), journal.id, line.accountCode, line.accountName, line.description, line.debitMinor, line.creditMinor]
      );
    }
    await client.query(
      `INSERT INTO audit_events (id, tenant_id, user_id, action, entity_type, entity_id, after_json, ip_address)
       VALUES ($1, $2, $3, 'CREATE', 'journal_entry', $4, $5, $6)`,
      [createId('audit'), tenantId, user.id, journal.id, JSON.stringify(journal), String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')]
    );
    await client.query('COMMIT');
    return journal;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createAccrual(input, user, req) {
  const amountMinor = amountToMinor(input);
  if (!amountMinor) throw new Error('Accrual amount must be a positive number.');
  const description = String(input.description || '').trim();
  const expenseAccount = cleanCode(input.expenseAccount, '5000-OTHER_EXPENSE');
  const liabilityAccount = cleanCode(input.liabilityAccount, '2000-ACCRUED_LIABILITIES');
  if (!description) throw new Error('Accrual description is required.');
  const journal = await createJournal({
    description: `Accrual: ${description}`,
    sourceType: 'ACCRUAL',
    journalDate: input.startDate,
    lines: [
      { accountCode: expenseAccount, debitMinor: amountMinor, description },
      { accountCode: liabilityAccount, creditMinor: amountMinor, description }
    ]
  }, user, req);
  const accrual = {
    id: createId('accrual'),
    description,
    amountMinor,
    currency: String(input.currency || 'GHS').toUpperCase(),
    expenseAccount,
    liabilityAccount,
    startDate: String(input.startDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
    reversalDate: input.reversalDate ? String(input.reversalDate).slice(0, 10) : null,
    status: 'PENDING_REVIEW',
    journalId: journal.id,
    createdBy: user.id
  };
  if (!dbReady) {
    seed.accruals.unshift(accrual);
    return accrual;
  }
  await pool.query(
    `INSERT INTO accruals (id, tenant_id, description, amount_minor, currency, expense_account, liability_account, start_date, reversal_date, status, journal_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_REVIEW', $10, $11)`,
    [accrual.id, tenantId, accrual.description, accrual.amountMinor, accrual.currency, accrual.expenseAccount, accrual.liabilityAccount, accrual.startDate, accrual.reversalDate, accrual.journalId, user.id]
  );
  await addAudit(user, 'CREATE', 'accrual', accrual.id, accrual, req);
  return accrual;
}



async function registrationOptions() {
  if (!dbReady) return { programs: seed.programs.map((program) => ({ id: program.id, title: program.title, type: program.type })), academicYears: seed.academicYears, semesters: seed.semesters };
  const [programs, academicYears, semesters] = await Promise.all([
    pool.query(`SELECT id, title, type FROM programs WHERE tenant_id = $1 AND active = TRUE ORDER BY code`, [tenantId]),
    pool.query(`SELECT id, label, starts_on AS "startsOn", ends_on AS "endsOn" FROM academic_years WHERE tenant_id = $1 AND active = TRUE ORDER BY starts_on DESC`, [tenantId]),
    pool.query(`SELECT id, name, academic_year_id AS "academicYearId" FROM semesters WHERE tenant_id = $1 AND active = TRUE ORDER BY name`, [tenantId])
  ]);
  return { programs: programs.rows, academicYears: academicYears.rows, semesters: semesters.rows };
}

async function createStudentRegistration(input, req) {
  const required = ['firstName', 'lastName', 'phone', 'programme', 'academicYear', 'semester'];
  const missing = required.filter((field) => !String(input[field] ?? '').trim());
  if (missing.length) throw new Error(`Missing registration fields: ${missing.join(', ')}`);
  const currentYearCode = String(new Date().getFullYear());
  const registration = {
    id: createId('registration'),
    applicationNumber: `APP-${currentYearCode}-${String(Date.now()).slice(-6)}`,
    studentNumber: null,
    firstName: String(input.firstName).trim(),
    lastName: String(input.lastName).trim(),
    dateOfBirth: input.dateOfBirth ? String(input.dateOfBirth).slice(0, 10) : null,
    gender: String(input.gender || '').trim(),
    phone: String(input.phone).trim(),
    email: String(input.email || '').trim().toLowerCase(),
    whatsapp: String(input.whatsapp || '').trim(),
    residentialAddress: String(input.residentialAddress || '').trim(),
    city: String(input.city || '').trim(),
    region: String(input.region || '').trim(),
    programme: String(input.programme).trim(),
    intake: String(input.intake || '').trim(),
    academicYear: String(input.academicYear).trim(),
    semester: String(input.semester).trim(),
    guardianName: String(input.guardianName || '').trim(),
    guardianRelationship: String(input.guardianRelationship || '').trim(),
    guardianPhone: String(input.guardianPhone || '').trim(),
    guardianEmail: String(input.guardianEmail || '').trim().toLowerCase(),
    emergencyContactName: String(input.emergencyContactName || '').trim(),
    emergencyContactPhone: String(input.emergencyContactPhone || '').trim(),
    status: 'SUBMITTED',
    createdAt: new Date().toISOString()
  };
  if (!dbReady) {
    const yearCode = String(new Date().getFullYear()).slice(-2);
    registration.studentNumber = `CAR-${yearCode}-${String(seed.registrations.length + 1).padStart(5, '0')}`;
    seed.registrations.unshift(registration);
    return registration;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO student_number_counters (tenant_id, year_code, last_number) VALUES ($1, $2, 0) ON CONFLICT (tenant_id, year_code) DO NOTHING`, [tenantId, currentYearCode]);
    const counter = await client.query(`SELECT last_number FROM student_number_counters WHERE tenant_id = $1 AND year_code = $2 FOR UPDATE`, [tenantId, currentYearCode]);
    const nextNumber = Number(counter.rows[0].last_number) + 1;
    await client.query(`UPDATE student_number_counters SET last_number = $3 WHERE tenant_id = $1 AND year_code = $2`, [tenantId, currentYearCode, nextNumber]);
    registration.studentNumber = `CAR-${String(new Date().getFullYear()).slice(-2)}-${String(nextNumber).padStart(5, '0')}`;
    await client.query(
      `INSERT INTO student_registrations (id, tenant_id, application_number, student_number, first_name, last_name, date_of_birth, gender, phone, email, whatsapp, residential_address, city, region, programme, intake, academic_year, semester, guardian_name, guardian_relationship, guardian_phone, guardian_email, emergency_contact_name, emergency_contact_phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      [registration.id, tenantId, registration.applicationNumber, registration.studentNumber, registration.firstName, registration.lastName, registration.dateOfBirth, registration.gender, registration.phone, registration.email, registration.whatsapp, registration.residentialAddress, registration.city, registration.region, registration.programme, registration.intake, registration.academicYear, registration.semester, registration.guardianName, registration.guardianRelationship, registration.guardianPhone, registration.guardianEmail, registration.emergencyContactName, registration.emergencyContactPhone, registration.status]
    );
    await client.query('COMMIT');
    return registration;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function nextReceiptNumber(client = null) {
  const year = String(new Date().getFullYear());
  if (!dbReady) return `RCPT-${year}-${String(seed.nextReceiptNumber++).padStart(6, '0')}`;
  const executor = client || pool;
  await executor.query(`INSERT INTO receipt_counters (tenant_id, year_code, last_number) VALUES ($1, $2, 0) ON CONFLICT (tenant_id, year_code) DO NOTHING`, [tenantId, year]);
  const current = await executor.query(`SELECT last_number FROM receipt_counters WHERE tenant_id = $1 AND year_code = $2 FOR UPDATE`, [tenantId, year]);
  const next = Number(current.rows[0].last_number) + 1;
  await executor.query(`UPDATE receipt_counters SET last_number = $3 WHERE tenant_id = $1 AND year_code = $2`, [tenantId, year, next]);
  return `RCPT-${year}-${String(next).padStart(6, '0')}`;
}

async function createManualPayment(input, user, req) {
  const required = ['studentId', 'studentName', 'feeCategory', 'academicYear', 'semester', 'paymentMethod'];
  const missing = required.filter((field) => !String(input[field] ?? '').trim());
  if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);
  const amountMinor = amountToMinor(input);
  if (!amountMinor) throw new Error('Amount paid must be a positive number.');
  const payment = {
    id: createId('payment'),
    studentId: String(input.studentId).trim(),
    registrationApplicationNumber: String(input.registrationApplicationNumber || '').trim(),
    studentName: String(input.studentName).trim(),
    receiptNumber: String(input.receiptNumber || '').trim(),
    bankName: String(input.bankName || '').trim(),
    depositSlipNumber: String(input.depositSlipNumber || '').trim(),
    tellerNumber: String(input.tellerNumber || '').trim(),
    paymentDate: String(input.paymentDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
    amountMinor,
    amountPaid: amountFromMinor(amountMinor),
    currency: String(input.currency || 'GHS').toUpperCase(),
    paymentMethod: String(input.paymentMethod).trim(),
    feeCategory: String(input.feeCategory).trim(),
    feeCategoryCode: cleanCode(input.feeCategoryCode || input.feeCategory),
    revenueCode: cleanCode(input.revenueCode || `4000-${input.feeCategory}`),
    academicYear: String(input.academicYear).trim(),
    semester: String(input.semester).trim(),
    recordedBy: user.id,
    status: 'POSTED',
    reviewStatus: 'PENDING_REVIEW',
    createdAt: new Date().toISOString()
  };

  if (!dbReady) {
    if (!payment.receiptNumber) payment.receiptNumber = await nextReceiptNumber();
    seed.payments.unshift(payment);
    seed.ledger.push(
      { id: createId('ledger'), accountCode: '1100-CASH-BANK', direction: 'DEBIT', amountMinor, paymentId: payment.id },
      { id: createId('ledger'), accountCode: payment.revenueCode, direction: 'CREDIT', amountMinor, paymentId: payment.id }
    );
    seed.cashbook.unshift({ id: createId('cashbook'), entryDate: payment.paymentDate, entryType: 'RECEIPT', sourceType: 'MANUAL_PAYMENT', sourceId: payment.id, referenceNumber: payment.receiptNumber, registrationApplicationNumber: payment.registrationApplicationNumber, description: `Receipt ${payment.receiptNumber}`, amountMinor, paymentMethod: payment.paymentMethod, accountCode: '1100-CASH-BANK', status: 'POSTED' });
    return { payment, ledger: { updated: true, balanceRecalculated: true } };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!payment.receiptNumber) payment.receiptNumber = await nextReceiptNumber(client);
    const duplicate = await client.query('SELECT id FROM manual_payments WHERE tenant_id = $1 AND receipt_number = $2', [tenantId, payment.receiptNumber]);
    if (duplicate.rowCount) throw new Error('This receipt number has already been recorded.');
    await client.query(
      `INSERT INTO manual_payments (id, tenant_id, student_id, registration_application_number, fee_category_code, revenue_category_code, student_name, receipt_number, bank_name, deposit_slip_number, teller_number, payment_date, amount_minor, currency, payment_method, fee_category, academic_year, semester, recorded_by, status, review_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [payment.id, tenantId, payment.studentId, payment.registrationApplicationNumber || null, payment.feeCategoryCode, payment.revenueCode, payment.studentName, payment.receiptNumber, payment.bankName, payment.depositSlipNumber, payment.tellerNumber, payment.paymentDate, amountMinor, payment.currency, payment.paymentMethod, payment.feeCategory, payment.academicYear, payment.semester, user.id, payment.status, payment.reviewStatus]
    );
    await client.query(
      `INSERT INTO ledger_entries (id, tenant_id, payment_id, account_code, direction, amount_minor, currency, description)
       VALUES ($1, $2, $3, '1100-CASH-BANK', 'DEBIT', $4, $5, $6), ($7, $2, $3, $8, 'CREDIT', $4, $5, $9)`,
      [createId('ledger'), tenantId, payment.id, amountMinor, payment.currency, `Manual payment ${payment.receiptNumber}`, createId('ledger'), payment.revenueCode, `Fee income ${payment.feeCategory}`]
    );
    await client.query(
      `INSERT INTO cashbook_entries (id, tenant_id, entry_date, entry_type, source_type, source_id, reference_number, registration_application_number, description, amount_minor, currency, payment_method, account_code, recorded_by)
       VALUES ($1, $2, $3, 'RECEIPT', 'MANUAL_PAYMENT', $4, $5, $6, $7, $8, $9, $10, '1100-CASH-BANK', $11)`,
      [createId('cashbook'), tenantId, payment.paymentDate, payment.id, payment.receiptNumber, payment.registrationApplicationNumber || null, `Receipt ${payment.receiptNumber}`, amountMinor, payment.currency, payment.paymentMethod, user.id]
    );
    await client.query(
      `INSERT INTO audit_events (id, tenant_id, user_id, action, entity_type, entity_id, after_json, ip_address)
       VALUES ($1, $2, $3, 'CREATE', 'manual_payment', $4, $5, $6)`, 
      [createId('audit'), tenantId, user.id, payment.id, JSON.stringify(payment), String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')]
    );
    await client.query('COMMIT');
    return { payment, ledger: { updated: true, balanceRecalculated: true } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createExpense(input, user, req) {
  const required = ['vendor', 'referenceNumber', 'expenseCategory', 'paymentMethod'];
  const missing = required.filter((field) => !String(input[field] ?? '').trim());
  if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);
  const amountMinor = amountToMinor(input);
  if (!amountMinor) throw new Error('Expense amount must be a positive number.');
  const expense = {
    id: createId('expense'),
    vendor: String(input.vendor).trim(),
    referenceNumber: String(input.referenceNumber).trim(),
    expenseCategory: String(input.expenseCategory).trim(),
    expenseCategoryCode: cleanCode(input.expenseCategoryCode || input.expenseCategory),
    expenseAccountCode: cleanCode(input.expenseAccountCode || `5000-${input.expenseCategory}`),
    paymentMethod: String(input.paymentMethod).trim(),
    expenseDate: String(input.expenseDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
    amountMinor,
    amountPaid: amountFromMinor(amountMinor),
    currency: String(input.currency || 'GHS').toUpperCase(),
    department: String(input.department || '').trim(),
    status: 'POSTED',
    reviewStatus: 'PENDING_REVIEW',
    createdAt: new Date().toISOString()
  };
  if (!dbReady) {
    seed.expenses.unshift(expense);
    seed.ledger.push(
      { id: createId('ledger'), expenseId: expense.id, accountCode: expense.expenseAccountCode, direction: 'DEBIT', amountMinor, paymentId: null },
      { id: createId('ledger'), expenseId: expense.id, accountCode: `1100-${cleanCode(expense.paymentMethod)}`, direction: 'CREDIT', amountMinor, paymentId: null }
    );
    seed.cashbook.unshift({ id: createId('cashbook'), entryDate: expense.expenseDate, entryType: 'PAYMENT', sourceType: 'MANUAL_EXPENSE', sourceId: expense.id, referenceNumber: expense.referenceNumber, description: `Expense ${expense.referenceNumber}`, amountMinor, paymentMethod: expense.paymentMethod, accountCode: `5000-${cleanCode(expense.expenseCategory)}`, status: 'POSTED' });
    return { expense, ledger: { updated: true } };
  }
  // Expense storage is kept separate from payment receipts; ledger posting is still atomic.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `CREATE TABLE IF NOT EXISTS manual_expenses (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        vendor TEXT NOT NULL, reference_number TEXT NOT NULL, expense_category TEXT NOT NULL,
        payment_method TEXT NOT NULL, expense_date DATE NOT NULL, amount_minor BIGINT NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'GHS', department TEXT, recorded_by TEXT NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'POSTED', review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW', reviewed_by TEXT REFERENCES users(id), reviewed_at TIMESTAMPTZ, voided_at TIMESTAMPTZ, void_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, reference_number)
      )`,
    );
    await client.query(
      `INSERT INTO manual_expenses (id, tenant_id, vendor, reference_number, expense_category, expense_category_code, expense_account_code, payment_method, expense_date, amount_minor, currency, department, recorded_by, status, review_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [expense.id, tenantId, expense.vendor, expense.referenceNumber, expense.expenseCategory, expense.expenseCategoryCode, expense.expenseAccountCode, expense.paymentMethod, expense.expenseDate, amountMinor, expense.currency, expense.department, user.id, expense.status, expense.reviewStatus]
    );
    await client.query(
      `INSERT INTO ledger_entries (id, tenant_id, expense_id, account_code, direction, amount_minor, currency, description)
       VALUES ($1, $2, $3, $4, 'DEBIT', $5, $6, $7), ($8, $2, $3, $9, 'CREDIT', $5, $6, $10)`,
      [createId('ledger'), tenantId, expense.id, expense.expenseAccountCode, amountMinor, expense.currency, `Expense ${expense.referenceNumber}`, createId('ledger'), `1100-${cleanCode(expense.paymentMethod)}`, `Payment for ${expense.vendor}`]
    );
    await client.query(
      `INSERT INTO cashbook_entries (id, tenant_id, entry_date, entry_type, source_type, source_id, reference_number, description, amount_minor, currency, payment_method, account_code, recorded_by)
       VALUES ($1, $2, $3, 'PAYMENT', 'MANUAL_EXPENSE', $4, $5, $6, $7, $8, $9, $10, $11)`,
      [createId('cashbook'), tenantId, expense.expenseDate, expense.id, expense.referenceNumber, `Expense ${expense.referenceNumber}`, amountMinor, expense.currency, expense.paymentMethod, expense.expenseAccountCode, user.id]
    );
    await addAudit(user, 'CREATE', 'manual_expense', expense.id, expense, req);
    await client.query('COMMIT');
    return { expense, ledger: { updated: true } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function financeSummary() {
  if (!dbReady) {
    const activePayments = seed.payments.filter((item) => item.status !== 'VOIDED');
    const activeExpenses = seed.expenses.filter((item) => item.status !== 'VOIDED');
    const collections = activePayments.reduce((sum, item) => sum + item.amountMinor, 0);
    const expenses = activeExpenses.reduce((sum, item) => sum + item.amountMinor, 0);
    const pendingCount = [...activePayments, ...activeExpenses].filter((item) => item.reviewStatus === 'PENDING_REVIEW').length;
    return { collectionsMinor: collections, expensesMinor: expenses, netMinor: collections - expenses, paymentCount: activePayments.length, expenseCount: activeExpenses.length, pendingCount, currency: 'GHS' };
  }
  const { rows } = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(amount_minor) FROM manual_payments WHERE tenant_id = $1 AND status <> 'VOIDED'), 0) AS collections_minor,
       COALESCE((SELECT SUM(amount_minor) FROM manual_expenses WHERE tenant_id = $1 AND status <> 'VOIDED'), 0) AS expenses_minor,
       (SELECT COUNT(*) FROM manual_payments WHERE tenant_id = $1 AND status <> 'VOIDED') AS payment_count,
       (SELECT COUNT(*) FROM manual_expenses WHERE tenant_id = $1 AND status <> 'VOIDED') AS expense_count,
       ((SELECT COUNT(*) FROM manual_payments WHERE tenant_id = $1 AND status <> 'VOIDED' AND review_status = 'PENDING_REVIEW') +
        (SELECT COUNT(*) FROM manual_expenses WHERE tenant_id = $1 AND status <> 'VOIDED' AND review_status = 'PENDING_REVIEW')) AS pending_count`,
    [tenantId]
  );
  const row = rows[0];
  const collectionsMinor = Number(row.collections_minor);
  const expensesMinor = Number(row.expenses_minor);
  return { collectionsMinor, expensesMinor, netMinor: collectionsMinor - expensesMinor, paymentCount: Number(row.payment_count), expenseCount: Number(row.expense_count), pendingCount: Number(row.pending_count), currency: 'GHS' };
}

async function recentPayments() {
  if (!dbReady) return seed.payments.slice(0, 20).map((item) => ({ ...item, amountPaid: amountFromMinor(item.amountMinor) }));
  const { rows } = await pool.query(
    `SELECT id, student_id AS "studentId", student_name AS "studentName", receipt_number AS "receiptNumber", payment_date AS "paymentDate", amount_minor AS "amountMinor", currency, payment_method AS "paymentMethod", fee_category AS "feeCategory", status, review_status AS "reviewStatus", created_at AS "createdAt"
     FROM manual_payments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [tenantId]
  );
  return rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor), amountPaid: amountFromMinor(row.amountMinor) }));
}


function memoryTransaction(type, id) {
  const collection = type === 'payment' ? seed.payments : seed.expenses;
  return collection.find((item) => item.id === id);
}

function memoryLedgerFor(type, id) {
  return seed.ledger.filter((entry) => type === 'payment' ? entry.paymentId === id : entry.expenseId === id);
}

function reverseMemoryLedger(type, record, reason) {
  const entries = memoryLedgerFor(type, record.id);
  entries.forEach((entry) => {
    seed.ledger.push({
      id: createId('ledger'),
      paymentId: type === 'payment' ? record.id : null,
      expenseId: type === 'expense' ? record.id : null,
      accountCode: entry.accountCode,
      direction: entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
      amountMinor: entry.amountMinor,
      description: `Reversal: ${reason}`
    });
  });
}

function transactionView(type, record) {
  return type === 'payment'
    ? {
      id: record.id,
      type,
      description: record.studentName,
      reference: record.receiptNumber,
      category: record.feeCategory,
      amountMinor: Number(record.amountMinor),
      amountPaid: amountFromMinor(record.amountMinor),
      currency: record.currency || 'GHS',
      transactionDate: record.paymentDate,
      status: record.status,
      reviewStatus: record.reviewStatus,
      createdAt: record.createdAt,
      studentId: record.studentId,
      studentName: record.studentName,
      receiptNumber: record.receiptNumber,
      feeCategory: record.feeCategory,
      paymentMethod: record.paymentMethod,
      academicYear: record.academicYear,
      semester: record.semester
    }
    : {
      id: record.id,
      type,
      description: record.vendor,
      reference: record.referenceNumber,
      category: record.expenseCategory,
      amountMinor: Number(record.amountMinor),
      amountPaid: amountFromMinor(record.amountMinor),
      currency: record.currency || 'GHS',
      transactionDate: record.expenseDate,
      status: record.status,
      reviewStatus: record.reviewStatus,
      createdAt: record.createdAt,
      vendor: record.vendor,
      referenceNumber: record.referenceNumber,
      expenseCategory: record.expenseCategory,
      paymentMethod: record.paymentMethod,
      department: record.department
    };
}

async function recentTransactions() {
  if (!dbReady) {
    return [
      ...seed.payments.map((item) => transactionView('payment', item)),
      ...seed.expenses.map((item) => transactionView('expense', item))
    ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 50);
  }
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT id, 'payment' AS type, student_name AS description, receipt_number AS reference, fee_category AS category,
              amount_minor AS "amountMinor", currency, payment_date AS "transactionDate", status, review_status AS "reviewStatus", created_at AS "createdAt",
              student_id AS "studentId", student_name AS "studentName", receipt_number AS "receiptNumber", fee_category AS "feeCategory", payment_method AS "paymentMethod", academic_year AS "academicYear", semester,
              NULL::text AS vendor, NULL::text AS "referenceNumber", NULL::text AS "expenseCategory", NULL::text AS department
       FROM manual_payments WHERE tenant_id = $1
       UNION ALL
       SELECT id, 'expense' AS type, vendor AS description, reference_number AS reference, expense_category AS category,
              amount_minor AS "amountMinor", currency, expense_date AS "transactionDate", status, review_status AS "reviewStatus", created_at AS "createdAt",
              NULL::text AS "studentId", NULL::text AS "studentName", NULL::text AS "receiptNumber", NULL::text AS "feeCategory", payment_method AS "paymentMethod", NULL::text AS "academicYear", NULL::text AS semester,
              vendor, reference_number AS "referenceNumber", expense_category AS "expenseCategory", department
       FROM manual_expenses WHERE tenant_id = $1
     ) transactions
     ORDER BY "createdAt" DESC LIMIT 50`,
    [tenantId]
  );
  return rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor), amountPaid: amountFromMinor(row.amountMinor) }));
}

async function editTransaction(type, id, input, user, req) {
  if (!dbReady) {
    const record = memoryTransaction(type, id);
    if (!record || record.status === 'VOIDED') throw new Error('Only active transactions can be edited.');
    const before = { ...record };
    if (type === 'payment') {
      for (const field of ['studentId', 'registrationApplicationNumber', 'studentName', 'receiptNumber', 'bankName', 'depositSlipNumber', 'tellerNumber', 'paymentDate', 'paymentMethod', 'feeCategory', 'feeCategoryCode', 'revenueCode', 'academicYear', 'semester']) {
        if (input[field] !== undefined && String(input[field]).trim()) record[field] = String(input[field]).trim();
      }
    } else {
      for (const field of ['vendor', 'referenceNumber', 'expenseCategory', 'paymentMethod', 'expenseDate', 'department']) {
        if (input[field] !== undefined && String(input[field]).trim()) record[field] = String(input[field]).trim();
      }
    }
    if (input.amountPaid !== undefined || input.amountPaidMinor !== undefined) {
      const amountMinor = amountToMinor(input);
      if (!amountMinor) throw new Error('Updated amount must be a positive number.');
      record.amountMinor = amountMinor;
      record.amountPaid = amountFromMinor(amountMinor);
    }
    const entries = memoryLedgerFor(type, id);
    entries.forEach((entry) => {
      entry.amountMinor = record.amountMinor;
      if (type === 'payment' && record.feeCategory && entry.direction === 'CREDIT') entry.accountCode = record.revenueCode || `4000-${cleanCode(record.feeCategory)}`;
      if (type === 'expense' && record.expenseCategory && entry.direction === 'DEBIT') entry.accountCode = `5000-${cleanCode(record.expenseCategory)}`;
    });
    record.updatedAt = new Date().toISOString();
    record.reviewStatus = 'PENDING_REVIEW';
    seed.activity.unshift({ initials: 'ED', name: user.name, action: `edited ${type} ${record.receiptNumber || record.referenceNumber}`, time: 'just now', tone: 'orange' });
    return { before, after: record };
  }

  const table = type === 'payment' ? 'manual_payments' : 'manual_expenses';
  const current = await pool.query(`SELECT * FROM ${table} WHERE id = $1 AND tenant_id = $2 AND status <> 'VOIDED'`, [id, tenantId]);
  if (!current.rowCount) throw new Error('Active transaction not found.');
  const before = current.rows[0];
  const amountMinor = input.amountPaid !== undefined || input.amountPaidMinor !== undefined ? amountToMinor(input) : null;
  if ((input.amountPaid !== undefined || input.amountPaidMinor !== undefined) && !amountMinor) throw new Error('Updated amount must be a positive number.');
  let result;
  if (type === 'payment') {
    result = await pool.query(
      `UPDATE manual_payments SET student_id = COALESCE($3, student_id), registration_application_number = COALESCE($4, registration_application_number), student_name = COALESCE($5, student_name), receipt_number = COALESCE($6, receipt_number), bank_name = COALESCE($7, bank_name), deposit_slip_number = COALESCE($8, deposit_slip_number), teller_number = COALESCE($9, teller_number), payment_date = COALESCE($10::date, payment_date), amount_minor = COALESCE($11, amount_minor), payment_method = COALESCE($12, payment_method), fee_category = COALESCE($13, fee_category), fee_category_code = COALESCE($14, fee_category_code), revenue_category_code = COALESCE($15, revenue_category_code), academic_year = COALESCE($16, academic_year), semester = COALESCE($17, semester), review_status = 'PENDING_REVIEW', reviewed_by = NULL, reviewed_at = NULL WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId, input.studentId || null, input.registrationApplicationNumber || null, input.studentName || null, input.receiptNumber || null, input.bankName || null, input.depositSlipNumber || null, input.tellerNumber || null, input.paymentDate || null, amountMinor, input.paymentMethod || null, input.feeCategory || null, input.feeCategoryCode || null, input.revenueCode || null, input.academicYear || null, input.semester || null]
    );
    await pool.query(`UPDATE ledger_entries SET amount_minor = COALESCE($2, amount_minor), account_code = CASE WHEN direction = 'CREDIT' AND $3 IS NOT NULL THEN $3 ELSE account_code END WHERE payment_id = $1`, [id, amountMinor, input.revenueCode || (input.feeCategory ? `4000-${cleanCode(input.feeCategory)}` : null)]);
  } else {
    result = await pool.query(
      `UPDATE manual_expenses SET vendor = COALESCE($3, vendor), reference_number = COALESCE($4, reference_number), expense_category = COALESCE($5, expense_category), expense_category_code = COALESCE($6, expense_category_code), expense_account_code = COALESCE($7, expense_account_code), payment_method = COALESCE($8, payment_method), expense_date = COALESCE($9::date, expense_date), amount_minor = COALESCE($10, amount_minor), department = COALESCE($11, department), review_status = 'PENDING_REVIEW', reviewed_by = NULL, reviewed_at = NULL WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId, input.vendor || null, input.referenceNumber || null, input.expenseCategory || null, input.expenseCategoryCode || null, input.expenseAccountCode || null, input.paymentMethod || null, input.expenseDate || null, amountMinor, input.department || null]
    );
    await pool.query(`UPDATE ledger_entries SET amount_minor = COALESCE($2, amount_minor), account_code = CASE WHEN direction = 'DEBIT' AND $3 IS NOT NULL THEN $3 WHEN direction = 'CREDIT' AND $4 IS NOT NULL THEN $4 ELSE account_code END WHERE expense_id = $1`, [id, amountMinor, input.expenseAccountCode || (input.expenseCategory ? `5000-${cleanCode(input.expenseCategory)}` : null), input.paymentMethod ? `1100-${cleanCode(input.paymentMethod)}` : null]);
  }
  const after = result.rows[0];
  await addAudit(user, 'UPDATE', type === 'payment' ? 'manual_payment' : 'manual_expense', id, after, req);
  return { before, after };
}

async function reviewTransaction(type, id, input, user, req) {
  const decision = String(input.decision || 'approve').toLowerCase();
  if (!['approve', 'reject'].includes(decision)) throw new Error('Review decision must be approve or reject.');
  if (!dbReady) {
    const record = memoryTransaction(type, id);
    if (!record || record.status === 'VOIDED') throw new Error('Transaction not found.');
    if (decision === 'reject') {
      reverseMemoryLedger(type, record, 'Rejected during review');
      record.status = 'VOIDED';
      record.reviewStatus = 'REJECTED';
      record.voidReason = String(input.notes || 'Rejected during review');
      record.voidedAt = new Date().toISOString();
    } else {
      record.reviewStatus = 'APPROVED';
    }
    record.reviewedBy = user.id;
    record.reviewedAt = new Date().toISOString();
    return record;
  }
  const table = type === 'payment' ? 'manual_payments' : 'manual_expenses';
  const current = await pool.query(`SELECT * FROM ${table} WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
  if (!current.rowCount) throw new Error('Transaction not found.');
  const record = current.rows[0];
  if (record.status === 'VOIDED') throw new Error('Voided transactions cannot be reviewed.');
  if (decision === 'approve') {
    const result = await pool.query(`UPDATE ${table} SET review_status = 'APPROVED', reviewed_by = $3, reviewed_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId, user.id]);
    await addAudit(user, 'REVIEW_APPROVE', type === 'payment' ? 'manual_payment' : 'manual_expense', id, result.rows[0], req);
    return result.rows[0];
  }
  const voided = await voidTransaction(type, id, { reason: input.notes || 'Rejected during review', reviewStatus: 'REJECTED' }, user, req);
  return voided;
}

async function voidTransaction(type, id, input, user, req) {
  const reason = String(input.reason || 'Voided by finance administrator').trim();
  if (!dbReady) {
    const record = memoryTransaction(type, id);
    if (!record || record.status === 'VOIDED') throw new Error('Active transaction not found.');
    reverseMemoryLedger(type, record, reason);
    const cashbookEntry = seed.cashbook.find((entry) => entry.sourceId === record.id);
    if (cashbookEntry) seed.cashbook.push({ ...cashbookEntry, id: createId('cashbook'), entryType: 'REVERSAL', description: `Reversal: ${reason}`, status: 'POSTED' });
    record.status = 'VOIDED';
    record.reviewStatus = input.reviewStatus || 'VOIDED';
    record.voidReason = reason;
    record.voidedAt = new Date().toISOString();
    return record;
  }
  const table = type === 'payment' ? 'manual_payments' : 'manual_expenses';
  const linkColumn = type === 'payment' ? 'payment_id' : 'expense_id';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`SELECT * FROM ${table} WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [id, tenantId]);
    if (!current.rowCount || current.rows[0].status === 'VOIDED') throw new Error('Active transaction not found.');
    const entries = await client.query(`SELECT account_code, direction, amount_minor, currency, description FROM ledger_entries WHERE ${linkColumn} = $1`, [id]);
    const updated = await client.query(`UPDATE ${table} SET status = 'VOIDED', review_status = $3, voided_at = NOW(), void_reason = $4 WHERE id = $1 AND tenant_id = $2 RETURNING *`, [id, tenantId, input.reviewStatus || 'VOIDED', reason]);
    for (const entry of entries.rows) {
      await client.query(`INSERT INTO ledger_entries (id, tenant_id, ${linkColumn}, account_code, direction, amount_minor, currency, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [createId('ledger'), tenantId, id, entry.account_code, entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT', entry.amount_minor, entry.currency, `Reversal: ${reason}`]);
    }
    const original = current.rows[0];
    const cashDate = type === 'payment' ? original.payment_date : original.expense_date;
    const cashReference = type === 'payment' ? original.receipt_number : original.reference_number;
    const cashMethod = type === 'payment' ? original.payment_method : original.payment_method;
    const cashAccount = type === 'payment' ? '1100-CASH-BANK' : `5000-${cleanCode(original.expense_category)}`;
    await client.query(`INSERT INTO cashbook_entries (id, tenant_id, entry_date, entry_type, source_type, source_id, reference_number, description, amount_minor, currency, payment_method, account_code, recorded_by, status) VALUES ($1, $2, $3, 'REVERSAL', $4, $5, $6, $7, $8, $9, $10, $11, $12, 'POSTED')`, [createId('cashbook'), tenantId, cashDate, type === 'payment' ? 'MANUAL_PAYMENT' : 'MANUAL_EXPENSE', id, `VOID-${cashReference}`, `Reversal: ${reason}`, original.amount_minor, original.currency, cashMethod, cashAccount, user.id]);
    await client.query(`INSERT INTO audit_events (id, tenant_id, user_id, action, entity_type, entity_id, after_json, ip_address) VALUES ($1, $2, $3, 'VOID', $4, $5, $6, $7)`, [createId('audit'), tenantId, user.id, type === 'payment' ? 'manual_payment' : 'manual_expense', id, JSON.stringify(updated.rows[0]), String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')]);
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function parseReportRange(url) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : firstDay;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : today;
  return from <= to ? { from, to } : { from: to, to: from };
}

function formatGhsMinor(minor) {
  return `GHS ${(Number(minor || 0) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatLiveGhanaDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(new Date(value));
}

async function reportTransactions(from, to) {
  if (!dbReady) {
    const rows = [
      ...seed.payments.filter((item) => item.status !== 'VOIDED' && item.paymentDate >= from && item.paymentDate <= to).map((item) => ({
        id: item.id, type: 'income', date: item.paymentDate, description: item.studentName, reference: item.receiptNumber, category: item.feeCategory, amountMinor: item.amountMinor, currency: item.currency || 'GHS', status: item.status, reviewStatus: item.reviewStatus
      })),
      ...seed.expenses.filter((item) => item.status !== 'VOIDED' && item.expenseDate >= from && item.expenseDate <= to).map((item) => ({
        id: item.id, type: 'expense', date: item.expenseDate, description: item.vendor, reference: item.referenceNumber, category: item.expenseCategory, amountMinor: item.amountMinor, currency: item.currency || 'GHS', status: item.status, reviewStatus: item.reviewStatus
      }))
    ];
    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  const { rows } = await pool.query(
    `SELECT id, 'income' AS type, payment_date AS date, student_name AS description, receipt_number AS reference, fee_category AS category, amount_minor AS "amountMinor", currency, status, review_status AS "reviewStatus"
     FROM manual_payments WHERE tenant_id = $1 AND payment_date BETWEEN $2::date AND $3::date AND status <> 'VOIDED'
     UNION ALL
     SELECT id, 'expense' AS type, expense_date AS date, vendor AS description, reference_number AS reference, expense_category AS category, amount_minor AS "amountMinor", currency, status, review_status AS "reviewStatus"
     FROM manual_expenses WHERE tenant_id = $1 AND expense_date BETWEEN $2::date AND $3::date AND status <> 'VOIDED'
     ORDER BY date DESC`,
    [tenantId, from, to]
  );
  return rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor) }));
}

function reportTotals(rows) {
  const incomeMinor = rows.filter((row) => row.type === 'income').reduce((sum, row) => sum + Number(row.amountMinor || 0), 0);
  const expenseMinor = rows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + Number(row.amountMinor || 0), 0);
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
}

function escapeReportHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function reportTitle(report) {
  const titles = {
    transactions: 'Transaction Register',
    'statement-of-financial-position': 'Statement of Financial Position',
    'statement-of-comprehensive-income': 'Statement of Comprehensive Income',
    'statement-of-cash-flows': 'Statement of Cash Flows',
    'trial-balance': 'Trial Balance',
    'bank-reconciliation': 'Bank Reconciliation',
    'accounts-receivable': 'Accounts Receivable Report',
    'accounts-payable': 'Accounts Payable Report',
    'budget-variance': 'Budget and Variance Report'
  };
  return titles[report] || titles.transactions;
}

function reportRowsFor(report, rows, totals) {
  if (report === 'statement-of-comprehensive-income') {
    const byCategory = new Map();
    rows.forEach((row) => {
      const key = `${row.type}:${row.category}`;
      const current = byCategory.get(key) || { type: row.type, category: row.category, amountMinor: 0 };
      current.amountMinor += Number(row.amountMinor || 0);
      byCategory.set(key, current);
    });
    return [...byCategory.values()].map((row) => ({ date: '', description: row.type === 'income' ? 'Income' : 'Expense', reference: '', category: row.category, amountMinor: row.type === 'income' ? row.amountMinor : -row.amountMinor, type: row.type }));
  }
  if (report === 'trial-balance') {
    const totalsByAccount = new Map();
    rows.forEach((row) => {
      const account = row.type === 'income' ? `4000-${row.category}` : `5000-${row.category}`;
      const current = totalsByAccount.get(account) || { account, debitMinor: 0, creditMinor: 0 };
      if (row.type === 'income') current.creditMinor += Number(row.amountMinor || 0);
      else current.debitMinor += Number(row.amountMinor || 0);
      totalsByAccount.set(account, current);
    });
    const cash = totals.incomeMinor - totals.expenseMinor;
    totalsByAccount.set('1100-CASH-BANK', { account: '1100-CASH-BANK', debitMinor: Math.max(cash, 0), creditMinor: Math.max(-cash, 0) });
    return [...totalsByAccount.values()].map((row) => ({ date: '', description: row.account, reference: '', category: row.debitMinor ? 'Debit' : 'Credit', amountMinor: row.debitMinor || row.creditMinor, type: row.debitMinor ? 'debit' : 'credit', debitMinor: row.debitMinor, creditMinor: row.creditMinor }));
  }
  if (report === 'statement-of-financial-position') {
    return [
      { date: '', description: 'Cash and bank movement', reference: '', category: 'Current assets', amountMinor: totals.netMinor, type: 'position' },
      { date: '', description: 'Current period result', reference: '', category: 'Equity / retained result', amountMinor: totals.netMinor, type: 'position' }
    ];
  }
  if (report === 'statement-of-cash-flows') {
    return [
      { date: '', description: 'Cash received from fees and other income', reference: '', category: 'Operating inflows', amountMinor: totals.incomeMinor, type: 'income' },
      { date: '', description: 'Cash paid for expenses', reference: '', category: 'Operating outflows', amountMinor: -totals.expenseMinor, type: 'expense' },
      { date: '', description: 'Net movement in cash', reference: '', category: 'Net cash flow', amountMinor: totals.netMinor, type: 'position' }
    ];
  }
  if (report === 'accounts-receivable') return rows.filter((row) => row.type === 'income');
  if (report === 'accounts-payable') return rows.filter((row) => row.type === 'expense');
  if (report === 'bank-reconciliation') return rows.map((row) => ({ ...row, category: `${row.type === 'income' ? 'Deposit' : 'Payment'} / ${row.category}` }));
  if (report === 'budget-variance') return [{ date: '', description: 'Budget lines have not been configured for this period.', reference: '', category: 'Configuration required', amountMinor: 0, type: 'info' }];
  return rows;
}

function reportTableHtml(rows, report) {
  const isTrial = report === 'trial-balance';
  const head = isTrial ? '<th>Account</th><th>Debit</th><th>Credit</th>' : '<th>Date</th><th>Description</th><th>Reference</th><th>Category</th><th class="money">Amount</th>';
  const body = rows.length ? rows.map((row) => {
    if (isTrial) return `<tr><td>${escapeReportHtml(row.description)}</td><td class="money">${formatGhsMinor(row.debitMinor)}</td><td class="money">${formatGhsMinor(row.creditMinor)}</td></tr>`;
    const amount = Number(row.amountMinor || 0);
    return `<tr><td>${escapeReportHtml(row.date)}</td><td>${escapeReportHtml(row.description)}</td><td>${escapeReportHtml(row.reference)}</td><td>${escapeReportHtml(row.category)}</td><td class="money ${amount < 0 ? 'negative' : ''}">${formatGhsMinor(amount)}</td></tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">No records found for this period.</td></tr>';
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function reportPageHtml(report, rows, totals, from, to) {
  const title = reportTitle(report);
  const activeRows = reportRowsFor(report, rows, totals);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeReportHtml(title)} · CAREST College of Health</title><style>
  :root{--navy:#163d68;--red:#c62943;--ink:#1c2b39;--muted:#71808c;--line:#dce4ea;--paper:#f7fafc}*{box-sizing:border-box}body{margin:0;color:var(--ink);background:#eaf0f4;font:13px Arial,Helvetica,sans-serif}.report{width:210mm;min-height:297mm;margin:18px auto;padding:18mm 16mm;background:#fff;box-shadow:0 8px 30px #1839541f}.toolbar{width:210mm;margin:18px auto 0;display:flex;justify-content:space-between;align-items:center}.toolbar button,.toolbar a{border:1px solid #b8cbd9;background:#fff;color:var(--navy);padding:8px 12px;font-size:11px;text-decoration:none;cursor:pointer}.report-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:3px solid var(--navy)}.brand{display:flex;gap:12px;align-items:center}.brand img{width:210px;height:auto}.report-type{text-align:right}.report-type h1{margin:0 0 8px;color:var(--navy);font-size:23px;line-height:1.1}.report-type p{margin:2px 0;color:var(--muted);font-size:11px}.report-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:18px 0;padding:11px 13px;border:1px solid var(--line);background:var(--paper)}.report-meta span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.09em}.report-meta strong{display:block;margin-top:4px;color:var(--ink);font-size:12px}.summary{display:flex;gap:10px;margin:18px 0}.summary-card{flex:1;padding:12px;border:1px solid var(--line);background:#fff}.summary-card span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase}.summary-card strong{display:block;margin-top:8px;color:var(--navy);font-size:18px}.summary-card.net{border-top:3px solid var(--red)}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:10px}th{padding:9px 8px;border-bottom:2px solid var(--navy);color:var(--navy);background:#edf4f8;font-size:9px;letter-spacing:.06em;text-align:left;text-transform:uppercase}td{padding:9px 8px;border-bottom:1px solid var(--line)}.money{text-align:right;white-space:nowrap}.negative{color:var(--red)}.empty{text-align:center;color:var(--muted);padding:30px}.note{margin-top:24px;padding:12px;border-left:3px solid var(--red);color:var(--muted);background:#fff6f7;font-size:10px;line-height:1.5}.signature{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:55px}.signature div{padding-top:9px;border-top:1px solid #9dafbb;color:var(--muted);font-size:10px}.report-footer{display:flex;justify-content:space-between;margin-top:40px;padding-top:10px;border-top:1px solid var(--line);color:#8a98a2;font-size:9px}@media print{body{background:#fff}.toolbar{display:none}.report{width:auto;min-height:auto;margin:0;padding:12mm;box-shadow:none}@page{size:A4;margin:0}}
  </style></head><body><div class="toolbar"><span>CAREST 360 · ${escapeReportHtml(title)}</span><span><button onclick="if(history.length>1){history.back()}else{location.href='/dashboard'}">← Back</button> <button onclick="window.print()">Print / spool</button> <a href="?format=pdf">PDF</a> <a href="?format=xlsx">Excel</a> <a href="?format=csv">CSV</a> <a href="/dashboard">Dashboard</a></span></div><main class="report"><header class="report-header"><div class="brand"><img src="/assets/carest-logo-cropped.png" alt="CAREST College of Health"></div><div class="report-type"><h1>${escapeReportHtml(title)}</h1><p>CAREST College of Health</p><p>Hohoe · Volta Region · Ghana</p></div></header><section class="report-meta"><div><span>Reporting period</span><strong>${escapeReportHtml(from)} — ${escapeReportHtml(to)}</strong></div><div><span>Currency</span><strong>GHS · Ghana Cedi</strong></div><div><span>Generated</span><strong>${escapeReportHtml(formatLiveGhanaDate())}</strong></div></section><section class="summary"><div class="summary-card"><span>Total income</span><strong>${formatGhsMinor(totals.incomeMinor)}</strong></div><div class="summary-card"><span>Total expenses</span><strong>${formatGhsMinor(totals.expenseMinor)}</strong></div><div class="summary-card net"><span>Net movement</span><strong>${formatGhsMinor(totals.netMinor)}</strong></div></section>${reportTableHtml(activeRows, report)}<div class="note">Prepared by CAREST 360. Financial records remain subject to authorized review, correction controls, period close and the College’s applicable accounting policies. This report is generated from transactions recorded within the selected period.</div><div class="signature"><div>Prepared by / Finance Officer</div><div>Reviewed by / Finance Administrator</div></div><footer class="report-footer"><span>CAREST College of Health · Official finance report</span><span>Page 1</span></footer></main></body></html>`;
}


function chartOfAccountsReportHtml(accounts) {
  const rows = accounts.map((account) => `<tr><td>${escapeReportHtml(account.code)}</td><td>${escapeReportHtml(account.name)}</td><td>${escapeReportHtml(account.accountType)}</td><td>${escapeReportHtml(account.normalBalance || '')}</td><td>${escapeReportHtml(account.usageNote || '')}</td><td>${account.active === false ? 'Inactive' : 'Active'}</td></tr>`).join('') || '<tr><td colspan="6">No accounts configured.</td></tr>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chart of Accounts · CAREST College of Health</title><style>body{margin:0;background:#eef3f6;color:#1d2b38;font:13px Arial,sans-serif}.toolbar{width:210mm;margin:18px auto;display:flex;justify-content:space-between}.toolbar button{padding:8px 12px;border:1px solid #b9cad6;background:#fff;color:#163d68;cursor:pointer}.report{width:210mm;min-height:297mm;margin:0 auto;padding:16mm;background:#fff;box-shadow:0 8px 30px #1839541f}.head{display:flex;justify-content:space-between;border-bottom:3px solid #163d68;padding-bottom:14px}.head img{width:210px}.head h1{margin:0;color:#163d68;font-size:24px;text-align:right}.head p{text-align:right;color:#70808c;font-size:10px}.meta{margin:18px 0;padding:10px;background:#f1f6f9;color:#70808c;font-size:10px}.meta strong{color:#163d68}.table{width:100%;border-collapse:collapse;font-size:10px}.table th{padding:9px;border-bottom:2px solid #163d68;background:#edf4f8;color:#163d68;text-align:left;font-size:9px;text-transform:uppercase}.table td{padding:9px;border-bottom:1px solid #dce5eb;vertical-align:top}.note{margin-top:18px;padding:12px;border-left:3px solid #c62943;background:#fff5f6;color:#70808c;font-size:10px;line-height:1.5}@media print{body{background:#fff}.toolbar{display:none}.report{width:auto;margin:0;box-shadow:none}@page{size:A4;margin:0}}</style></head><body><div class="toolbar"><span>CAREST 360 · Chart of accounts reference</span><span><button onclick="if(history.length>1){history.back()}else{location.href='/dashboard'}">← Back</button> <button onclick="window.print()">Print / spool</button> <a href="?format=pdf">PDF</a> <a href="?format=csv">CSV</a> <a href="/dashboard">Dashboard</a></span></div><main class="report"><header class="head"><img src="/assets/carest-logo-cropped.png" alt="CAREST College of Health"><div><h1>Chart of Accounts</h1><p>CAREST College of Health</p><p>Hohoe · Volta Region · Ghana</p></div></header><div class="meta">Generated: <strong>${escapeReportHtml(formatLiveGhanaDate())}</strong> · This reference lists account classification, normal balance and how each code should be used.</div><table class="table"><thead><tr><th>Code</th><th>Account name</th><th>Classification</th><th>Normal balance</th><th>How to use</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div class="note">Use only active accounts when posting. Assets and expenses normally carry debit balances; liabilities, equity and income normally carry credit balances. Any exception must be approved by the finance administrator and recorded in the audit trail.</div></main></body></html>`;
}

function sendAccountCsv(res, accounts) {
  const header = ['Code', 'Account name', 'Classification', 'Normal balance', 'How to use', 'Status'];
  const values = accounts.map((account) => [account.code, account.name, account.accountType, account.normalBalance, account.usageNote, account.active === false ? 'Inactive' : 'Active']);
  const csv = [header, ...values].map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="carest-chart-of-accounts.csv"', 'Content-Length': Buffer.byteLength(csv) });
  res.end(csv);
}

async function getPaymentById(id) {
  let payment;
  if (!dbReady) {
    payment = seed.payments.find((item) => item.id === id) || null;
    if (!payment) return null;
    const registration = seed.registrations.find((item) => item.studentNumber === payment.studentId || item.applicationNumber === payment.registrationApplicationNumber) || null;
    return { ...payment, registration };
  }
  const { rows } = await pool.query('SELECT * FROM manual_payments WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  payment = rows[0] || null;
  if (!payment) return null;
  const registration = await pool.query(`SELECT student_number AS "studentNumber", application_number AS "applicationNumber", first_name AS "firstName", last_name AS "lastName", phone, email, whatsapp, guardian_name AS "guardianName", guardian_phone AS "guardianPhone", emergency_contact_name AS "emergencyContactName", emergency_contact_phone AS "emergencyContactPhone" FROM student_registrations WHERE tenant_id = $1 AND (student_number = $2 OR application_number = $2) LIMIT 1`, [tenantId, payment.registration_application_number || payment.student_id]);
  return { ...payment, registration: registration.rows[0] || null };
}

function receiptPageHtml(payment) {
  const amountMinor = Number(payment.amountMinor || 0);
  const amount = formatGhsMinor(amountMinor);
  const paymentDate = payment.paymentDate || payment.payment_date;
  const studentId = payment.studentId || payment.student_id;
  const studentName = payment.studentName || payment.student_name;
  const receiptNumber = payment.receiptNumber || payment.receipt_number;
  const feeCategory = payment.feeCategory || payment.fee_category;
  const paymentMethod = payment.paymentMethod || payment.payment_method;
  const registration = payment.registration || {};
  const studentPhone = payment.phone || registration.phone || '—';
  const studentEmail = payment.email || registration.email || '—';
  const whatsapp = payment.whatsapp || registration.whatsapp || '—';
  const guardianName = payment.guardianName || registration.guardianName || '—';
  const guardianPhone = payment.guardianPhone || registration.guardianPhone || registration.emergencyContactPhone || '—';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${escapeReportHtml(receiptNumber)} · CAREST College of Health</title><style>:root{--navy:#163d68;--red:#c62943;--line:#dbe4eb;--muted:#6f7e89}*{box-sizing:border-box}body{margin:0;background:#eaf0f4;color:#1c2b39;font:13px Arial,sans-serif}.toolbar{width:180mm;margin:18px auto;display:flex;justify-content:space-between}.toolbar button{border:1px solid #a9bdcb;background:#fff;color:var(--navy);padding:8px 13px;cursor:pointer}.receipt{width:180mm;min-height:120mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 8px 30px #1839541f}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--navy);padding-bottom:16px}.head img{width:220px}.head h1{margin:0;color:var(--navy);font-size:21px;text-align:right}.head p{margin:4px 0 0;color:var(--muted);font-size:10px;text-align:right}.receipt-label{display:flex;justify-content:space-between;margin:18px 0 10px;padding:10px 12px;background:#edf4f8;color:var(--navy);font-size:11px;font-weight:bold;text-transform:uppercase}.details{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.detail{border:1px solid var(--line);padding:10px}.detail span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase}.detail strong{display:block;margin-top:5px;font-size:12px}.amount{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:14px;background:#fff5f6;border-left:4px solid var(--red)}.amount span{color:var(--muted);font-size:10px}.amount strong{color:var(--red);font-size:21px}.notice{margin-top:18px;color:var(--muted);font-size:10px;line-height:1.5}.sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:42px}.sign div{border-top:1px solid #a5b5c0;padding-top:8px;color:var(--muted);font-size:9px}@media print{body{background:#fff}.toolbar{display:none}.receipt{width:auto;margin:0;box-shadow:none}@page{size:A4;margin:0}}</style></head><body><div class="toolbar"><span>CAREST 360 · official payment receipt</span><span><button onclick="if(history.length>1){history.back()}else{location.href='/dashboard'}">← Back</button> <button onclick="window.print()">Print / spool receipt</button> <a href="?format=pdf">Download PDF</a> <a href="/dashboard">Dashboard</a></span></div><main class="receipt"><header class="head"><img src="/assets/carest-logo-cropped.png" alt="CAREST College of Health"><div><h1>Payment Receipt</h1><p>CAREST College of Health</p><p>Hohoe · Volta Region · Ghana</p></div></header><div class="receipt-label"><span>Bill / Official Receipt</span><span>${escapeReportHtml(receiptNumber)}</span></div><section class="details"><div class="detail"><span>Student ID</span><strong>${escapeReportHtml(studentId)}</strong></div><div class="detail"><span>Student name</span><strong>${escapeReportHtml(studentName)}</strong></div><div class="detail"><span>Student phone</span><strong>${escapeReportHtml(studentPhone)}</strong></div><div class="detail"><span>Student email</span><strong>${escapeReportHtml(studentEmail)}</strong></div><div class="detail"><span>WhatsApp</span><strong>${escapeReportHtml(whatsapp)}</strong></div><div class="detail"><span>Guardian / emergency</span><strong>${escapeReportHtml(guardianName)} · ${escapeReportHtml(guardianPhone)}</strong></div><div class="detail"><span>Payment date</span><strong>${escapeReportHtml(paymentDate)}</strong></div><div class="detail"><span>Payment method</span><strong>${escapeReportHtml(paymentMethod)}</strong></div><div class="detail"><span>Academic year</span><strong>${escapeReportHtml(payment.academicYear || payment.academic_year)}</strong></div><div class="detail"><span>Semester</span><strong>${escapeReportHtml(payment.semester)}</strong></div><div class="detail"><span>Fee category</span><strong>${escapeReportHtml(feeCategory)}</strong></div><div class="detail"><span>Bank / deposit slip</span><strong>${escapeReportHtml(payment.bankName || payment.bank_name || '—')} / ${escapeReportHtml(payment.depositSlipNumber || payment.deposit_slip_number || '—')}</strong></div></section><div class="amount"><span>Amount received</span><strong>${amount}</strong></div><p class="notice">This receipt was generated by CAREST 360 after a finance officer recorded the external payment evidence. Keep it for your records. Any correction must be reviewed and will remain in the audit history.</p><div class="sign"><div>Recorded by / Finance Officer</div><div>Reviewed by / Finance Administrator</div></div></main></body></html>`;
}

async function sendPdf(res, title, htmlData) {
  try {
    const pdfModule = await import('pdfkit');
    const PDFDocument = pdfModule.default || pdfModule;
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise((resolve) => doc.on('end', resolve));
    const logoPath = join(publicDir, 'assets', 'carest-logo-cropped.png');
    doc.image(logoPath, { width: 180 });
    doc.moveDown(1);
    doc.fillColor('#163d68').fontSize(20).text(title);
    doc.fillColor('#6f7e89').fontSize(9).text('CAREST College of Health · Hohoe, Volta Region, Ghana');
    doc.moveDown(.8);
    doc.strokeColor('#163d68').lineWidth(2).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown(1);
    doc.fillColor('#1c2b39').fontSize(10).text(htmlData.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000));
    doc.moveDown(2);
    doc.fillColor('#6f7e89').fontSize(8).text(`Generated ${formatLiveGhanaDate()}`);
    doc.end();
    await done;
    const buffer = Buffer.concat(chunks);
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf"`, 'Content-Length': buffer.length });
    res.end(buffer);
  } catch (error) {
    sendError(res, 503, 'PDF generation is not available until the reporting dependencies are installed.', { error: error.message });
  }
}

function sendCsv(res, title, rows) {
  const header = ['Date', 'Type', 'Description', 'Reference', 'Category', 'Amount (GHS)', 'Status', 'Review'];
  const values = rows.map((row) => [row.date, row.type, row.description, row.reference, row.category, (Number(row.amountMinor || 0) / 100).toFixed(2), row.status, row.reviewStatus]);
  const csv = [header, ...values].map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv"`, 'Content-Length': Buffer.byteLength(csv) });
  res.end(csv);
}

async function sendXlsx(res, title, rows) {
  try {
    const excelModule = await import('exceljs');
    const ExcelJS = excelModule.default || excelModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CAREST 360';
    const sheet = workbook.addWorksheet(title.slice(0, 31));
    sheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Category', key: 'category', width: 28 },
      { header: 'Amount (GHS)', key: 'amount', width: 16 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Review', key: 'review', width: 16 }
    ];
    rows.forEach((row) => sheet.addRow({ date: row.date, type: row.type, description: row.description, reference: row.reference, category: row.category, amount: Number(row.amountMinor || 0) / 100, status: row.status, review: row.reviewStatus }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163D68' } };
    sheet.getColumn('amount').numFmt = 'GHS #,##0.00';
    const buffer = await workbook.xlsx.writeBuffer();
    const content = Buffer.from(buffer);
    res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx"`, 'Content-Length': content.length });
    res.end(content);
  } catch (error) {
    sendError(res, 503, 'Excel export is not available until the reporting dependencies are installed.', { error: error.message });
  }
}



function calculateDepreciation(asset) {
  const cost = Number(asset.costMinor ?? asset.cost_minor ?? 0);
  const residual = Number(asset.residualValueMinor ?? asset.residual_value_minor ?? 0);
  const life = Number(asset.usefulLifeMonths ?? asset.useful_life_months ?? 0);
  const inService = new Date(asset.inServiceDate || asset.in_service_date || new Date());
  const months = Math.max(0, (new Date().getUTCFullYear() - inService.getUTCFullYear()) * 12 + new Date().getUTCMonth() - inService.getUTCMonth());
  const depreciable = Math.max(0, cost - residual);
  const monthly = life ? depreciable / life : 0;
  const accumulated = Math.min(depreciable, Math.round(monthly * months));
  return { accumulatedDepreciationMinor: accumulated, netBookValueMinor: Math.max(0, cost - accumulated), monthlyDepreciationMinor: Math.round(monthly) };
}

async function getLedgerEntries() {
  if (!dbReady) return seed.ledger.map((entry) => ({ ...entry, createdAt: entry.createdAt || new Date().toISOString() }));
  const { rows } = await pool.query(
    `SELECT id, account_code AS "accountCode", direction, amount_minor AS "amountMinor", currency, description, created_at AS "createdAt"
     FROM ledger_entries WHERE tenant_id = $1
     UNION ALL
     SELECT jl.id, jl.account_code AS "accountCode", CASE WHEN jl.debit_minor > 0 THEN 'DEBIT' ELSE 'CREDIT' END AS direction,
            CASE WHEN jl.debit_minor > 0 THEN jl.debit_minor ELSE jl.credit_minor END AS "amountMinor", jl.currency, je.description, je.created_at AS "createdAt"
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_id
     WHERE je.tenant_id = $1 AND je.status = 'POSTED'
     ORDER BY "createdAt" DESC LIMIT 250`,
    [tenantId]
  );
  return rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor) }));
}

async function getTrialBalance() {
  const entries = await getLedgerEntries();
  const grouped = new Map();
  entries.forEach((entry) => {
    const current = grouped.get(entry.accountCode) || { accountCode: entry.accountCode, debitMinor: 0, creditMinor: 0 };
    if (entry.direction === 'DEBIT') current.debitMinor += Number(entry.amountMinor || 0);
    else current.creditMinor += Number(entry.amountMinor || 0);
    grouped.set(entry.accountCode, current);
  });
  const rows = [...grouped.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  return { rows, totals: { debitMinor: rows.reduce((sum, row) => sum + row.debitMinor, 0), creditMinor: rows.reduce((sum, row) => sum + row.creditMinor, 0) } };
}

async function getApprovals() {
  if (!dbReady) {
    return [
      ...seed.payments.filter((item) => item.reviewStatus === 'PENDING_REVIEW').map((item) => ({ id: item.id, entityType: 'manual_payment', description: item.studentName, amountMinor: item.amountMinor, status: 'PENDING', createdAt: item.createdAt })),
      ...seed.expenses.filter((item) => item.reviewStatus === 'PENDING_REVIEW').map((item) => ({ id: item.id, entityType: 'manual_expense', description: item.vendor, amountMinor: item.amountMinor, status: 'PENDING', createdAt: item.createdAt })),
      ...seed.journals.filter((item) => item.status === 'PENDING_REVIEW').map((item) => ({ id: item.id, entityType: 'journal_entry', description: item.description, amountMinor: item.debitTotal, status: 'PENDING', createdAt: new Date().toISOString() }))
    ];
  }
  const { rows } = await pool.query(
    `SELECT id, 'manual_payment' AS "entityType", student_name AS description, amount_minor AS "amountMinor", review_status AS status, created_at AS "createdAt" FROM manual_payments WHERE tenant_id = $1 AND review_status = 'PENDING_REVIEW'
     UNION ALL SELECT id, 'manual_expense', vendor, amount_minor, review_status, created_at FROM manual_expenses WHERE tenant_id = $1 AND review_status = 'PENDING_REVIEW'
     UNION ALL SELECT id, 'journal_entry', description, 0, status, created_at FROM journal_entries WHERE tenant_id = $1 AND status = 'PENDING_REVIEW'
     UNION ALL SELECT id, 'accrual', description, amount_minor, status, created_at FROM accruals WHERE tenant_id = $1 AND status = 'PENDING_REVIEW'
     ORDER BY "createdAt" DESC LIMIT 100`,
    [tenantId]
  );
  return rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor || 0) }));
}

async function getAuditEvents() {
  if (!dbReady) return seed.activity.map((item, index) => ({ id: `memory_${index}`, action: item.action, entityType: 'review', entityId: item.initials, createdAt: new Date().toISOString(), userName: item.name }));
  const { rows } = await pool.query(`SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId", a.created_at AS "createdAt", COALESCE(u.name, 'System') AS "userName" FROM audit_events a LEFT JOIN users u ON u.id = a.user_id WHERE a.tenant_id = $1 ORDER BY a.created_at DESC LIMIT 100`, [tenantId]);
  return rows;
}

async function getRevenueSummary() {
  const rows = await reportTransactions('1900-01-01', '2999-12-31');
  const grouped = new Map();
  rows.filter((row) => row.type === 'income').forEach((row) => grouped.set(row.category, (grouped.get(row.category) || 0) + Number(row.amountMinor || 0)));
  return [...grouped.entries()].map(([category, amountMinor]) => ({ category, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor);
}

async function getBankReconciliations() {
  if (!dbReady) return seed.bankReconciliations;
  const { rows } = await pool.query(`SELECT br.id, br.statement_date AS "statementDate", br.closing_balance_minor AS "closingBalanceMinor", br.status, br.notes, ba.name AS "bankAccount" FROM bank_reconciliations br JOIN bank_accounts ba ON ba.id = br.bank_account_id WHERE ba.tenant_id = $1 ORDER BY br.statement_date DESC LIMIT 50`, [tenantId]);
  return rows.map((row) => ({ ...row, closingBalanceMinor: Number(row.closingBalanceMinor) }));
}

async function createBankReconciliation(input, user, req) {
  const item = { id: createId('reconciliation'), statementDate: String(input.statementDate || new Date().toISOString().slice(0, 10)), closingBalanceMinor: amountToMinor({ amountPaid: input.closingBalance }), status: 'OPEN', bankAccount: String(input.bankAccount || 'Main bank account'), notes: String(input.notes || '') };
  if (!item.closingBalanceMinor) throw new Error('Closing bank balance must be positive.');
  if (!dbReady) { seed.bankReconciliations.unshift(item); return item; }
  let bank = await pool.query(`SELECT id FROM bank_accounts WHERE tenant_id = $1 AND name = $2`, [tenantId, item.bankAccount]);
  if (!bank.rowCount) {
    bank = await pool.query(`INSERT INTO bank_accounts (id, tenant_id, name, bank_name) VALUES ($1, $2, $3, $3) RETURNING id`, [createId('bank'), tenantId, item.bankAccount]);
  }
  await pool.query(`INSERT INTO bank_reconciliations (id, bank_account_id, statement_date, closing_balance_minor, status, notes) VALUES ($1, $2, $3, $4, $5, $6)`, [item.id, bank.rows[0].id, item.statementDate, item.closingBalanceMinor, item.status, item.notes]);
  await addAudit(user, 'CREATE', 'bank_reconciliation', item.id, item, req);
  return item;
}

async function getCashbook() {
  if (!dbReady) return seed.cashbook.slice().sort((a, b) => String(b.entryDate).localeCompare(String(a.entryDate)));
  const { rows } = await pool.query(`SELECT id, entry_date AS "entryDate", entry_type AS "entryType", source_type AS "sourceType", source_id AS "sourceId", reference_number AS "referenceNumber", registration_application_number AS "registrationApplicationNumber", description, amount_minor AS "amountMinor", currency, payment_method AS "paymentMethod", account_code AS "accountCode", status FROM cashbook_entries WHERE tenant_id = $1 ORDER BY entry_date DESC, created_at DESC LIMIT 250`, [tenantId]);
  return rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor) }));
}

async function getPettyCash() {
  if (!dbReady) {
    const transactions = seed.pettyCash;
    const balanceMinor = transactions.reduce((sum, item) => sum + (item.transactionType === 'INFLOW' ? item.amountMinor : -item.amountMinor), 0);
    return { transactions, balanceMinor };
  }
  const { rows } = await pool.query(`SELECT id, transaction_date AS "transactionDate", transaction_type AS "transactionType", description, reference_number AS "referenceNumber", amount_minor AS "amountMinor", category FROM petty_cash_transactions WHERE tenant_id = $1 ORDER BY transaction_date DESC, created_at DESC LIMIT 100`, [tenantId]);
  const transactions = rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor) }));
  const balanceMinor = transactions.reduce((sum, item) => sum + (item.transactionType === 'INFLOW' ? item.amountMinor : -item.amountMinor), 0);
  return { transactions, balanceMinor };
}

async function createPettyCash(input, user, req) {
  const amountMinor = amountToMinor(input);
  const transactionType = String(input.transactionType || '').toUpperCase();
  const description = String(input.description || '').trim();
  if (!amountMinor || !['INFLOW', 'OUTFLOW'].includes(transactionType) || !description) throw new Error('Petty cash requires a positive amount, inflow/outflow type and description.');
  const item = { id: createId('petty'), transactionDate: String(input.transactionDate || new Date().toISOString().slice(0, 10)), transactionType, description, referenceNumber: String(input.referenceNumber || ''), amountMinor, category: String(input.category || '') };
  if (!dbReady) { seed.pettyCash.unshift(item); seed.cashbook.unshift({ id: createId('cashbook'), entryDate: item.transactionDate, entryType: item.transactionType === 'INFLOW' ? 'RECEIPT' : 'PAYMENT', sourceType: 'PETTY_CASH', sourceId: item.id, referenceNumber: item.referenceNumber, description: item.description, amountMinor: item.amountMinor, paymentMethod: 'PETTY_CASH', accountCode: '1000-PETTY-CASH', status: 'POSTED' }); return item; }
  let account = await pool.query(`SELECT id FROM petty_cash_accounts WHERE tenant_id = $1 ORDER BY name LIMIT 1`, [tenantId]);
  if (!account.rowCount) account = await pool.query(`INSERT INTO petty_cash_accounts (id, tenant_id, name) VALUES ($1, $2, 'Main petty cash') RETURNING id`, [createId('petty_account'), tenantId]);
  await pool.query(`INSERT INTO petty_cash_transactions (id, account_id, tenant_id, transaction_date, transaction_type, description, reference_number, amount_minor, category, recorded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [item.id, account.rows[0].id, tenantId, item.transactionDate, item.transactionType, item.description, item.referenceNumber, item.amountMinor, item.category, user.id]);
  await pool.query(`INSERT INTO cashbook_entries (id, tenant_id, entry_date, entry_type, source_type, source_id, reference_number, description, amount_minor, currency, payment_method, account_code, recorded_by) VALUES ($1, $2, $3, $4, 'PETTY_CASH', $5, $6, $7, $8, 'GHS', 'PETTY_CASH', '1000-PETTY-CASH', $9)`, [createId('cashbook'), tenantId, item.transactionDate, item.transactionType === 'INFLOW' ? 'RECEIPT' : 'PAYMENT', item.id, item.referenceNumber, item.description, item.amountMinor, user.id]);
  await addAudit(user, 'CREATE', 'petty_cash_transaction', item.id, item, req);
  return item;
}

async function getBudgets() {
  if (!dbReady) return seed.budgets;
  const { rows } = await pool.query(`SELECT id, name, period_name AS "periodName", status, created_at AS "createdAt" FROM budgets WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
  return rows;
}

async function createBudget(input, user, req) {
  const name = String(input.name || '').trim();
  const periodName = String(input.periodName || '').trim();
  const amountMinor = amountToMinor(input);
  if (!name || !periodName || !amountMinor) throw new Error('Budget requires a name, period and positive amount.');
  const item = { id: createId('budget'), name, periodName, amountMinor, status: 'DRAFT' };
  if (!dbReady) { seed.budgets.unshift(item); return item; }
  await pool.query(`INSERT INTO budgets (id, tenant_id, name, period_name, status) VALUES ($1, $2, $3, $4, 'DRAFT')`, [item.id, tenantId, item.name, item.periodName]);
  await pool.query(`INSERT INTO budget_lines (id, budget_id, account_code, amount_minor) VALUES ($1, $2, $3, $4)`, [createId('budget_line'), item.id, cleanCode(input.accountCode, '5000-OTHER_EXPENSE'), item.amountMinor]);
  await addAudit(user, 'CREATE', 'budget', item.id, item, req);
  return item;
}

async function getAssets() {
  if (!dbReady) return seed.assets.map((asset) => ({ ...asset, ...calculateDepreciation(asset) }));
  const { rows } = await pool.query(`SELECT id, asset_code AS "assetCode", name, category, acquisition_date AS "acquisitionDate", in_service_date AS "inServiceDate", cost_minor AS "costMinor", residual_value_minor AS "residualValueMinor", useful_life_months AS "usefulLifeMonths", depreciation_method AS "depreciationMethod", status FROM fixed_assets WHERE tenant_id = $1 ORDER BY acquisition_date DESC`, [tenantId]);
  return rows.map((row) => ({ ...row, costMinor: Number(row.costMinor), residualValueMinor: Number(row.residualValueMinor), ...calculateDepreciation(row) }));
}

async function createAsset(input, user, req) {
  const costMinor = amountToMinor({ amountPaid: input.cost });
  const usefulLifeMonths = Number(input.usefulLifeMonths);
  const name = String(input.name || '').trim();
  if (!name || !costMinor || !Number.isInteger(usefulLifeMonths) || usefulLifeMonths <= 0) throw new Error('Asset requires a name, positive cost and useful life in months.');
  const asset = { id: createId('asset'), assetCode: cleanCode(input.assetCode || name, 'ASSET'), name, category: String(input.category || 'General'), acquisitionDate: String(input.acquisitionDate || new Date().toISOString().slice(0, 10)), inServiceDate: String(input.inServiceDate || new Date().toISOString().slice(0, 10)), costMinor, residualValueMinor: Math.max(0, Math.round(Number(input.residualValue || 0) * 100)), usefulLifeMonths, depreciationMethod: 'STRAIGHT_LINE', status: 'ACTIVE' };
  if (!dbReady) { seed.assets.unshift(asset); return { ...asset, ...calculateDepreciation(asset) }; }
  await pool.query(`INSERT INTO fixed_assets (id, tenant_id, asset_code, name, category, acquisition_date, in_service_date, cost_minor, residual_value_minor, useful_life_months, depreciation_method, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [asset.id, tenantId, asset.assetCode, asset.name, asset.category, asset.acquisitionDate, asset.inServiceDate, asset.costMinor, asset.residualValueMinor, asset.usefulLifeMonths, asset.depreciationMethod, user.id]);
  await addAudit(user, 'CREATE', 'fixed_asset', asset.id, asset, req);
  return { ...asset, ...calculateDepreciation(asset) };
}

async function getStudentLedger(studentId) {
  const rows = !dbReady ? seed.payments.filter((payment) => payment.studentId === studentId && payment.status !== 'VOIDED') : (await pool.query(`SELECT id, student_id AS "studentId", student_name AS "studentName", receipt_number AS "receiptNumber", payment_date AS "paymentDate", amount_minor AS "amountMinor", currency, fee_category AS "feeCategory", status FROM manual_payments WHERE tenant_id = $1 AND student_id = $2 AND status <> 'VOIDED' ORDER BY payment_date DESC`, [tenantId, studentId])).rows;
  return rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor) }));
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : (pathname === '/dashboard' || pathname === '/dashboard/' ? '/dashboard.html' : pathname);
  const safePath = normalize(join(publicDir, requested));
  if (!safePath.startsWith(publicDir)) return res.writeHead(403).end('Forbidden');
  try {
    const fileStat = await stat(safePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    const content = await readFile(safePath);
    const extension = extname(safePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Content-Length': content.length,
      'Cache-Control': ['.html', '.css', '.js', '.json', '.webmanifest'].includes(extension) ? 'no-store, max-age=0, must-revalidate' : 'public, max-age=86400'
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  try {
    if (pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, service: 'carest-360', version: appVersion, mode: dbReady ? 'postgresql' : 'review-memory', timestamp: new Date().toISOString() });
    }
    if (pathname === '/api/overview' && req.method === 'GET') return sendJson(res, 200, seed.overview);
    if (pathname === '/api/events' && req.method === 'GET') return sendJson(res, 200, { events: seed.events });
    if (pathname === '/api/activity' && req.method === 'GET') return sendJson(res, 200, { activity: seed.activity });
    if (pathname === '/api/registration/options' && req.method === 'GET') {
      return sendJson(res, 200, await registrationOptions());
    }
    if (pathname === '/api/registrations' && req.method === 'POST') {
      const registration = await createStudentRegistration(await readJson(req), req);
      return sendJson(res, 201, { ok: true, registration: { applicationNumber: registration.applicationNumber, studentNumber: registration.studentNumber, status: registration.status, firstName: registration.firstName, lastName: registration.lastName, phone: registration.phone, email: registration.email, programme: registration.programme, academicYear: registration.academicYear, semester: registration.semester } });
    }
    if (pathname === '/api/registrations' && req.method === 'GET') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      if (!dbReady) return sendJson(res, 200, { registrations: seed.registrations });
      const { rows } = await pool.query('SELECT * FROM student_registrations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100', [tenantId]);
      return sendJson(res, 200, { registrations: rows });
    }
    if (pathname === '/api/programs' && req.method === 'GET') return sendJson(res, 200, { programs: await listPrograms() });

    if (pathname === '/api/auth/password-reset/request' && req.method === 'POST') {
      const request = await requestPasswordReset(await readJson(req), req);
      return sendJson(res, 201, { ok: true, request: { id: request.id, status: request.status, message: 'Request submitted for finance administrator approval.' } });
    }
    if (pathname === '/api/auth/password-reset/requests' && req.method === 'GET') {
      const user = await requireUser(req, res, ['finance_admin']);
      if (!user) return;
      return sendJson(res, 200, { requests: await getPasswordResetRequests() });
    }
    const resetApproveMatch = pathname.match(/^\/api\/auth\/password-reset\/([^/]+)\/approve$/);
    if (resetApproveMatch && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin']);
      if (!user) return;
      return sendJson(res, 200, { ok: true, request: await approvePasswordReset(resetApproveMatch[1], await readJson(req), user, req) });
    }
    if (pathname === '/api/logout' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'carest_access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
    }
    if (pathname === '/api/login' && req.method === 'POST') {
      const credentials = await readJson(req);
      const email = String(credentials.email || '').trim().toLowerCase();
      const password = String(credentials.password || '');
      if (!email || !email.includes('@') || !password) return sendError(res, 422, 'Enter your college email and password.');
      let user;
      if (dbReady) {
        const result = await pool.query('SELECT id, tenant_id AS "tenantId", email, name, role, active, password_hash FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, email]);
        const candidate = result.rows[0];
        if (!candidate || !candidate.active || !(await bcrypt.compare(password, candidate.password_hash))) return sendError(res, 401, 'Invalid finance workspace credentials.');
        user = candidate;
      } else {
        user = { id: 'demo-user', tenantId, email, name: email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), role: 'finance_admin' };
      }
      const token = signUser(user);
      return sendJson(res, 200, { ok: true, user: { id: user.id, name: user.name, role: user.role === 'finance_admin' ? 'Finance administrator' : 'Finance workspace' }, token }, { 'Set-Cookie': authCookie(token) });
    }

    if (pathname === '/api/finance/config' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, await getFinanceConfig());
    }
    if (pathname === '/api/finance/summary' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, await financeSummary());
    }
    if (pathname === '/api/finance/transactions' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { transactions: await recentTransactions() });
    }
    const transactionMatch = pathname.match(/^\/api\/finance\/(payments|expenses)\/([^/]+)(?:\/(review))?$/);
    if (transactionMatch) {
      const type = transactionMatch[1] === 'payments' ? 'payment' : 'expense';
      const id = transactionMatch[2];
      const action = transactionMatch[3];
      if (req.method === 'PATCH' && !action) {
        const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
        if (!user) return;
        return sendJson(res, 200, { ok: true, transaction: await editTransaction(type, id, await readJson(req), user, req) });
      }
      if (req.method === 'POST' && action === 'review') {
        const user = await requireUser(req, res, ['finance_admin']);
        if (!user) return;
        return sendJson(res, 200, { ok: true, transaction: await reviewTransaction(type, id, await readJson(req), user, req) });
      }
      if (req.method === 'DELETE' && !action) {
        const user = await requireUser(req, res, ['finance_admin']);
        if (!user) return;
        return sendJson(res, 200, { ok: true, transaction: await voidTransaction(type, id, await readJson(req).catch(() => ({})), user, req) });
      }
    }
    if (pathname === '/api/finance/payments' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { payments: await recentPayments() });
    }
    if (pathname === '/api/finance/fee-types' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      const item = await createFeeType(await readJson(req), user, req);
      return sendJson(res, 201, { ok: true, feeType: item });
    }
    if (pathname === '/api/finance/revenue-categories' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      const item = await createRevenueCategory(await readJson(req), user, req);
      return sendJson(res, 201, { ok: true, category: item });
    }
    if (pathname === '/api/finance/expense-categories' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      const item = await createExpenseCategory(await readJson(req), user, req);
      return sendJson(res, 201, { ok: true, category: item });
    }
    if (pathname === '/api/programs' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      const program = await createProgram(await readJson(req), user, req);
      return sendJson(res, 201, { ok: true, program });
    }
    if (pathname === '/api/payments/manual' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, ...(await createManualPayment(await readJson(req), user, req)) });
    }
    if (pathname === '/api/expenses/manual' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, ...(await createExpense(await readJson(req), user, req)) });
    }
    if (pathname === '/api/accounting/chart-of-accounts' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { accounts: await chartOfAccounts() });
    }
    if (pathname === '/api/accounting/chart-of-accounts' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, account: await createAccount(await readJson(req), user, req) });
    }
    if (pathname === '/api/accounting/journals' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, journal: await createJournal(await readJson(req), user, req) });
    }
    if (pathname === '/api/accounting/accruals' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, accrual: await createAccrual(await readJson(req), user, req) });
    }
    if (pathname === '/api/accounting/ledger' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { entries: await getLedgerEntries() });
    }
    if (pathname === '/api/accounting/trial-balance' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, await getTrialBalance());
    }
    if (pathname === '/api/accounting/approvals' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { approvals: await getApprovals() });
    }
    if (pathname === '/api/accounting/audit-events' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { events: await getAuditEvents() });
    }
    if (pathname === '/api/accounting/revenue' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { revenue: await getRevenueSummary() });
    }
    if (pathname === '/api/accounting/cashbook' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { entries: await getCashbook() });
    }
    if (pathname === '/api/accounting/operating-expenses' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { entries: (await getCashbook()).filter((entry) => entry.sourceType === 'MANUAL_EXPENSE') });
    }
    if (pathname === '/api/accounting/petty-cash-ledger' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, await getPettyCash());
    }
    if (pathname === '/api/accounting/bank-reconciliations' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { reconciliations: await getBankReconciliations() });
    }
    if (pathname === '/api/accounting/bank-reconciliations' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, reconciliation: await createBankReconciliation(await readJson(req), user, req) });
    }
    if (pathname === '/api/accounting/petty-cash' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { transactions: await getPettyCash() });
    }
    if (pathname === '/api/accounting/petty-cash' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, transaction: await createPettyCash(await readJson(req), user, req) });
    }
    if (pathname === '/api/accounting/budgets' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { budgets: await getBudgets() });
    }
    if (pathname === '/api/accounting/budgets' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, budget: await createBudget(await readJson(req), user, req) });
    }
    if (pathname === '/api/accounting/assets' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { assets: await getAssets() });
    }
    if (pathname === '/api/accounting/assets' && req.method === 'POST') {
      const user = await requireUser(req, res, ['finance_admin', 'finance_officer']);
      if (!user) return;
      return sendJson(res, 201, { ok: true, asset: await createAsset(await readJson(req), user, req) });
    }
    const studentLedgerMatch = pathname.match(/^\/api\/accounting\/student-ledgers\/([^/]+)$/);
    if (studentLedgerMatch && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { studentId: studentLedgerMatch[1], ledger: await getStudentLedger(studentLedgerMatch[1]) });
    }

    if (pathname === '/api/reports/chart-of-accounts' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      return sendJson(res, 200, { accounts: await chartOfAccounts(), generatedAt: formatLiveGhanaDate() });
    }
    if (pathname === '/reports/chart-of-accounts' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      const accounts = await chartOfAccounts();
      const format = url.searchParams.get('format') || 'html';
      if (format === 'csv') return sendAccountCsv(res, accounts);
      if (format === 'pdf') return sendPdf(res, 'Chart of Accounts', chartOfAccountsReportHtml(accounts));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(chartOfAccountsReportHtml(accounts));
    }

    const apiReportMatch = pathname.match(/^\/api\/reports\/financial\/([^/]+)$/);
    if (apiReportMatch && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      const report = apiReportMatch[1];
      const { from, to } = parseReportRange(url);
      const rows = await reportTransactions(from, to);
      return sendJson(res, 200, { report, from, to, generatedAt: formatLiveGhanaDate(), totals: reportTotals(rows), rows: reportRowsFor(report, rows, reportTotals(rows)) });
    }

    const reportMatch = pathname.match(/^\/reports\/financial\/([^/]+)$/);
    if (reportMatch && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      const report = reportMatch[1];
      const { from, to } = parseReportRange(url);
      const rows = await reportTransactions(from, to);
      const totals = reportTotals(rows);
      const title = reportTitle(report);
      const format = url.searchParams.get('format') || 'html';
      if (format === 'csv') return sendCsv(res, title, rows);
      if (format === 'xlsx') return sendXlsx(res, title, rows);
      if (format === 'pdf') return sendPdf(res, title, reportPageHtml(report, rows, totals, from, to));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(reportPageHtml(report, rows, totals, from, to));
    }

    const receiptMatch = pathname.match(/^\/reports\/(receipt|bill)\/([^/]+)$/);
    if (receiptMatch && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      const payment = await getPaymentById(receiptMatch[2]);
      if (!payment) return sendError(res, 404, 'Receipt not found.');
      const html = receiptPageHtml(payment);
      if (url.searchParams.get('format') === 'pdf') return sendPdf(res, `Receipt ${payment.receiptNumber || payment.receipt_number}`, html);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }

    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    return sendError(res, error.message?.includes('Missing') || error.message?.includes('required') || error.message?.includes('positive') ? 422 : 500, error.message || 'Unexpected server error.');
  }
});

async function start() {
  if (pool) {
    try {
      await initializeDatabase();
      console.log('CAREST 360 connected to PostgreSQL.');
    } catch (error) {
      console.error('Database initialization failed:', error);
      process.exit(1);
    }
  } else {
    console.warn('DATABASE_URL is not set. Running review mode with in-memory data; do not use for real financial records.');
  }
  server.listen(port, () => console.log(`CAREST 360 is live at http://localhost:${port}`));
}

start();
