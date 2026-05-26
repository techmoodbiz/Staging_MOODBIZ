# Tài liệu kỹ thuật: Moodbiz Rank Checker Extension

> Phiên bản extension: 1.3.0 | Cập nhật: 2026-05-20

---

## 1. Tổng quan kiến trúc

Extension **Moodbiz Rank Checker** là một Chrome Extension (Manifest V3) dùng để kiểm tra thứ hạng từ khóa trên Google bằng cách đọc DOM thực tế từ tab trình duyệt thay vì gọi API.

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard (React)          Chrome Extension                    │
│  RankCheckerTab.tsx         ┌─────────────────────────────────┐ │
│  ┌─────────────────┐        │  popup.js (UI extension)        │ │
│  │ 1. Tạo Job      │        │  background.js (Service Worker) │ │
│  │    POST /api    │        │  content-bridge.js (Cầu nối)    │ │
│  │                 │        │  config.js (Server URL)         │ │
│  │ 2. Dispatch     │──────▶ │                                 │ │
│  │    CustomEvent  │        └────────────┬────────────────────┘ │
│  └─────────────────┘                     │                      │
│                                          │ GET /api (queue)     │
│  ◀──── poll job status mỗi 3s ──────────│                      │
│                                          ▼                      │
│                              ┌─────────────────────┐            │
│                              │  Google Search SERP │            │
│                              │  (incognito tab)    │            │
│                              └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ POST /api/submit-result
                    ┌───────────────────────────────┐
                    │  Backend (Vercel)              │
                    │  staging-backend-one.vercel.app│
                    │  Lưu kết quả vào Firestore    │
                    └───────────────────────────────┘
```

---

## 2. Các thành phần

| File | Vai trò | Phạm vi |
|---|---|---|
| `manifest.json` | Khai báo permissions, host, content scripts | Config |
| `config.js` | SERVER_URL (điểm cuối API) | Shared |
| `background.js` | Service Worker — toàn bộ logic xử lý | Background |
| `content-bridge.js` | Cầu nối Dashboard ↔ Extension | Content Script |
| `popup.js` | UI popup — hiển thị trạng thái | Popup |
| `popup.html` | Giao diện popup | Popup |

### Permissions

```json
permissions: ["tabs", "scripting", "storage", "alarms", "windows"]

host_permissions:
  - http://localhost:*/*
  - https://staging-backend-one.vercel.app/*
  - https://www.google.com/*
  - https://www.google.com.vn/*
```

---

## 3. Quy trình check ranking (End-to-end)

### Bước 1 — Dashboard khởi tạo Job

```
User nhấn "Check Google (Extension)"
  ↓
RankCheckerTab.tsx: startChecking()
  ↓
POST /api/rank-checker?action=create-job { projectId }
  ← { jobId: "abc123" }
  ↓
window.dispatchEvent(new CustomEvent('rank-checker-trigger', {
  detail: { jobId: "abc123", token: JWT }
}))
```

### Bước 2 — Content Bridge nhận lệnh

```
content-bridge.js lắng nghe 'rank-checker-trigger'
  ↓
Lấy JWT token (từ event.detail hoặc localStorage)
  ↓
chrome.runtime.sendMessage({ type: 'START_CHECKING', jobId, token })
  ↓ (retry tối đa 3 lần nếu lỗi)
background.js nhận message
```

### Bước 3 — Background Service Worker xử lý queue

```
background.js: startProcessing(jobId)
  ↓
Tạo cửa sổ Incognito (minimized, tọa độ ngoài màn hình)
  ↓
LOOP:
  GET /api/rank-checker?action=get-next-keyword&jobId=abc123
  ← { keyword, domain, keywordId, jobId, remaining, total }
  ↓
  checkKeywordAcrossPages(item, windowId)
  ↓
  POST /api/rank-checker?action=submit-result { jobId, keywordId, position, url }
  ↓
  Chờ 800–1500ms (random) → keyword tiếp theo
```

### Bước 4 — Dashboard poll kết quả

```
RankCheckerTab.tsx: setInterval(fetchJobStatus, 3000)
  ↓
GET /api/rank-checker?action=get-job-status&jobId=abc123
  ← { done, pending, total, jobs[] }
  ↓
Cập nhật UI + fetchRankings() (silent)
  ↓
Khi data.done = true → setIsChecking(false), hiển thị toast
```

---

## 4. Thuật toán check 1 keyword (`checkKeywordAcrossPages`)

Google đã bỏ qua tham số `&num=100`, vì vậy extension phải **paginate thủ công**.

```
Tối đa 10 trang × 10 kết quả = top 100

