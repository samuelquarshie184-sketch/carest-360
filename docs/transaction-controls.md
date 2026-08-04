# CAREST 360 · Transaction controls

## Record

A finance officer can create a manual payment or expense with its source evidence, category, date, amount, reference and recorder. The API creates the transaction and its double-entry ledger pair in a transaction-safe operation.

## Edit

Active transactions can be edited through `PATCH /api/finance/payments/:id` or `PATCH /api/finance/expenses/:id`. Changes are audited. Editing returns the record to `PENDING_REVIEW` so a finance administrator can review the change.

The API updates the linked ledger amount and account/category code with the edited transaction. In production, edits should be limited to fields permitted by the institution’s approval policy.

## Review / approve / reject

A finance administrator can review a transaction:

```http
POST /api/finance/payments/:id/review
Content-Type: application/json
```

```json
{ "decision": "approve" }
```

Use `{ "decision": "reject", "notes": "Duplicate deposit slip" }` to reject it. Rejection creates a reversal and leaves the original record available in history with a rejected review status.

## Delete / void

Posted financial transactions are **never hard-deleted**. The delete action is implemented as a void:

```http
DELETE /api/finance/payments/:id
Content-Type: application/json
```

```json
{ "reason": "Duplicate receipt entered in error" }
```

The original record remains in the database, its status becomes `VOIDED`, the reason and actor are recorded, and compensating reversal ledger entries are added. Reports exclude voided transactions from active totals while audit history remains intact.

The same controls apply to expenses. This preserves accounting integrity, traceability and the ability to explain every change during a review.
