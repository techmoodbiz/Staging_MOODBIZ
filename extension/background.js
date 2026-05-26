// ─── Rank Checker - Background Service Worker ─────────────────────────────────
// Google mới: KHÔNG dùng &num=100 (bị ignore)
// Thay bằng paginate: start=0 (pos 1-10), start=10 (11-20), ..., start=90 (91-100)

// SERVER_URL được load từ config.js (importScripts bên dưới)
importScripts('config.js');

let isProcessing = false;
let shouldStop = false;
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

// ─── Locale detection ─────────────────────────────────────────────────────────
// Dùng chrome.i18n.getUILanguage() để lấy ngôn ngữ/quốc gia của trình duyệt user.
// Ví dụ: "vi" → hl=vi&gl=VN | "en-US" → hl=en&gl=US | "ja" → hl=ja&gl=JP
const _browserLocale = (() => {
  const raw = (chrome.i18n.getUILanguage() || 'en').trim();
  const parts = raw.split(/[-_]/);
  const hl = parts[0].toLowerCase();
  const explicitCountry = parts[1]?.toUpperCase() || null;
  // Ánh xạ ngôn ngữ → quốc gia mặc định khi locale không có country code (vd: "vi", "ja")
  const langToCountry = {
    vi: 'VN', ja: 'JP', ko: 'KR', th: 'TH', zh: 'CN',
    fr: 'FR', de: 'DE', es: 'ES', pt: 'BR', ru: 'RU',
    ar: 'SA', hi: 'IN', id: 'ID', ms: 'MY', tl: 'PH',
    nl: 'NL', it: 'IT', pl: 'PL', tr: 'TR', sv: 'SE',
  };
  const gl = explicitCountry || langToCountry[hl] || 'US';
  console.log(`[Locale] raw="${raw}" → hl=${hl} gl=${gl}`);
  return { hl, gl };
})();

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
    // Tạo thẳng ở state 'minimized' để tránh flash đen khi window xuất hiện.
    // Chrome đôi khi bỏ qua state này trên một số OS → gọi thêm update() ngay sau
    // để đảm bảo window không hiện ra màn hình người dùng.
    const win = await chrome.windows.create({
      url: 'about:blank', incognito: true, state: 'minimized', focused: false,
    });
    if (!win.incognito) {
      await chrome.windows.remove(win.id).catch(() => {});
      console.error('❌ Chrome trả về cửa sổ THƯỜNG!');
      return null;
    }
    incognitoWindowId = win.id;
    incognitoTabId    = win.tabs?.[0]?.id || null;
    // Belt-and-suspenders: minimize ngay lập tức phòng Chrome tạo state 'normal' trước
    chrome.windows.update(win.id, { state: 'minimized', focused: false }).catch(() => {});
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
  // chrome.storage write đáng tin cậy hơn getPlatformInfo để giữ SW không bị terminate
  chrome.storage.local.set({ _sw_heartbeat: Date.now() });
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
      pageTitle.includes('Error 403') ||
      html.includes('does not have permission') ||
      html.includes('That\'s an error') ||
      (html.length < 8000 && (html.includes('recaptcha') || html.includes('captcha')));

    if (isCaptcha) {
      return { found: false, position: null, captcha: true, totalResults: 0 };
    }

    // Scroll để kích hoạt lazy-load
    await new Promise(r => setTimeout(r, 120));
    const ph = Math.max(document.body.scrollHeight, 3000);
    for (let i = 1; i <= 3; i++) {
      window.scrollTo(0, (ph / 3) * i);
      await new Promise(r => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 120));

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
    // divG: dùng div.A6K0A[data-rpos] — Google DOM mới (div.g đã bị xóa hoàn toàn)
    // Loại slot có PAA signals nhúng bên trong (.MBeuO / .dnXCYb / [jsname="N760b"])
    // để count khớp với SEOquake và tránh đếm PAA-hybrid slot như organic thường
    const isPAASlot = el =>
      !!el.querySelector('.related-question-pair, [jsname="N760b"], .dnXCYb, .MBeuO');
    const organicA6K0A = Array.from(rso.querySelectorAll('div.A6K0A[data-rpos]'))
      .filter(el => !isInsideAd(el) && !!el.querySelector('h3') && !isPAASlot(el));
    s.divG = toLinks(organicA6K0A.map(g => g.querySelector('a[jsname="UWckNb"], a[href^="http"]')).filter(Boolean));
    s.ping   = toLinks(rso.querySelectorAll('a[ping][href^="http"]'));

    const debugCounts = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.length]));

    // ── Bước 1: Tìm target theo thứ tự ưu tiên strategy ─────────────────
    // Ưu tiên URL sạch (không có #:~:text=) để tránh nhầm AI Overview citation
    // với organic result thật. AI Overview dùng text-fragment URL để highlight nguồn.
    let targetLink = null, bestKey = 'none';
    for (const key of ['UWckNb', 'yuRUbf', 'h3', 'divG', 'ping']) {
      let cleanLnk = null, fragLnk = null;
      for (const lnk of s[key]) {
        const h = norm(lnk.hostname);
        if (h === target || h.endsWith('.' + target) || target.endsWith('.' + h)) {
          if (!lnk.url.includes('#:~:text=')) { cleanLnk = lnk; break; }
          if (!fragLnk) fragLnk = lnk;
        }
      }
      const picked = cleanLnk || fragLnk;
      if (picked) { targetLink = picked; bestKey = key; break; }
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

    // ── Bước 2: Đếm vị trí organic theo DOM order ───────────────────────
    let position = null;
    const debugBefore = []; // để log ra service worker
    try {
      const mainResults = Array.from(rso.querySelectorAll('.yuRUbf'))
        .filter(el => !isInsideAd(el) && !!el.querySelector('a[jsname="UWckNb"]'));
      for (let i = 0; i < mainResults.length; i++) {
        if (mainResults[i].contains(targetLink.el)) {
          position = i + 1;
          console.log('[RankChecker] yuRUbf+UWckNb: position=' + position + '/' + mainResults.length);
          break;
        }
        // Thu thập debug: hostname + class của parent block
        const a = mainResults[i].querySelector('a[jsname="UWckNb"]');
        const blockCls = (mainResults[i].closest('[class]') || mainResults[i].parentElement)?.className || '';
        debugBefore.push((a ? (new URL(a.href).hostname || a.href.slice(0,40)) : '?') + ' [' + String(blockCls).split(' ').slice(0,3).join(' ') + ']');
      }
    } catch(e) {
      console.warn('[RankChecker] yuRUbf+UWckNb error:', e.message);
    }

    // Fallback: đếm hostname trong divG → yuRUbf → bestKey
    if (!position) {
      const fallbackArr = s.divG.length >= 3 ? s.divG
                        : s.yuRUbf.length >= 3 ? s.yuRUbf
                        : s[bestKey];
      const fallbackKey = s.divG.length >= 3 ? 'divG' : s.yuRUbf.length >= 3 ? 'yuRUbf' : bestKey;
      for (let i = 0; i < fallbackArr.length; i++) {
        const h = norm(fallbackArr[i].hostname);
        if (h === target || h.endsWith('.' + target) || target.endsWith('.' + h)) {
          position = i + 1; break;
        }
      }
      if (position) console.log('[RankChecker] fallback via ' + fallbackKey + ': position=' + position);
    }

    const totalG = Array.from(rso.querySelectorAll('div.A6K0A[data-rpos]'))
      .filter(el => !isInsideAd(el) && !!el.querySelector('a[jsname="UWckNb"]') && !isPAASlot(el)).length;

    console.log('[RankChecker] FOUND | strategy:', bestKey, '| position:', position, '| totalSlots:', totalG);
    console.log('[RankChecker] debug counts:', JSON.stringify(debugCounts));
    if (debugBefore.length) console.log('[RankChecker] results before target:', debugBefore.join(' | '));

    return {
      found: true,
      position,
      url: targetLink.url,
      totalResults: totalG || s[bestKey].length,
      captcha: false,
      debug: { ...debugCounts, debugBefore },
      strategy: bestKey,
    };

  } catch(err) {
    return { found: false, position: null, error: err.message, totalResults: 0, captcha: false };
  }
}

