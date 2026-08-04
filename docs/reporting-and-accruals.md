# CAREST 360 · Professional reporting, accruals and period controls

## Report presentation

All generated reports use CAREST College of Health branding:

- school name and Hohoe / Volta Region address;
- supplied CAREST logo;
- GHS currency and Ghana time zone;
- reporting period from/to dates;
- generated date and time;
- preparer and reviewer lines;
- print/spool action;
- PDF, Excel and CSV export options where the reporting dependencies are installed.

The payment receipt is intentionally formatted as a bank-style document. A bill/payment record can produce a printable receipt from:

```text
/reports/receipt/:paymentId
/reports/receipt/:paymentId?format=pdf
```

A receipt retains the original receipt number and transaction details. Corrections do not overwrite the historical report; they are recorded through edits, review status and void/reversal entries.

## Period-based reporting

Reports accept:

```text
from=YYYY-MM-DD
to=YYYY-MM-DD
```

The finance workspace includes a live Ghana date/time clock and a period selector for spooling:

- Transaction Register
- Statement of Comprehensive Income
- Statement of Financial Position
- Statement of Cash Flows
- Trial Balance
- Bank Reconciliation
- Accounts Receivable
- Accounts Payable
- Budget and Variance

Period close should be added before production use. A closed period must block edits and require a controlled reversal or correction journal.

## Accrual basis

Accruals are represented by a balanced journal:

```text
Debit   expense account       GHS amount
Credit  accrued liability     GHS amount
```

Each accrual has:

- description;
- amount and currency;
- expense account;
- liability account;
- start date;
- optional reversal date;
- status and reviewer;
- linked journal entry.

When the reversal date arrives, a scheduled worker should create the opposite journal automatically. The current API validates the debit/credit equality and records the accrual/journal foundation; the production worker must be enabled before automated reversals are relied upon.

## Double entry

Every manual payment creates:

```text
Debit   cash/bank clearing
Credit  configured fee/revenue account
```

Every manual expense creates:

```text
Debit   configured expense account
Credit  cash/bank/payment account
```

Every correction/void creates compensating reversal entries. No posted financial row is physically deleted.

## IFRS and Ghana reporting readiness

The system is structured to support accrual accounting, configurable chart-of-accounts reporting and the applicable financial reporting standards selected by CAREST. The software should be described as **IFRS-ready/configurable**, not as an automatic guarantee of IFRS compliance. Final account mappings, recognition policies, tax treatment, statutory reports and financial statements require review and sign-off by CAREST’s qualified accountant and any applicable Ghana regulatory adviser.

Before production sign-off, configure:

- chart of accounts and account classes;
- fiscal periods and closing rules;
- opening balances;
- revenue recognition policy;
- accrual and prepayment policy;
- fixed-asset/depreciation policy if required;
- bank accounts and reconciliation rules;
- tax/VAT treatment where applicable;
- budget owners and approval levels;
- report headers, signatories and retention rules.
