const fallbackData = {
  overview: {
    stats: [
      { value: '01' },
      { value: '∞' },
      { value: '100%' },
      { value: '24/7' }
    ]
  },
  activity: [
    { initials: 'FA', name: 'Finance Admin', action: 'posted a verified bank payment', time: '2m ago', tone: 'purple' },
    { initials: 'AR', name: 'Accounts Review', action: 'reconciled a revenue category', time: '8m ago', tone: 'orange' },
    { initials: 'YL', name: 'Year Ledger', action: 'opened the 2026 / 27 fee schedule', time: '14m ago', tone: 'green' }
  ],
  programs: [
    { id: '01', title: 'BSc. Business Administration', type: 'BSc', length: 'Bachelor programme', detail: 'Build leadership, management and entrepreneurial skills for today’s business world.', color: 'orange' },
    { id: '02', title: 'BSc Computer Science', type: 'BSc', length: 'Bachelor programme', detail: 'Learn computing, programming and software development to shape the future of technology.', color: 'blue' },
    { id: '03', title: 'HND Medical Laboratory Technology', type: 'HND / Diploma', length: 'HND programme', detail: 'Learn to test, diagnose and help save lives through hands-on laboratory training.', color: 'green' },
    { id: '04', title: 'Diploma in Security and Artificial Intelligence', type: 'HND / Diploma', length: 'Diploma programme', detail: 'Build knowledge in AI technologies, cybersecurity systems and digital protection.', color: 'violet' },
    { id: '05', title: 'Diploma in Catering, Hotel & Institutional Management', type: 'HND / Diploma', length: 'Diploma programme', detail: 'Master cooking, hospitality and hotel operations through practical experience.', color: 'red' },
    { id: '06', title: 'Medicine Counter Assistant / Pharmacy Assistant', type: 'Professional', length: 'Professional programme', detail: 'Learn to dispense medicines safely, assist pharmacists and serve with care.', color: 'yellow' }
  ],
  academicYears: [{ id: 'ay_2026_27', label: '2026/27' }, { id: 'ay_2027_28', label: '2027/28' }],
  semesters: [{ id: 'sem_1', name: 'Semester 1', academicYearId: 'ay_2026_27' }, { id: 'sem_2', name: 'Semester 2', academicYearId: 'ay_2026_27' }]
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
let programmeCatalog = [];

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3600);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

async function getJSON(path, fallback) {
  try {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.json();
  } catch {
    return fallback;
  }
}

async function hydrateFromApi() {
  const [overview, activity, programs] = await Promise.all([
    getJSON('/api/overview', fallbackData.overview),
    getJSON('/api/activity', { activity: fallbackData.activity }),
    getJSON('/api/programs', { programs: fallbackData.programs })
  ]);

  if (overview?.stats) {
    overview.stats.forEach((stat, index) => {
      const metric = $$('.metric strong')[index];
      if (metric && stat.value) metric.textContent = stat.value;
    });
  }

  const activityList = $('#activity-list');
  if (activityList && activity?.activity?.length) {
    activityList.innerHTML = activity.activity.map((item) => `
      <div class="activity-row">
        <span class="avatar avatar-${item.tone || 'purple'}">${escapeHtml(item.initials || item.name.slice(0, 2).toUpperCase())}</span>
        <p><strong>${escapeHtml(item.name)}</strong> ${escapeHtml(item.action)}<small>${escapeHtml(item.time)}</small></p>
      </div>
    `).join('');
  }

  if (programs?.programs?.length) renderProgrammeCards(programs.programs);
}

function setupAnnouncement() {
  const closeButton = $('.announcement-close');
  const bar = $('.announcement-bar');
  closeButton?.addEventListener('click', () => bar?.classList.add('is-hidden'));
}

function setupMobileMenu() {
  const toggle = $('.menu-toggle');
  const menu = $('#mobile-nav');
  if (!toggle || !menu) return;
  const closeMenu = () => {
    toggle.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
  };
  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    menu.classList.toggle('is-open', !isOpen);
  });
  $$('#mobile-nav a, #mobile-nav button').forEach((item) => item.addEventListener('click', closeMenu));
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && !toggle.contains(event.target)) closeMenu();
  });
}

