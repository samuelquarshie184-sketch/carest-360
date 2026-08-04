# CAREST 360 · Accounting & financial management architecture

## Institution context

The public-facing site is branded for **CAREST College of Health**, located in Hohoe in Ghana’s Volta Region. The official site describes CAREST as a forward-thinking private tertiary institution focused on competent and compassionate professionals, affordable quality education, innovation, discipline, community service and employable skills.

The product in this repository is deliberately scoped as a **pure accounting and financial management system** for the College. It is not a student information system, LMS, HR/payroll system or academic management system. Those systems may integrate later, but they are not part of the finance product core.

## Product boundary

### Core system of record

- Chart of accounts and accounting dimensions
- Configurable fee types and fee schedules
- Student/customer billing references and account balances
- Multiple institutional revenue sources
- Manual recording of externally received payments
- Cash, bank and mobile-money clearing accounts
- Expense categories, budgets and approvals
- Double-entry journals and ledgers
- Bank/deposit reconciliation support
- Financial reports, exports and audit trails
- Roles, permissions, approval workflows and configuration history

### Explicitly outside the core

- Course registration, examinations, grades or attendance
- Learning management and teaching workflows
- Payroll and human-resource records
- Library, hostel or biometric operations
- Online payment collection in Phase One

These may integrate through stable APIs. The finance system should consume only the identifiers and financial events it needs.

## Target production stack

| Layer | Recommendation | Why |
| --- | --- | --- |
| Web | Next.js + React + TypeScript | fast public site and secure finance portal |
| UI | Tailwind CSS + Material UI | reusable, accessible accounting controls |
| API | NestJS + TypeScript | module boundaries, guards, DTO validation and OpenAPI |
| API style | REST first; GraphQL read models optional | stable banking and reporting integrations |
| Database | PostgreSQL + Prisma migrations | reliable transactions, constraints and audit history |
| Cache/jobs | Redis + BullMQ, optional | report generation, reminders and reconciliation jobs |
| Auth | JWT access token + rotating httpOnly refresh token; MFA | secure finance-admin access |
| Files | S3-compatible adapter | bank slips, receipts and supporting evidence |
| Reports | PDFKit/Playwright, ExcelJS and CSV streaming | open-source export pipeline |
| Delivery | Docker, Docker Compose and GitHub Actions | portable Render/cloud/VPS deployments |

The current review build remains dependency-light so the client can open it immediately. It demonstrates the visual finance workspace and API contracts; it is not the final PostgreSQL ledger.

## Suggested repository shape

```text
apps/
  web/                         Next.js public site + finance portal
  api/                         NestJS finance API
packages/
  domain/                      shared financial types and contracts
  validation/                  DTO and input schemas
  ui/                          CAREST design system
  config/                      typed environment configuration
  integrations/                banking, payments, storage, email and SMS adapters
prisma/
  schema.prisma
  migrations/
docs/
infra/
  docker/
  render/
  nginx/
```

## Finance modules

1. **Institution & configuration** — institution, campus, currency, timezone, fiscal year, semesters, departments and reporting dimensions.
2. **Chart of accounts** — account classes, account codes, journals, debit/credit rules, fiscal periods and closing controls.
3. **Fee configuration** — unlimited fee types, fee schedules, programme references, scholarships, waivers and effective dates.
4. **Revenue** — student fees plus donations, grants, short courses, hostel income, rentals, consultancy and every administrator-defined source.
5. **Manual payments** — cash, bank deposit, bank transfer and externally processed mobile money with receipt/evidence capture.
6. **Expenses & budgets** — configurable expense categories, suppliers, approvals, commitments and budget-versus-actual reporting.
7. **Reconciliation** — bank accounts, deposit slips, teller references, clearing accounts and month-end review.
8. **Reports & exports** — income, expenditure, receivables, fee collections, ledger, trial balance, cash/bank and management summaries.
9. **Audit & access** — finance roles, approvals, immutable audit events, export history and configuration change history.
10. **Integration adapters** — future gateways, banks, mobile money, SIS, LMS, library, SMS, email and regulator reporting.

The current programme catalogue is data-driven because the public site needs room for new BSc, HND/Diploma and Professional programmes. Programme records are used as references for billing and public information, not as an academic operations module.

## Financial data model

The production minimum is represented in `prisma/schema.prisma` and should be refined during discovery:

- `tenant`, `campus`, `department`, `academic_year`, `semester`;
- `programme` as a reference dimension for programme-related fees;
- `student` as a debtor/customer dimension, not a full registry system;
- `fee_type`, `fee_schedule`, `fee_schedule_line`;
- `revenue_category`, `expense_category`, `payment_method`;
- `student_bill`, `bill_line`, `manual_payment`, `payment_evidence`;
- `ledger_entry`, `chart_of_account`, `fiscal_period`, `bank_account`, `reconciliation`;
- `budget`, `budget_line`, `approval`, `audit_event`, `file_object`, `export_job`.

