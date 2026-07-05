const { CONFIG } = require('../config/mock-config');

function registerDashboardRoutes(app) {
  if (!CONFIG.dashboardEnabled) {
    return;
  }

  app.get('/', (req, res) => {
    res.redirect('/tiramis/mock/dashboard');
  });

  app.get('/tiramis/mock/dashboard', (req, res) => {
    res.set('Content-Type', 'text/html');
    res.send(buildDashboardHtml());
  });

  app.get('/tiramis/mock/ui', (req, res) => {
    res.redirect('/tiramis/mock/dashboard');
  });
}

function buildDashboardHtml() {
  const title = CONFIG.dashboardTitle || 'TIRAMIS Mock TIRA Dashboard';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #f4f6f8; color: #1f2937; }
    header { background: #111827; color: white; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    header h1 { font-size: 20px; margin: 0; }
    header small { color: #d1d5db; }
    main { padding: 20px; max-width: 1500px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .card { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; }
    .card h2 { font-size: 16px; margin: 0 0 12px; color: #111827; }
    .metric { font-size: 28px; font-weight: bold; margin-bottom: 4px; }
    .muted { color: #6b7280; font-size: 13px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    button { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 9px 12px; cursor: pointer; font-size: 13px; }
    button:hover { background: #1d4ed8; }
    button.secondary { background: #4b5563; }
    button.danger { background: #dc2626; }
    button.success { background: #16a34a; }
    input, select, textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 9px; font-size: 13px; background: white; }
    label { display: block; font-size: 12px; font-weight: bold; color: #374151; margin-bottom: 5px; }
    .form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 9px; text-align: left; vertical-align: top; }
    th { background: #f9fafb; color: #374151; position: sticky; top: 0; z-index: 1; }
    .table-wrap { max-height: 520px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 10px; }
    .badge { display: inline-block; border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: bold; background: #e5e7eb; color: #374151; white-space: nowrap; }
    .badge-ok { background: #dcfce7; color: #166534; }
    .badge-warn { background: #fef3c7; color: #92400e; }
    .badge-bad { background: #fee2e2; color: #991b1b; }
    pre { background: #111827; color: #e5e7eb; padding: 14px; border-radius: 10px; overflow: auto; max-height: 450px; font-size: 12px; line-height: 1.5; }
    .request-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .request-actions button { padding: 6px 8px; font-size: 12px; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .tab { background: white; color: #111827; border: 1px solid #d1d5db; }
    .tab.active { background: #111827; color: white; }
    .section { display: none; }
    .section.active { display: block; }
    .notice { padding: 10px 12px; border-radius: 10px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; margin-bottom: 16px; font-size: 13px; }
    .error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    @media (max-width: 1000px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid-2 { grid-template-columns: 1fr; } .form-grid { grid-template-columns: 1fr; } }
    @media (max-width: 640px) { main { padding: 12px; } .grid { grid-template-columns: 1fr; } header { padding: 14px; } }
  </style>
</head>
<body>
<header>
  <div>
    <h1>${escapeHtml(title)}</h1>
    <small>Mock TIRA control panel</small>
  </div>
  <div class="toolbar">
    <button onclick="refreshAll()">Refresh</button>
    <button class="secondary" onclick="openApi('/tiramis/mock/health')">Health</button>
    <button class="secondary" onclick="openApi('/tiramis/mock/endpoints')">Endpoints API</button>
  </div>
</header>
<main>
  <div id="notice" class="notice">Loading dashboard...</div>
  <div class="grid">
    <div class="card"><h2>Total Requests</h2><div class="metric" id="metricTotal">0</div><div class="muted">All tracked requests</div></div>
    <div class="card"><h2>Duplicates</h2><div class="metric" id="metricDuplicates">0</div><div class="muted">Duplicate request records</div></div>
    <div class="card"><h2>Callbacks</h2><div class="metric" id="metricCallbacks">0</div><div class="muted">Callback attempts</div></div>
    <div class="card"><h2>Storage</h2><div class="metric" id="metricStorage">OFF</div><div class="muted" id="storagePath">-</div></div>
  </div>
  <div class="tabs">
    <button class="tab active" onclick="showSection('requests', this)">Requests</button>
    <button class="tab" onclick="showSection('controls', this)">Controls</button>
    <button class="tab" onclick="showSection('load', this)">Load Test</button>
    <button class="tab" onclick="showSection('configs', this)">Configs</button>
    <button class="tab" onclick="showSection('debug', this)">Debug</button>
  </div>
  <section id="section-requests" class="section active">
    <div class="card">
      <div class="toolbar">
        <button onclick="loadRequests()">Reload Requests</button>
        <button class="secondary" onclick="downloadExport(false)">Export Without XML</button>
        <button class="secondary" onclick="downloadExport(true)">Export With XML</button>
        <button class="success" onclick="saveStorage()">Save Storage</button>
        <button class="secondary" onclick="backupStorage()">Backup</button>
        <button class="danger" onclick="clearRequests()">Clear Requests</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th><th>RequestId</th><th>Service</th><th>Root</th><th>Status</th><th>Scenario</th><th>ACK</th><th>Final</th><th>Callback Attempts</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="requestsBody"></tbody>
        </table>
      </div>
    </div>
  </section>
  <section id="section-controls" class="section">
    <div class="grid-2">
      <div class="card">
        <h2>Queue Next Scenario</h2>
        <div class="form-grid">
          <div><label>Scenario</label><select id="queueScenario"></select></div>
          <div><label>Request Root</label><input id="queueRoot" placeholder="PolicyReq" /></div>
          <div><label>Times</label><input id="queueTimes" type="number" value="1" min="1" max="100" /></div>
        </div>
        <button onclick="queueNextScenario()">Queue Scenario</button>
        <pre id="queueResult">{}</pre>
      </div>
      <div class="card">
        <h2>Manual Request Actions</h2>
        <div class="form-grid">
          <div><label>RequestId</label><input id="manualRequestId" placeholder="REQ-001" /></div>
          <div><label>Action</label>
            <select id="manualAction"><option value="replay">Replay Callback</option><option value="success">Send Final Success</option><option value="failure">Send Final Failure</option></select>
          </div>
          <div><label>&nbsp;</label><button onclick="runManualAction()">Run</button></div>
        </div>
        <pre id="manualResult">{}</pre>
      </div>
    </div>
  </section>
  <section id="section-load" class="section">
    <div class="grid-2">
      <div class="card">
        <h2>Run Load Test</h2>
        <div class="form-grid">
          <div><label>Service Type</label><select id="loadServiceType"></select></div>
          <div><label>Count</label><input id="loadCount" type="number" value="10" min="1" /></div>
          <div><label>Concurrency</label><input id="loadConcurrency" type="number" value="2" min="1" /></div>
          <div><label>Scenario</label><select id="loadScenario"></select></div>
          <div><label>Signed</label><select id="loadSigned"><option value="false">false</option><option value="true">true</option></select></div>
          <div><label>Callback URL</label><input id="loadCallbackUrl" value="http://localhost:${CONFIG.port}/tiramis/mock/callback-receiver" /></div>
        </div>
        <button onclick="runLoadTest()">Run Load Test</button>
        <button class="secondary" onclick="generateSampleXml()">Generate Sample XML</button>
      </div>
      <div class="card"><h2>Load Test Result</h2><pre id="loadResult">{}</pre></div>
    </div>
    <div class="card"><h2>Sample XML</h2><pre id="sampleXml">Generate sample XML...</pre></div>
  </section>
  <section id="section-configs" class="section">
    <div class="grid-2">
      <div class="card"><h2>Statistics</h2><pre id="statsJson">{}</pre></div>
      <div class="card"><h2>Scenarios</h2><pre id="scenariosJson">{}</pre></div>
      <div class="card"><h2>Storage</h2><pre id="storageJson">{}</pre></div>
      <div class="card"><h2>Chaos</h2><pre id="chaosJson">{}</pre></div>
      <div class="card"><h2>Duplicates</h2><pre id="duplicatesJson">{}</pre></div>
      <div class="card"><h2>Service Types</h2><pre id="serviceTypesJson">{}</pre></div>
      <div class="card"><h2>Response Config</h2><pre id="responseConfigJson">{}</pre></div>
      <div class="card"><h2>Endpoints</h2><pre id="endpointsJson">{}</pre></div>
    </div>
  </section>
  <section id="section-debug" class="section">
    <div class="grid-2">
      <div class="card">
        <h2>Inspect Request XML</h2>
        <textarea id="debugXml" rows="12" placeholder="<PolicyReq>...</PolicyReq>"></textarea>
        <br /><br />
        <button onclick="debugXml()">Debug XML</button>
      </div>
      <div class="card"><h2>Debug Result</h2><pre id="debugResult">{}</pre></div>
    </div>
    <div class="card"><h2>Selected Request Details</h2><pre id="requestDetails">Click View on a request...</pre></div>
  </section>
</main>
<script>
  const state = { scenarios: [], serviceTypes: [] };

  function showNotice(message, isError = false) {
    const el = document.getElementById('notice');
    el.textContent = message;
    el.className = isError ? 'notice error' : 'notice';
  }

  async function apiJson(path, options = {}) {
    const response = await fetch(path, options);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || JSON.stringify(data));
      return data;
    }

    const text = await response.text();
    if (!response.ok) throw new Error(text);
    return text;
  }

  function pretty(value) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  }

  function setJson(id, value) {
    document.getElementById(id).textContent = pretty(value);
  }

  function badge(value) {
    const text = String(value || '-');
    let cls = 'badge';
    if (text.includes('ACCEPTED') || text.includes('SENT') || text.includes('TIRA001') || text === 'success') {
      cls += ' badge-ok';
    } else if (text.includes('FAILED') || text.includes('ERROR') || text.includes('DUPLICATE') || text.includes('TIRA002') || text.includes('TIRA005') || text.includes('TIRA007') || text.includes('TIRA016')) {
      cls += ' badge-bad';
    } else if (text.includes('PENDING') || text.includes('SCHEDULED') || text.includes('RETRY')) {
      cls += ' badge-warn';
    }
    return '<span class="' + cls + '">' + escapeHtml(text) + '</span>';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeJs(value) {
    return String(value || '').replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  }

  function showSection(name, button) {
    document.querySelectorAll('.section').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));
    document.getElementById('section-' + name).classList.add('active');
    button.classList.add('active');
  }

  async function refreshAll() {
    try {
      showNotice('Refreshing dashboard...');
      const [stats, storage, chaos, duplicates, scenarios, serviceTypes, responseConfig, endpoints] = await Promise.all([
        apiJson('/tiramis/mock/statistics'),
        apiJson('/tiramis/mock/storage'),
        apiJson('/tiramis/mock/chaos/config'),
        apiJson('/tiramis/mock/duplicates/config'),
        apiJson('/tiramis/mock/scenarios'),
        apiJson('/tiramis/mock/load/service-types'),
        apiJson('/tiramis/mock/response-config'),
        apiJson('/tiramis/mock/endpoints'),
      ]);

      setJson('statsJson', stats);
      setJson('storageJson', storage);
      setJson('chaosJson', chaos);
      setJson('duplicatesJson', duplicates);
      setJson('scenariosJson', scenarios);
      setJson('serviceTypesJson', serviceTypes);
      setJson('responseConfigJson', responseConfig);
      setJson('endpointsJson', endpoints);

      const statistics = stats.statistics || {};
      document.getElementById('metricTotal').textContent = statistics.total || 0;
      document.getElementById('metricDuplicates').textContent = statistics.duplicates || 0;
      document.getElementById('metricCallbacks').textContent = statistics.callbackAttempts || 0;

      const storageInfo = storage.storage || {};
      document.getElementById('metricStorage').textContent = storageInfo.persistenceEnabled ? 'ON' : 'OFF';
      document.getElementById('storagePath').textContent = storageInfo.storagePath || '-';

      state.scenarios = scenarios.supportedScenarios || [];
      state.serviceTypes = serviceTypes.serviceTypes || [];
      fillSelect('queueScenario', state.scenarios);
      fillSelect('loadScenario', state.scenarios);
      fillSelect('loadServiceType', state.serviceTypes.map((item) => item.serviceType));

      await loadRequests();
      showNotice('Dashboard refreshed.');
    } catch (error) {
      showNotice(error.message || String(error), true);
    }
  }

  function fillSelect(id, values) {
    const el = document.getElementById(id);
    const current = el.value;
    el.innerHTML = values.map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>').join('');
    if (current) el.value = current;
  }

  async function loadRequests() {
    const data = await apiJson('/tiramis/mock/requests?includeXml=false&limit=100');
    const body = document.getElementById('requestsBody');
    body.innerHTML = (data.items || []).map((item) => {
      const callbackAttempts = item.callbackAttempts ? item.callbackAttempts.length : 0;
      return '<tr>' +
        '<td>' + escapeHtml(item.createdAt || '-') + '</td>' +
        '<td><strong>' + escapeHtml(item.requestId || '-') + '</strong></td>' +
        '<td>' + escapeHtml(item.serviceType || '-') + '</td>' +
        '<td>' + escapeHtml(item.root || '-') + '</td>' +
        '<td>' + badge(item.status) + '</td>' +
        '<td>' + escapeHtml(item.scenario || '-') + '</td>' +
        '<td>' + badge(item.ackCode || '-') + '</td>' +
        '<td>' + badge(item.finalCode || '-') + '</td>' +
        '<td>' + callbackAttempts + '</td>' +
        '<td><div class="request-actions">' +
          '<button onclick="viewRequest(\\'' + escapeJs(item.requestId) + '\\')">View</button>' +
          '<button class="secondary" onclick="setManualRequest(\\'' + escapeJs(item.requestId) + '\\')">Use</button>' +
          '<button class="success" onclick="manualActionFor(\\'' + escapeJs(item.requestId) + '\\', \\'replay\\')">Replay</button>' +
          '<button class="danger" onclick="manualActionFor(\\'' + escapeJs(item.requestId) + '\\', \\'failure\\')">Fail</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  async function viewRequest(requestId) {
    try {
      const data = await apiJson('/tiramis/mock/requests/' + encodeURIComponent(requestId) + '?includeXml=true');
      setJson('requestDetails', data);
      showNotice('Loaded request ' + requestId);
    } catch (error) {
      showNotice(error.message || String(error), true);
    }
  }

  function setManualRequest(requestId) {
    document.getElementById('manualRequestId').value = requestId;
    showNotice('Selected request ' + requestId);
  }

  async function manualActionFor(requestId, action) {
    document.getElementById('manualRequestId').value = requestId;
    document.getElementById('manualAction').value = action;
    await runManualAction();
  }

  async function runManualAction() {
    try {
      const requestId = document.getElementById('manualRequestId').value.trim();
      const action = document.getElementById('manualAction').value;
      if (!requestId) throw new Error('RequestId is required');
      let path = '';
      if (action === 'replay') path = '/tiramis/mock/requests/' + encodeURIComponent(requestId) + '/callback/replay';
      else if (action === 'success') path = '/tiramis/mock/requests/' + encodeURIComponent(requestId) + '/mark-success';
      else if (action === 'failure') path = '/tiramis/mock/requests/' + encodeURIComponent(requestId) + '/final-failure';
      const data = await apiJson(path, { method: 'POST' });
      setJson('manualResult', data);
      await loadRequests();
      showNotice('Manual action completed.');
    } catch (error) {
      showNotice(error.message || String(error), true);
    }
  }

  async function queueNextScenario() {
    try {
      const body = {
        scenario: document.getElementById('queueScenario').value,
        requestRoot: document.getElementById('queueRoot').value || null,
        times: Number(document.getElementById('queueTimes').value || 1),
      };
      const data = await apiJson('/tiramis/mock/scenarios/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setJson('queueResult', data);
      await refreshAll();
      showNotice('Scenario queued.');
    } catch (error) {
      showNotice(error.message || String(error), true);
    }
  }

  async function runLoadTest() {
    try {
      const body = {
        serviceType: document.getElementById('loadServiceType').value,
        count: Number(document.getElementById('loadCount').value || 10),
        concurrency: Number(document.getElementById('loadConcurrency').value || 2),
        scenario: document.getElementById('loadScenario').value,
        signed: document.getElementById('loadSigned').value === 'true',
        callbackUrl: document.getElementById('loadCallbackUrl').value,
      };
      setJson('loadResult', { running: true, body });
      const data = await apiJson('/tiramis/mock/load/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setJson('loadResult', data);
      await refreshAll();
      showNotice('Load test completed.');
    } catch (error) {
      showNotice(error.message || String(error), true);
      setJson('loadResult', { success: false, message: error.message || String(error) });
    }
  }

  async function generateSampleXml() {
    try {
      const serviceType = document.getElementById('loadServiceType').value || 'POLICY';
      const callbackUrl = encodeURIComponent(document.getElementById('loadCallbackUrl').value || '');
      const response = await fetch('/tiramis/mock/load/sample-xml?serviceType=' + encodeURIComponent(serviceType) + '&requestId=REQ-SAMPLE-001&callbackUrl=' + callbackUrl);
      const xml = await response.text();
      if (!response.ok) throw new Error(xml);
      document.getElementById('sampleXml').textContent = xml;
      showNotice('Sample XML generated.');
    } catch (error) {
      showNotice(error.message || String(error), true);
    }
  }

  async function debugXml() {
    try {
      const xml = document.getElementById('debugXml').value;
      const data = await apiJson('/tiramis/mock/debug/xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
      });
      setJson('debugResult', data);
      showNotice('XML debug completed.');
    } catch (error) {
      showNotice(error.message || String(error), true);
    }
  }

  async function clearRequests() {
    if (!confirm('Clear all mock request records? A backup will be created.')) return;
    const data = await apiJson('/tiramis/mock/requests?backup=true', { method: 'DELETE' });
    showNotice('Deleted ' + data.deleted + ' request records.');
    await refreshAll();
  }

  async function saveStorage() {
    const data = await apiJson('/tiramis/mock/storage/save', { method: 'POST' });
    showNotice('Storage saved.');
    setJson('storageJson', data);
  }

  async function backupStorage() {
    const data = await apiJson('/tiramis/mock/storage/backup', { method: 'POST' });
    showNotice('Backup created.');
    setJson('storageJson', data);
  }

  function downloadExport(includeXml) {
    window.open('/tiramis/mock/storage/export?includeXml=' + includeXml, '_blank');
  }

  function openApi(path) {
    window.open(path, '_blank');
  }

  refreshAll();
</script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  registerDashboardRoutes,
};