function setupModals() {
  const modals = {
    film: $('#film-modal'),
    portal: $('#portal-modal'),
    programme: $('#programme-modal'),
    registration: $('#registration-modal')
  };
  let activeModal = null;

  const openModal = (modal) => {
    if (!modal) return;
    activeModal = modal;
    if (modal === modals.registration) {
      $('#registration-form', modal)?.removeAttribute('hidden');
      $('#registration-success', modal)?.setAttribute('hidden', '');
      $('#registration-form', modal)?.reset();
      const message = $('#registration-message', modal);
      if (message) { message.textContent = 'We will show your application number after submission.'; message.style.color = ''; }
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    setTimeout(() => $('.modal-close', modal)?.focus(), 80);
  };

  const closeModal = (modal = activeModal) => {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    activeModal = null;
    document.body.classList.remove('modal-open');
  };

  $$('[data-open-film]').forEach((button) => button.addEventListener('click', () => openModal(modals.film)));
  $$('[data-open-portal]').forEach((button) => button.addEventListener('click', () => openModal(modals.portal)));
  $$('[data-open-programme-builder]').forEach((button) => button.addEventListener('click', () => openModal(modals.programme)));
  $$('[data-open-registration]').forEach((button) => button.addEventListener('click', () => openModal(modals.registration)));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
  Object.values(modals).forEach((modal) => modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal);
  }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  setupLogin(modals.portal);
  setupFinanceConsole(modals.portal);
  setupReportSpool(modals.portal);
  setupRegistrationForm(modals.registration);
}

function formatDateInput(value) {
  return value.toISOString().slice(0, 10);
}

function setupLiveClock() {
  const update = () => {
    const now = new Date();
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
    const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', dateStyle: 'full' }).format(now);
    $$('.demo-date').forEach((node) => { node.textContent = `${date} · ${time} GMT`; });
    $$('[data-report-clock]').forEach((node) => { node.textContent = `Live now · ${time} GMT`; });
  };
  update();
  window.setInterval(update, 1000);
}

function setupReportSpool(portalModal) {
  const fromInput = $('[data-report-from]', portalModal);
  const toInput = $('[data-report-to]', portalModal);
  const typeInput = $('[data-report-type]', portalModal);
  const formatInput = $('[data-report-format]', portalModal);
  const button = $('[data-spool-report]', portalModal);
  if (!fromInput || !toInput || !typeInput || !formatInput || !button) return;
  const now = new Date();
  fromInput.value = formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  toInput.value = formatDateInput(now);
  button.addEventListener('click', () => {
    const params = new URLSearchParams({ from: fromInput.value, to: toInput.value, format: formatInput.value });
    window.open(`/reports/financial/${encodeURIComponent(typeInput.value)}?${params.toString()}`, '_blank', 'noopener');
  });
}

async function hydrateRegistrationOptions(registrationModal) {
  const options = await getJSON('/api/registration/options', { programs: fallbackData.programs, academicYears: fallbackData.academicYears, semesters: fallbackData.semesters });
  const programme = $('#registration-programme', registrationModal);
  const academicYear = $('#registration-academic-year', registrationModal);
  const semester = $('#registration-semester', registrationModal);
  if (programme) programme.innerHTML = '<option value="">Select a programme</option>' + options.programs.map((item) => `<option value="${escapeHtml(item.title)}">${escapeHtml(item.title)} · ${escapeHtml(item.type)}</option>`).join('') + '<option>Other / future programme</option>';
  if (academicYear) academicYear.innerHTML = '<option value="">Select academic year</option>' + options.academicYears.map((item) => `<option value="${escapeHtml(item.label)}">${escapeHtml(item.label)}</option>`).join('');
  if (semester) semester.innerHTML = '<option value="">Select semester</option>' + options.semesters.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('');
}

