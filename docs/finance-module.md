# CAREST 360 · Configurable finance module

## Non-negotiable rules

1. Fee categories are records in a configuration table, never an enum in source code.
2. Revenue categories are separate from student fee categories so institutional income is not reduced to tuition.
3. Finance staff record externally received payments during Phase One; no online payment is implied by the portal.
4. Every posted payment has a receipt number, officer, timestamp and optional evidence file.
5. Posting a payment recalculates the student's balance and statement inside one transaction.
6. Bills and account views are available to authorized staff on screen. Printable statements/invoices remain behind a future permission.
7. Configuration changes, payment edits, voids, exports and approvals are audited.
8. Currency values are stored as integer minor units, for example pesewas, plus an ISO currency code.

## Configuration model

### Fee type

```json
{
  "id": "fee_medical",
  "tenantId": "carest",
  "code": "MEDICAL",
  "name": "Medical Fees",
  "description": "",
  "active": true,
  "recurring": false,
  "effectiveFrom": "2026-08-01",
  "effectiveTo": null
}
```

### Revenue category

```json
{
  "id": "rev_research_grants",
  "tenantId": "carest",
  "code": "RESEARCH_GRANTS",
  "name": "Research Grants",
  "active": true,
  "accountCode": null
}
```

The UI should provide search, active/inactive filters, create, edit, archive and restore. Archived categories remain visible in historical reports but cannot be selected for new bill lines.

## Starter configuration catalog

The initial seed can include the categories requested by CAREST, including:

- tuition, scholarship, registration, admission, acceptance;
- examinations, re-sit, deferred, make-up and professional examinations;
- medical, ICT, internet, library, SRC/Guild, laboratory and practical;
- workshop, field trip, project, research and industrial attachment;
- internship, hostel, accommodation, graduation, convocation, gown and clearance;
- ID card, transcript, certificate, document processing, insurance, utility, transport, security, sports and orientation;
- handbook, replacement ID, penalties, miscellaneous, donations and other auxiliary fees.

Revenue categories should seed student tuition, scholarship contributions, admissions, hostel, graduation, forms, transcripts, certificates, library fines, examinations, short courses, weekend/sandwich/distance learning, consultancy, grants, donations, sponsorships, endowment funds, conferences, workshops, seminars, rentals, cafeteria commissions, bookshop, printing, photocopying, transport, ICT, internet, laboratory services, application processing, penalties, interest, investments, government support, NGO support, alumni contributions and other revenue.

These are seed records only. Administrators can add more without a deployment.

## Manual payment workflow — Phase One

1. Finance officer searches for a student by ID, name or programme.
2. System shows the internal fee schedule, posted payments, pending items and balance.
3. Officer chooses `Record manual payment`.
4. Officer enters:
   - student name and ID;
   - receipt number;
   - bank, deposit slip and teller where applicable;
   - payment date;
   - amount and currency;
   - payment method: cash, bank deposit, bank transfer or external mobile money;
   - fee category, academic year and semester;
   - recording officer;
   - optional evidence upload.
5. System validates amount, date, category activity and duplicate receipt number.
6. Officer reviews and confirms. The API writes the payment, evidence reference, ledger entries and account balance in one transaction.
7. The audit event records who posted it and what changed.
8. A future gateway adapter can call the same posting service after webhook verification.

## Example request

```http
POST /v1/tenants/carest/finance/manual-payments
Idempotency-Key: 8ce4e4b1-7fb3-4e6f-a10f-5a6b1d4a1454
Content-Type: application/json
```

```json
{
  "studentId": "CAR-2026-0042",
  "studentName": "Ama Mensah",
  "receiptNumber": "RCPT-000184",
  "bankName": "Example Bank",
  "depositSlipNumber": "DS-3922",
  "tellerNumber": "T-14",
  "paymentDate": "2026-08-03",
  "amountPaidMinor": 125000,
  "currency": "GHS",
  "paymentMethod": "BANK_DEPOSIT",
  "feeTypeId": "fee_tuition",
  "academicYearId": "ay_2026_27",
  "semesterId": "sem_1",
  "evidenceFileId": "file_abc123"
}
```

## Ledger behavior

For a verified student payment:

- debit: cash/bank clearing account;
- credit: student receivable or the configured fee revenue account;
- update student account balance;
- append an immutable audit event.

Voids and corrections must create reversing entries; never mutate a posted ledger row without preserving its prior state.

## Future payment adapters

Use an adapter interface so a new provider does not leak into the finance core:

```ts
interface PaymentProvider {
  createPayment(input: PaymentRequest): Promise<PaymentIntent>;
  verifyWebhook(rawBody: string, signature: string): Promise<VerifiedEvent>;
  mapStatus(event: VerifiedEvent): PaymentStatus;
}
```

Implementations may later include a Ghana mobile-money provider, bank collection API or card gateway. All providers end by calling the same idempotent posting service.

## Permissions

Suggested permissions:

- `finance.config.read`
- `finance.config.manage`
- `finance.payment.create`
- `finance.payment.verify`
- `finance.payment.void`
- `finance.account.read`
- `finance.statement.export`
- `finance.statement.print` (disabled by default in Phase One)
- `finance.report.read`
- `finance.report.export`
- `finance.audit.read`

A finance officer may record payments; a finance supervisor may verify/void; an administrator may manage categories and reporting structure. Every permission should be tenant and campus scoped.
