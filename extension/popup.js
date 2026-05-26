// Popup chỉ hiển thị trạng thái - việc xử lý do background.js đảm nhiệm
// SERVER_URL được load từ config.js (script tag trong popup.html)

let pollTimer = null;
let foundCount = 0;

let popupAuthToken = null;
// Context brand/project được lưu bởi content-bridge khi user chọn brand/project
let jobContext = { brandId: null, brandName: '', projectId: null, projectName: '', domain: '' };

// Đọc storage dưới dạng Promise — phải xong trước khi refreshStatus chạy
function loadStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get(['auth_token', 'job_context'], (r) => {
      popupAuthToken = r.auth_token || null;
      if (r.job_context) jobContext = r.job_context;
      resolve();
    });
  });
}

function popupHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (popupAuthToken) h['Authorization'] = `Bearer ${popupAuthToken}`;
  return h;
}

const $ = (id) => document.getElementById(id);

// ─── Server health ────────────────────────────────────────
async function checkServer() {
  try {
    const res = await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      $('server-dot').className = 'dot online';
      $('server-text').textContent = 'Server OK';
      return true;
    }
  } catch(e) {}
  $('server-dot').className = 'dot offline';
  $('server-text').textContent = 'Offline';
  return false;
}

async function retryServer() {
  $('server-text').textContent = 'Kết nối...';
  await checkServer();
  await refreshStatus();
}

// ─── Show sections ────────────────────────────────────────
function showSection(name) {
  ['empty-state','job-ready','checking-state'].forEach(s => {
    $(s).style.display = 'none';
  });
  if (name) $(name).style.display = '';
}

function setStatus(icon, text, cls) {
  $('status-icon').textContent = icon;
  $('status-text').textContent = text;
  $('status-text').className = 'status-text ' + cls;
}

function updateProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  $('progress-count').textContent = `${done} / ${total}`;
  $('progress-fill').style.width = pct + '%';
  $('progress-label').textContent = `Tiến trình (${pct}%)`;
  $('stat-checked').textContent = done;
  $('stat-found').textContent = foundCount;
  $('stat-notfound').textContent = done - foundCount;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function addLogEntry(keyword, position) {
  const list = $('log-list');
  if (list.querySelector('[style*="text-align"]')) list.innerHTML = '';

  const item = document.createElement('div');
  item.className = 'log-item';
  let posClass, posText;
  if (position == null) { posClass = 'pos-none'; posText = '—'; }
  else if (position <= 3)  { posClass = 'pos-top3';  posText = `#${position}`; }
  else if (position <= 10) { posClass = 'pos-top10'; posText = `#${position}`; }
  else if (position <= 30) { posClass = 'pos-top30'; posText = `#${position}`; }
  else                     { posClass = 'pos-other'; posText = `#${position}`; }

  item.innerHTML = `
    <span class="log-kw" title="${escapeHtml(keyword)}">${escapeHtml(keyword)}</span>
    <span class="log-pos ${posClass}">${posText}</span>
  `;
  list.insertBefore(item, list.firstChild);
  while (list.children.length > 20) list.removeChild(list.lastChild);
}

