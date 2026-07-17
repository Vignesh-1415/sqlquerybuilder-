/* =========================================================
   STATEMENT APP — client logic
   1. Config + small fetch helper
   2. API health check
   3. Upload flow (dropzone + sample database)
   4. Schema rendering
   5. Ask flow (validation, request, render result)
   6. History
   7. Toast + shared helpers
   8. Bootstrap (restore session from localStorage)
   ========================================================= */

(() => {
  'use strict';

  const API_BASE = window.STATEMENT_CONFIG.apiBaseUrl;
  const SESSION_STORAGE_KEY = 'statement.sessionId';

  const els = {
    apiStatusDot: document.getElementById('api-status-dot'),
    apiStatusText: document.getElementById('api-status-text'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('file-input'),
    useSampleBtn: document.getElementById('use-sample-btn'),
    uploadStatus: document.getElementById('upload-status'),
    schemaPanel: document.getElementById('schema-panel'),
    schemaList: document.getElementById('schema-list'),
    historyPanel: document.getElementById('history-panel'),
    historyList: document.getElementById('history-list'),
    emptyState: document.getElementById('empty-state'),
    askArea: document.getElementById('ask-area'),
    askForm: document.getElementById('ask-form'),
    askSubmit: document.getElementById('ask-submit'),
    questionInput: document.getElementById('question-input'),
    questionError: document.getElementById('question-error'),
    resultArea: document.getElementById('result-area'),
    toast: document.getElementById('toast'),
  };

  let state = {
    sessionId: null,
    fileName: null,
  };

  /* ---------- 1. FETCH HELPER ---------- */
  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, options);
    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error('The server returned an unexpected response.');
    }
    if (!res.ok || body.success === false) {
      const err = new Error(body.message || 'Something went wrong.');
      err.code = body.code;
      throw err;
    }
    return body;
  }

  /* ---------- 2. API HEALTH ---------- */
  async function checkHealth() {
    try {
      await api('/health');
      els.apiStatusDot.classList.add('is-online');
      els.apiStatusDot.classList.remove('is-offline');
      els.apiStatusText.textContent = 'API connected';
    } catch {
      els.apiStatusDot.classList.add('is-offline');
      els.apiStatusDot.classList.remove('is-online');
      els.apiStatusText.textContent = 'API unreachable';
    }
  }

  /* ---------- 3. UPLOAD FLOW ---------- */
  function setUploadStatus(message, type) {
    els.uploadStatus.textContent = message;
    els.uploadStatus.className = `upload-status${type ? ` is-${type}` : ''}`;
  }

  async function uploadFile(file) {
    if (!file) return;

    const allowed = ['.db', '.sqlite', '.sqlite3'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadStatus('Only .db, .sqlite, or .sqlite3 files are accepted.', 'error');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadStatus('File is too large. Maximum size is 15MB.', 'error');
      return;
    }

    setUploadStatus(`Uploading ${file.name}…`, 'loading');

    const formData = new FormData();
    formData.append('database', file);

    try {
      const res = await api('/upload', { method: 'POST', body: formData });
      const { sessionId, fileName, schema } = res.data;

      state.sessionId = sessionId;
      state.fileName = fileName;
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);

      setUploadStatus(`Connected: ${fileName}`, 'success');
      renderSchema(schema);
      showAskArea();
      await refreshHistory();
      showToast(`${fileName} is ready. Ask it a question below.`, 'success');
    } catch (err) {
      setUploadStatus(err.message, 'error');
      showToast(err.message, 'error');
    }
  }

  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
  });
  els.fileInput.addEventListener('change', (e) => uploadFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach((evt) =>
    els.dropzone.addEventListener(evt, (e) => { e.preventDefault(); els.dropzone.classList.add('is-dragover'); })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    els.dropzone.addEventListener(evt, (e) => { e.preventDefault(); els.dropzone.classList.remove('is-dragover'); })
  );
  els.dropzone.addEventListener('drop', (e) => uploadFile(e.dataTransfer.files[0]));

  els.useSampleBtn.addEventListener('click', async () => {
    setUploadStatus('Fetching sample database…', 'loading');
    try {
      const res = await fetch('assets/sample.sqlite');
      if (!res.ok) throw new Error('Could not load the bundled sample database.');
      const blob = await res.blob();
      const file = new File([blob], 'sample.sqlite', { type: 'application/octet-stream' });
      await uploadFile(file);
    } catch (err) {
      setUploadStatus(err.message, 'error');
    }
  });

  /* ---------- 4. SCHEMA RENDERING ---------- */
  function renderSchema(schema) {
    els.schemaList.innerHTML = '';
    schema.forEach((table) => {
      const wrap = document.createElement('div');
      wrap.className = 'schema-table';

      const head = document.createElement('div');
      head.className = 'schema-table__head';
      head.innerHTML = `<span>${escapeHtml(table.table)}</span><span>${table.rowCount} rows</span>`;
      wrap.appendChild(head);

      const rows = document.createElement('div');
      rows.className = 'schema-table__rows';
      table.columns.forEach((col) => {
        const row = document.createElement('div');
        row.className = `schema-col${col.primaryKey ? ' is-pk' : ''}`;
        row.innerHTML = `<span>${escapeHtml(col.name)}${col.primaryKey ? ' (PK)' : ''}</span><span class="schema-col__type">${escapeHtml(col.type)}</span>`;
        rows.appendChild(row);
      });
      wrap.appendChild(rows);

      els.schemaList.appendChild(wrap);
    });
    els.schemaPanel.hidden = false;
  }

  function showAskArea() {
    els.emptyState.hidden = true;
    els.askArea.hidden = false;
    els.historyPanel.hidden = false;
  }

  /* ---------- 5. ASK FLOW ---------- */
  function setAskLoading(isLoading) {
    els.askSubmit.disabled = isLoading;
    els.askSubmit.classList.toggle('is-loading', isLoading);
  }

  function renderResult(question, data) {
    const card = document.createElement('div');
    card.className = 'result-card';

    card.innerHTML = `
      <div class="result-card__section result-card__section--nl">
        <span class="result-card__label">You asked</span>
        <p class="result-card__text">${escapeHtml(question)}</p>
      </div>
      <div class="result-card__section result-card__section--sql">
        <span class="result-card__label">Statement ran</span>
        <pre class="result-card__code">${escapeHtml(data.sql)}</pre>
      </div>
      <div class="result-meta">
        <span>${data.rowCount} row${data.rowCount === 1 ? '' : 's'}</span>
        <span>${data.durationMs}ms</span>
      </div>
    `;

    const tableSection = document.createElement('div');
    if (data.rows.length === 0) {
      tableSection.className = 'result-empty';
      tableSection.textContent = 'The query ran successfully and returned no rows.';
    } else {
      tableSection.className = 'table-wrap';
      const table = document.createElement('table');
      table.className = 'result-table';
      const thead = document.createElement('thead');
      thead.innerHTML = `<tr>${data.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
      const tbody = document.createElement('tbody');
      data.rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = data.columns
          .map((c) => {
            const value = row[c];
            return value === null || value === undefined
              ? `<td class="is-null">null</td>`
              : `<td>${escapeHtml(String(value))}</td>`;
          })
          .join('');
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      tableSection.appendChild(table);
    }
    card.appendChild(tableSection);

    els.resultArea.prepend(card);
  }

  function renderResultError(question, message) {
    const card = document.createElement('div');
    card.className = 'result-error';
    card.innerHTML = `<strong>Couldn't run that one</strong>${escapeHtml(message)}`;
    els.resultArea.prepend(card);
  }

  els.askForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = els.questionInput.value.trim();
    els.questionError.textContent = '';

    if (question.length < 4) {
      els.questionError.textContent = 'Type a full question (at least 4 characters).';
      return;
    }
    if (!state.sessionId) {
      showToast('Upload a database first.', 'error');
      return;
    }

    setAskLoading(true);
    try {
      const res = await api('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, question }),
      });
      renderResult(question, res.data);
      els.questionInput.value = '';
    } catch (err) {
      renderResultError(question, err.message);
      showToast(err.message, 'error');
    } finally {
      setAskLoading(false);
      await refreshHistory();
    }
  });

  /* ---------- 6. HISTORY ---------- */
  async function refreshHistory() {
    if (!state.sessionId) return;
    try {
      const res = await api(`/history/${state.sessionId}`);
      renderHistory(res.data);
    } catch {
      // Non-fatal: history is a convenience panel, not core to the ask flow.
    }
  }

  function renderHistory(items) {
    els.historyList.innerHTML = '';
    if (items.length === 0) {
      els.historyList.innerHTML = '<li class="history-item">No questions yet.</li>';
      return;
    }
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <p class="history-item__q">${escapeHtml(item.question)}</p>
        <div class="history-item__meta">
          <span class="history-item__status ${item.status}"></span>
          <span>${item.rowCount} rows</span>
        </div>
      `;
      li.addEventListener('click', () => {
        els.questionInput.value = item.question;
        els.questionInput.focus();
      });
      els.historyList.appendChild(li);
    });
  }

  /* ---------- 7. TOAST + HELPERS ---------- */
  let toastTimer;
  function showToast(message, type) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.className = `toast is-visible${type ? ` is-${type}` : ''}`;
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 3500);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------- 8. BOOTSTRAP ---------- */
  async function restoreSession() {
    const savedId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!savedId) return;

    try {
      const res = await api(`/session/${savedId}`);
      state.sessionId = savedId;
      state.fileName = res.data.fileName;
      setUploadStatus(`Connected: ${res.data.fileName}`, 'success');
      renderSchema(res.data.schema);
      showAskArea();
      await refreshHistory();
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  checkHealth();
  restoreSession();
})();
