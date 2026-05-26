// ─── Rank Checker - Background Service Worker ─────────────────────────────────
// Google mới: KHÔNG dùng &num=100 (bị ignore)
// Thay bằng paginate: start=0 (pos 1-10), start=10 (11-20), ..., start=90 (91-100)

// SERVER_URL được load từ config.js (importScripts bên dưới)
importScripts('config.js');

let isProcessing = false;
let incognitoWindowId = null;
let incognitoTabId    = null; // tab persistent trong cửa sổ ẩn danh — reuse thay vì tạo mới
let authToken = null; // JWT token từ dashboard

// ─── Trạng thái tiến trình (để popup cập nhật UI) ────────────────────────────
let progressState = {
  checked: 0,
  found: 0,
  total: 0,
  currentKeyword: '',
  currentDomain: '',
  recentResults: [], // [{keyword, position}] tối đa 20
};

// Đọc token đã lưu khi service worker khởi động lại
chrome.storage.local.get(['auth_token'], (r) => { authToken = r.auth_token || null; });

// Helper: tạo headers với auth token
function apiHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

// ─── Incognito window management ──────────────────────────────────────────────
// Chiến lược: tạo 1 cửa sổ + 1 tab ẩn danh, reuse suốt quá trình check
// → tránh chrome.tabs.create() gây window focus lên màn hình
async function getIncognitoWindow() {
  if (incognitoWindowId !== null) {
    try {
      const existing = await chrome.windows.get(incognitoWindowId);
      if (existing.incognito) {
        // Xác nhận tab vẫn còn sống
        if (incognitoTabId) {
          try { await chrome.tabs.get(incognitoTabId); return incognitoWindowId; }
          catch(e) { incognitoTabId = null; }
        }
        // Tab bị đóng nhưng window còn → tạo lại tab blank
        const t = await chrome.tabs.create({ url: 'about:blank', windowId: incognitoWindowId, active: false });
        incognitoTabId = t.id;
        return incognitoWindowId;
      }
      await chrome.windows.remove(incognitoWindowId).catch(() => {});
    } catch(e) {}
    incognitoWindowId = null;
    incognitoTabId    = null;
  }
  try {
    const win = await chrome.windows.create({
      url: 'about:blank', incognito: true, state: 'minimized', focused: false,
    });
    if (!win.incognito) {
      await chrome.windows.remove(win.id).catch(() => {});
      console.error('❌ Chrome trả về cửa sổ THƯỜNG thay vì incognito!');
      return null;
    }
    incognitoWindowId = win.id;
    incognitoTabId    = win.tabs?.[0]?.id || null;
    console.log('🕵️ Incognito window:', incognitoWindowId, '| tab:', incognitoTabId);
    return incognitoWindowId;
  } catch(e) {
    console.warn('⚠️ Cannot create incognito window:', e.message);
    return null;
  }
}

async function closeIncognitoWindow() {
  if (incognitoWindowId !== null) {
    await chrome.windows.remove(incognitoWindowId).catch(() => {});
    incognitoWindowId = null;
    incognitoTabId    = null;
    console.log('🕵️ Incognito window closed');
  }
}

function keepAlive() {
  chrome.runtime.getPlatformInfo(() => {});
}

// ─── Chặn cửa sổ ẩn danh hiện ra trong khi đang check ───────────────────────
// Chrome tự focus cửa sổ khi tab navigate → listener minimize ngay lập tức
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (isProcessing && incognitoWindowId !== null && windowId === incognitoWindowId) {
    chrome.windows.update(incognitoWindowId, { state: 'minimized', focused: false }).catch(() => {});
  }
});