Trang 1: /search?q={keyword}&start=0   → vị trí 1–10
Trang 2: /search?q={keyword}&start=10  → vị trí 11–20
...
Trang 10: /search?q={keyword}&start=90 → vị trí 91–100

Tham số cố định: &hl=vi&gl=vn
```

**Luồng trong vòng lặp trang:**

```
Với mỗi trang (page = 0..9):
  1. Điều hướng incognito tab → URL tìm kiếm
     - Trang đầu: chrome.tabs.update(tabId, { url: firstUrl })
     - Trang sau: chrome.tabs.update(tabId, { url: nextUrl })
     (Reuse tab, không tạo mới để tránh focus window)
  
  2. Chờ tab load xong (waitForTabLoad, timeout 20s)
  
  3. Chờ thêm 400ms (ổn định DOM)
  
  4. Inject script vào tab → extractRankingFromPage(domain)
     ← { found, position, captcha, url, debug, strategy, totalResults }
  
  5. Phân tích kết quả:
     a. CAPTCHA → xử lý riêng (xem mục 5)
     b. found = true → tính vị trí tuyệt đối = startPos + position
                     → return ngay, dừng loop
     c. found = false → kiểm tra pageCount < 5 (hết SERP) → break
                      → chờ 1200–2000ms → trang tiếp theo
  
  6. Nếu đã qua tất cả 10 trang → return { found: false }
```

---

## 5. Thuật toán trích xuất kết quả từ trang Google (`extractRankingFromPage`)

Hàm này được **inject trực tiếp vào tab Google** (context của tab, không phải extension).

### 5.1 Kiểm tra CAPTCHA trước

Extension kiểm tra nhiều dấu hiệu CAPTCHA:

| Dấu hiệu | Cách phát hiện |
|---|---|
| Form CAPTCHA | `form#captcha-form`, `.g-recaptcha`, `[action*="sorry"]` |
| Text tiếng Anh | "detected unusual traffic", "unusual traffic from your computer" |
| Text tiếng Việt | "lưu lượng truy cập bất thường", "không phải một rô-bốt" |
| URL redirect | `google.com/sorry`, `/sorry/index` |
| Title trang | "Giới thiệu về trang", "Before you continue" |
| HTML ngắn | `html.length < 8000` và có chứa "recaptcha" |

→ Nếu phát hiện CAPTCHA: `return { found: false, captcha: true }`

### 5.2 Normalize domain

```javascript
norm(d) → hostname lowercase, bỏ "www."
Ví dụ: "https://www.Moodbiz.vn/blog" → "moodbiz.vn"
```

### 5.3 Lọc kết quả quảng cáo

Loại bỏ các link nằm trong:
- `#tads`, `#bottomads`, `#tadsb`
- `[data-text-ad]`
- `.commercial-unit`, `.ads-fr`

Loại bỏ các domain Google nội bộ:
`google.`, `youtube.com`, `gstatic.`, `gmail.com`, `blogger.com`, `translate.google`, `maps.google`

### 5.4 Thu thập links — 5 strategies song song

| Strategy | Selector | Ghi chú |
|---|---|---|
| `UWckNb` | `a[jsname="UWckNb"]` | Attribute của Google, ưu tiên cao nhất |
| `yuRUbf` | `.yuRUbf a[href^="http"]` | Class CSS của Google |
| `h3` | `h3` → `closest('a')` | Tiêu đề kết quả → link cha |
| `divG` | `div.g` top-level → `a[href^="http"]` | Khối kết quả chuẩn |
| `ping` | `a[ping][href^="http"]` | Link có ping attribute |

Tất cả links đều được **decode Google redirect**: `/url?q=REAL_URL` → `REAL_URL`

### 5.5 Tìm target domain

```
for strategy in ['UWckNb', 'yuRUbf', 'h3', 'divG', 'ping']:
  for link in strategy_links:
    if norm(link.hostname) == target
    OR norm(link.hostname).endsWith('.' + target)
    OR target.endsWith('.' + norm(link.hostname)):
      → targetLink = link; break
```

### 5.6 Tính vị trí (position counting)

**Phương pháp chính — `div.g` slot counting:**

```
1. Tìm div.g chứa targetLink
2. Leo lên div.g cha ngoài cùng (không nằm trong div.g khác)
3. Đếm tất cả div.g top-level không phải quảng cáo
4. position = indexOf(targetG) + 1
```

Lý do: Featured snippet, knowledge panel chiếm slot DOM nhưng không có `jsname="UWckNb"`, dùng array index sẽ bị lệch.

