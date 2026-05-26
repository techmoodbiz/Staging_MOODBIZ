# Moodbiz Rank Checker — Tài liệu Phần mềm & Hướng dẫn Triển khai

---

## MỤC LỤC

1. [Tổng quan phần mềm](#1-tổng-quan)
2. [Kiến trúc hệ thống](#2-kiến-trúc)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Các thành phần chi tiết](#4-các-thành-phần)
5. [Cơ sở dữ liệu](#5-cơ-sở-dữ-liệu)
6. [API Endpoints](#6-api-endpoints)
7. [Luồng hoạt động](#7-luồng-hoạt-động)
8. [Hướng dẫn triển khai](#8-hướng-dẫn-triển-khai)
9. [Cài đặt Chrome Extension](#9-cài-đặt-extension)
10. [Công cụ Debug Simulator](#10-debug-simulator)
11. [Xử lý sự cố](#11-xử-lý-sự-cố)

---

## 1. TỔNG QUAN

### Giới thiệu

**Moodbiz Rank Checker** là phần mềm theo dõi thứ hạng từ khóa trên Google Search cho một hoặc nhiều website. Phần mềm giúp người dùng biết website của mình đang đứng ở vị trí nào trong top 100 kết quả tìm kiếm Google cho các từ khóa đã chọn.

### Vấn đề giải quyết

- Google cá nhân hóa kết quả tìm kiếm dựa trên lịch sử duyệt web, tài khoản đăng nhập và vị trí địa lý → kết quả check thủ công không phản ánh thứ hạng thật
- Các công cụ check ranking thương mại (SEMrush, Ahrefs...) tốn kém
- Cần một giải pháp nhẹ, chạy local, miễn phí và cho kết quả trung lập

### Giải pháp

Sử dụng **Chrome Extension** chạy trong chế độ **Ẩn danh (Incognito)** để tìm kiếm Google — đảm bảo kết quả hoàn toàn trung lập, không bị ảnh hưởng bởi lịch sử cá nhân. Extension đọc DOM trực tiếp từ trang Google và gửi kết quả về server local.

### Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| Quản lý nhiều website | Thêm/xóa domain, theo dõi song song |
| Quản lý từ khóa | Thêm từng từ hoặc bulk paste danh sách |
| Check top 100 | Paginate qua 10 trang Google (start=0 đến start=90) |
| Kết quả trung lập | Bắt buộc dùng incognito window |
| Lưu lịch sử | Mỗi lần check = 1 bản ghi trong DB |
| Dashboard trực quan | Bảng xếp hạng với màu sắc theo vị trí |
| Debug Simulator | Tool kiểm tra logic extraction không cần mở Google thật |

---

## 2. KIẾN TRÚC

### Sơ đồ hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                     NGƯỜI DÙNG                              │
│                   (Chrome Browser)                          │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐        ┌──────────────────────┐
│   Dashboard UI   │        │  Chrome Extension    │
│  localhost:5000  │◄──────►│  Moodbiz Rank Checker│
│  (client/index   │  Event │  (Manifest V3)       │
│   .html)         │  Bridge│                      │
└────────┬─────────┘        └──────────┬───────────┘
         │                             │
         │ HTTP API                    │ Mở tab ẩn danh
         ▼                             ▼
┌──────────────────┐        ┌──────────────────────┐
│   Express Server │        │  Google.com          │
│   server.js      │        │  (Incognito tab)     │
│   :5000          │        │                      │
└────────┬─────────┘        └──────────────────────┘
         │
         ▼
┌──────────────────┐
│   SQLite DB      │
│   db/rankings.db │
└──────────────────┘
```

### Tech Stack

| Thành phần | Công nghệ | Phiên bản |
|-----------|-----------|-----------|
| Backend Server | Node.js + Express.js | Express 5.2.1 |
| Frontend Dashboard | HTML/CSS/JS thuần + Tailwind CSS | CDN |
| Cơ sở dữ liệu | SQLite | sqlite3 6.0.1 |
| Browser Automation | Chrome Extension Manifest V3 | - |
| Runtime | Node.js | ≥ 18 |

### Tại sao dùng Chrome Extension thay vì Headless Browser?

| Tiêu chí | Playwright/Puppeteer | Chrome Extension |
|----------|---------------------|-----------------|
| CAPTCHA | Dễ bị chặn | Rất khó bị chặn (dùng Chrome thật) |
| Tốc độ setup | Cài ~500MB driver | Chỉ cần load extension |
| Độ tin cậy | Bị detect bởi Google | Giống user thật |
| Incognito | Cần cấu hình phức tạp | Native support |
| Tài nguyên | RAM cao (headless Chrome) | Dùng Chrome đang mở |

---

## 3. CẤU TRÚC THƯ MỤC

```
check ranking\
│
├── server.js                 # Server Express chính — API + job queue
├── package.json              # Dependencies: express, sqlite3, cors, dotenv
├── .env                      # Biến môi trường (PORT, etc.)
├── README.md                 # Tài liệu này
│
├── db\
│   ├── schema.js             # Khởi tạo DB, tạo bảng, migration
│   ├── rankings.js           # Tất cả hàm truy vấn DB
│   └── rankings.db           # File SQLite (tự tạo khi chạy lần đầu)
│
├── client\
│   └── index.html            # Dashboard UI (vanilla HTML/JS + Tailwind)
│
├── extension\
│   ├── manifest.json         # Chrome Extension v3 config
│   ├── background.js         # Service Worker — engine xử lý chính
│   ├── content-bridge.js     # Content Script — cầu nối dashboard↔extension
│   ├── popup.html            # UI popup của extension
│   └── popup.js              # Logic popup
│
└── test\
    └── simulator.html        # Tool debug extraction logic
```

---

## 4. CÁC THÀNH PHẦN

### 4.1 Server (`server.js`)

Server Express chạy ở port 5000, phục vụ hai chức năng:
1. **Serve static files**: Dashboard UI (`/client/`), Simulator (`/test/`)
2. **REST API**: Quản lý sites, keywords, rankings và job queue cho extension

### 4.2 Dashboard UI (`client/index.html`)

Giao diện web không cần build, chạy bằng Tailwind CDN. Gồm:

**Layout 2 cột:**
- **Sidebar trái**: Form thêm website + danh sách websites đã thêm
- **Vùng chính**: Panel keywords + Panel rankings

**Panel Keywords** (khi chọn website):
- Form thêm từ khóa đơn lẻ
- Textarea bulk paste (mỗi dòng 1 từ khóa)
- Nút "🔍 Check Google Rankings (Extension)"
- Danh sách từ khóa với nút xóa

**Panel Rankings** (khi có kết quả):
- 4 stat cards: Tổng / Top 3 / Top 10 / Không tìm thấy
- Dropdown sắp xếp: Vị trí / A→Z / Mới nhất
- Bảng kết quả với badge màu:
  - 🟡 Vàng: #1–3
  - 🟢 Xanh lá: #4–10
  - 🔵 Xanh dương: #11–30
  - ⚫ Xám: >30 hoặc không có

**Modal Check Rankings**:
- Hiển thị tiến trình real-time (cập nhật mỗi 2 giây)
- Progress bar theo %
- Log 8 kết quả gần nhất
- Hướng dẫn chi tiết khi gặp lỗi `no_incognito`

### 4.3 Chrome Extension

**Gồm 4 file chính:**

#### `manifest.json`
Khai báo permissions cần thiết:
```json
{
  "manifest_version": 3,
  "permissions": ["tabs", "scripting", "storage", "alarms", "windows"],
  "host_permissions": [
    "http://localhost:5000/*",
    "https://www.google.com/*"
  ],
  "content_scripts": [{
    "matches": ["http://localhost:5000/*"],
    "js": ["content-bridge.js"]
  }]
}
```

#### `content-bridge.js` — Cầu nối Dashboard ↔ Extension
- Chạy trên trang `localhost:5000` như content script
- Nhận lệnh từ dashboard qua `CustomEvent` (`rank-checker-trigger`)
- Chuyển lệnh sang background service worker qua `chrome.runtime.sendMessage`
- Gửi phản hồi lại dashboard qua `rank-checker-ack` event
- Retry tối đa 3 lần (service worker có thể đang sleep)
- Dừng ngay nếu lỗi `no_incognito` (không retry)

#### `background.js` — Engine xử lý chính

**Quản lý cửa sổ Incognito:**
```
getIncognitoWindow()
├── Kiểm tra window cũ còn tồn tại không
├── Xác nhận win.incognito === true
└── Tạo mới nếu cần (state: minimized, focused: false)
```

**Chiến lược phân trang Google (Top 100):**
```
Google KHÔNG hỗ trợ &num=100 → chỉ trả 10 kết quả/trang

Trang 1: start=0   → vị trí  1–10
Trang 2: start=10  → vị trí 11–20
Trang 3: start=20  → vị trí 21–30
...
Trang 10: start=90 → vị trí 91–100

Dừng sớm khi: tìm thấy target HOẶC trang có < 5 kết quả
```

**Logic trích xuất vị trí (`extractRankingFromPage`):**

Được inject vào tab Google qua `chrome.scripting.executeScript`, chạy bên trong trang.

*Bước 1 — Phát hiện CAPTCHA:*
- Kiểm tra `form#captcha-form`, `.g-recaptcha`, text "detected unusual traffic"
- Nếu có → trả về `{ captcha: true }` → focus tab → chờ user giải (tối đa 60 giây)

*Bước 2 — Scroll trang:*
- Scroll 6 lần để kích hoạt lazy-load DOM

*Bước 3 — Thu thập links theo 5 strategies (ưu tiên từ cao xuống thấp):*

| Strategy | Selector | Đặc điểm |
|----------|----------|----------|
| `UWckNb` | `a[jsname="UWckNb"]` | **Tốt nhất** — chỉ organic title links |
| `yuRUbf` | `.yuRUbf a[href^="http"]` | Stable 2020–2025 |
| `h3` | `h3 → closest a` | Fallback qua heading |
| `divG` | `div.g top-level → first link` | Theo block kết quả |
| `ping` | `a[ping][href^="http"]` | **Cuối cùng** — bao gồm sitelinks |

*Bước 4 — Đếm vị trí chính xác bằng div.g slot counting:*

> **Vấn đề**: Google hiển thị các khối đặc biệt (Experiences, Featured Snippet, Things to do...) chiếm SERP slot nhưng KHÔNG có `jsname="UWckNb"` → nếu dùng index mảng UWckNb sẽ sai vị trí

> **Giải pháp**: Sau khi tìm thấy target bằng UWckNb, leo lên `div.g` cha ngoài cùng, đếm số `div.g` top-level trước nó → đây là vị trí thật (khớp với SEOquake)

```
Tìm target anchor → closest div.g → leo lên top-level div.g
→ đếm allTopGs.indexOf(targetG) + 1 = vị trí tuyệt đối
```

*Bước 5 — Lọc ads:*
- `isInsideAd()`: traverse lên DOM, tìm `#tads`, `#bottomads`, `#tadsb`, `[data-text-ad]`

*Bước 6 — Lọc Google-owned domains:*
- Bỏ qua: `google.*`, `youtube.com`, `gstatic.*`, `gmail.com`, `maps.google`, etc.

**Kết quả trả về:**
```javascript
{ found: true/false, position: 1-10, url: "...", strategy: "UWckNb", totalResults: 10 }
// position là vị trí TƯƠNG ĐỐI trong trang hiện tại
// Caller sẽ cộng thêm startPos để ra vị trí TUYỆT ĐỐI
```

#### `popup.html` + `popup.js` — Popup Extension

- Kiểm tra kết nối server (`/api/health`)
- Hiển thị trạng thái: idle / có jobs / đang xử lý
- Nút "▶ Bắt đầu kiểm tra" khởi động background
- Hiện log kết quả real-time khi đang chạy
- Cảnh báo CAPTCHA với hướng dẫn

### 4.4 Debug Simulator (`test/simulator.html`)

Tool debug chạy tại `http://localhost:5000/test/simulator.html`

**Tab 1 — Giả lập HTML:**
- Tạo fake Google SERP với vị trí target tùy chỉnh
- Hỗ trợ: quảng cáo, sitelinks, PAA, Featured Snippet
- Giả lập multi-page (10 trang × 10 kết quả)
- Hiển thị bảng so sánh từng strategy

**Tab 2 — Paste HTML thật:**
- Paste HTML từ `Ctrl+U` trên trang Google (dùng URL `start=0`, `start=10`...)
- Chọn trang đang paste để tính vị trí tuyệt đối đúng
- Cảnh báo nếu < 20 kết quả (paste sai trang)
- Chẩn đoán DOM: kiểm tra các selector có tồn tại không

**Tab 3 — So sánh live:**
- Load danh sách sites từ server
- Hiển thị rankings mới nhất từ DB
- Nút "🧪 Simulate" để test từ khóa cụ thể

---

## 5. CƠ SỞ DỮ LIỆU

File: `db/rankings.db` (SQLite, tự tạo khi server khởi động lần đầu)

### Bảng `sites`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto increment |
| domain | TEXT UNIQUE | Domain đã normalize (không có https://, www., trailing /) |
| name | TEXT | Tên hiển thị |
| gscUrl | TEXT | URL Google Search Console (tùy chọn, hiện chưa dùng) |
| createdAt | DATETIME | Thời điểm thêm |
| lastChecked | DATETIME | Thời điểm check rankings gần nhất |

### Bảng `keywords`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto increment |
| siteId | INTEGER FK | Tham chiếu đến sites.id (CASCADE DELETE) |
| keyword | TEXT | Từ khóa cần theo dõi |
| createdAt | DATETIME | Thời điểm thêm |

*Constraint: UNIQUE(siteId, keyword) — không cho phép từ khóa trùng trong cùng 1 site*

### Bảng `rankings`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto increment |
| keywordId | INTEGER FK | Tham chiếu đến keywords.id (CASCADE DELETE) |
| position | REAL | Vị trí trên Google (1–100, NULL nếu không tìm thấy) |
| clicks | INTEGER | Số click từ GSC (hiện chưa dùng, mặc định 0) |
| impressions | INTEGER | Số hiển thị từ GSC (hiện chưa dùng, mặc định 0) |
| ctr | REAL | Tỷ lệ click-through từ GSC (hiện chưa dùng, mặc định 0) |
| checkedAt | DATETIME | Thời điểm check |

*Mỗi lần check tạo 1 bản ghi mới → giữ nguyên lịch sử*

### Query quan trọng — Lấy ranking mới nhất mỗi keyword:
```sql
SELECT k.id, k.keyword, s.domain,
       r.position, r.checkedAt
FROM keywords k
JOIN sites s ON k.siteId = s.id
LEFT JOIN rankings r ON k.id = r.keywordId
  AND r.checkedAt = (
    SELECT MAX(r2.checkedAt) FROM rankings r2 WHERE r2.keywordId = k.id
  )
WHERE s.id = ?
ORDER BY
  CASE WHEN r.position IS NULL THEN 9999 ELSE r.position END ASC,
  k.keyword ASC
```

---

## 6. API ENDPOINTS

Base URL: `http://localhost:5000`

### Sites

| Method | Endpoint | Mô tả | Body/Params |
|--------|----------|-------|-------------|
| GET | `/api/sites` | Danh sách tất cả sites | — |
| POST | `/api/sites` | Thêm website mới | `{domain, name?}` |
| GET | `/api/sites/:id` | Chi tiết 1 site | — |
| DELETE | `/api/sites/:id` | Xóa site + keywords + rankings | — |

*POST tự động normalize domain: bỏ `https://`, `www.`, trailing `/`*

### Keywords

| Method | Endpoint | Mô tả | Body |
|--------|----------|-------|------|
| GET | `/api/keywords/:siteId` | Danh sách keywords của site | — |
| POST | `/api/keywords` | Thêm 1 keyword | `{siteId, keyword}` |
| POST | `/api/keywords/bulk` | Thêm nhiều keywords | `{siteId, keywords: []}` |
| DELETE | `/api/keywords/:id` | Xóa 1 keyword | — |

### Rankings

| Method | Endpoint | Mô tả | Query |
|--------|----------|-------|-------|
| GET | `/api/rankings/:siteId` | Rankings mới nhất mỗi keyword | — |
| GET | `/api/history/:keywordId` | Lịch sử ranking | `?limit=30` |

### Check Queue (Extension)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/check-queue` | Tạo job check rankings | `{siteId}` |
| GET | `/api/check-queue/next` | Extension lấy keyword tiếp theo | — |
| POST | `/api/check-results` | Extension gửi kết quả | `{jobId, keywordId, keyword, position, url, error}` |
| GET | `/api/check-status/:jobId` | Dashboard poll tiến trình | — |
| GET | `/api/check-queue/status` | Tổng quan queue (cho badge) | — |
| DELETE | `/api/check-queue/:jobId` | Hủy job | — |

### Hệ thống

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/health` | Health check | — |
| GET | `/test/simulator.html` | Debug tool | — |

---

## 7. LUỒNG HOẠT ĐỘNG

### Luồng đầy đủ khi người dùng click "Check Rankings"

```
[1] User click "🔍 Check Google Rankings"
    │
    ▼
[2] Dashboard → POST /api/check-queue {siteId}
    Server tạo job trong RAM (Map), gán jobId, copy danh sách keywords → pending[]
    Server trả về: { jobId, total: N, domain }
    │
    ▼
[3] Dashboard dispatch CustomEvent "rank-checker-trigger" {jobId}
    │
    ▼
[4] content-bridge.js bắt event → chrome.runtime.sendMessage { type: "START_CHECKING" }
    (retry tối đa 3 lần nếu service worker chưa sẵn sàng)
    │
    ▼
[5] background.js: startProcessing()
    ├── Kiểm tra incognito window → nếu không có → trả lỗi no_incognito
    └── Tạo/tái sử dụng incognito window (minimized)
    │
    ▼
[6] Loop: GET /api/check-queue/next → nhận keyword
    │
    ▼
[7] checkKeywordAcrossPages(keyword, domain, winId):
    ├── Mở tab: google.com/search?q=KEYWORD&start=0
    ├── Chờ load (timeout 20s) + render DOM (1.2s)
    ├── Inject extractRankingFromPage(domain)
    │   ├── Scroll 6 lần → lazy-load
    │   ├── CAPTCHA? → focus tab → chờ user giải (tối đa 60s)
    │   ├── Thu thập links: UWckNb > yuRUbf > h3 > divG > ping
    │   ├── Tìm target domain
    │   └── Đếm vị trí = div.g slot counting
    ├── Nếu tìm thấy: absPos = startPos + relativePos → RETURN
    ├── Nếu < 5 kết quả: BREAK (hết top 100)
    ├── Delay 800–1400ms → navigate start=10 → lặp lại
    └── Tối đa 10 trang (top 100)
    │
    ▼
[8] POST /api/check-results { jobId, keywordId, position, url }
    Server lưu vào DB → cập nhật job.completed[]
    │
    ▼
[9] Delay 1500–2500ms → [6] keyword tiếp theo
    │
    ▼
[10] Hết queue → đóng incognito window → badge "✓"
     Server cập nhật sites.lastChecked
    │
    ▼
[11] Dashboard (đang poll /api/check-status/jobId mỗi 2s)
     Thấy done: true → refresh bảng rankings → show "✅ Xem Rankings"
```

### Cơ chế Job Queue (In-Memory)

```javascript
checkJobs = Map {
  "job_1234_abc": {
    jobId, siteId, domain, total,
    pending: [...keywords],   // chưa xử lý
    completed: [...results],  // đã xử lý (có position)
    createdAt
  }
}
```

> ⚠️ **Lưu ý**: Job queue lưu trong RAM — nếu server restart, các job đang chạy sẽ mất

---

## 8. HƯỚNG DẪN TRIỂN KHAI

### Yêu cầu hệ thống

| Thành phần | Yêu cầu |
|-----------|---------|
| OS | Windows 10/11 (đã test) hoặc macOS/Linux |
| Node.js | ≥ 18.0.0 |
| npm | ≥ 8.0.0 |
| Browser | Google Chrome (không phải Chromium, Edge) |
| RAM | Tối thiểu 4GB |
| Disk | ~100MB cho node_modules |

### Bước 1: Cài đặt Node.js

Tải và cài đặt Node.js LTS từ https://nodejs.org/

Kiểm tra:
```bash
node --version   # phải ≥ v18
npm --version    # phải ≥ v8
```

### Bước 2: Chuẩn bị source code

```bash
# Clone hoặc copy thư mục vào máy
# Ví dụ: D:\ViberCode\check ranking\

cd "D:\ViberCode\check ranking"
```

### Bước 3: Cài dependencies

```bash
npm install
```

Kiểm tra không có lỗi. Các package cần có:
- `express` — HTTP server
- `sqlite3` — Database
- `cors` — Cross-origin
- `dotenv` — Biến môi trường

### Bước 4: Tạo file .env

Tạo file `.env` tại thư mục gốc:

```env
PORT=5000
NODE_ENV=production
```

*(Nếu đã có file `.env`, bỏ qua bước này)*

### Bước 5: Khởi động server

```bash
# Cách 1: Chạy thường (sẽ dừng khi đóng terminal)
npm start

# Cách 2: Chạy nền bằng pm2 (khuyến nghị cho production)
npm install -g pm2
pm2 start server.js --name "rank-checker"
pm2 save
pm2 startup   # Tự khởi động cùng Windows
```

Kết quả thành công:
```
🚀 Rank Checker: http://localhost:5000
✅ Database khởi tạo xong
```

### Bước 6: Kiểm tra server

Mở browser, vào: `http://localhost:5000/api/health`

Kết quả mong đợi:
```json
{"status":"ok","dbReady":true,"method":"Chrome Extension","pendingJobs":0}
```

### Bước 7: Mở Dashboard

Vào `http://localhost:5000` trong Chrome — Dashboard sẽ hiện ra.

---

## 9. CÀI ĐẶT EXTENSION

### Bước 1: Mở trang Extensions trong Chrome

Nhập vào thanh địa chỉ: `chrome://extensions/`

### Bước 2: Bật Developer Mode

Toggle **Developer mode** (góc trên bên phải) → **ON**

### Bước 3: Load extension

Click **"Load unpacked"** → chọn thư mục:
```
D:\ViberCode\check ranking\extension\
```

→ Extension "Moodbiz Rank Checker" xuất hiện trong danh sách.

### Bước 4: Bật quyền Incognito

> **Bắt buộc** — nếu bỏ qua bước này, kết quả check sẽ bị ảnh hưởng bởi lịch sử cá nhân

1. Click **"Details"** trên extension Moodbiz Rank Checker
2. Cuộn xuống tìm **"Allow in Incognito"**
3. Toggle → **ON**

### Bước 5: Ghim extension lên toolbar

Click icon puzzle 🧩 trên toolbar → ghim "Moodbiz Rank Checker"

### Kiểm tra extension hoạt động

1. Vào `http://localhost:5000`
2. Click icon extension → popup hiện "✅ Server OK"
3. Nếu thấy "Offline" → kiểm tra server có đang chạy không

### Reload extension sau khi update code

Khi có thay đổi trong thư mục `extension/`:
- Vào `chrome://extensions/`
- Click nút 🔄 Reload trên extension

---

## 10. DEBUG SIMULATOR

Truy cập: `http://localhost:5000/test/simulator.html`

### Khi nào cần dùng?

- Extension trả về vị trí sai hoặc không tìm thấy domain
- Muốn kiểm tra logic extraction mà không cần mở Google thật
- Google vừa thay đổi cấu trúc HTML → cần verify selectors

### Tab 2: Paste HTML thật (quan trọng nhất)

**Cách lấy HTML đúng:**
```
1. Mở Chrome Incognito
2. Dán URL: https://www.google.com/search?q=TỪ_KHÓA&start=0
   (Trang 2: start=10, Trang 3: start=20, ...)
3. Đợi trang load xong
4. Ctrl+U → mở tab source
5. Ctrl+A → Ctrl+C
6. Dán vào ô textarea trong Tab 2
7. Chọn đúng trang đang paste (dropdown "Trang 1/2/3...")
8. Nhập domain cần tìm → Click "🔍 Phân tích HTML"
```

> ⚠️ **Lưu ý**: Phải dùng `start=0` chứ KHÔNG dùng `&num=100` — Google đã bỏ support tham số này, chỉ trả 10 kết quả/trang

### Đọc kết quả

| Màu header | Ý nghĩa |
|------------|---------|
| 🟢 Xanh | Tìm thấy đúng vị trí |
| 🟡 Vàng | Tìm thấy nhưng vị trí khác mong đợi |
| 🔴 Đỏ | Không tìm thấy |

Bảng "Kết quả từng strategy":
- ★ = Strategy đang được áp dụng
- Số links = bao nhiêu kết quả strategy này tìm được
- Vị trí tìm được = domain xuất hiện ở đâu trong strategy này

---

## 11. XỬ LÝ SỰ CỐ

### Lỗi: "Extension chưa phản hồi"

**Nguyên nhân**: Service worker của extension đang sleep  
**Cách fix**: Click icon extension trên toolbar → "▶ Bắt đầu kiểm tra" → quay lại dashboard → thử lại

---

### Lỗi: "Cần bật Allow in Incognito"

**Nguyên nhân**: Extension không được phép tạo cửa sổ ẩn danh  
**Cách fix**:
1. `chrome://extensions/` → Moodbiz Rank Checker → **Details**
2. **Allow in Incognito** → ON
3. Reload extension (nút 🔄)
4. Thử lại

---

### Kết quả sai (vị trí lệch so với thực tế)

**Nguyên nhân có thể**:
1. Không dùng incognito → Google cá nhân hóa kết quả
2. Check tại IP/vị trí khác với thực tế
3. Google vừa cập nhật cấu trúc HTML → cần verify với Simulator Tab 2

**Cách debug**:
- Dùng Tab 2 của Simulator: paste HTML từ `start=0` → xem có tìm thấy domain không
- Kiểm tra "Chẩn đoán DOM": nếu `a[jsname="UWckNb"] = 0` → Google đổi jsname

---

### CAPTCHA khi check

**Nguyên nhân**: Check quá nhiều keywords liên tục, Google nghi ngờ bot  
**Cách xử lý**:
1. Extension sẽ tự động focus tab Google bị CAPTCHA
2. Giải CAPTCHA thủ công
3. Extension tự động tiếp tục sau khi CAPTCHA được giải (timeout 60s)

**Phòng tránh**:
- Không check quá 50 keywords trong 1 lần
- Tăng delay giữa các keyword trong `background.js` nếu cần
- Để Chrome đang mở các tab thông thường (hành vi tự nhiên hơn)

---

### Server không khởi động

```bash
# Kiểm tra port 5000 có bị dùng chưa
netstat -ano | findstr :5000

# Kill process đang dùng port 5000
npx kill-port 5000

# Khởi động lại
npm start
```

---

### Reset database

```bash
# Xóa file DB và để server tự tạo lại
del "D:\ViberCode\check ranking\db\rankings.db"
npm start
```

> ⚠️ **Cảnh báo**: Thao tác này xóa toàn bộ dữ liệu (sites, keywords, rankings history)

---

## PHỤ LỤC: THÔNG SỐ KỸ THUẬT

| Thông số | Giá trị |
|----------|---------|
| Port server | 5000 (mặc định) |
| Trang check/keyword | Tối đa 10 trang (100 kết quả) |
| Delay giữa các trang | 800–1400ms (random) |
| Delay giữa các keywords | 1500–2500ms (random) |
| Timeout load tab | 20 giây |
| Thời gian chờ DOM render | 1200ms |
| Thời gian chờ giải CAPTCHA | 60 giây (12 lần × 5s) |
| Tự xóa job cũ | Sau 60 phút hoàn thành |
| Dọn job cũ định kỳ | Mỗi 30 phút |
| Poll dashboard | Mỗi 2 giây |
| Giới hạn lịch sử | 30 bản ghi mới nhất/keyword (default) |

---

*Tài liệu này mô tả phiên bản hiện tại của Moodbiz Rank Checker — April 2026*