// ─── Google result extraction (injected vào tab Google) ───────────────────────
// Trả về vị trí TƯƠNG ĐỐI trong trang hiện tại (1–10)
// Caller sẽ cộng thêm startPos để ra vị trí tuyệt đối
async function extractRankingFromPage(targetDomain) {
  try {
    // CAPTCHA check
    const html = document.body?.innerHTML || '';
    if (document.querySelector('form#captcha-form, .g-recaptcha') ||
        html.includes('detected unusual traffic') ||
        (html.length < 5000 && html.includes('recaptcha'))) {
      return { found: false, position: null, captcha: true, totalResults: 0 };
    }

    // Scroll để kích hoạt lazy-load
    await new Promise(r => setTimeout(r, 300));
    const ph = Math.max(document.body.scrollHeight, 3000);
    for (let i = 1; i <= 6; i++) {
      window.scrollTo(0, (ph / 6) * i);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));

    // ── Helpers ────────────────────────────────────────────────────────────
    const norm = d => String(d).toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '')
      .replace(/\/.*$/, '').replace(/:.*$/, '').trim();

    const isInsideAd = el => {
      let p = el;
      while (p && p !== document.body) {
        const id = p.id || '';
        if (id === 'tads' || id === 'bottomads' || id === 'tadsb') return true;
        if (p.getAttribute?.('data-text-ad')) return true;
        const cls = p.className || '';
        if (typeof cls === 'string' && (cls.includes('commercial-unit') || cls.includes('ads-fr'))) return true;
        p = p.parentElement;
      }
      return false;
    };

    const BAD = ['google.', 'youtube.com', 'gstatic.', 'googleapis.',
                 'googleusercontent.', 'gmail.com', 'blogger.com',
                 'google.com.vn', 'google.co.uk', 'google.com.au',
                 'translate.google', 'maps.google'];
    const excluded = h => { const n = norm(h); return BAD.some(b => n === b || n.startsWith(b) || n.endsWith('.' + b.replace(/\.$/, ''))); };

    // toLinks: lưu thêm el (tham chiếu DOM) để đếm div.g slot sau này
    // Xử lý Google redirect URL (/url?q=REAL_URL) → decode thành URL thật
    const toLinks = nodes => Array.from(nodes)
      .filter(a => a?.href?.startsWith('http') && !isInsideAd(a))
      .reduce((acc, a) => {
        try {
          let rawUrl = a.href;
          let u = new URL(rawUrl);
          // Google dùng /url?q=REAL_URL làm redirect → decode lấy URL thật
          if (u.hostname.endsWith('google.com') && u.pathname === '/url') {
            const q = u.searchParams.get('q');
            if (q && q.startsWith('http')) { rawUrl = q; u = new URL(rawUrl); }
          }
          if (!excluded(u.hostname)) acc.push({ url: rawUrl, hostname: u.hostname, el: a });
        } catch(e) {}
        return acc;
      }, []);

    const target = norm(targetDomain);
    const rso = document.getElementById('rso') || document.getElementById('search') || document.body;

    // ── 5 strategies ──────────────────────────────────────────────────────
    const s = {};
    s.UWckNb = toLinks(rso.querySelectorAll('a[jsname="UWckNb"]'));
    s.yuRUbf = toLinks(rso.querySelectorAll('.yuRUbf a[href^="http"]'));
    s.h3     = toLinks(Array.from(rso.querySelectorAll('h3')).map(h => h.closest('a')).filter(Boolean));
    const topGsDom = Array.from(rso.querySelectorAll('div.g')).filter(g => !g.parentElement?.closest('div.g'));
    s.divG   = toLinks(topGsDom.map(g => g.querySelector('a[href^="http"]')).filter(Boolean));
    s.ping   = toLinks(rso.querySelectorAll('a[ping][href^="http"]'));

    const debugCounts = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.length]));

    // ── Bước 1: Tìm target bằng priority strategies ───────────────────────
    // Mục tiêu: lấy được URL + element DOM của target để đếm vị trí chính xác
    let targetLink = null, bestKey = 'none';
    for (const key of ['UWckNb', 'yuRUbf', 'h3', 'divG', 'ping']) {
      for (const lnk of s[key]) {
        const h = norm(lnk.hostname);
        if (h === target || h.endsWith('.' + target) || target.endsWith('.' + h)) {
          targetLink = lnk; bestKey = key; break;
        }
      }
      if (targetLink) break;
    }

    // Không tìm thấy → trả về false với strategy có nhiều kết quả nhất
    if (!targetLink) {
      let best = [], bKey = 'none';
      for (const key of ['UWckNb', 'yuRUbf', 'h3', 'divG', 'ping']) {
        if (s[key].length >= 3) { best = s[key]; bKey = key; break; }
      }
      if (!best.length) for (const [k, v] of Object.entries(s)) if (v.length > best.length) { best = v; bKey = k; }
      console.log('[RankChecker] Not found | counts:', JSON.stringify(debugCounts), '| best strategy:', bKey);
      return { found: false, position: null, totalResults: best.length, captcha: false, debug: debugCounts, strategy: bKey };
    }

    // ── Bước 2: Đếm vị trí ĐÚNG bằng div.g slot counting ────────────────
    // Lý do: Google có các khối đặc biệt (Experiences, Featured snippet, Things to do...)
    // chiếm SERP slot nhưng KHÔNG có jsname="UWckNb" → UWckNb index bị lệch
    // div.g slot counting = đếm tất cả các khối kết quả, kể cả non-organic
    let position = null;
    try {
      let targetG = targetLink.el.closest('div.g');
      if (targetG) {
        // Leo lên div.g ngoài cùng (không lồng trong div.g khác)
        while (targetG.parentElement?.closest('div.g')) {
          targetG = targetG.parentElement.closest('div.g');
        }
        // Lấy tất cả top-level div.g không phải trong ad
        const allTopGs = Array.from(rso.querySelectorAll('div.g'))
          .filter(g => !g.parentElement?.closest('div.g') && !isInsideAd(g));
        const idx = allTopGs.indexOf(targetG);
        if (idx >= 0) {
          position = idx + 1;
          console.log('[RankChecker] div.g slot: idx=' + idx + ' → position=' + position);
        }
      }
    } catch(e) {
      console.warn('[RankChecker] div.g counting error:', e.message);
    }

    // Fallback: dùng index trong mảng nếu div.g counting thất bại
    if (!position) {
      const arr = s[bestKey];
      for (let i = 0; i < arr.length; i++) {
        const h = norm(arr[i].hostname);
        if (h === target || h.endsWith('.' + target) || target.endsWith('.' + h)) {
          position = i + 1; break;
        }
      }
    }

    const totalG = Array.from(rso.querySelectorAll('div.g'))
      .filter(g => !g.parentElement?.closest('div.g') && !isInsideAd(g)).length;

    console.log('[RankChecker] FOUND | strategy:', bestKey, '| position:', position, '| totalSlots:', totalG);
    console.log('[RankChecker] debug counts:', JSON.stringify(debugCounts));

    return {
      found: true,
      position,                   // vị trí TƯƠNG ĐỐI trong trang (1–10), caller cộng startPos
      url: targetLink.url,
      totalResults: totalG || s[bestKey].length,
      captcha: false,
      debug: debugCounts,
      strategy: bestKey,
    };

  } catch(err) {
    return { found: false, position: null, error: err.message, totalResults: 0, captcha: false };
  }
}

