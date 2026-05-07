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
async function getIncognitoWindow() {
  if (incognitoWindowId !== null) {
    try {
      const existing = await chrome.windows.get(incognitoWindowId);
      if (existing.incognito) {
        if (incognitoTabId) {
          try { await chrome.tabs.get(incognitoTabId); return incognitoWindowId; }
          catch(e) { incognitoTabId = null; }
        }
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
      url: 'about:blank', incognito: true, state: 'normal', focused: false,
    });
    if (!win.incognito) {
      await chrome.windows.remove(win.id).catch(() => {});
      console.error('❌ Chrome trả về cửa sổ THƯỜNG!');
      return null;
    }
    incognitoWindowId = win.id;
    incognitoTabId    = win.tabs?.[0]?.id || null;
    return incognitoWindowId;
  } catch(e) {
    return null;
  }
}

async function closeIncognitoWindow() {
  if (incognitoWindowId !== null) {
    await chrome.windows.remove(incognitoWindowId).catch(() => {});
    incognitoWindowId = null;
    incognitoTabId    = null;
  }
}

function keepAlive() {
  chrome.runtime.getPlatformInfo(() => {});
}

// ─── Google result extraction (injected vào tab Google) ───────────────────────
// Trả về vị trí TƯƠNG ĐỐI trong trang hiện tại (1–10)
// Caller sẽ cộng thêm startPos để ra vị trí tuyệt đối
async function extractRankingFromPage(targetDomain) {
  try {
    // CAPTCHA check — kiểm tra cả tiếng Anh và tiếng Việt
    const html = document.body?.innerHTML || '';
    const pageUrl = window.location.href;
    const pageTitle = document.title || '';
    const isCaptcha =
      !!document.querySelector('form#captcha-form, .g-recaptcha, #captcha, [action*="sorry"]') ||
      html.includes('detected unusual traffic') ||
      html.includes('unusual traffic from your computer') ||
      html.includes('lưu lượng truy cập bất thường') ||
      html.includes('phát hiện thấy lưu lượng') ||
      html.includes('không phải một rô-bốt') ||
      pageUrl.includes('google.com/sorry') ||
      pageUrl.includes('/sorry/index') ||
      (pageUrl.includes('sei=') && !html.includes('id="rso"')) ||
      pageTitle.includes('Giới thiệu về trang') ||
      pageTitle.includes('Before you continue') ||
      (html.length < 8000 && (html.includes('recaptcha') || html.includes('captcha')));

    if (isCaptcha) {
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
    const norm = d => {
      try {
        let s = d.trim().toLowerCase();
        if (!s.startsWith('http')) s = 'https://' + s;
        return new URL(s).hostname.replace(/^www\./, '').toLowerCase();
      } catch (_) {
        return d.replace(/^www\./, '').toLowerCase().split('/')[0].trim();
      }
    };

    const isInsideAd = el => {
      let p = el;
      while (p && p !== document.body) {
        if (p.id === 'tads' || p.id === 'bottomads' || p.id === 'tadsb' || p.getAttribute?.('data-text-ad')) return true;
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

    // toLinks: decode Google redirect URLs (/url?q=REAL_URL) và lưu cả el DOM
    const toLinks = nodes => Array.from(nodes)
      .filter(a => a?.href?.startsWith('http') && !isInsideAd(a))
      .reduce((acc, a) => {
        try {
          let rawUrl = a.href;
          let u = new URL(rawUrl);
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

    // ── 5 strategies song song ────────────────────────────────────────────
    const s = {};
    s.UWckNb = toLinks(rso.querySelectorAll('a[jsname="UWckNb"]'));
    s.yuRUbf = toLinks(rso.querySelectorAll('.yuRUbf a[href^="http"]'));
    s.h3     = toLinks(Array.from(rso.querySelectorAll('h3')).map(h => h.closest('a')).filter(Boolean));
    const topGsDom = Array.from(rso.querySelectorAll('div.g')).filter(g => !g.parentElement?.closest('div.g'));
    s.divG   = toLinks(topGsDom.map(g => g.querySelector('a[href^="http"]')).filter(Boolean));
    s.ping   = toLinks(rso.querySelectorAll('a[ping][href^="http"]'));

    const debugCounts = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.length]));

    // ── Bước 1: Tìm target theo thứ tự ưu tiên strategy ─────────────────
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

    if (!targetLink) {
      let best = [], bKey = 'none';
      for (const key of ['UWckNb', 'yuRUbf', 'h3', 'divG', 'ping']) {
        if (s[key].length >= 3) { best = s[key]; bKey = key; break; }
      }
      if (!best.length) for (const [k, v] of Object.entries(s)) if (v.length > best.length) { best = v; bKey = k; }
      const foundHostnames = best.slice(0, 8).map(lnk => norm(lnk.hostname));
      console.log('[RankChecker] Not found | target:', target, '| counts:', JSON.stringify(debugCounts), '| best:', bKey);
      console.log('[RankChecker] Top hostnames in SERP:', foundHostnames.join(', ') || '(none — possible CAPTCHA or selector change)');
      return { found: false, position: null, totalResults: best.length, captcha: false, debug: debugCounts, strategy: bKey, foundHostnames };
    }

    // ── Bước 2: Đếm vị trí bằng div.g slot counting ──────────────────────
    // Chính xác hơn array index vì Google có featured snippet, knowledge panel
    // chiếm slot nhưng không có jsname="UWckNb" → index bị lệch
    let position = null;
    try {
      let targetG = targetLink.el.closest('div.g');
      if (targetG) {
        while (targetG.parentElement?.closest('div.g')) {
          targetG = targetG.parentElement.closest('div.g');
        }
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

    // Fallback: dùng index trong mảng strategy nếu div.g counting thất bại
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
      position,
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
// Google bỏ qua &num=100 → paginate: start=0 (1-10), start=10 (11-20), ..., start=90 (91-100)
async function checkKeywordAcrossPages(item, winId) {
  const MAX_PAGES = 10; // 10 trang × 10 kết quả = top 100

  const tabId = incognitoTabId;
  if (!tabId) throw new Error('Không có incognito tab');

  // Điều hướng tab hiện có đến trang đầu tiên — KHÔNG tạo tab mới (gây window focus)
  const firstUrl = `https://www.google.com/search?q=${encodeURIComponent(item.keyword)}&start=0&hl=vi&gl=vn`;
  await chrome.tabs.update(tabId, { url: firstUrl, active: false });
  chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});

  for (let page = 0; page < MAX_PAGES; page++) {
    const startPos = page * 10; // offset tuyệt đối: 0, 10, 20, ...

    if (page > 0) {
      const nextUrl = `https://www.google.com/search?q=${encodeURIComponent(item.keyword)}&start=${startPos}&hl=vi&gl=vn`;
      await chrome.tabs.update(tabId, { url: nextUrl });
      chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});
    }

    await waitForTabLoad(tabId);
    keepAlive();
    await new Promise(r => setTimeout(r, 1200));
    keepAlive();

    const scriptResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractRankingFromPage,
      args: [item.domain],
    });
    const result = scriptResult[0]?.result || {};

    // ── CAPTCHA ─────────────────────────────────────────────────────────
    if (result.captcha) {
      console.warn(`  ⚠️ CAPTCHA trang ${page + 1}! Hiện cửa sổ để user giải...`);
      setBadge('!', '#f59e0b');
      // Hiện cửa sổ ẩn danh lên để user thấy và giải CAPTCHA
      if (winId) chrome.windows.update(winId, { state: 'normal', focused: true }).catch(() => {});

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
            // Minimize lại sau khi giải xong, chờ thêm 3s để Google không block ngay
            if (winId) chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});
            await new Promise(r => setTimeout(r, 3000));
            if (r2.found) {
              const absPos = startPos + r2.position;
              return { found: true, position: absPos, url: r2.url, strategy: r2.strategy, page: page + 1 };
            }
            solved = true; // giải xong nhưng target không ở trang này → tiếp tục
          }
        } catch(e) { /* tab đang navigate */ }
      }
      if (!solved) break; // hết thời gian → dừng
    }

    // ── Tìm thấy! ────────────────────────────────────────────────────────
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

    // ── Hết kết quả? → dừng sớm ─────────────────────────────────────────
    // Dùng max của tất cả strategy (không chỉ UWckNb/h3) tránh thoát sớm khi Google đổi cấu trúc
    const pageCount = Math.max(
      result.debug?.UWckNb || 0,
      result.debug?.yuRUbf || 0,
      result.debug?.h3 || 0,
      result.debug?.divG || 0,
      result.debug?.ping || 0,
      result.totalResults || 0
    );
    console.log(`  Trang ${page + 1} (pos ${startPos + 1}–${startPos + 10}): ${pageCount} kết quả, không thấy target`);
    if (result.foundHostnames?.length) {
      console.log(`  Top hostnames trang này: ${result.foundHostnames.join(', ')}`);
    }

    if (pageCount < 5) {
      console.log('  → Ít hơn 5 kết quả → đã hết top 100, dừng');
      break;
    }

    // Delay giữa các trang — đủ dài để Google không coi là bot
    if (page < MAX_PAGES - 1) {
      keepAlive();
      const waitMs = 2500 + Math.floor(Math.random() * 2000); // 2.5–4.5s
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  return { found: false, position: null };
  // NOTE: KHÔNG remove tab — incognitoTabId được reuse cho keyword tiếp theo
}

