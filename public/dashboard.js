const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
let transactions = [];
let accounts = [];
let ledgerEntries = [];
let trialBalance = { rows: [], totals: { debitMinor: 0, creditMinor: 0 } };
let bankReconciliations = [];
let cashbookEntries = [];
let operatingExpenseEntries = [];
let pettyCashTransactions = [];
let pettyCashBalanceMinor = 0;
let budgets = [];
let assets = [];
let approvals = [];
let auditEvents = [];
let resetRequests = [];
let registrations = [];
let financeConfig = { feeTypes: [], revenueCategories: [], expenseCategories: [], chartOfAccounts: [], academicYears: [], semesters: [] };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatGhs(minor) {
  return `GHS ${(Number(minor || 0) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tokenHeaders() {
  const token = sessionStorage.getItem('carest_access_token');
  return { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...tokenHeaders(), ...(options.headers || {}) }
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* empty body */ }
  if (response.status === 401) {
    sessionStorage.removeItem('carest_access_token');
    showAuth();
  }
  if (!response.ok) throw new Error(payload.message || `Request failed: ${response.status}`);
  return payload;
}

function showToast(message) {
  const toast = $('#dashboard-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3600);
}

function showAuth() {
  $('#dashboard-auth').hidden = false;
  $('#dashboard-app').hidden = true;
}

function getTimeGreeting() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', hour12: false }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function showApp(user) {
  $('#dashboard-auth').hidden = true;
  $('#dashboard-app').hidden = false;
  $('#user-name').textContent = user?.name || 'Finance Admin';
  $('#welcome-name').textContent = user?.name?.split(' ')[0] || 'Finance team';
  $('[data-greeting]').textContent = getTimeGreeting();
  $('#user-avatar').textContent = (user?.name || 'FA').split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
}

function updateLiveClock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', dateStyle: 'full', timeStyle: 'medium' }).format(now);
  $$('[data-greeting]').forEach((node) => { node.textContent = getTimeGreeting(); });
  $$('[data-dashboard-clock]').forEach((node) => { node.textContent = `${time} GMT`; });
  $$('[data-dashboard-period]').forEach((node) => { node.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', month: 'long', year: 'numeric' }).format(now); });
}

function updateSummary(summary) {
  $('[data-summary="income"]').textContent = formatGhs(summary.collectionsMinor);
  $('[data-summary="expenses"]').textContent = formatGhs(summary.expensesMinor);
  $('[data-summary="net"]').textContent = formatGhs(summary.netMinor);
  $('[data-summary="pending"]').textContent = String(summary.pendingCount || 0);
  $('[data-control-payments]').textContent = String(summary.paymentCount || 0);
  $('[data-control-pending]').textContent = String(summary.pendingCount || 0);
  $('[data-nav-pending]').textContent = String(summary.pendingCount || 0);
}

function statusClass(status, reviewStatus) {
  if (status === 'VOIDED') return 'voided';
  return reviewStatus === 'APPROVED' ? 'approved' : '';
}

function statusLabel(status, reviewStatus) {
  if (status === 'VOIDED') return 'Voided';
  if (reviewStatus === 'PENDING_REVIEW') return 'Pending review';
  if (reviewStatus === 'REJECTED') return 'Rejected';
  return 'Approved';
}

function renderMiniTransactions() {
  const target = $('[data-mini-transactions]');
  if (!target) return;
  if (!transactions.length) {
    target.innerHTML = '<p class="empty-state">No transactions recorded yet.</p>';
    return;
  }
  target.innerHTML = transactions.slice(0, 5).map((transaction) => `<div class="mini-transaction"><p><b>${escapeHtml(transaction.description)}</b><small>${escapeHtml(transaction.reference)} · ${escapeHtml(transaction.category)}</small></p><span class="transaction-kind ${transaction.type === 'expense' ? 'expense' : ''}">${transaction.type === 'expense' ? 'Expense' : 'Income'}</span><span class="amount">${formatGhs(transaction.amountMinor)}</span><span class="status">${statusLabel(transaction.status, transaction.reviewStatus)}</span></div>`).join('');
}

function renderTransactions() {
  const table = $('[data-transactions-table]');
  if (!table) return;
  const query = ($('[data-transaction-search]')?.value || '').toLowerCase();
  const type = $('[data-transaction-filter]')?.value || 'all';
  const review = $('[data-review-filter]')?.value || 'all';
  const filtered = transactions.filter((transaction) => {
    const haystack = `${transaction.description} ${transaction.reference} ${transaction.category}`.toLowerCase();
    return (!query || haystack.includes(query)) && (type === 'all' || transaction.type === type) && (review === 'all' || transaction.reviewStatus === review || transaction.status === review);
  });
  if (!filtered.length) {
    table.innerHTML = '<tr><td colspan="8" class="empty-state">No transactions match this view.</td></tr>';
    return;
  }
  table.innerHTML = filtered.map((transaction) => `<tr>
    <td>${escapeHtml(transaction.transactionDate || '')}</td>
    <td><span class="transaction-kind ${transaction.type === 'expense' ? 'expense' : ''}">${transaction.type === 'expense' ? 'Expense' : 'Income'}</span></td>
    <td><strong>${escapeHtml(transaction.description)}</strong></td>
    <td>${escapeHtml(transaction.reference)}</td>
    <td>${escapeHtml(transaction.category)}</td>
    <td class="align-right">${formatGhs(transaction.amountMinor)}</td>
    <td><span class="status-pill ${statusClass(transaction.status, transaction.reviewStatus)}">${statusLabel(transaction.status, transaction.reviewStatus)}</span></td>
    <td><div class="table-actions">${transaction.type === 'income' ? `<button data-action="receipt" data-id="${escapeHtml(transaction.id)}">Receipt</button>` : ''}${transaction.status !== 'VOIDED' ? `<button data-action="edit" data-id="${escapeHtml(transaction.id)}">Edit</button>` : ''}${transaction.reviewStatus === 'PENDING_REVIEW' && transaction.status !== 'VOIDED' ? `<button data-action="review" data-id="${escapeHtml(transaction.id)}">Review</button>` : ''}${transaction.status !== 'VOIDED' ? `<button class="danger" data-action="void" data-id="${escapeHtml(transaction.id)}">Void</button>` : ''}</div></td>
  </tr>`).join('');
  $$('[data-action]', table).forEach((button) => button.addEventListener('click', () => handleTransaction(button.dataset.action, button.dataset.id)));
}

async function handleTransaction(action, id) {
  const transaction = transactions.find((item) => item.id === id);
  if (!transaction) return;
  const endpoint = transaction.type === 'expense' ? 'expenses' : 'payments';
  try {
    if (action === 'receipt') {
      window.open(`/reports/receipt/${encodeURIComponent(id)}`, '_blank', 'noopener');
      return;
    }
    if (action === 'review') {
      await api(`/api/finance/${endpoint}/${encodeURIComponent(id)}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
      showToast('Transaction approved.');
    } else if (action === 'void') {
      const reason = window.prompt('Reason for voiding this transaction:', 'Correction requested by finance administrator');
      if (reason === null) return;
      await api(`/api/finance/${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      showToast('Transaction voided with reversal entries.');
    } else if (action === 'edit') {
      const amount = window.prompt('Updated amount in GHS:', (Number(transaction.amountMinor || 0) / 100).toFixed(2));
      if (amount === null) return;
      const category = window.prompt('Updated category:', transaction.category);
      if (category === null) return;
      const body = transaction.type === 'expense' ? { amountPaid: Number(amount), expenseCategory: category } : { amountPaid: Number(amount), feeCategory: category };
      await api(`/api/finance/${endpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      showToast('Transaction updated and returned to review.');
    }
    await loadData();
  } catch (error) {
    showToast(error.message);
  }
}