function setupRegistrationForm(registrationModal) {
  const form = $('#registration-form', registrationModal);
  const success = $('#registration-success', registrationModal);
  const number = $('#registration-number', registrationModal);
  const studentNumber = $('#student-number', registrationModal);
  const studentNumberInput = $('#registration-student-number', registrationModal);
  const message = $('#registration-message', registrationModal);
  if (!form) return;
  hydrateRegistrationOptions(registrationModal);
  const updateStudentNumberPreview = () => {
    const first = $('#registration-first-name', registrationModal)?.value.trim();
    const last = $('#registration-last-name', registrationModal)?.value.trim();
    if (studentNumberInput) {
      const initials = `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
      studentNumberInput.value = first && last ? `Preview · CAR-${String(new Date().getFullYear()).slice(-2)}-${initials}-${String(Date.now()).slice(-4)}` : '';
    }
  };
  $('#registration-first-name', registrationModal)?.addEventListener('input', updateStudentNumberPreview);
  $('#registration-last-name', registrationModal)?.addEventListener('input', updateStudentNumberPreview);
  $('[data-register-another]', registrationModal)?.addEventListener('click', () => {
    form.reset();
    form.hidden = false;
    success.hidden = true;
    if (message) {
      message.textContent = 'We will show your application number after submission.';
      message.style.color = '';
    }
    $('#registration-first-name', registrationModal)?.focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = $('button[type="submit"]', form);
    const originalLabel = submit.innerHTML;
    const payload = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    submit.innerHTML = 'Submitting details <span>…</span>';
    try {
      const response = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to submit the registration form.');
      form.hidden = true;
      success.hidden = false;
      number.textContent = result.registration.applicationNumber;
      if (studentNumber) studentNumber.textContent = result.registration.studentNumber;
      if (studentNumberInput) studentNumberInput.value = result.registration.studentNumber;
      showToast('Registration details submitted to CAREST.');
    } catch (error) {
      message.textContent = error.message;
      message.style.color = '#c62943';
    } finally {
      submit.disabled = false;
      submit.innerHTML = originalLabel;
    }
  });
}

function financeHeaders() {
  const token = sessionStorage.getItem('carest_access_token');
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function refreshFinanceSummary(portalModal) {
  const response = await fetch('/api/finance/summary', { headers: financeHeaders(), credentials: 'same-origin' });
  if (!response.ok) throw new Error((await response.json()).message || 'Unable to load finance summary.');
  const summary = await response.json();
  const formatGhs = (minor) => `₵ ${(Number(minor || 0) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const collections = $('[data-finance-summary="collections"] strong', portalModal);
  const expenses = $('[data-finance-summary="expenses"] strong', portalModal);
  const net = $('[data-finance-summary="net"] strong', portalModal);
  if (collections) collections.textContent = formatGhs(summary.collectionsMinor);
  if (expenses) expenses.textContent = formatGhs(summary.expensesMinor);
  if (net) net.textContent = formatGhs(summary.netMinor);
}

async function hydrateFinanceConsoleOptions(portalModal) {
  const response = await fetch('/api/finance/config', { headers: financeHeaders(), credentials: 'same-origin' });
  if (!response.ok) return;
  const config = await response.json();
  const feeSelect = $('#payment-fee-category', portalModal);
  const revenueSelect = $('#payment-revenue-code', portalModal);
  const expenseSelect = $('#expense-category', portalModal);
  const expenseAccountSelect = $('#expense-account-code', portalModal);
  if (feeSelect) feeSelect.innerHTML = '<option value="">Select fee category</option>' + (config.feeTypes || []).map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} · ${escapeHtml(item.code)}</option>`).join('');
  if (revenueSelect) revenueSelect.innerHTML = '<option value="">Select revenue account</option>' + (config.revenueCategories || []).map((item) => `<option value="4000-${escapeHtml(item.code)}">${escapeHtml(item.name)} · 4000-${escapeHtml(item.code)}</option>`).join('');
  if (expenseSelect) expenseSelect.innerHTML = '<option value="">Select expense category</option>' + (config.expenseCategories || []).map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} · ${escapeHtml(item.code)}</option>`).join('');
  if (expenseAccountSelect) expenseAccountSelect.innerHTML = '<option value="">Select expense account</option>' + (config.chartOfAccounts || []).filter((item) => item.accountType === 'EXPENSE').map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.name)} · ${escapeHtml(item.code)}</option>`).join('');
}

function transactionLabel(status, reviewStatus) {
  if (status === 'VOIDED') return 'Voided';
  if (reviewStatus === 'PENDING_REVIEW') return 'Pending review';
  if (reviewStatus === 'REJECTED') return 'Rejected';
  return 'Approved';
}

function renderTransactions(transactions, portalModal) {
  const list = $('#transaction-list', portalModal);
  if (!list) return;
  if (!transactions?.length) {
    list.innerHTML = '<p class="transaction-empty">No transactions have been recorded yet.</p>';
    return;
  }
  const formatGhs = (minor) => `₵ ${(Number(minor || 0) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  list.innerHTML = transactions.map((transaction) => {
    const isExpense = transaction.type === 'expense';
    const pending = transaction.reviewStatus === 'PENDING_REVIEW';
    const status = transactionLabel(transaction.status, transaction.reviewStatus);
    return `<div class="transaction-row">
      <div class="transaction-row-main"><strong>${escapeHtml(transaction.description)}</strong><small>${escapeHtml(transaction.reference)} · ${escapeHtml(transaction.category)}</small></div>
      <span class="transaction-type ${isExpense ? 'is-expense' : ''}">${isExpense ? 'Expense' : 'Income'}</span>
      <span class="transaction-amount">${formatGhs(transaction.amountMinor)}</span>
      <div class="transaction-actions">
        ${transaction.type === 'payment' ? `<button type="button" data-transaction-action="receipt" data-transaction-type="${transaction.type}" data-transaction-id="${escapeHtml(transaction.id)}">Receipt</button>` : ''}
        ${transaction.status !== 'VOIDED' ? `<button type="button" data-transaction-action="edit" data-transaction-type="${transaction.type}" data-transaction-id="${escapeHtml(transaction.id)}">Edit</button>` : ''}
        ${pending && transaction.status !== 'VOIDED' ? `<button type="button" data-transaction-action="review" data-transaction-type="${transaction.type}" data-transaction-id="${escapeHtml(transaction.id)}">Review</button>` : ''}
        ${transaction.status !== 'VOIDED' ? `<button type="button" class="is-danger" data-transaction-action="void" data-transaction-type="${transaction.type}" data-transaction-id="${escapeHtml(transaction.id)}">Void</button>` : ''}
      </div>
      <div class="transaction-status ${pending ? 'is-pending' : ''}"><span class="pulse-dot"></span>${status}</div>
    </div>`;
  }).join('');
  $$('#transaction-list [data-transaction-action]', portalModal).forEach((button) => {
    button.addEventListener('click', () => handleTransactionAction(button, portalModal));
  });
}

async function refreshTransactions(portalModal) {
  const response = await fetch('/api/finance/transactions', { headers: financeHeaders(), credentials: 'same-origin' });
  if (!response.ok) throw new Error((await response.json()).message || 'Unable to load transactions.');
  const result = await response.json();
  renderTransactions(result.transactions, portalModal);
}

async function handleTransactionAction(button, portalModal) {
  const action = button.dataset.transactionAction;
  const type = button.dataset.transactionType;
  const id = button.dataset.transactionId;
  const endpointType = type === 'payment' ? 'payments' : 'expenses';
  if (action === 'receipt') {
    window.open(`/reports/receipt/${encodeURIComponent(id)}`, '_blank', 'noopener');
    return;
  }
  if (action === 'void') {
    const reason = window.prompt('Reason for voiding this transaction:', 'Correction requested by finance administrator');
    if (reason === null) return;
    const response = await fetch(`/api/finance/${endpointType}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...financeHeaders() },
      credentials: 'same-origin',
      body: JSON.stringify({ reason })
    });
    const result = await response.json();
    if (!response.ok) return showToast(result.message || 'Unable to void transaction.');
    showToast('Transaction voided with a reversal entry.');
  } else if (action === 'review') {
    const response = await fetch(`/api/finance/${endpointType}/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...financeHeaders() },
      credentials: 'same-origin',
      body: JSON.stringify({ decision: 'approve' })
    });
    const result = await response.json();
    if (!response.ok) return showToast(result.message || 'Unable to review transaction.');
    showToast('Transaction reviewed and approved.');
  } else if (action === 'edit') {
    const transaction = (await (await fetch('/api/finance/transactions', { headers: financeHeaders(), credentials: 'same-origin' })).json()).transactions.find((item) => item.id === id);
    if (!transaction) return showToast('Transaction could not be loaded.');
    const formName = type === 'payment' ? 'manual-payment-form' : 'manual-expense-form';
    const form = $(`#${formName}`, portalModal);
    const toggle = $(`[data-console-toggle="${type === 'payment' ? 'payment' : 'expense'}"]`, portalModal);
    toggle?.click();
    if (!form) return;
    form.dataset.editId = id;
    form.dataset.editType = type;
    const values = type === 'payment'
      ? { studentId: transaction.studentId, studentName: transaction.studentName, receiptNumber: transaction.receiptNumber, amountPaid: transaction.amountPaid, feeCategory: transaction.feeCategory, paymentMethod: transaction.paymentMethod, academicYear: transaction.academicYear, semester: transaction.semester }
      : { vendor: transaction.vendor, referenceNumber: transaction.referenceNumber, amountPaid: transaction.amountPaid, expenseCategory: transaction.expenseCategory, paymentMethod: transaction.paymentMethod };
    Object.entries(values).forEach(([key, value]) => { const input = form.elements.namedItem(key); if (input && value !== undefined) input.value = value; });
    const submit = $('button[type="submit"]', form);
    if (submit) submit.firstChild.textContent = type === 'payment' ? 'Update payment ' : 'Update expense ';
    showToast('Transaction loaded for editing.');
  }
  try {
    await refreshFinanceSummary(portalModal);
    await refreshTransactions(portalModal);
  } catch (error) {
    showToast(error.message);
  }
}