Financial amounts must be stored as integer minor units with an ISO currency code. Posted journals must balance. Corrections and voids create reversing entries instead of mutating an immutable ledger row.

## Configurability rules

Fee categories, revenue categories, expense categories, departments, programmes, academic years, semesters, banks, payment methods, scholarship schemes and reporting structures are records in configuration tables. They must not be hardcoded enums in application code.

An authorized finance administrator can create, edit, activate, deactivate or archive these records through the UI. Historical reports continue to display archived records; inactive records cannot be selected for new transactions.

## Phase One payment policy

Students do not pay inside the portal during the initial release. Finance staff verify external evidence and record the payment manually. Each record captures student/customer, receipt number, bank, deposit slip, teller, payment date, amount, method, fee category, academic year, semester, recording officer and optional supporting file.

The posting service must validate duplicate receipt numbers, active configuration, amount and date, then create the payment, journal entries, account balance update and audit event in one PostgreSQL transaction. A future payment provider ends at the same idempotent posting service after webhook verification.

## API-first contracts

```text
GET    /v1/tenants/:tenantId/finance/accounts
POST   /v1/tenants/:tenantId/finance/fee-types
PATCH  /v1/tenants/:tenantId/finance/fee-types/:id
POST   /v1/tenants/:tenantId/finance/revenue-categories
POST   /v1/tenants/:tenantId/finance/expense-categories
POST   /v1/tenants/:tenantId/finance/manual-payments
GET    /v1/tenants/:tenantId/finance/accounts/:accountId/statement
GET    /v1/tenants/:tenantId/finance/reports/trial-balance.csv
POST   /v1/tenants/:tenantId/finance/exports
POST   /v1/integrations/payment-gateway/webhooks/:provider
```

All financial writes should support an idempotency key. Webhooks should be signature-verified, stored as raw events, acknowledged quickly and processed asynchronously.

## Security baseline

- Argon2id password hashing; never store raw passwords.
- Short-lived JWTs with rotating, revocable httpOnly refresh tokens.
- MFA for finance administrators, approvers and system administrators.
- Least-privilege permissions such as `finance.payment.post`, `finance.payment.void`, `finance.config.manage`, `finance.report.export` and `finance.audit.read`.
- Tenant/campus authorization at controller and service boundaries; derive tenant context from authenticated membership.
- DTO validation, parameterized queries, rate limiting, strict CORS and secure cookie flags.
- TLS, HSTS, content security policy and security headers in production.
- Private evidence storage with virus/type/size checks and signed URLs.
- Append-only audit events for login, configuration changes, payment edits, voids, approvals and exports.
- Structured logs without passwords, tokens, bank secrets or unnecessary personal data.

## Initial Render deployment

The `render.yaml` blueprint provides the client-review starting point:

1. Push the repository to GitHub.
2. Create a Render Blueprint from the repository.
3. Configure secrets and storage variables in Render, never in Git.
4. Attach managed PostgreSQL through `DATABASE_URL` for the production API phase.
5. Run migrations as a release command before the new API process receives traffic.
6. Enable GitHub auto-deploy after CI passes.
7. Use an S3-compatible free-tier object store for the review period; keep the adapter vendor-neutral.
8. Monitor `/health` and review structured logs after deploys.

Free tiers are suitable for review and acceptance, not guaranteed availability for real financial records. Confirm current provider quotas, backups and data-retention terms before the College uses the environment operationally.

## Backup, restore and migration

- Daily PostgreSQL logical backup plus provider snapshots where available.
- Weekly restore rehearsal into a separate database.
- Object storage versioning for payment evidence and bank documents.
- Forward-only Prisma migrations committed to Git.
- Export a tenant as a database dump plus object-storage manifest.
- Keep stable identifiers and UTC timestamps; store GHS amounts as integer minor units.
- For migration: pause writes, sync final database and files, replay pending events, verify counts/checksums, switch reverse proxy/DNS, resume writes and monitor.

## CI/CD gates

GitHub Actions should run on pull requests and main pushes:

1. lockfile validation and dependency audit;
2. formatting and linting;
3. TypeScript strict compilation;
4. unit/API integration tests;
5. Playwright finance smoke tests for login, category configuration, manual payment and export permissions;
6. Docker build and image scan;
7. migration validation against ephemeral PostgreSQL;
8. deploy only after required checks pass.

## Migration path

**Review:** Render web service, review API and branded finance dashboard.

**Pilot:** Next.js web, NestJS API, PostgreSQL migrations, real roles, configurable fees, manual payment posting, audit log, backups and exports.

**Production:** private network, point-in-time recovery, durable object storage, Redis workers, reverse proxy/load balancer, observability and tested restore procedures.

**Future integrations:** online payments, Mobile Money, banks, student information systems, LMS, library, SMS/email and regulatory reporting through adapters. No provider-specific logic should enter the accounting core.

The system can therefore migrate to AWS, Azure, GCP, DigitalOcean, Hetzner, OCI, a dedicated VPS or private server by changing containers, environment variables and infrastructure manifests rather than rewriting finance logic.