function renderAccounts() {
  const table = $('[data-accounts-table]');
  if (!table) return;
  $('[data-account-count]').textContent = `${accounts.filter((account) => account.active !== false).length} active`;
  $('[data-control-accounts]').textContent = String(accounts.length);
  table.innerHTML = accounts.map((account) => `<tr><td><strong>${escapeHtml(account.code)}</strong></td><td>${escapeHtml(account.name)}</td><td><span class="status-pill ${account.accountType === 'INCOME' ? 'approved' : ''}">${escapeHtml(account.accountType)}</span></td><td>${escapeHtml(account.normalBalance || (['LIABILITY', 'EQUITY', 'INCOME'].includes(account.accountType) ? 'CREDIT' : 'DEBIT'))}</td><td>${escapeHtml(account.usageNote || 'Configured account in the CAREST chart.')}</td><td>${account.active === false ? 'Inactive' : 'Active'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No accounts configured.</td></tr>';
}

function renderLedger() {
  const table = $('[data-ledger-table]');
  if (!table) return;
  const debit = trialBalance.totals?.debitMinor || 0;
  const credit = trialBalance.totals?.creditMinor || 0;
  $('[data-trial-debit]').textContent = formatGhs(debit);
  $('[data-trial-credit]').textContent = formatGhs(credit);
  $('[data-trial-difference]').textContent = formatGhs(debit - credit);
  $('[data-ledger-count]').textContent = String(ledgerEntries.length);
  table.innerHTML = ledgerEntries.slice(0, 100).map((entry) => `<tr><td>${escapeHtml(entry.createdAt || '')}</td><td><strong>${escapeHtml(entry.accountCode)}</strong></td><td>${escapeHtml(entry.description || '')}</td><td>${escapeHtml(entry.direction)}</td><td class="align-right">${formatGhs(entry.amountMinor)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No posted ledger lines yet.</td></tr>';
}

function renderReceivables() {
  const income = transactions.filter((item) => item.type === 'income' && item.status !== 'VOIDED').reduce((sum, item) => sum + Number(item.amountMinor || 0), 0);
  const expense = transactions.filter((item) => item.type === 'expense' && item.status !== 'VOIDED').reduce((sum, item) => sum + Number(item.amountMinor || 0), 0);
  $('[data-ar-total]').textContent = formatGhs(income);
  $('[data-ap-total]').textContent = formatGhs(expense);
}

function renderBanking() {
  const table = $('[data-bank-table]');
  if (table) table.innerHTML = bankReconciliations.map((item) => `<tr><td>${escapeHtml(item.statementDate)}</td><td>${escapeHtml(item.bankAccount || 'Main bank account')}</td><td>${formatGhs(item.closingBalanceMinor)}</td><td><span class="status-pill">${escapeHtml(item.status || 'OPEN')}</span></td><td>${escapeHtml(item.notes || '—')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No bank reconciliations recorded yet.</td></tr>';
  const cashbook = $('[data-cashbook-table]');
  if (cashbook) cashbook.innerHTML = cashbookEntries.slice(0, 100).map((entry) => `<tr><td>${escapeHtml(entry.entryDate)}</td><td><span class="transaction-kind ${entry.entryType === 'PAYMENT' ? 'expense' : ''}">${escapeHtml(entry.entryType)}</span></td><td>${escapeHtml(entry.referenceNumber || '—')}</td><td>${escapeHtml(entry.description)}</td><td>${escapeHtml(entry.paymentMethod || '—')}</td><td class="align-right">${formatGhs(entry.amountMinor)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No cashbook entries recorded yet.</td></tr>';
  const operating = $('[data-operating-expense-table]');
  if (operating) operating.innerHTML = operatingExpenseEntries.slice(0, 50).map((entry) => `<tr><td>${escapeHtml(entry.entryDate)}</td><td>${escapeHtml(entry.referenceNumber || '—')}</td><td>${escapeHtml(entry.description)}</td><td class="align-right">${formatGhs(entry.amountMinor)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">No operating expense entries recorded yet.</td></tr>';
  const petty = $('[data-petty-table]');
  if (petty) petty.innerHTML = pettyCashTransactions.slice(0, 50).map((item) => `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.transactionType)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.referenceNumber || '—')}</td><td class="align-right">${formatGhs(item.amountMinor)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No petty cash entries recorded yet.</td></tr>';
  const balance = $('[data-petty-balance]');
  if (balance) balance.textContent = formatGhs(pettyCashBalanceMinor);
}

function renderBudgetsAssets() {
  const table = $('[data-assets-table]');
  if (!table) return;
  table.innerHTML = assets.map((asset) => `<tr><td><strong>${escapeHtml(asset.name)}</strong></td><td>${escapeHtml(asset.assetCode)}</td><td>${escapeHtml(asset.category)}</td><td>${formatGhs(asset.costMinor)}</td><td>${formatGhs(asset.accumulatedDepreciationMinor)}</td><td>${formatGhs(asset.netBookValueMinor)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No fixed assets registered yet.</td></tr>';
}

function renderGovernance() {
  const approvalTable = $('[data-approvals-table]');
  const auditTable = $('[data-audit-table]');
  const resetTable = $('[data-reset-table]');
  if (approvalTable) approvalTable.innerHTML = approvals.map((item) => `<tr><td>${escapeHtml(item.entityType)}</td><td>${escapeHtml(item.description)}</td><td>${formatGhs(item.amountMinor)}</td><td>${escapeHtml(item.createdAt || '')}</td><td><span class="status-pill">${escapeHtml(item.status)}</span></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No pending approvals.</td></tr>';
  if (auditTable) auditTable.innerHTML = auditEvents.slice(0, 50).map((item) => `<tr><td>${escapeHtml(item.createdAt || '')}</td><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.entityType)} / ${escapeHtml(item.entityId)}</td><td>${escapeHtml(item.userName || 'System')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">No audit events yet.</td></tr>';
  if (resetTable) {
    resetTable.innerHTML = resetRequests.map((item) => `<tr><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.reason || '')}</td><td>${escapeHtml(item.requestedAt || '')}</td><td><span class="status-pill ${item.status === 'APPROVED' ? 'approved' : ''}">${escapeHtml(item.status)}</span></td><td>${item.status === 'PENDING' ? `<button class="table-action-button" data-reset-approve="${escapeHtml(item.id)}">Approve</button>` : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No password reset requests.</td></tr>';
    $$('[data-reset-approve]', resetTable).forEach((button) => button.addEventListener('click', () => approveReset(button.dataset.resetApprove)));
  }
}

async function approveReset(id) {
  const newPassword = window.prompt('Enter a new password of at least 12 characters:');
  if (!newPassword) return;
  try {
    await api(`/api/auth/password-reset/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword }) });
    showToast('Password reset approved. The user can now sign in.');
    await loadData();
  } catch (error) { showToast(error.message); }
}

async function loadStudentLedger(studentId) {
  const table = $('[data-student-ledger-table]');
  try {
    const result = await api(`/api/accounting/student-ledgers/${encodeURIComponent(studentId)}`);
    const rows = result.ledger || [];
    table.innerHTML = rows.map((item) => `<tr><td>${escapeHtml(item.paymentDate || '')}</td><td>${escapeHtml(item.receiptNumber || '')}</td><td>${escapeHtml(item.feeCategory || '')}</td><td class="align-right">${formatGhs(item.amountMinor)}</td><td><span class="status-pill approved">${escapeHtml(item.status || 'POSTED')}</span></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No ledger entries for this student.</td></tr>';
  } catch (error) { table.innerHTML = `<tr><td colspan="5" class="empty-state">${escapeHtml(error.message)}</td></tr>`; }
}

function renderRegistrations(records = registrations) {
  const table = $('[data-registrations-table]');
  if (!table) return;
  const query = ($('[data-registration-search]')?.value || '').toLowerCase();
  const programme = $('[data-registration-programme-filter]')?.value || 'all';
  const status = $('[data-registration-status-filter]')?.value || 'all';
  const filtered = records.filter((item) => {
    const student = `${item.student_number || item.studentNumber || ''} ${item.first_name || item.firstName || ''} ${item.last_name || item.lastName || ''}`.toLowerCase();
    return (!query || student.includes(query)) && (programme === 'all' || item.programme === programme) && (status === 'all' || item.status === status);
  });
  if (!filtered.length) {
    table.innerHTML = '<tr><td colspan="8" class="empty-state">No student registrations received yet.</td></tr>';
    return;
  }
  table.innerHTML = filtered.map((item) => `<tr><td><strong>${escapeHtml(item.student_number || item.studentNumber || '—')}</strong></td><td>${escapeHtml(item.application_number || item.applicationNumber)}</td><td>${escapeHtml(item.first_name || item.firstName)} ${escapeHtml(item.last_name || item.lastName)}</td><td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.email || '—')}</td><td>${escapeHtml(item.programme)}</td><td>${escapeHtml(item.guardian_phone || item.guardianPhone || item.emergency_contact_phone || item.emergencyContactPhone || '—')}</td><td><span class="status-pill approved">${escapeHtml(item.status)}</span></td></tr>`).join('');
}

function populateFinanceSelectors() {
  const optionGroup = (items, valueKey, labelKey) => items.map((item) => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey])}${item.code ? ` · ${escapeHtml(item.code)}` : ''}</option>`).join('');
  $$('[data-account-select]').forEach((select) => { const current = select.value; select.innerHTML = '<option value="">Select account code</option>' + optionGroup(financeConfig.chartOfAccounts || [], 'code', 'name'); if (current) select.value = current; });
  $$('[data-fee-select]').forEach((select) => { select.innerHTML = '<option value="">Select fee category</option>' + optionGroup(financeConfig.feeTypes || [], 'name', 'name'); });
  $$('[data-revenue-select]').forEach((select) => { select.innerHTML = '<option value="">Select revenue account</option>' + (financeConfig.revenueCategories || []).map((item) => `<option value="4000-${escapeHtml(item.code)}">${escapeHtml(item.name)} · 4000-${escapeHtml(item.code)}</option>`).join(''); });
  $$('[data-year-select]').forEach((select) => { select.innerHTML = '<option value="">Select academic year</option>' + (financeConfig.academicYears || []).map((item) => `<option value="${escapeHtml(item.label)}">${escapeHtml(item.label)}</option>`).join(''); });
  $$('[data-semester-select]').forEach((select) => { select.innerHTML = '<option value="">Select semester</option>' + (financeConfig.semesters || []).map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join(''); });
}

async function loadData() {
  try {
    const [summary, transactionResult, accountResult, configResult, ledgerResult, trialResult, cashbookResult, operatingResult, bankResult, pettyResult, budgetResult, assetResult, approvalResult, auditResult, resetResult] = await Promise.all([
      api('/api/finance/summary'),
      api('/api/finance/transactions'),
      api('/api/accounting/chart-of-accounts'),
      api('/api/finance/config'),
      api('/api/accounting/ledger'),
      api('/api/accounting/trial-balance'),
      api('/api/accounting/cashbook'),
      api('/api/accounting/operating-expenses'),
      api('/api/accounting/bank-reconciliations'),
      api('/api/accounting/petty-cash'),
      api('/api/accounting/budgets'),
      api('/api/accounting/assets'),
      api('/api/accounting/approvals'),
      api('/api/accounting/audit-events'),
      api('/api/auth/password-reset/requests')
    ]);
    transactions = transactionResult.transactions || [];
    accounts = accountResult.accounts || [];
    financeConfig = configResult || financeConfig;
    populateFinanceSelectors();
    ledgerEntries = ledgerResult.entries || [];
    trialBalance = trialResult || { rows: [], totals: { debitMinor: 0, creditMinor: 0 } };
    cashbookEntries = cashbookResult.entries || [];
    operatingExpenseEntries = operatingResult.entries || [];
    bankReconciliations = bankResult.reconciliations || [];
    pettyCashTransactions = pettyResult.transactions || [];
    pettyCashBalanceMinor = Number(pettyResult.balanceMinor || 0);
    budgets = budgetResult.budgets || [];
    assets = assetResult.assets || [];
    approvals = approvalResult.approvals || [];
    auditEvents = auditResult.events || [];
    resetRequests = resetResult.requests || [];
    updateSummary(summary);
    renderMiniTransactions();
    renderTransactions();
    renderAccounts();
    renderLedger();
    renderReceivables();
    renderBanking();
    renderBudgetsAssets();
    renderGovernance();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadRegistrationOptions() {
  const options = await api('/api/registration/options');
  const programme = $('[data-dashboard-registration-programme]');
  const year = $('[data-dashboard-registration-year]');
  const semester = $('[data-dashboard-registration-semester]');
  if (programme) programme.innerHTML = '<option value="">Select programme</option>' + (options.programs || []).map((item) => `<option value="${escapeHtml(item.title)}">${escapeHtml(item.title)} · ${escapeHtml(item.type)}</option>`).join('');
  if (year) year.innerHTML = '<option value="">Select academic year</option>' + (options.academicYears || []).map((item) => `<option value="${escapeHtml(item.label)}">${escapeHtml(item.label)}</option>`).join('');
  if (semester) semester.innerHTML = '<option value="">Select semester</option>' + (options.semesters || []).map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('');
}

async function loadRegistrations() {
  try {
    await loadRegistrationOptions();
    const result = await api('/api/registrations');
    registrations = result.registrations || [];
    const programmeFilter = $('[data-registration-programme-filter]');
    if (programmeFilter) programmeFilter.innerHTML = '<option value="all">All programmes</option>' + [...new Set(registrations.map((item) => item.programme).filter(Boolean))].sort().map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
    renderRegistrations(registrations);
  } catch (error) {
    showToast(error.message);
  }
}

function setupNavigation() {
  const go = (section) => {
    $$('.dashboard-section').forEach((node) => { node.hidden = node.id !== `section-${section}`; node.classList.toggle('is-visible', node.id === `section-${section}`); });
    $$('.dashboard-nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.section === section));
    $('#section-breadcrumb').textContent = section.replace(/-/g, ' ');
    if (section === 'registrations') loadRegistrations();
  };
  $$('[data-section]').forEach((button) => button.addEventListener('click', () => go(button.dataset.section)));
  $$('[data-go-section]').forEach((button) => button.addEventListener('click', () => go(button.dataset.goSection)));
  window.dashboardGo = go;
}

function setupReports() {
  const form = $('#dashboard-report-form');
  if (!form) return;
  const now = new Date();
  form.from.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  form.to.value = now.toISOString().slice(0, 10);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const query = new URLSearchParams({ from: values.from, to: values.to, format: values.format });
    window.open(`/reports/financial/${encodeURIComponent(values.report)}?${query.toString()}`, '_blank', 'noopener');
  });
}

function setupForms() {
  setupDashboardRegistrationForm();
  const paymentPanel = $('[data-record-payment-panel]');
  $('[data-open-record-payment]')?.addEventListener('click', () => { if (paymentPanel) { paymentPanel.hidden = false; paymentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  $('[data-close-record-payment]')?.addEventListener('click', () => { if (paymentPanel) paymentPanel.hidden = true; });
  const dashboardPaymentForm = $('#dashboard-payment-form');
  if (dashboardPaymentForm) {
    const dateInput = dashboardPaymentForm.elements.namedItem('paymentDate');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    dashboardPaymentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = $('[data-dashboard-payment-message]');
      try {
        await api('/api/payments/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
        form.reset();
        if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
        message.textContent = 'Payment saved. Receipt and cashbook entry created.';
        message.style.color = '#57926c';
        showToast('Payment saved to the cashbook.');
        await loadData();
      } catch (error) { message.textContent = error.message; message.style.color = '#c62943'; }
    });
  }
  $('#account-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-account-message]');
    try {
      await api('/api/accounting/chart-of-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      message.textContent = 'Account added and audited.';
      message.style.color = '#57926c';
      await loadData();
    } catch (error) { message.textContent = error.message; message.style.color = '#c62943'; }
  });
  $('#journal-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-journal-message]');
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await api('/api/accounting/accruals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: data.description, amountPaid: Number(data.amountPaid), expenseAccount: data.debitAccount, liabilityAccount: data.creditAccount, startDate: new Date().toISOString().slice(0, 10) }) });
      form.reset();
      message.textContent = 'Accrual journal created and queued for review.';
      message.style.color = '#57926c';
      await loadData();
    } catch (error) { message.textContent = error.message; message.style.color = '#c62943'; }
  });
  $('#bank-reconciliation-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-bank-message]');
    try {
      await api('/api/accounting/bank-reconciliations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      message.textContent = 'Bank reconciliation saved.';
      message.style.color = '#57926c';
      await loadData();
    } catch (error) { message.textContent = error.message; message.style.color = '#c62943'; }
  });
  $('#petty-cash-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-petty-message]');
    try {
      await api('/api/accounting/petty-cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      message.textContent = 'Petty cash transaction saved.';
      message.style.color = '#57926c';
      await loadData();
    } catch (error) { message.textContent = error.message; message.style.color = '#c62943'; }
  });
  $('#budget-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-budget-message]');
    try {
      await api('/api/accounting/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      message.textContent = 'Budget line created.';
      message.style.color = '#57926c';
      await loadData();
    } catch (error) { message.textContent = error.message; message.style.color = '#c62943'; }
  });
  $('#asset-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('[data-asset-message]');
    try {
      await api('/api/accounting/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset();
      message.textContent = 'Asset registered; depreciation schedule updated.';
      message.style.color = '#57926c';
      await loadData();
    } catch (error) { message.textContent = error.message; message.style.color = '#c62943'; }
  });
  $('#student-ledger-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadStudentLedger(event.currentTarget.studentId.value.trim());
  });
}

function setupDashboardRegistrationForm() {
  const form = $('#dashboard-registration-form');
  if (!form) return;
  const preview = $('[data-dashboard-student-number]', form);
  const updatePreview = () => {
    const first = form.elements.namedItem('firstName')?.value.trim();
    const last = form.elements.namedItem('lastName')?.value.trim();
    if (preview) preview.value = first && last ? `Preview · CAR-${String(new Date().getFullYear()).slice(-2)}-${first[0]}${last[0]}-PENDING` : '';
  };
  form.elements.namedItem('firstName')?.addEventListener('input', updatePreview);
  form.elements.namedItem('lastName')?.addEventListener('input', updatePreview);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('[data-dashboard-registration-message]');
    const payload = Object.fromEntries(new FormData(form).entries());
    delete payload.studentNumberPreview;
    try {
      const result = await api('/api/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      form.reset();
      if (preview) preview.value = '';
      message.textContent = `Student saved: ${result.registration.studentNumber} · application ${result.registration.applicationNumber}`;
      message.style.color = '#57926c';
      showToast('Student registration saved.');
      await loadRegistrations();
    } catch (error) {
      message.textContent = error.message;
      message.style.color = '#c62943';
    }
  });
}

function setupFilters() {
  $('[data-transaction-search]')?.addEventListener('input', renderTransactions);
  $('[data-transaction-filter]')?.addEventListener('change', renderTransactions);
  $('[data-review-filter]')?.addEventListener('change', renderTransactions);
  $$('[data-refresh-all]').forEach((button) => button.addEventListener('click', async () => { await loadData(); showToast('Dashboard refreshed.'); }));
  $('[data-refresh-accounts]')?.addEventListener('click', loadData);
  $('[data-spool-coa]')?.addEventListener('click', () => window.open('/reports/chart-of-accounts', '_blank', 'noopener'));
  $('[data-refresh-ledger]')?.addEventListener('click', loadData);
  $('[data-refresh-cashbook]')?.addEventListener('click', loadData);
  $('[data-refresh-governance]')?.addEventListener('click', loadData);
  $('[data-refresh-registrations]')?.addEventListener('click', loadRegistrations);
  $('[data-registration-search]')?.addEventListener('input', () => renderRegistrations(registrations));
  $('[data-registration-programme-filter]')?.addEventListener('change', () => renderRegistrations(registrations));
  $('[data-registration-status-filter]')?.addEventListener('change', () => renderRegistrations(registrations));
  $('[data-open-ar-report]')?.addEventListener('click', () => window.open('/reports/financial/accounts-receivable', '_blank', 'noopener'));
  $('[data-open-ap-report]')?.addEventListener('click', () => window.open('/reports/financial/accounts-payable', '_blank', 'noopener'));
}

function setupDashboardClock() {
  const update = () => {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', dateStyle: 'full', timeStyle: 'medium' }).format(now);
    $$('[data-dashboard-clock]').forEach((node) => { node.textContent = `${date} GMT`; });
  };
  update();
  setInterval(update, 1000);
}

function setupPasswordReset() {
  const openButton = $('#open-reset-form');
  const form = $('#password-reset-form');
  const message = $('#reset-message');
  openButton?.addEventListener('click', () => { form.hidden = !form.hidden; if (!form.hidden) $('#reset-email')?.focus(); });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await api('/api/auth/password-reset/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      message.textContent = `${result.request.message} Request ID: ${result.request.id}`;
      message.style.color = '#57926c';
      form.reset();
    } catch (error) { message.textContent = error.message; message.style.color = '#c62943'; }
  });
}

async function startDashboard(user) {
  showApp(user);
  setupNavigation();
  setupReports();
  setupForms();
  setupFilters();
  setupDashboardClock();
  await loadData();
}

$('#dashboard-login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $('#dashboard-login-message');
  const button = $('button[type="submit"]', form);
  button.disabled = true;
  button.textContent = 'Signing in…';
  try {
    const result = await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email.value.trim(), password: form.password.value }) });
    sessionStorage.setItem('carest_access_token', result.token);
    await startDashboard(result.user);
  } catch (error) {
    message.textContent = error.message;
    message.style.color = '#c62943';
  } finally {
    button.disabled = false;
    button.innerHTML = 'Enter finance dashboard <span>↗</span>';
  }
});

async function performLogout() {
  try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* continue to landing */ }
  sessionStorage.removeItem('carest_access_token');
  window.location.assign('/');
}

$('#logout-button')?.addEventListener('click', performLogout);
$('#top-logout-button')?.addEventListener('click', performLogout);

setupPasswordReset();

const existingToken = sessionStorage.getItem('carest_access_token');
if (existingToken) {
  startDashboard({ name: 'Finance Admin', role: 'Finance workspace' });
}