function setupLogin(portalModal) {
  const form = $('#login-form', portalModal);
  const login = $('#portal-login', portalModal);
  const dashboard = $('#portal-dashboard', portalModal);
  const message = $('#login-message', portalModal);
  const name = $('#portal-user-name', portalModal);
  const role = $('#portal-user-role', portalModal);
  if (!form) return;

  $('#toggle-password', portalModal)?.addEventListener('click', (event) => {
    const password = $('#login-password', portalModal);
    const button = event.currentTarget;
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    button.textContent = show ? '◌' : '◉';
    button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#login-email', portalModal).value.trim();
    const submit = $('.login-submit', form);
    const originalLabel = submit.innerHTML;
    submit.disabled = true;
    submit.innerHTML = 'Opening workspace <span>…</span>';

    let result;
    let networkFailure = false;
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password: $('#login-password', portalModal).value })
      });
      result = await response.json();
      if (!response.ok) result = { ok: false, message: result.message || 'Unable to sign in.' };
    } catch {
      networkFailure = true;
    }

    if (networkFailure) {
      result = !email || !email.includes('@')
        ? { ok: false, message: 'Enter a valid college email address.' }
        : {
          ok: true,
          user: {
            name: email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
            role: 'Finance workspace'
          },
          token: 'local-review-token'
        };
    }

    submit.disabled = false;
    submit.innerHTML = originalLabel;
    if (!result.ok) {
      message.textContent = result.message || 'Please check your details and try again.';
      message.style.color = '#c62943';
      return;
    }

    if (result.token) sessionStorage.setItem('carest_access_token', result.token);
    if (portalModal?.id === 'portal-modal') {
      window.location.assign('/dashboard');
      return;
    }
    name.textContent = `Welcome back, ${result.user.name}`;
    role.textContent = result.user.role;
    login.hidden = true;
    dashboard.hidden = false;
    try {
      await hydrateFinanceConsoleOptions(portalModal);
      await refreshFinanceSummary(portalModal);
      await refreshTransactions(portalModal);
    } catch (error) {
      showToast(error.message);
    }
    showToast('Finance workspace opened — welcome to CAREST 360.');
  });
}