// ─── Tab helpers ──────────────────────────────────────────────────────────────
async function ensureIncognitoTab() {
  // Kiểm tra tab còn sống không
  if (incognitoTabId) {
    try { await chrome.tabs.get(incognitoTabId); return true; }
    catch(e) { incognitoTabId = null; }
  }
  // Tab đã chết — thử tạo lại trong cùng window
  if (incognitoWindowId) {
    try {
      await chrome.windows.get(incognitoWindowId);
      const t = await chrome.tabs.create({ url: 'about:blank', windowId: incognitoWindowId, active: false });
      incognitoTabId = t.id;
      console.log('🔄 Tab được tạo lại (tabId:', t.id, ')');
      return true;
    } catch(e) {
      incognitoWindowId = null;
      incognitoTabId = null;
    }
  }
  // Window cũng đã đóng — tạo lại toàn bộ
  const winId = await getIncognitoWindow();
  return winId !== null;
}

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

// ─── Alert sound ──────────────────────────────────────────────────────────────
// Phát 3 tiếng "tinh tinh tinh" trong tab ẩn danh để báo user có CAPTCHA.
// Không cần thêm permission — dùng lại scripting vào google.com đã được cấp.
async function playAlertBeeps() {
  if (!incognitoTabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: incognitoTabId },
      func: () => {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const beep = (freq, t) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.55, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.start(t);
            osc.stop(t + 0.35);
          };
          const now = ctx.currentTime;
          beep(1046.5, now);        // C6
          beep(1318.5, now + 0.42); // E6
          beep(1568.0, now + 0.84); // G6
        } catch (e) {}
      },
    });
  } catch (e) {
    console.log('[Sound] Không thể phát âm báo:', e.message);
  }
}

