# CAREST College of Health · CAREST 360

A cinematic client-review landing page and finance-platform proof-of-concept for **CAREST College of Health**. The supplied CAREST logo and the supplied campus photo are used in the site. The public content is aligned to the official CAREST pages, including its Hohoe / Volta Region location, school description, vision, mission and current programme catalogue.

## Official content snapshot used

- **School:** CAREST College of Health, Hohoe in the Volta Region of Ghana.
- **Vision:** To become a leading private tertiary institution in Ghana, producing graduates who are academically excellent, professionally skilled and ethically sound.
- **Mission:** To provide affordable, quality education through innovation, discipline and community service while empowering young people with employable skills.
- **Current programmes:** BSc. Business Administration; BSc Computer Science; HND Medical Laboratory Technology; Diploma in Security and Artificial Intelligence; Diploma in Catering, Hotel & Institutional Management; Medicine Counter Assistant / Pharmacy Assistant.
- **Official website:** https://carestcollegeofhealth.edu.gh/

The site is a **pure accounting and financial management system experience**. The programme catalogue is included as public content and as a configurable reference dimension for future fee schedules; student records, academic operations, LMS and HR/payroll are not part of the finance product core.

## Run the review build

Requires Node.js 18+.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The review build is intentionally dependency-light and can run on a free Render web service. It includes a small Node API so the page can be reviewed as a full-stack slice rather than a static mock-up.

## What is implemented in the review slice

- CAREST College of Health brand, logo, campus photo and official story.
- Responsive cinematic landing page with Hohoe / Volta Region context and vision/mission messaging.
- Programme explorer with BSc / HND-Diploma / Professional filters.
- Future-programme builder: add a new programme card through `POST /api/programs` without changing the page source.
- Full CAREST 360 finance dashboard at `/dashboard` for Overview, Transactions, General Ledger, Chart of Accounts, General Cashbook, Operating Expense Cashbook, AR/AP, Bank & Petty Cash Ledger, Budgets & Assets, Reports, Journals & Accruals, Approvals & Audit, and Registrations.
- Student registration records stay linked by application reference: only a verified finance payment creates a cashbook receipt, preventing unverified public submissions from becoming accounting entries.
- Configurable-finance UX: fee types, income sources, manual payment evidence, ledgers and future gateway adapters.
- Sign-in modal backed by `POST /api/login` (demo authentication; no credentials are persisted).
- JSON API routes for overview, programmes, events, activity and initial finance configuration.
- Live student registration form collecting student contact details, WhatsApp, residence, programme interest and parent/guardian/emergency contacts.
- Live finance-console actions for recording, editing, reviewing, approving and voiding transactions. Financial deletion is implemented as a reversible void with reversal ledger entries and audit history; posted records are never hard-deleted.
- Professionally branded bank-style statements, bills/payment receipts and period-based report spooling with live Ghana timestamps.
- Report outputs for transaction register, income, financial position, cash flow, trial balance, bank reconciliation, receivables, payables and budget variance; HTML/print, CSV and production PDF/Excel adapters.
- Accrual journal API with balanced debit/credit validation and a configurable chart-of-accounts foundation.
- Demo endpoints for adding fee types, adding revenue categories and recording externally verified manual payments and expenses.
- Newsletter interaction, campus film modal, keyboard-closeable dialogs and mobile navigation.
- No proprietary runtime dependencies.

## API routes in the review build

- `GET /health`
- `GET /api/overview`
- `GET /api/programs`
- `POST /api/programs` — programme catalogue builder for future additions
- `GET /api/registration/options` — live programme, academic year and semester selectors
- `POST /api/registrations` — student registration and contact capture
- `GET /api/registrations` — protected admissions/finance list
- `GET /api/events`
- `GET /api/activity`
- `GET /api/finance/config`
- `GET /api/finance/summary`
- `GET /api/finance/payments`
- `GET /api/finance/transactions`
- `PATCH /api/finance/payments/:id`
- `PATCH /api/finance/expenses/:id`
- `POST /api/finance/payments/:id/review`
- `POST /api/finance/expenses/:id/review`
- `DELETE /api/finance/payments/:id` — void with reversal, not hard delete
- `DELETE /api/finance/expenses/:id` — void with reversal, not hard delete
- `POST /api/finance/fee-types`
- `POST /api/finance/revenue-categories`
- `POST /api/finance/expense-categories`
- `POST /api/payments/manual`
- `POST /api/expenses/manual`
- `GET /api/accounting/chart-of-accounts`
- `POST /api/accounting/journals`
- `POST /api/accounting/accruals`
- `GET /api/accounting/ledger`
- `GET /api/accounting/trial-balance`
- `GET /api/accounting/approvals`
- `GET /api/accounting/audit-events`
- `GET /api/accounting/cashbook`
- `GET /api/accounting/operating-expenses`
- `GET|POST /api/accounting/bank-reconciliations`
- `GET|POST /api/accounting/petty-cash`
- `GET /api/accounting/petty-cash-ledger`
- `GET|POST /api/accounting/budgets`
- `GET|POST /api/accounting/assets`
- `GET /api/accounting/student-ledgers/:studentId`
- `GET /api/reports/chart-of-accounts`
- `GET /reports/chart-of-accounts` — printable chart-of-accounts reference
- `GET /api/reports/financial/:report`
- `GET /reports/financial/:report` — branded HTML/print, PDF, Excel or CSV via `format`
- `GET /reports/receipt/:paymentId` or `/reports/bill/:paymentId` — branded bill/receipt with print/PDF
- `POST /api/login`

When `DATABASE_URL`, `JWT_SECRET`, `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` are set, the API uses PostgreSQL, real password hashing, JWT/cookie authentication, role checks, transaction-safe payment/expense posting and audit events. Without `DATABASE_URL`, it deliberately runs only in local review mode with in-memory data and prints a warning.

## Deployment files

- `Dockerfile` — container image for the review service.
- `docker-compose.yml` — local PostgreSQL, Redis and MinIO-compatible object storage for future finance development.
- `render.yaml` — initial Render web-service and database blueprint.
- `.env.example` — externalized configuration contract.
- `.github/workflows/ci.yml` — GitHub Actions quality gate.
- `docs/architecture.md` — pure accounting/finance architecture and migration plan.
- `docs/finance-module.md` — flexible fee, revenue and manual-payment design.
- `docs/reporting-and-accruals.md` — branded reports, period spooling, accruals and accounting controls.
- `docs/transaction-controls.md` — edit/review/void behavior.
- `prisma/schema.prisma` — multi-tenant finance-oriented data model foundation.

## Project map

```text
server.js              Static server + review API
public/index.html      CAREST landing page markup
public/styles.css      Visual system and responsive styles
public/app.js          UI interactions and API hydration
public/assets/         CAREST logo, supplied campus photo and visual placeholders
docs/                  Architecture and finance design notes
```

The external clinical images are placeholders for the client review build. Replace them with licensed CAREST photography before production launch. Confirm final programme names, approved contact details, application dates and official domain before publishing.
