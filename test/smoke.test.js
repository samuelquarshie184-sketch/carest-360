import { spawn } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const port = 34781;
const baseUrl = `http://127.0.0.1:${port}`;

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/overview`);
      if (response.ok) return;
    } catch {
      // The child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Server did not start in time');
}

test('review API exposes CAREST overview, finance writes and transaction controls', async (t) => {
  const child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });
  t.after(() => child.kill('SIGTERM'));

  await waitForServer();

  const dashboardPage = await fetch(`${baseUrl}/dashboard`);
  assert.equal(dashboardPage.status, 200);
  assert.match(await dashboardPage.text(), /CAREST 360/);

  const overview = await (await fetch(`${baseUrl}/api/overview`)).json();
  assert.equal(overview.university, 'CAREST College of Health');
  assert.equal(overview.stats[0].value, '01');

  const config = await (await fetch(`${baseUrl}/api/finance/config`)).json();
  assert.ok(config.feeTypes.some((fee) => fee.name === 'Tuition Fees'));
  assert.ok(config.revenueCategories.some((category) => category.name === 'Donations'));
  assert.ok(config.chartOfAccounts.some((account) => account.code === '4000-TUITION'));
  const registrationOptions = await (await fetch(`${baseUrl}/api/registration/options`)).json();
  assert.ok(registrationOptions.programs.length >= 6);
  assert.ok(registrationOptions.semesters.some((semester) => semester.name === 'Semester 1'));

  const registration = await fetch(`${baseUrl}/api/registrations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ firstName: 'Ama', lastName: 'Mensah', phone: '+233240000000', email: 'ama@example.com', whatsapp: '+233240000000', city: 'Hohoe', region: 'Volta Region', programme: 'BSc Computer Science', academicYear: '2026/27', semester: 'Semester 1', guardianName: 'Kofi Mensah', guardianPhone: '+233240000001' })
  });
  assert.equal(registration.status, 201);
  const registrationBody = await registration.json();
  assert.match(registrationBody.registration.applicationNumber, /^APP-/);
  assert.match(registrationBody.registration.studentNumber, /^CAR-/);
  const registrationList = await (await fetch(`${baseUrl}/api/registrations`)).json();
  assert.ok(registrationList.registrations.some((item) => item.studentNumber === registrationBody.registration.studentNumber));

  for (const endpoint of ['/api/accounting/ledger', '/api/accounting/trial-balance', '/api/accounting/cashbook', '/api/accounting/operating-expenses', '/api/accounting/approvals', '/api/accounting/audit-events', '/api/accounting/bank-reconciliations', '/api/accounting/petty-cash-ledger', '/api/accounting/budgets', '/api/accounting/assets']) {
    const response = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(response.status, 200, endpoint);
  }

  const newProgramme = await fetch(`${baseUrl}/api/programs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Emergency Care', type: 'Professional', length: '6 months', color: 'blue' })
  });
  assert.equal(newProgramme.status, 201);
  assert.equal((await newProgramme.json()).program.title, 'Emergency Care');

  const journal = await fetch(`${baseUrl}/api/accounting/journals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      description: 'Accrued utilities test journal',
      lines: [
        { accountCode: '5000-FACILITIES_UTILITIES', debitMinor: 35000 },
        { accountCode: '2000-ACCRUED-LIABILITIES', creditMinor: 35000 }
      ]
    })
  });
  assert.equal(journal.status, 201);
  assert.equal((await journal.json()).journal.debitTotal, 35000);

  const accrual = await fetch(`${baseUrl}/api/accounting/accruals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ description: 'Monthly utilities accrual', amountPaid: 350, expenseAccount: '5000-FACILITIES_UTILITIES', liabilityAccount: '2000-ACCRUED-LIABILITIES', startDate: '2026-08-03', reversalDate: '2026-09-01' })
  });
  assert.equal(accrual.status, 201);
  assert.equal((await accrual.json()).accrual.status, 'PENDING_REVIEW');

  const created = await fetch(`${baseUrl}/api/finance/fee-types`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Replacement ID Card Fees', recurring: false })
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).feeType.name, 'Replacement ID Card Fees');

  const resetRequest = await fetch(`${baseUrl}/api/auth/password-reset/request`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'finance@example.com', reason: 'Test reset' }) });
  assert.equal(resetRequest.status, 201);
  const resetRequestBody = await resetRequest.json();
  assert.equal(resetRequestBody.request.status, 'PENDING');
  const approvedReset = await fetch(`${baseUrl}/api/auth/password-reset/${resetRequestBody.request.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newPassword: 'A-very-secure-test-password' }) });
  assert.equal(approvedReset.status, 200);

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'finance@carestcollegeofhealth.edu.gh', password: 'local-demo-password' })
  });
  assert.equal(login.status, 200);
  assert.ok((await login.json()).token);

  const payment = await fetch(`${baseUrl}/api/payments/manual`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      studentId: registrationBody.registration.studentNumber,
      registrationApplicationNumber: registrationBody.registration.applicationNumber,
      studentName: 'Ama Mensah',
      amountPaid: 1250,
      paymentMethod: 'BANK_DEPOSIT',
      feeCategory: 'Tuition Fees',
      revenueCode: '4000-TUITION',
      academicYear: '2026/27',
      semester: 'Semester 1'
    })
  });
  assert.equal(payment.status, 201);
  const paymentBody = await payment.json();
  assert.equal(paymentBody.ledger.updated, true);
  assert.match(paymentBody.payment.receiptNumber, /^RCPT-/);
  const paymentId = paymentBody.payment.id;

  const cashbookAfterPayment = await (await fetch(`${baseUrl}/api/accounting/cashbook`)).json();
  assert.ok(cashbookAfterPayment.entries.some((entry) => entry.sourceId === paymentId));
  assert.ok(cashbookAfterPayment.entries.some((entry) => entry.registrationApplicationNumber === registrationBody.registration.applicationNumber));

  const editPayment = await fetch(`${baseUrl}/api/finance/payments/${paymentId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amountPaid: 1300, feeCategory: 'Registration Fees' })
  });
  assert.equal(editPayment.status, 200);
  assert.equal((await editPayment.json()).transaction.after.amountMinor, 130000);

  const reviewPayment = await fetch(`${baseUrl}/api/finance/payments/${paymentId}/review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'approve' })
  });
  assert.equal(reviewPayment.status, 200);
  assert.equal((await reviewPayment.json()).transaction.reviewStatus, 'APPROVED');

  const receipt = await fetch(`${baseUrl}/reports/receipt/${paymentId}`);
  assert.equal(receipt.status, 200);
  const receiptText = await receipt.text();
  assert.match(receiptText, /Payment Receipt/);
  assert.match(receiptText, /\+233240000000/);
  assert.match(receiptText, /ama@example.com/);
  assert.match(receiptText, /Kofi Mensah/);

  const financeReport = await fetch(`${baseUrl}/reports/financial/statement-of-comprehensive-income?from=2026-01-01&to=2026-12-31`);
  assert.equal(financeReport.status, 200);
  assert.match(await financeReport.text(), /Statement of Comprehensive Income/);

  const pettyCash = await fetch(`${baseUrl}/api/accounting/petty-cash`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transactionType: 'OUTFLOW', amountPaid: 25, description: 'Test stationery', referenceNumber: 'PC-TEST-1' }) });
  assert.equal(pettyCash.status, 201);
  const pettyLedger = await (await fetch(`${baseUrl}/api/accounting/petty-cash-ledger`)).json();
  assert.ok(pettyLedger.transactions.some((item) => item.referenceNumber === 'PC-TEST-1'));

  const budget = await fetch(`${baseUrl}/api/accounting/budgets`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Test Budget', periodName: '2026/27', accountCode: '5000-FACILITIES_UTILITIES', amountPaid: 1000 }) });
  assert.equal(budget.status, 201);
  const asset = await fetch(`${baseUrl}/api/accounting/assets`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Test Equipment', assetCode: 'FA-TEST-001', category: 'Equipment', cost: 1000, usefulLifeMonths: 12 }) });
  assert.equal(asset.status, 201);

  const expense = await fetch(`${baseUrl}/api/expenses/manual`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      vendor: 'Campus Utilities',
      referenceNumber: 'EXP-000011',
      amountPaid: 350,
      paymentMethod: 'BANK_TRANSFER',
      expenseCategory: 'Facilities & Utilities'
    })
  });
  assert.equal(expense.status, 201);
  assert.equal((await expense.json()).ledger.updated, true);

  const transactions = await (await fetch(`${baseUrl}/api/finance/transactions`)).json();
  assert.ok(transactions.transactions.some((transaction) => transaction.id === paymentId));

  const voidPayment = await fetch(`${baseUrl}/api/finance/payments/${paymentId}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'Test correction' })
  });
  assert.equal(voidPayment.status, 200);
  assert.equal((await voidPayment.json()).transaction.status, 'VOIDED');

  const logout = await fetch(`${baseUrl}/api/logout`, { method: 'POST' });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/);

  const summary = await (await fetch(`${baseUrl}/api/finance/summary`)).json();
  assert.equal(summary.collectionsMinor, 0);
  assert.equal(summary.expensesMinor, 35000);
  assert.equal(summary.netMinor, -35000);
});
