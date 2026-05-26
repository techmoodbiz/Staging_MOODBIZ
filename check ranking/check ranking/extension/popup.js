// Popup chỉ hiển thị trạng thái - việc xử lý do background.js đảm nhiệm
// SERVER_URL được load từ config.js (script tag trong popup.html)

let pollTimer = null;
let foundCount = 0;

let popupAuthToken = null;
// Đọc token đã lưu từ chrome.storage.local khi popup mở
chrome.storage.local.get(['auth_token'], (r) => { popupAuthToken = r.auth_token || null; });

function popupHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (popupAuthToken) h['Authorization'] = `Bearer ${popupAuthToken}`;
  return h;
}

const $ = (id) => document.getElementById(id);

// ─── Server health ────────────────────────────────────────
async function checkServer() {
  try {
    const res = await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(3000), headers: popupHeaders() });
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
    const res = await fetch(`${SERVER_URL}/api/check-queue/status`, { headers: popupHeaders() });
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
      startPollingStatus();
    } else if (data.pendingJobs > 0) {
      const job = data.jobs[0];
      showSection('job-ready');
      $('job-domain').textContent = job.domain;
      $('job-meta').textContent = `${job.total} từ khóa • ${job.pending} chưa kiểm tra`;
      $('start-btn').disabled = false;
      $('start-btn').textContent = '▶ Bắt đầu kiểm tra';
      $('stop-btn').disabled = true;
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

// ─── Poll trạng thái background mỗi 1.5s để update UI ────
function startPollingStatus() {
  if (pollTimer) return;

  pollTimer = setInterval(async () => {
    try {
      const s = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (!s) return;

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

  const res = await fetch(`${SERVER_URL}/api/check-queue/status`, { headers: popupHeaders() }).catch(() => null);
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
  // Background không có cơ chế dừng giữa chừng hiện tại.
  // Chỉ dọn dẹp UI và để background tự hoàn thành keyword đang xử lý rồi dừng queue.
  $('stop-btn').disabled = true;
  setStatus('⏹️', 'Đang dừng sau keyword hiện tại...', 'idle');

  // Xóa tất cả job pending trên server để background không lấy keyword tiếp
  try {
    const res = await fetch(`${SERVER_URL}/api/check-queue/status`, { headers: popupHeaders() });
    if (res.ok) {
      const data = await res.json();
      for (const job of data.jobs) {
        await fetch(`${SERVER_URL}/api/check-queue/${job.jobId}`, {
          method: 'DELETE', headers: popupHeaders(),
        }).catch(() => {});
      }
    }
  } catch(e) {}
}

// ─── Init ─────────────────────────────────────────────────
async function init() {
  showSection('empty-state');
  $('start-btn').disabled = true;
  $('stop-btn').disabled = true;
  const ok = await checkServer();
  if (ok) await refreshStatus();
  else { showSection('empty-state'); $('start-btn').disabled = false; }
}

document.addEventListener('DOMContentLoaded', init);
