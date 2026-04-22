
# MOODBIZ Portal - AI-Powered Digital Growth Partner System

**MOODBIZ Portal** là nền tảng quản trị thương hiệu và sáng tạo nội dung tích hợp AI (GenAI), được thiết kế để giúp doanh nghiệp duy trì sự nhất quán về giọng văn (Tone of Voice), tự động hóa quy trình viết bài và kiểm duyệt nội dung (Audit) theo tiêu chuẩn 4 lớp.

---

## 🚀 Tính Năng Cốt Lõi (Core Features)

### 1. Quản Trị Thương Hiệu (Brand Management)
*   **Brand Identity:** Quản lý Logo, Màu sắc, Slogan, Định vị (Positioning), USP.
*   **AI Rules:** Cấu hình Tính cách thương hiệu (Personality), Giọng văn (Tone of Voice), Từ nên dùng (Do-words) và Từ cấm (Don't-words).
*   **Guideline Ingestion (RAG):**
    *   Upload tài liệu PDF/DOCX hoặc quét Website để tự động trích xuất thông tin thương hiệu.
    *   **Semantic Chunking:** Hệ thống tự động cắt nhỏ tài liệu theo ngữ nghĩa (thay vì cắt theo ký tự cố định) để tối ưu hóa khả năng hiểu của AI.
    *   Lưu trữ Vector Embedding để phục vụ tra cứu ngữ cảnh (Retrieval-Augmented Generation).

### 2. Content Generator (Tạo Nội Dung Thông Minh)
*   **Multi-Platform:** Hỗ trợ tạo nội dung cho Facebook, LinkedIn, Email Marketing, SEO Blog.
*   **Context-Aware:** AI tự động đọc hiểu dữ liệu sản phẩm, chân dung khách hàng (Persona) và quy chuẩn thương hiệu để viết bài.
*   **Learning from Mistakes (4-Layer Risk Control):**
    *   Hệ thống tự động học từ các lỗi sai trong quá khứ (dựa trên lịch sử Audit) để đưa vào "Negative Constraints" trong Prompt, giúp AI không lặp lại lỗi cũ.
*   **Citation:** Trích dẫn nguồn (Source) từ tài liệu Guideline gốc để đảm bảo tính xác thực.

### 3. Content Auditor (Kiểm Duyệt Nội Dung)
Hệ thống kiểm duyệt "Surface-First" độc quyền với 4 lớp phòng vệ:
1.  **Lớp 1 - Language (Ngôn ngữ):** Kiểm tra lỗi chính tả, đánh máy, dấu câu, format cơ bản.
2.  **Lớp 2 - Brand (Thương hiệu):** Đối soát Tone & Voice, từ cấm, quy tắc xưng hô.
3.  **Lớp 3 - Product (Sản phẩm):** Kiểm tra sai lệch thông tin kỹ thuật, giá bán, tính năng (chống Hallucination về dữ kiện).
4.  **Lớp 4 - AI Logic:** Kiểm tra tính logic, mâu thuẫn nội tại và các lỗi suy diễn của AI.

### 4. Quản Lý Tài Nguyên (Resource Management)
*   **Products & Services:** Quản lý danh mục sản phẩm/dịch vụ, USP, và lợi ích (Benefits).
*   **Audience Personas:** Định nghĩa chân dung khách hàng mục tiêu, nỗi đau (Pain points) và mục tiêu (Goals).
*   **User Management (RBAC):** Phân quyền chi tiết:
    *   `Admin`: Quản trị toàn hệ thống.
    *   `Brand Owner`: Quản lý thương hiệu và nhân sự của mình.
    *   `Content Creator`: Chỉ được truy cập vào Brand được phân công.
    *   `Viewer`: Chỉ xem báo cáo.

---

## 🛠 Tech Stack (Công Nghệ Sử Dụng)

### Frontend
*   **Framework:** React 19 (Vite)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** Lucide React (Icons), Custom Modal/Select components.

### Backend & API (Serverless)
*   **Runtime:** Node.js (Vercel Serverless Functions)
*   **AI Models:**
    *   `gemini-2.0-flash`: Dùng cho phân tích Website/File tốc độ cao.
    *   `gemini-3-flash-preview`: Dùng cho Generator và Auditor (Reasoning cao).
    *   `embedding-001`: Dùng để Vector hóa tài liệu (RAG).
*   **File Processing:** `pdf-parse` (đọc PDF), `mammoth` (đọc Word), `cheerio` (quét Web).

### Database & Cloud
*   **Database:** Google Firestore (NoSQL) - Lưu trữ Users, Brands, Audits, Generations, Chunks.
*   **Storage:** Firebase Storage - Lưu trữ file Guideline gốc.
*   **Auth:** Firebase Authentication.

---

## 📂 Cấu Trúc Dự Án

```
moodbiz-portal/
├── api/                        # Serverless Functions (Backend)
│   ├── brand-guidelines/       # Xử lý nhập liệu Guideline (Upload/Analyze)
│   ├── audit.js                # Logic kiểm duyệt 4 lớp
│   ├── create-user.js          # Tạo user (Admin function)
│   ├── rag-generate.js         # Logic RAG Generation
│   └── scrape.js               # Crawler quét nội dung website
├── components/                 # React UI Components
│   ├── tabs/                   # Các màn hình chính (Dashboard, Generator...)
│   ├── UIComponents.tsx        # Các component tái sử dụng (Card, Modal...)
│   ├── LoginScreen.tsx         # Màn hình đăng nhập
│   └── ...
├── services/                   # Frontend Services
│   ├── api.ts                  # Gọi API Backend
│   ├── geminiService.ts        # Gọi Gemini trực tiếp (Client-side fallback)
│   └── auditEngine.ts          # Helper tạo Prompt cho Auditor
├── types.ts                    # TypeScript Definitions
├── firebase.ts                 # Firebase Configuration
├── constants.ts                # System Prompts & Configurations
└── ...
```

---

## ⚙️ Hướng Dẫn Cài Đặt (Setup Guide)

### 1. Yêu cầu môi trường
*   Node.js (v18+)
*   Tài khoản Google Cloud Platform (để lấy Gemini API Key & Firebase).

### 2. Biến môi trường (.env)
Tạo file `.env` tại thư mục gốc:

```env
# Client-side (Vite)
VITE_API_KEY=AIzaSy... (Firebase Web API Key - Public)

# Server-side (Vercel/Node)
GEMINI_API_KEY=... (Google AI Studio Key)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
GOOGLE_STORAGE_BUCKET=...
```

### 3. Cài đặt & Chạy
```bash
# Cài đặt dependencies
npm install

# Chạy môi trường dev (Frontend)
npm run dev

# Build production
npm run build
```

---

## 🧠 Logic AI Nổi Bật

### 1. Semantic Chunking Logic
Thay vì cắt văn bản máy móc (ví dụ: cứ 1000 ký tự cắt 1 lần), hệ thống sử dụng thuật toán **Semantic Chunking**:
1.  Tách văn bản theo đoạn văn (`\n\n`).
2.  Nếu đoạn văn quá dài, tách tiếp theo câu (`.!?`).
3.  Gom nhóm các đoạn văn nhỏ lại thành một Chunk hoàn chỉnh (~1000 chars) để đảm bảo ngữ cảnh không bị cắt cụt.

### 2. 4-Layer Auditing Prompt
Prompt Audit được cấu trúc nghiêm ngặt để tránh AI bị ảo giác:
*   **Input:** Nhận vào 4 nguồn dữ liệu (Luật chính tả, Brand Profile, Product Facts, Logic Rules).
*   **Priority Routing:** AI bắt buộc check theo thứ tự: Lỗi chính tả -> Lỗi Brand -> Lỗi thông tin Sản phẩm -> Lỗi Logic.
*   **Safety:** Sử dụng `responseSchema` để đảm bảo kết quả trả về luôn là JSON hợp lệ.

---

© 2024 MOODBIZ TECHNOLOGY. All rights reserved.