**Fallback — array index:** Nếu div.g counting thất bại, dùng vị trí của link trong mảng strategy.

**Vị trí tuyệt đối:**
```
absolute_position = (page * 10) + relative_position
```

---

## 6. Xử lý CAPTCHA

```
CAPTCHA phát hiện trên trang:
  ↓
1. setBadge('!', '#f59e0b')         ← Badge vàng cảnh báo
2. progressState.captchaDetected = true
3. Gửi STATUS_UPDATE → content-bridge → Dashboard hiện banner
4. Mở cửa sổ incognito (focus, 1024×768)
5. waitForCaptchaSolved(tabId, 120s):
     Poll tab.url mỗi 3s:
       - URL chứa "/sorry" hoặc "about:blank" → chưa giải
       - URL chứa "google.com/search" → đã giải!
  ↓
Nếu giải thành công (trong 2 phút):
  - Minimize lại cửa sổ incognito
  - Chờ 3s
  - Reload lại URL tìm kiếm
  - Tiếp tục extract kết quả bình thường
  ↓
Nếu hết 2 phút không giải:
  - Bỏ qua keyword hiện tại → keyword tiếp theo
```

---

## 7. Quản lý Incognito Window

Extension dùng **1 tab incognito persistent** cho toàn bộ job để tránh:
- Tạo tab mới → Chrome focus window → gây phiền
- Cookie/session tích lũy ảnh hưởng kết quả

```
getIncognitoWindow():
  Nếu đã có incognitoWindowId:
    - Kiểm tra window còn tồn tại không
    - Kiểm tra tab còn tồn tại không
    - Nếu cần → tạo tab mới trong window cũ
  Nếu chưa có:
    - Tạo window mới: incognito=true, left=-32000, top=-32000 (ngoài màn hình)
    - Minimize ngay
    → lưu incognitoWindowId, incognitoTabId

Fallback (nếu không bật Allow in Incognito):
  → Tạo cửa sổ thường (kết quả kém chính xác hơn)
```

---

## 8. Service Worker Keep-Alive

Service Worker của Manifest V3 có thể bị Chrome tắt sau 30s không hoạt động. Extension dùng:

```javascript
keepAliveSleep(ms):
  while (chưa hết ms):
    await sleep(200ms)
    chrome.runtime.getPlatformInfo()   ← ping Chrome API để giữ SW tỉnh
```

Ngoài ra có alarm `checkQueue` chạy mỗi 30 giây (0.5 phút) để giữ SW tỉnh và cập nhật badge.

---

## 9. Giao tiếp giữa các thành phần

### Dashboard → Extension (khởi động)

```
Dashboard (RankCheckerTab.tsx)
  window.dispatchEvent('rank-checker-trigger', { jobId, token })
    ↓
content-bridge.js (content script)
  chrome.runtime.sendMessage({ type: 'START_CHECKING', jobId, token })
    ↓
background.js
  startProcessing(jobId)
```

### Extension → Dashboard (real-time status)

```
background.js
  pushStatusToDashboard(keyword, captchaDetected)
    ↓ chrome.tabs.sendMessage({ type: 'STATUS_UPDATE' })
content-bridge.js
  window.dispatchEvent('rank-checker-status', { currentKeyword, captchaDetected })
    ↓
Dashboard
  EventListener 'rank-checker-status' → cập nhật UI
```

### Extension Detection (handshake)

```
Dashboard load:
  window.dispatchEvent('rank-checker-ping')
    ↓
content-bridge.js:
  window.dispatchEvent('rank-checker-ready', { version: '1.3.1' })
    ↓
Dashboard:
  setIsExtensionReady(true) → hiện dot xanh "Ready"
```

### Popup ↔ Background

```
Popup mở:
  chrome.runtime.sendMessage({ type: 'GET_STATUS' })
  ← { isProcessing, checked, found, total, currentKeyword, recentResults }

Popup nhấn Start:
  chrome.runtime.sendMessage({ type: 'START_CHECKING', token })

Popup nhấn Stop:
  POST /api/rank-checker?action=cancel-job   ← xóa queue server
  (background tự dừng sau keyword hiện tại)
```

---

## 10. Badge trạng thái

| Badge | Màu | Ý nghĩa |
|---|---|---|
| `⏳` (số đang xử lý) | Xanh `#3b82f6` | Đang kiểm tra |
| `!` | Vàng `#f59e0b` | CAPTCHA phát hiện |
| `✓` | Xanh lá `#22c55e` | Hoàn thành |
| `!` | Đỏ `#ef4444` | Lỗi |
| (số job pending) | Đỏ `#ef4444` | Có job chờ trên server |
| (trống) | — | Không có gì |