// ─── Refresh status từ server ─────────────────────────────
async function refreshStatus() {
  try {
    const res = await fetch(`${SERVER_URL}/api/rank-checker?action=get-job-status`, { headers: popupHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    // Kiểm tra background có đang chạy không
    let bgProcessing = false;
    try {
      const bgRes = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      bgProcessing = bgRes?.isProcessing || false;
    } catch(e) {}

    if (bgProcessing) {
      showSection('checking-state');
      setStatus('🔍', 'Background đang kiểm tra...', 'active');
      $('start-btn').disabled = true;
      $('start-btn').textContent = '⏳ Đang chạy...';
      $('stop-btn').disabled = false;
      $('stop-btn').textContent = '■ Dừng';
      applyContextToCheckingState();
      startPollingStatus();
    } else if (data.pendingJobs > 0) {
      // Lọc job khớp với brand/project đang chọn trên dashboard
      // Ưu tiên match projectId (chính xác nhất), fallback về brandId
      const matchJob = (() => {
        if (jobContext.projectId)
          return data.jobs.find(j => j.projectId === jobContext.projectId);
        if (jobContext.brandId)
          return data.jobs.find(j => j.brandId === jobContext.brandId);
        return data.jobs[0];
      })();

      if (!matchJob) {
        // Có job nhưng thuộc brand khác → không hiện cho brand này
        showSection('empty-state');
        $('start-btn').disabled = false;
        $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
        $('stop-btn').disabled = true;
      } else {
        showSection('job-ready');
        $('job-brand').textContent   = jobContext.brandName   || '—';
        $('job-project').textContent = jobContext.projectName || '—';
        $('job-domain').textContent  = matchJob.domain || jobContext.domain || '—';
        $('job-meta').textContent = `${matchJob.total} từ khóa • ${matchJob.pending} chưa kiểm tra`;
        $('start-btn').disabled = false;
        $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
        $('stop-btn').disabled = false;
        $('stop-btn').textContent = '✕ Hủy';
      }
    } else {
      showSection('empty-state');
      $('start-btn').disabled = false;
      $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
      $('stop-btn').disabled = true;
    }
  } catch(e) {
    showSection('empty-state');
  }
}

// ─── Điền context brand/project vào ctx-bar (checking-state) ────────────────
function applyContextToCheckingState(s = null) {
  // Ưu tiên dữ liệu live từ progressState, fallback về storage
  const bn = s?.brandName   || jobContext.brandName   || '—';
  const pn = s?.projectName || jobContext.projectName || '—';
  const dm = s?.currentDomain || jobContext.domain     || '';
  $('ctx-brand').textContent   = bn;
  $('ctx-project').textContent = pn;
  $('ctx-domain').textContent  = dm;
}

// ─── Poll trạng thái background mỗi 1.5s để update UI ────
function startPollingStatus() {
  if (pollTimer) return;

  pollTimer = setInterval(async () => {
    try {
      const s = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (!s) return;

      // Cập nhật context bar (brand › project · domain)
      applyContextToCheckingState(s);

      // Cập nhật tiến trình
      if (s.total > 0 || s.checked > 0) {
        foundCount = s.found || 0;
        updateProgress(s.checked || 0, s.total || 0);
      }

      // Cập nhật keyword đang xử lý
      if (s.currentKeyword) {
        $('current-kw').textContent = `"${s.currentKeyword}"`;
      }

      // Đồng bộ log kết quả gần đây từ background
      if (s.recentResults?.length) {
        const list = $('log-list');
        list.innerHTML = '';
        s.recentResults.forEach(r => addLogEntry(r.keyword, r.position));
      }

      if (!s.isProcessing) {
        // Background hoàn tất
        clearInterval(pollTimer);
        pollTimer = null;
        setStatus('✅', `Hoàn thành! ${s.checked || 0} từ khóa, tìm thấy ${s.found || 0}`, 'done');
        $('current-kw').textContent = '—';
        $('start-btn').disabled = false;
        $('start-btn').textContent = '▶ Kiểm tra tiếp';
        $('stop-btn').disabled = true;
      } else if (s.checked > 0) {
        setStatus('🔍', `Đang kiểm tra: ${s.checked}/${s.total || '?'}`, 'active');
      }
    } catch(e) {}
  }, 1500);
}

// ─── Button handlers ──────────────────────────────────────

let isStarting = false;

async function handleStart() {
  if (isStarting) return;
  isStarting = true;
  $('start-btn').disabled = true;
  $('start-btn').textContent = '⏳ Đang kiểm tra...';

  function resetBtn() {
    isStarting = false;
    $('start-btn').disabled = false;
    $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
  }

  const ok = await checkServer();
  if (!ok) { resetBtn(); alert('Server offline!'); return; }

  const res = await fetch(`${SERVER_URL}/api/rank-checker?action=get-job-status`, { headers: popupHeaders() }).catch(() => null);
  if (!res?.ok) { resetBtn(); alert('Không kết nối queue!'); return; }
  const data = await res.json();
  if (data.pendingJobs === 0) {
    resetBtn();
    alert('Không có job nào.\nHãy vào Dashboard nhấn "Check Google (Extension)"');
    return;
  }

  // Kiểm tra background đã đang chạy chưa (tránh gửi lệnh 2 lần)
  try {
    const bgStatus = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (bgStatus?.isProcessing) {
      isStarting = false;
      showSection('checking-state');
      setStatus('🔍', 'Background đang kiểm tra...', 'active');
      $('start-btn').disabled = true;
      $('start-btn').textContent = '⏳ Đang chạy...';
      $('stop-btn').disabled = false;
      startPollingStatus();
      return;
    }
  } catch(e) {}

  // Chuẩn bị UI
  isStarting = false;
  showSection('checking-state');
  $('start-btn').disabled = true;
  $('start-btn').textContent = '⏳ Đang khởi động...';
  $('stop-btn').disabled = true;
  $('log-list').innerHTML = '<div style="text-align:center;padding:8px 0;color:#475569;font-size:11px;">Đang khởi động...</div>';
  setStatus('🚀', 'Đang khởi động incognito...', 'active');

  try {
    // Uỷ quyền hoàn toàn cho background.js — dùng incognito tab persistent
    const bgRes = await chrome.runtime.sendMessage({
      type: 'START_CHECKING',
      token: popupAuthToken,
    });

    if (bgRes?.error === 'no_incognito') {
      setStatus('❌', 'Cần bật "Allow in Incognito" cho Extension!', 'error');
      $('start-btn').disabled = false;
      $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
      return;
    }

    if (bgRes?.ok) {
      // Background đã bắt đầu → bắt đầu poll
      $('stop-btn').disabled = false;
      setStatus('🔍', 'Đang kiểm tra (incognito)...', 'active');
      startPollingStatus();
    } else {
      setStatus('❌', bgRes?.message || 'Không khởi động được', 'error');
      $('start-btn').disabled = false;
      $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
    }
  } catch(err) {
    setStatus('❌', 'Lỗi: ' + err.message, 'error');
    $('start-btn').disabled = false;
    $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
  }
}

async function handleStop() {
  $('stop-btn').disabled = true;
  $('stop-btn').textContent = '⏳';

  // Gửi STOP signal cho background để thoát processing loop
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_CHECKING' });
  } catch(e) {}

  // Hủy job pending trên server
  try {
    await fetch(`${SERVER_URL}/api/rank-checker?action=cancel-job`, {
      method: 'POST', headers: popupHeaders(),
    });
  } catch(e) {}

  // Dừng polling
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  showSection('empty-state');
  $('start-btn').disabled = false;
  $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
  $('stop-btn').disabled = true;
  $('stop-btn').textContent = '■ Dừng';
}

// ─── Init ─────────────────────────────────────────────────
async function init() {
  showSection('empty-state');
  $('start-btn').disabled = true;
  $('stop-btn').disabled = true;
  // Phải load storage trước — jobContext cần có brandId để lọc job đúng
  await loadStorage();
  const ok = await checkServer();
  if (ok) await refreshStatus();
  else { showSection('empty-state'); $('start-btn').disabled = false; }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  // Wire up button events (CSP-compliant: no inline onclick allowed in MV3)
  document.getElementById('start-btn')?.addEventListener('click', handleStart);
  document.getElementById('stop-btn')?.addEventListener('click', handleStop);
  document.getElementById('server-badge')?.addEventListener('click', retryServer);
});