// Âm hoàn thành — 2 nốt nhẹ nhàng đi lên (E5 → G5), nhỏ hơn CAPTCHA alert
async function playDoneBeeps() {
  if (!incognitoTabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: incognitoTabId },
      func: () => {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          const ctx = new Ctx();
          const beep = (freq, t, vol = 0.3) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(vol, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
            osc.start(t);
            osc.stop(t + 0.45);
          };
          const now = ctx.currentTime;
          beep(659.3, now);        // E5
          beep(783.9, now + 0.52); // G5
        } catch (e) {}
      },
    });
  } catch (e) {
    console.log('[Sound] Không thể phát âm done:', e.message);
  }
}

// ─── Kiểm tra 1 keyword qua nhiều trang ───────────────────────────────────────
// Google bỏ qua &num=100 → paginate: start=0 (1-10), start=10 (11-20), ..., start=90 (91-100)
//
// Smart ordering : bắt đầu từ trang gần previousPosition thay vì trang 0.
// Smart depth    : giới hạn số trang dựa vào previousPosition + bestPosition.
//
// Ví dụ previousPosition=45, bestPosition=8:
//   depthFromPP = 7 (pos 31-60 → max 7 trang)
//   depthFromBP = max(2, ceil(8/10)+1) = 2  →  dynamicMax = max(7,2) = 7
//   pageOrder   = [3,4,5,6,7,8,9,2,1,0] → slice 7 → [3,4,5,6,7,8,9]
//   Keyword tại pos 45 tìm được ở lần check thứ 2 (trang 4).
async function checkKeywordAcrossPages(item, winId) {
  const pp = item.previousPosition ?? null; // vị trí lần check gần nhất
  const bp = item.bestPosition    ?? null; // vị trí tốt nhất lịch sử

  // ── Smart depth: tính số trang tối đa cần quét ──────────────────────────
  // 1) Từ previousPosition (chỉ báo tốt nhất về vị trí hiện tại)
  const depthFromPP = pp === null ? 10
    : pp <= 10 ? 2
    : pp <= 30 ? 4
    : pp <= 60 ? 7
    : 10;

  // 2) Từ bestPosition — đảm bảo luôn cover trang chứa bestPos + 1 buffer
  //    Tránh bỏ sót khi keyword hồi phục về vùng từng đạt được trước đây
  const depthFromBP = bp !== null ? Math.min(10, Math.ceil(bp / 10) + 1) : 0;

  const dynamicMax = Math.max(depthFromPP, depthFromBP);

  // ── Smart ordering: bắt đầu gần hintPos, hoàn thiện phần còn lại sau ───
  const hintPos = pp; // dùng previousPosition làm gợi ý vị trí
  let pageOrder;
  if (hintPos != null && hintPos > 10) {
    const hintPageIdx = Math.max(0, Math.floor((hintPos - 1) / 10) - 1);
    const forward  = Array.from({ length: 10 - hintPageIdx }, (_, i) => hintPageIdx + i);
    const backward = Array.from({ length: hintPageIdx },      (_, i) => hintPageIdx - 1 - i);
    pageOrder = [...forward, ...backward];
  } else {
    pageOrder = Array.from({ length: 10 }, (_, i) => i);
  }

  // Áp dụng giới hạn độ sâu
  pageOrder = pageOrder.slice(0, dynamicMax);

  console.log(`  📍 pp=${pp} bp=${bp} → dynamicMax=${dynamicMax} trang | thứ tự: [${pageOrder.map(p => p+1).join(',')}]`);

  const ok = await ensureIncognitoTab();
  if (!ok) throw new Error('Không thể tạo incognito tab');
  let tabId = incognitoTabId;

  // Tự detect ngôn ngữ keyword: tiếng Việt (có dấu) → hl=vi&gl=VN
  // để kết quả khớp với Google người dùng Việt Nam thực sự thấy
  const _kwLocale = /[àáảãạăặắằẳẵâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẶẮẰẲẴÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/.test(item.keyword)
    ? { hl: 'vi', gl: 'VN' }
    : _browserLocale;
  console.log(`  🌐 Locale: hl=${_kwLocale.hl} gl=${_kwLocale.gl}`);

  const buildUrl = (kw, start) =>
    `https://www.google.com/search?q=${encodeURIComponent(kw)}&start=${start}&hl=${_kwLocale.hl}&gl=${_kwLocale.gl}`;

  await chrome.tabs.update(tabId, { url: buildUrl(item.keyword, pageOrder[0] * 10), active: false });
  chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});

  for (let i = 0; i < pageOrder.length; i++) {
    const page = pageOrder[i];
    const startPos = page * 10; // offset tuyệt đối: 0, 10, 20, ...

    if (i > 0) {
      // Kiểm tra tab còn sống trước khi navigate
      const stillOk = await ensureIncognitoTab();
      if (!stillOk) break;
      tabId = incognitoTabId;
      const nextUrl = buildUrl(item.keyword, startPos);
      await chrome.tabs.update(tabId, { url: nextUrl });
      chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});
    }

    await waitForTabLoad(tabId);
    keepAlive();
    await new Promise(r => setTimeout(r, 800));
    keepAlive();

    let scriptResult;
    try {
      scriptResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: extractRankingFromPage,
        args: [item.domain],
      });
    } catch(e) {
      console.warn('  Tab đã đóng giữa chừng, bỏ qua trang này:', e.message);
      break;
    }
    // result là let để có thể override sau silent-retry / sau giải CAPTCHA
    let result = scriptResult?.[0]?.result || {};

    // ── CAPTCHA: silent retry 3s trước khi hiện cửa sổ ──────────────────
    // Phần lớn "CAPTCHA" ở trang 2+ là false-positive (page chưa render xong).
    // Thử lại im lặng một lần → chỉ hiện cửa sổ nếu vẫn còn CAPTCHA thật.
    if (result.captcha) {
      console.log(`  🔄 Phát hiện CAPTCHA trang ${page + 1}, thử lại im lặng sau 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      keepAlive();
      try {
        const silentRc = await chrome.scripting.executeScript({
          target: { tabId }, func: extractRankingFromPage, args: [item.domain],
        });
        const sr = silentRc?.[0]?.result;
        if (sr && !sr.captcha) {
          console.log(`  ✅ False-positive CAPTCHA — trang ${page + 1} load xong bình thường.`);
          result = sr; // override bằng kết quả đúng, xử lý tiếp bên dưới
        }
      } catch(e) { /* tab đang navigate, giữ result cũ */ }
    }

    // ── CAPTCHA thật (vẫn còn sau silent retry) ───────────────────────────
    if (result.captcha) {
      console.warn(`  ⚠️ CAPTCHA thật trang ${page + 1}! Hiện cửa sổ để user giải...`);
      setBadge('!', '#f59e0b');
      if (winId) chrome.windows.update(winId, { state: 'normal', focused: true }).catch(() => {});
      playAlertBeeps(); // 🔔 tinh tinh tinh — báo user cần giải CAPTCHA

      let captchaSolved = false;
      for (let attempt = 0; attempt < 24 && !captchaSolved; attempt++) {
        await new Promise(r => setTimeout(r, 5000));
        keepAlive();
        try {
          const recheck = await chrome.scripting.executeScript({
            target: { tabId }, func: extractRankingFromPage, args: [item.domain],
          });
          const r2 = recheck[0]?.result;
          if (r2 && !r2.captcha) {
            setBadge('⏳', '#3b82f6');
            if (winId) chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});
            await new Promise(r => setTimeout(r, 3000));
            if (r2.found) {
              const absPos = startPos + r2.position;
              return { found: true, position: absPos, url: r2.url, strategy: r2.strategy, page: page + 1 };
            }
            result = r2;       // override để các bước sau dùng đúng data
            captchaSolved = true;
          }
        } catch(e) { /* tab đang navigate */ }
      }
      if (!captchaSolved) break; // hết thời gian → dừng job
    }

    // ── Tìm thấy! ────────────────────────────────────────────────────────
    if (result.found) {
      const absPos = startPos + result.position;
      console.log(`  ✅ Trang ${page + 1} | relative=#${result.position} | absolute=#${absPos} | ${result.url}`);
      if (result.debug?.debugBefore?.length) {
        console.log(`  📋 Results counted before target:`, result.debug.debugBefore);
      }
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

    // ── Đếm kết quả trang hiện tại ───────────────────────────────────────
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

    // Soft block: CHỈ hiện cửa sổ khi Google trang 1 (page index = 0) trả về 0 kết quả.
    // Dùng `page === 0` (trang thật của Google) thay vì `i === 0` (index trong custom order)
    // để tránh trigger khi smart ordering bắt đầu từ trang 3, 4...
    if (page === 0 && pageCount === 0) {
      console.warn('  ⚠️ Google trang 1 có 0 kết quả → có thể bị soft-block, hiện cửa sổ...');
      setBadge('!', '#f59e0b');
      if (winId) chrome.windows.update(winId, { state: 'normal', focused: true }).catch(() => {});
      await new Promise(r => setTimeout(r, 10000));
      if (winId) chrome.windows.update(winId, { state: 'minimized', focused: false }).catch(() => {});
      setBadge('⏳', '#3b82f6');
    }

    // Delay giữa các trang — đủ dài để Google không coi là bot
    if (i < pageOrder.length - 1) {
      keepAlive();
      const waitMs = 800 + Math.floor(Math.random() * 600); // 0.8–1.4s
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  return { found: false, position: null };
  // NOTE: KHÔNG remove tab — incognitoTabId được reuse cho keyword tiếp theo
}

// ─── Push trạng thái sang dashboard tab (real-time) ──────────────────────────
// Cache tab IDs trong 30s để tránh gọi chrome.tabs.query({}) mỗi keyword
let _dashTabCache = null, _dashTabCacheTime = 0;
async function getDashboardTabs() {
  const now = Date.now();
  if (_dashTabCache && now - _dashTabCacheTime < 30000) return _dashTabCache;
  const allTabs = await chrome.tabs.query({});
  _dashTabCache = allTabs.filter(tab =>
    tab.url && (
      tab.url.startsWith('http://localhost:5173') ||
      tab.url.startsWith('https://rank.moodbiz.vn') ||
      tab.url.includes('moodbiz')
    )
  );
  _dashTabCacheTime = now;
  return _dashTabCache;
}

async function pushStatusToDashboard(keyword) {
  try {
    const dashboardTabs = await getDashboardTabs();
    for (const tab of dashboardTabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'STATUS_UPDATE',
        currentKeyword: keyword,
      }).catch(() => {});
    }
  } catch(e) {}
}

