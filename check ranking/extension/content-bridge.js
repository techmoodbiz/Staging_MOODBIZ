// Content script chạy trên localhost:5000 và rank.moodbiz.vn
// Cầu nối giữa Dashboard page và Extension background

// Đợi 200ms để page scripts đăng ký listener trước
setTimeout(() => {
  window.dispatchEvent(new CustomEvent('rank-checker-ready', {
    detail: { version: '1.3.0' }
  }));
}, 200);

// Nhận status update từ background → forward sang page dưới dạng CustomEvent
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') {
    window.dispatchEvent(new CustomEvent('rank-checker-status', {
      detail: { currentKeyword: msg.currentKeyword || '' }
    }));
  }
  // Không return true — không cần async response
});

// Nhận lệnh từ Dashboard → chuyển cho background (có retry)
window.addEventListener('rank-checker-trigger', async (e) => {
  const { jobId, token } = e.detail || {};

  let lastError = '';
  let lastResponse = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // sendMessage wakes up service worker nếu đang ngủ
      const response = await chrome.runtime.sendMessage({
        type: 'START_CHECKING',
        jobId,
        token, // gửi kèm JWT từ event detail
      });

      if (response?.ok) {
        window.dispatchEvent(new CustomEvent('rank-checker-ack', {
          detail: { ok: true }
        }));
        return;
      }

      lastResponse = response;
      lastError = response?.message || 'No response';

      // Lỗi cứng (ví dụ: chưa bật incognito) → không retry, báo ngay
      if (response?.error === 'no_incognito') break;

    } catch(err) {
      lastError = err.message;
      // Chờ trước khi retry (service worker cần thời gian khởi động)
      if (attempt < 3) await new Promise(r => setTimeout(r, 600));
    }
  }

  // Tất cả attempts thất bại
  window.dispatchEvent(new CustomEvent('rank-checker-ack', {
    detail: { ok: false, message: lastError, error: lastResponse?.error }
  }));
});
