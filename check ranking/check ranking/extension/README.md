# Rank Checker - Chrome Extension

Extension này thực hiện tìm kiếm Google thực tế từ trình duyệt của bạn để kiểm tra thứ hạng từ khóa.

## Cài đặt

1. Mở Chrome, vào `chrome://extensions/`
2. Bật **Developer mode** (góc phải trên)
3. Click **Load unpacked**
4. Chọn thư mục `extension/` này
5. Extension "Rank Checker" sẽ xuất hiện trên toolbar

## Sử dụng

1. Mở Dashboard: http://localhost:5000
2. Chọn website, thêm keywords
3. Click nút **"🔍 Check Google (Extension)"** (màu tím)
4. Popup hiện lên, nhấn vào **icon Extension** trên Chrome
5. Nhấn **"▶ Bắt đầu kiểm tra"** trong popup extension
6. Extension tự động mở tab Google cho từng keyword
7. Kết quả tự động cập nhật trong Dashboard

## Tại sao dùng Extension?

- **Không bị CAPTCHA**: Google nhận ra đây là lượt duyệt web thực của người dùng
- **Kết quả chính xác**: Đọc trực tiếp từ DOM của trang kết quả
- **Top 100**: Kiểm tra đến vị trí #100
- **Không cần API key**: Không tốn chi phí

## Lưu ý

- Mỗi từ khóa mất ~4-5 giây để kiểm tra
- Không đóng popup extension trong khi đang chạy
- Nếu Google hiện CAPTCHA: giải thủ công trong tab vừa mở, extension tiếp tục tự động