// ─── Tab helpers ──────────────────────────────────────────────────────────────
function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve('timeout');
    }, 20000);
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve('complete');
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text: String(text) });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}

// ─── Kiểm tra 1 keyword qua nhiều trang ───────────────────────────────────────
// Google: start=0 → pos 1-10 | start=10 → pos 11-20 | ... | start=90 → pos 91-100
async function checkKeywordAcrossPages(item, winId) {
  const MAX_PAGES = 10; // 10 trang × 10 kết quả = top 100

  // ── Reuse tab persistent — KHÔNG tạo tab mới (chrome.tabs.create gây window focus) ──
  const tabId = incognitoTabId;
  if (!tabId) throw new Error('Không có incognito tab — gọi getIncognitoWindow() trước');

  // Điều hướng tab hiện có đến trang Google đầu tiên
  const firstUrl = `https://www.google.com/search?q=${encodeURIComponent(item.keyword)}&start=0`;
  await chrome.tabs.update(tabId, { url: firstUrl, active: false });
  // Giữ cửa sổ ẩn danh minimized (chrome.tabs.update cũng có thể gây focus)
  chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});

  for (let page = 0; page < MAX_PAGES; page++) {
    const startPos = page * 10; // offset tuyệt đối: 0, 10, 20, ...

    if (page > 0) {
      const nextUrl = `https://www.google.com/search?q=${encodeURIComponent(item.keyword)}&start=${startPos}`;
      await chrome.tabs.update(tabId, { url: nextUrl });
      chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});
    }

    await waitForTabLoad(tabId);
    keepAlive();
    await new Promise(r => setTimeout(r, 1200)); // chờ DOM render
    keepAlive();

    // Inject script trích xuất
    const scriptResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractRankingFromPage,
      args: [item.domain],
    });
    const result = scriptResult[0]?.result || {};

    // ── CAPTCHA ──────────────────────────────────────────────────────
    if (result.captcha) {
      console.warn(`  ⚠️ CAPTCHA trang ${page + 1}! Chờ user giải...`);
      setBadge('⚠️', '#f59e0b');
      // KHÔNG focus tab/window — chỉ badge cảnh báo, user tự mở incognito để giải

      let solved = false;
      for (let attempt = 0; attempt < 12 && !solved; attempt++) {
        await new Promise(r => setTimeout(r, 5000));
        keepAlive();
        try {
          const recheck = await chrome.scripting.executeScript({
            target: { tabId },
            func: extractRankingFromPage,
            args: [item.domain],
          });
          const r2 = recheck[0]?.result;
          if (r2 && !r2.captcha) {
            setBadge('⏳', '#3b82f6');
            if (r2.found) {
              const absPos = startPos + r2.position;
              return { found: true, position: absPos, url: r2.url, strategy: r2.strategy, page: page + 1 };
            }
            solved = true; // giải xong nhưng target không ở trang này → tiếp tục
          }
        } catch(e) { /* tab navigated */ }
      }
      if (!solved) break; // hết thời gian → dừng
    }

    // ── Tìm thấy! ────────────────────────────────────────────────────
    if (result.found) {
      const absPos = startPos + result.position;
      console.log(`  ✅ Trang ${page + 1} | relative=#${result.position} | absolute=#${absPos} | ${result.url}`);
      return {
        found: true,
        position: absPos,
        url: result.url,
        strategy: result.strategy,
        totalResults: result.totalResults,
        debug: result.debug,
        page: page + 1,
      };
    }

    // ── Hết kết quả? → dừng sớm ──────────────────────────────────────
    const pageCount = result.debug?.UWckNb || result.debug?.h3 || result.totalResults || 0;
    console.log(`  Trang ${page + 1} (pos ${startPos + 1}–${startPos + 10}): ${pageCount} kết quả, không thấy`);

    if (pageCount < 5) {
      console.log('  → Ít hơn 5 kết quả → đã hết top 100, dừng');
      break;
    }

    // Delay ngắn giữa các trang (tránh rate limit)
    if (page < MAX_PAGES - 1) {
      keepAlive();
      const waitMs = 800 + Math.floor(Math.random() * 600);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  return { found: false, position: null };
  // NOTE: KHÔNG remove tab — incognitoTabId được reuse cho keyword tiếp theo
}

