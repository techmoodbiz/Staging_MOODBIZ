// Content script chạy trên localhost:5173 và staging.moodbiz.vn
// Cầu nối giữa Dashboard page và Extension background

// ─── Guard: kiểm tra extension còn context không ─────────────────────────────
// Khi extension bị reload/update, content script cũ bị "orphan":
// chrome.runtime.id trở thành undefined → mọi chrome.* call sẽ throw.
function isExtensionAlive() {
  try { return !!chrome.runtime?.id; } catch(e) { return false; }
}

// ─── Ping / Ready ─────────────────────────────────────────────────────────────
const notifyReady = () => {
  if (!isExtensionAlive()) return;
  window.dispatchEvent(new CustomEvent('rank-checker-ready', {
    detail: { version: '2.0.0' }
  }));
};

setTimeout(notifyReady, 200);
window.addEventListener('rank-checker-ping', notifyReady);

// ─── Status từ background → forward sang page ────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') {
    window.dispatchEvent(new CustomEvent('rank-checker-status', {
      detail: {
        currentKeyword: msg.currentKeyword || '',
        captchaDetected: msg.captchaDetected || false,
      }
    }));
  }
  if (msg.type === 'RESULT_READY') {
    window.dispatchEvent(new CustomEvent('rank-checker-result-ready'));
  }
});

// ─── Đồng bộ brand/project → lưu storage để popup đọc ngay ──────────────────
window.addEventListener('rank-checker-context', (e) => {
  if (!isExtensionAlive()) return;
  const { brandId, brandName, projectId, projectName, domain } = e.detail || {};
  try {
    chrome.storage.local.set({
      job_context: {
        brandId:     brandId     || null,
        brandName:   brandName   || '',
        projectId:   projectId   || null,
        projectName: projectName || '',
        domain:      domain      || '',
        savedAt:     Date.now(),
      }
    });
  } catch(e) { /* context đã chết, bỏ qua */ }
});

// ─── Nhận lệnh check từ Dashboard → chuyển cho background ────────────────────
window.addEventListener('rank-checker-trigger', async (e) => {
  // Kiểm tra ngay đầu — nếu context chết thì báo lỗi rõ ràng
  if (!isExtensionAlive()) {
    window.dispatchEvent(new CustomEvent('rank-checker-ack', {
      detail: {
        ok: false,
        message: 'Extension bị reload. Hãy reload lại trang để tiếp tục.',
        error: 'context_invalidated',
      }
    }));
    return;
  }

  const { jobId, token: triggerToken, brandName, projectName, domain } = e.detail || {};

  // Ưu tiên token truyền từ event, fallback về localStorage
  let token = triggerToken;
  if (!token) {
    try { token = localStorage.getItem('moodbiz_token'); } catch(err) {}
  }

  // Lưu context vào storage để popup đọc được (kể cả khi popup mở sau)
  try {
    chrome.storage.local.set({
      job_context: {
        brandName:   brandName   || '',
        projectName: projectName || '',
        domain:      domain      || '',
        jobId:       jobId       || null,
        savedAt:     Date.now(),
      }
    });
  } catch(e) { /* context chết, bỏ qua storage */ }

  let lastError = '';
  let lastResponse = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Kiểm tra lại mỗi lần retry — tránh vòng lặp vô ích nếu context đã chết
    if (!isExtensionAlive()) {
      lastError = 'Extension context invalidated';
      break;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_CHECKING',
        jobId,
        token,
        brandName:   brandName   || '',
        projectName: projectName || '',
        domain:      domain      || '',
      });

      if (response?.ok) {
        window.dispatchEvent(new CustomEvent('rank-checker-ack', {
          detail: { ok: true }
        }));
        return;
      }

      lastResponse = response;
      lastError = response?.message || 'No response';
      if (response?.error === 'no_incognito') break;

    } catch(err) {
      lastError = err.message;
      // "Extension context invalidated" → không có ích gì khi retry
      if (err.message?.includes('context invalidated') || err.message?.includes('context invalid')) break;
      if (attempt < 3) await new Promise(r => setTimeout(r, 600));
    }
  }

  window.dispatchEvent(new CustomEvent('rank-checker-ack', {
    detail: { ok: false, message: lastError, error: lastResponse?.error }
  }));
});