function setupFinanceConsole(portalModal) {
  const dashboard = $('#portal-dashboard', portalModal);
  if (!dashboard) return;
  const today = formatDateInput(new Date());
  const paymentDate = $('#payment-date', dashboard);
  const expenseDate = $('#expense-date', dashboard);
  if (paymentDate) paymentDate.value = today;
  if (expenseDate) expenseDate.value = today;

  $$('[data-console-toggle]', dashboard).forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.consoleToggle;
      $$('[data-console-form]', dashboard).forEach((form) => {
        form.hidden = form.dataset.consoleForm !== target;
      });
      $$('[data-console-toggle]', dashboard).forEach((item) => item.classList.toggle('is-active', item === button));
    });
  });

  const postForm = async (form, endpoint, messageNode) => {
    const submit = $('button[type="submit"]', form);
    const originalLabel = submit.innerHTML;
    const payload = Object.fromEntries(new FormData(form).entries());
    const editId = form.dataset.editId;
    const editType = form.dataset.editType;
    const requestEndpoint = editId ? `/api/finance/${editType === 'payment' ? 'payments' : 'expenses'}/${encodeURIComponent(editId)}` : endpoint;
    submit.disabled = true;
    submit.innerHTML = 'Saving <span>…</span>';
    try {
      const response = await fetch(requestEndpoint, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...financeHeaders() },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to save this record.');
      form.reset();
      if ($('#payment-date', dashboard)) $('#payment-date', dashboard).value = formatDateInput(new Date());
      if ($('#expense-date', dashboard)) $('#expense-date', dashboard).value = formatDateInput(new Date());
      delete form.dataset.editId;
      delete form.dataset.editType;
      messageNode.textContent = editId ? 'Transaction updated and returned to review.' : 'Saved successfully. The finance summary has been updated.';
      messageNode.style.color = '#4e8a61';
      await refreshFinanceSummary(portalModal);
      await refreshTransactions(portalModal);
      showToast(editId ? 'Transaction updated.' : 'Finance record saved.');
    } catch (error) {
      messageNode.textContent = error.message;
      messageNode.style.color = '#c62943';
    } finally {
      submit.disabled = false;
      submit.innerHTML = originalLabel;
    }
  };

  $('[data-refresh-transactions]', dashboard)?.addEventListener('click', async () => {
    try {
      await refreshTransactions(portalModal);
      showToast('Transactions refreshed.');
    } catch (error) {
      showToast(error.message);
    }
  });

  const paymentForm = $('#manual-payment-form', dashboard);
  paymentForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    postForm(paymentForm, '/api/payments/manual', $('#payment-form-message', dashboard));
  });
  const feeForm = $('#new-fee-form', dashboard);
  feeForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    postForm(feeForm, '/api/finance/fee-types', $('#fee-form-message', dashboard));
  });
  const expenseForm = $('#manual-expense-form', dashboard);
  expenseForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    postForm(expenseForm, '/api/expenses/manual', $('#expense-form-message', dashboard));
  });
}