// ─── Push trạng thái sang dashboard tab (real-time) ──────────────────────────
async function pushStatusToDashboard(keyword) {
  try {
    // Tìm tab Dashboard ở cả localhost (dev) lẫn production
    const allTabs = await chrome.tabs.query({});
    const dashboardTabs = allTabs.filter(tab =>
      tab.url && (
        tab.url.startsWith('http://localhost:5173') ||
        tab.url.startsWith('https://rank.moodbiz.vn') ||
        tab.url.includes('moodbiz')
      )
    );
    for (const tab of dashboardTabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'STATUS_UPDATE',
        currentKeyword: keyword,
      }).catch(() => {}); // tab có thể không có content script → bỏ qua
    }
  } catch(e) {}
}

// ─── Main processing loop ─────────────────────────────────────────────────────
async function startProcessing(targetJobId = null) {
  if (isProcessing) {
    console.log('Already processing, skip');
    return { ok: true, message: 'Đang xử lý, vui lòng chờ...' };
  }

  isProcessing = true;
  progressState = { checked: 0, found: 0, total: 0, currentKeyword: '', currentDomain: '', recentResults: [] };
  setBadge('⏳', '#3b82f6');
  console.log('\n🚀 Background: bắt đầu kiểm tra queue (paginated, top 100)...');

  // ── Ưu tiên incognito, fallback sang cửa sổ thường nếu chưa bật ──────
  const incogWin = await getIncognitoWindow();
  if (incogWin === null) {
    console.warn('⚠️ Không tạo được Incognito → Fallback sang cửa sổ thường.');
    console.warn('→ Để chính xác hơn: chrome://extensions/ → Moodbiz Rank Checker → bật "Allow in Incognito"');
    try {
      const win = await chrome.windows.create({ url: 'about:blank', state: 'minimized', focused: false });
      incognitoWindowId = win.id;
      incognitoTabId    = win.tabs?.[0]?.id || null;
      console.log('✅ Fallback window tạo thành công (windowId:', win.id, ')');
    } catch(e) {
      isProcessing = false;
      setBadge('!', '#ef4444');
      return { ok: false, error: 'no_window', message: 'Không thể tạo cửa sổ trình duyệt.' };
    }
  } else {
    console.log('✅ Incognito sẵn sàng (windowId:', incogWin, ')');
  }

  let checked = 0, found = 0;
  // Nếu được truyền jobId từ Dashboard, lock vào job đó ngay
  let currentJobId = targetJobId || null;
  if (currentJobId) {
    console.log('📌 Locked to jobId:', currentJobId);
  }

  while (true) {
    keepAlive();

    // Lấy keyword tiếp theo từ queue
    let item;
    try {
      // Nếu đã có jobId, gửi kèm để server ưu tiên job đó
      const jobParam = currentJobId ? `&jobId=${currentJobId}` : '';
      const res = await fetch(`${SERVER_URL}/api/rank-checker?action=get-next-keyword${jobParam}`, { headers: apiHeaders() });
      item = await res.json();
      if (!item || !item.keyword) break; // Hết keyword hoặc lỗi
      // Lưu jobId từ item đầu tiên nhận được
      if (!currentJobId && item.jobId) {
        currentJobId = item.jobId;
        console.log('📌 Tracking jobId:', currentJobId);
      }
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
    console.log(`\n[${checked}] "${item.keyword}" | domain: "${item.domain}"`);
    if (!item.domain) {
      console.error('  ❌ Domain rỗng! Hãy kiểm tra brand có đang được cấu hình domain trong Firestore không.');
    }

    let result = { found: false, position: null };
    try {
      // ── Ưu tiên dùng Google Custom Search API (không bị CAPTCHA) ──────────
      const apiRes = await fetch(`${SERVER_URL}/api/rank-checker?action=check-keyword-api`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          jobId: item.jobId || currentJobId,
          keywordId: item.keywordId,
          keyword: item.keyword,
          domain: item.domain,
        }),
      });
      const apiData = await apiRes.json();

      if (apiRes.ok && apiData.ok && apiData.position !== null) {
        // CSE tìm thấy vị trí (top 30), kết quả đã được lưu bởi server
        result = { found: true, position: apiData.position, url: apiData.url, source: 'cse' };
        console.log(`  [CSE] ✅ Tìm thấy #${apiData.position} | scanned ${apiData.totalScanned} results`);
      } else {
        // CSE không thấy trong top 30 → thử GSC (không cần browser, không bị CAPTCHA)
        console.log(`  [CSE] Không có trong top ${apiData?.totalScanned || 30} → hỏi GSC...`);
        try {
          const gscRes = await fetch(`${SERVER_URL}/api/rank-checker?action=check-keyword-gsc`, {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify({
              jobId: item.jobId || currentJobId,
              keywordId: item.keywordId,
              keyword: item.keyword,
              domain: item.domain,
            }),
          });
          const gscData = await gscRes.json();
          if (gscRes.ok && gscData.ok && gscData.position !== null) {
            result = { found: true, position: gscData.position, url: null, source: 'gsc' };
            console.log(`  [GSC] ✅ Tìm thấy #${gscData.position} (trung bình ${gscData.days} ngày)`);
          } else {
            result = { found: false, position: null, source: 'gsc' };
            console.log(`  [GSC] Không có dữ liệu → not found`);
          }
        } catch(gscErr) {
          result = { found: false, position: null, source: 'gsc-error' };
          console.warn('  [GSC] Lỗi:', gscErr.message);
        }
        // Submit kết quả (found hay not found) để cập nhật tiến độ job
        await fetch(`${SERVER_URL}/api/rank-checker?action=submit-result`, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({
            jobId: item.jobId || currentJobId,
            keywordId: item.keywordId,
            keyword: item.keyword,
            position: result.found ? result.position : null,
            url: result.url || null,
          }),
        }).catch(e => console.error('  Submit error:', e.message));
      }
    } catch(err) {
      result.error = err.message;
      console.error('  Error:', err.message);
    }

    if (result.found) {
      found++;
      progressState.found = found;
      console.log(`  → #${result.position} | ${result.url}`);
    } else {
      console.log(`  → Không tìm thấy trong top 100`);
    }

    // Lưu kết quả gần đây cho popup
    progressState.recentResults.unshift({ keyword: item.keyword, position: result.found ? result.position : null });
    if (progressState.recentResults.length > 20) progressState.recentResults.pop();

    // Delay giữa các keyword — 8–15s giả lập người dùng
    if (item.remaining > 0) {
      const waitMs = 8000 + Math.floor(Math.random() * 7000);
      console.log(`  ⏳ Chờ ${(waitMs/1000).toFixed(1)}s trước keyword tiếp theo...`);
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
    const targetJobId = message.jobId || null;
    console.log('📨 START_CHECKING from dashboard | jobId:', targetJobId);
    // Lưu token nếu được gửi kèm
    if (message.token) {
      authToken = message.token;
      chrome.storage.local.set({ auth_token: message.token });
    }
    startProcessing(targetJobId)
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
    const res = await fetch(`${SERVER_URL}/api/rank-checker?action=get-job-status`, { headers: apiHeaders() });
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