async function pushResultReady() {
  try {
    const dashboardTabs = await getDashboardTabs();
    for (const tab of dashboardTabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'RESULT_READY' }).catch(() => {});
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
    // Đảm bảo window đang minimized trước khi bắt đầu check
    chrome.windows.update(incogWin, { state: 'minimized', focused: false }).catch(() => {});
  }

  let checked = 0, found = 0;
  // Nếu được truyền jobId từ Dashboard, lock vào job đó ngay
  let currentJobId = targetJobId || null;
  if (currentJobId) {
    console.log('📌 Locked to jobId:', currentJobId);
  }

  while (true) {
    keepAlive();
    if (shouldStop) { console.log('🛑 Stop signal nhận được, thoát loop.'); break; }

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
      result = await checkKeywordAcrossPages(item, incognitoWindowId);
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
      // Báo dashboard fetch kết quả ngay, chờ UI cập nhật trước khi check tiếp
      await pushResultReady();
      await new Promise(r => setTimeout(r, 1000));
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

    // Delay giữa các keyword — 2–4s giả lập người dùng
    if (item.remaining > 0 && !shouldStop) {
      const waitMs = 2000 + Math.floor(Math.random() * 2000);
      console.log(`  ⏳ Chờ ${(waitMs/1000).toFixed(1)}s trước keyword tiếp theo...`);
      keepAlive();
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  const wasStopped = shouldStop;
  shouldStop = false;
  if (!wasStopped) await playDoneBeeps(); // phát trước khi đóng window
  await closeIncognitoWindow();
  isProcessing = false;
  if (wasStopped) {
    console.log(`\n🛑 Dừng sớm! Checked ${checked}, found ${found}`);
    setBadge('', '');
  } else {
    console.log(`\n✅ Hoàn thành! Checked ${checked}, found ${found}`);
    setBadge('✓', '#22c55e');
    setTimeout(() => setBadge('', ''), 5000);
  }
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
  if (message.type === 'STOP_CHECKING') {
    console.log('🛑 STOP_CHECKING received from popup');
    shouldStop = true;
    sendResponse({ ok: true });
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
  chrome.alarms.create('checkQueue',   { periodInMinutes: 0.5 });
  chrome.alarms.create('sw_keepalive', { periodInMinutes: 0.5 });
  updateBadge();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('sw_keepalive', { periodInMinutes: 0.5 });
  updateBadge();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkQueue'   && !isProcessing) updateBadge();
  if (alarm.name === 'sw_keepalive') keepAlive();
});