---

## 11. API Endpoints (Server)

Base URL: `https://staging-backend-one.vercel.app/api`

| Method | Action | Mô tả |
|---|---|---|
| `GET` | `get-next-keyword?jobId=` | Lấy keyword tiếp theo trong queue |
| `POST` | `submit-result` | Gửi kết quả 1 keyword |
| `GET` | `get-job-status?jobId=` | Trạng thái job (done, pending, total) |
| `POST` | `cancel-job` | Hủy tất cả job đang pending |
| `GET` | `get-projects?brandId=` | Danh sách projects |
| `POST` | `manage-projects` | CRUD project (add/update/delete) |
| `GET` | `get-keywords?projectId=` | Danh sách keywords |
| `POST` | `manage-keywords` | CRUD keyword (add/bulk-add/delete) |
| `GET` | `get-rankings?projectId=` | Kết quả ranking mới nhất |
| `POST` | `create-job` | Tạo job mới cho 1 project |
| `GET` | `health` | Health check server |

Tất cả request cần header: `Authorization: Bearer {JWT_TOKEN}`

---

## 12. Cấu trúc dữ liệu

### Item từ queue (`get-next-keyword`)

```typescript
{
  keyword: string;      // từ khóa cần kiểm tra
  domain: string;       // domain cần tìm, vd: "moodbiz.vn"
  keywordId: string;    // ID trong Firestore
  jobId: string;        // ID job hiện tại
  remaining: number;    // số keyword còn lại (không tính item này)
  total: number;        // tổng số keyword trong job
}
```

### Kết quả 1 keyword (`submit-result`)

```typescript
{
  jobId: string;
  keywordId: string;
  keyword: string;
  position: number | null;   // null nếu không tìm thấy trong top 100
  url: string | null;        // URL kết quả tìm thấy
}
```

### progressState (trong background.js)

```typescript
{
  checked: number;           // số keyword đã xử lý
  found: number;             // số keyword tìm thấy vị trí
  total: number;             // tổng số keyword của job
  currentKeyword: string;    // keyword đang xử lý
  currentDomain: string;     // domain đang kiểm tra
  recentResults: Array<{     // tối đa 20 kết quả gần nhất
    keyword: string;
    position: number | null;
  }>;
  captchaDetected: boolean;
}
```

---

## 13. Vị trí màu thứ hạng (UI)

| Vị trí | Màu popup | Màu dashboard |
|---|---|---|
| #1 – #3 | Vàng `#fbbf24` | `bg-amber-100 text-amber-700` |
| #4 – #10 | Xanh lá `#22c55e` | `bg-emerald-100 text-emerald-700` |
| #11 – #30 | Xanh dương `#60a5fa` | `bg-blue-100 text-blue-700` |
| #31 – #100 | Xám | `bg-slate-100 text-slate-500` |
| Không có | Gạch ngang | `N/A` in nghiêng |

---

## 14. Thời gian xử lý ước tính

| Số keyword | Thời gian (không CAPTCHA) |
|---|---|
| 10 kw (top 10 tất cả) | ~15–20 giây |
| 10 kw (top 100 tất cả) | ~2–3 phút |
| 100 kw (top 10 trung bình) | ~3–4 phút |
| 100 kw (top 100 tất cả) | ~20–30 phút |

- Mỗi trang Google: ~1–2s (load + 400ms chờ DOM)
- Delay giữa các keyword: 800–1500ms (random)
- Delay giữa các trang: 1200–2000ms (random)
- CAPTCHA: tối đa 2 phút chờ user giải

---

## 15. Lưu ý triển khai

1. **Phải bật "Allow in Incognito"** trong `chrome://extensions/` → Moodbiz Rank Checker → Enable incognito để tránh session/cookie ảnh hưởng kết quả.

2. **Không đóng popup trong khi chạy** — popup đang poll status. Background vẫn chạy nhưng popup sẽ mất kết nối real-time.

3. **Đổi SERVER_URL** khi deploy: sửa `config.js` → `const SERVER_URL = '...'`

4. **Host permissions** phải khớp với domain backend — hiện tại chỉ whitelist `staging-backend-one.vercel.app`.

5. **Chrome giới hạn Service Worker** có thể bị tắt. Extension dùng keepAliveSleep để giảm thiểu, nhưng với job rất dài (500+ keywords) có thể cần cơ chế resume.