// ─── Push trạng thái sang dashboard tab (real-time) ──────────────────────────
async function pushStatusToDashboard(keyword) {
  try {
    const tabs = await chrome.tabs.query({ url: SERVER_URL + '/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'STATUS_UPDATE',
        currentKeyword: keyword,
      }).catch(() => {}); // tab có thể không có content script → bỏ qua
    }
  } catch(e) {}
}

// ─── Main processing loop ─────────────────────────────────────────────────────
async function startProcessing() {
  if (isProcessing) {
    console.log('Already processing, skip');
    return { ok: true, message: 'Đang xử lý, vui lòng chờ...' };
  }

  isProcessing = true;
  progressState = { checked: 0, found: 0, total: 0, currentKeyword: '', currentDomain: '', recentResults: [] };
  setBadge('⏳', '#3b82f6');
  console.log('\n🚀 Background: bắt đầu kiểm tra queue (paginated, top 100)...');

  // ── Bắt buộc incognito ────────────────────────────────────────────────
  const incogWin = await getIncognitoWindow();
  if (incogWin === null) {
    isProcessing = false;
    setBadge('!', '#ef4444');
    console.error('❌ KHÔNG CÓ INCOGNITO — kết quả sẽ sai!');
    return {
      ok: false,
      error: 'no_incognito',
      message: 'Cần bật "Allow in Incognito" cho Extension!\n\nVào chrome://extensions/ → tìm "Moodbiz Rank Checker" → bật "Allow in Incognito" → reload extension → thử lại.',
    };
  }
  console.log('✅ Incognito sẵn sàng (windowId:', incogWin, ')');

  let checked = 0, found = 0;

  while (true) {
    keepAlive();

    // Lấy keyword tiếp theo từ queue
    let item;
    try {
      const res = await fetch(`${SERVER_URL}/api/check-queue/next`, { headers: apiHeaders() });
      item = await res.json();
    } catch(e) {
      console.error('Queue error:', e.message);
      break;
    }

    if (!item) {
      console.log('✅ Queue empty, done!');
      break;
    }

    // Khởi tạo bộ đếm từ item đầu tiên — dùng item.total để lấy tổng job thật
    // (item.remaining = số keyword còn lại KHÔNG kể item hiện tại)
    if (progressState.total === 0) {
      progressState.total = item.total || (item.remaining + 1);
      const alreadyDone = progressState.total - item.remaining - 1;
      if (alreadyDone > 0) { checked = alreadyDone; progressState.checked = checked; }
    }
    progressState.currentKeyword = item.keyword;
    progressState.currentDomain  = item.domain;
    pushStatusToDashboard(item.keyword);

    checked++;
    progressState.checked = checked;
    setBadge(String(checked), '#3b82f6');
    console.log(`\n[${checked}] "${item.keyword}" | domain: ${item.domain} | sẽ check tối đa 10 trang`);

    let result = { found: false, position: null };
    try {
      const winId = await getIncognitoWindow();
      result = await checkKeywordAcrossPages(item, winId);
    } catch(err) {
      result.error = err.message;
      console.error('  Error:', err.message);
    }

    // Gửi kết quả về server
    keepAlive();
    try {
      await fetch(`${SERVER_URL}/api/check-results`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          jobId: item.jobId,
          keywordId: item.keywordId,
          keyword: item.keyword,
          position: result.found ? result.position : null,
          url: result.url || null,
          error: result.error || null,
        }),
      });
    } catch(e) {
      console.error('  Submit error:', e.message);
    }

    if (result.found) {
      found++;
      progressState.found = found;
      console.log(`  → #${result.position} | page ${result.page} | ${result.url}`);
    } else {
      console.log(`  → Không tìm thấy trong top 100`);
    }

    // Lưu kết quả gần đây cho popup
    progressState.recentResults.unshift({ keyword: item.keyword, position: result.found ? result.position : null });
    if (progressState.recentResults.length > 20) progressState.recentResults.pop();

    // Delay giữa các keyword
    if (item.remaining > 0) {
      const waitMs = 1500 + Math.floor(Math.random() * 1000);
      keepAlive();
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  await closeIncognitoWindow();
  isProcessing = false;
  console.log(`\n✅ Hoàn thành! Checked ${checked}, found ${found}`);
  setBadge('✓', '#22c55e');
  setTimeout(() => setBadge('', ''), 5000);
  return { ok: true, checked, found };
}

// ─── Message listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CHECKING') {
    console.log('📨 START_CHECKING from dashboard');
    // Lưu token nếu được gửi kèm
    if (message.token) {
      authToken = message.token;
      chrome.storage.local.set({ auth_token: message.token });
    }
    startProcessing()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (message.type === 'GET_STATUS') {
    sendResponse({ ok: true, isProcessing, ...progressState });
    return true;
  }
  if (message.type === 'UPDATE_BADGE') {
    updateBadge();
    sendResponse({ ok: true });
    return true;
  }
});

// ─── Badge update ─────────────────────────────────────────────────────────────
async function updateBadge() {
  if (isProcessing) return;
  try {
    const res = await fetch(`${SERVER_URL}/api/check-queue/status`, { headers: apiHeaders() });
    if (res.ok) {
      const data = await res.json();
      setBadge(data.pendingJobs > 0 ? String(data.pendingJobs) : '', data.pendingJobs > 0 ? '#ef4444' : '');
    }
  } catch(e) { setBadge('', ''); }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('checkQueue', { periodInMinutes: 0.5 });
  updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkQueue' && !isProcessing) updateBadge();
});