function createProgrammeCard(programme) {
  const colors = ['orange', 'blue', 'green', 'violet', 'red', 'yellow'];
  const color = colors.includes(programme.color) ? programme.color : 'blue';
  const type = programme.type || 'Professional';
  const code = type === 'BSc' ? 'BSc' : type === 'HND / Diploma' ? 'DIP' : 'CPD';
  const id = String(programme.id || '').padStart(2, '0').slice(-2);
  const titleParts = String(programme.title || 'New programme').split(' ');
  const titleMarkup = titleParts.length > 1
    ? `${escapeHtml(titleParts.slice(0, -1).join(' '))}<br><em>${escapeHtml(titleParts.at(-1))}</em>`
    : `<em>${escapeHtml(titleParts[0])}</em>`;
  return `<article class="programme-card card-${color}" data-type="${escapeHtml(type)}" data-id="${escapeHtml(programme.id || id)}">
    <div class="programme-card-top"><span>${escapeHtml(id)} / ${code}</span><span class="card-arrow">↗</span></div>
    <div class="programme-card-art art-${color}"><i></i><i></i><i></i><span>${escapeHtml(id)}</span></div>
    <div class="programme-card-copy"><h3>${titleMarkup}</h3><p>${escapeHtml(programme.detail || 'A future-ready CAREST programme.')}</p><div><span>${escapeHtml(type)}</span><span>${escapeHtml(programme.length || 'To be configured')}</span></div></div>
  </article>`;
}

function applyProgrammeFilter(type) {
  const cards = $$('.programme-card');
  const empty = $('#programme-empty');
  let visible = 0;
  cards.forEach((card) => {
    const matches = type === 'All' || card.dataset.type === type;
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  if (empty) empty.hidden = visible !== 0;
}

function renderProgrammeCards(programmes) {
  const grid = $('#programme-grid');
  if (!grid || !programmes?.length) return;
  programmeCatalog = programmes;
  grid.innerHTML = programmes.map(createProgrammeCard).join('');
  const count = $('[data-filter="All"] span');
  if (count) count.textContent = String(programmes.length).padStart(2, '0');
  applyProgrammeFilter($('.filter-button.is-active')?.dataset.filter || 'All');
}

function setupProgrammeFilters() {
  const filters = $$('.filter-button');
  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      const type = filter.dataset.filter;
      filters.forEach((item) => {
        const isActive = item === filter;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', String(isActive));
      });
      applyProgrammeFilter(type);
    });
  });
}

function setupProgrammeBuilder() {
  const form = $('#programme-form');
  const modal = $('#programme-modal');
  const message = $('#programme-message');
  if (!form || !modal) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = $('button[type="submit"]', form);
    const originalLabel = submit.innerHTML;
    const input = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    submit.innerHTML = 'Saving programme <span>…</span>';

    let result;
    let networkFailure = false;
    try {
      const response = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...financeHeaders() },
        credentials: 'same-origin',
        body: JSON.stringify(input)
      });
      result = await response.json();
      if (!response.ok) result = { ok: false, message: result.message || 'Unable to save programme.' };
    } catch {
      networkFailure = true;
    }
    if (networkFailure) {
      result = !input.title
        ? { ok: false, message: 'Add a programme title first.' }
        : { ok: true, program: { ...input, id: `future-${Date.now()}` } };
    }

    submit.disabled = false;
    submit.innerHTML = originalLabel;
    if (!result.ok) {
      message.textContent = result.message || 'Please check the programme details.';
      message.style.color = '#c62943';
      return;
    }

    renderProgrammeCards([...programmeCatalog, result.program]);
    form.reset();
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    message.style.color = '';
    showToast(`${result.program.title} added to the programme catalogue.`);
  });
}

const moduleViews = {
  overview: {
    title: 'Finance desk / Monday close',
    kpis: [['Total collections', '₵ 8.42m', '↗ 12.2%', 'vs last term'], ['Outstanding balances', '₵ 620k', '↓ 8.4%', 'vs last week'], ['Expenses posted', '₵ 2.15m', '↗ 6.8%', 'vs last term']]
  },
  revenue: {
    title: 'Revenue at a glance',
    kpis: [['Total income', '₵ 10.57m', '↗ 9.4%', 'vs last term'], ['Other revenue', '₵ 2.15m', '↗ 18.2%', 'vs last term'], ['Banked today', '₵ 184k', '↗ 4.1%', 'vs yesterday']]
  },
  fees: {
    title: 'Student fees, configured by you',
    kpis: [['Active fee types', '42', '↗ 6', 'this academic year'], ['Fees posted', '₵ 8.42m', '↗ 12.2%', 'vs last term'], ['Outstanding fees', '₵ 620k', '↓ 8.4%', 'vs last week']]
  },
  expenses: {
    title: 'Expenses under control',
    kpis: [['Operating expenses', '₵ 2.15m', '↗ 6.8%', 'vs last term'], ['Pending approvals', '18', '↓ 4', 'vs yesterday'], ['Budget used', '64.2%', '→ 2.1%', 'vs last month']]
  },
  reports: {
    title: 'Reports ready when you are',
    kpis: [['Open reports', '12', '↗ 3', 'this month'], ['Last close', '98.4%', '↗ 1.8%', 'reconciled'], ['Exports this month', '84', '↗ 14.8%', 'vs last month']]
  }
};

function setupDemoModules() {
  const navItems = $$('.demo-nav');
  const title = $('#module-title');
  const kpis = $$('.demo-kpi');
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const view = moduleViews[item.dataset.module] || moduleViews.overview;
      navItems.forEach((nav) => nav.classList.toggle('is-active', nav === item));
      if (title) title.textContent = view.title;
      view.kpis.forEach((values, index) => {
        const card = kpis[index];
        if (!card) return;
        const label = $('span', card);
        const value = $('strong', card);
        const delta = $('small', card);
        if (label) label.textContent = values[0];
        if (value) value.textContent = values[1];
        if (delta) delta.innerHTML = `${values[2]} <em>${values[3]}</em>`;
        if (delta) {
          delta.classList.toggle('positive', values[2].startsWith('↗'));
          delta.classList.toggle('neutral', !values[2].startsWith('↗'));
        }
      });
      showToast(`${item.textContent.trim().replace(/\s+/g, ' ')} workspace loaded.`);
    });
  });
}

function setupNewsletter() {
  const form = $('#newsletter-form');
  const message = $('#newsletter-message');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = $('#newsletter-email').value.trim();
    if (!email) return;
    form.reset();
    if (message) message.textContent = 'You’re on the list. See you in your inbox.';
    showToast('You’re on the list — thanks for staying close.');
  });
}

function setupReveal() {
  const elements = $$('.reveal-on-scroll');
  if (!('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        instance.unobserve(entry.target);
      }
    });
  }, { threshold: .15 });
  elements.forEach((element) => observer.observe(element));
}

function setupHeroParallax() {
  const heroImage = $('.hero-media img');
  if (!heroImage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let ticking = false;
  const update = () => {
    const offset = Math.min(window.scrollY * .06, 34);
    heroImage.style.transform = `scale(1.04) translateY(${offset}px)`;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

setupAnnouncement();
setupMobileMenu();
setupModals();
setupProgrammeFilters();
setupProgrammeBuilder();
setupDemoModules();
setupNewsletter();
setupReveal();
setupHeroParallax();
setupLiveClock();
hydrateFromApi();
