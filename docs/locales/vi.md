# Clip Guard

Clip Guard là tiện ích mở rộng trình duyệt thử nghiệm, cảnh báo về lệnh shell đáng ngờ trước khi lệnh được ghi vào bộ nhớ tạm hoặc dán vào trang. Cơ chế phỏng đoán có thể báo nhầm hoặc bỏ sót mối đe dọa; tiện ích không thay thế biện pháp bảo vệ của hệ điều hành.

## Cài đặt

Tải xuống và giải nén [bản phát hành mới nhất](https://github.com/drizxy2/clip-guard/releases).

- **Chrome, Edge, Brave và các trình duyệt Chromium khác:** mở `chrome://extensions` hoặc `edge://extensions`, bật Developer mode, chọn **Load unpacked**, rồi chọn thư mục đã giải nén có `manifest.json`.
- **Firefox:** trước khi tiện ích được AMO ký và phát hành, hãy tải tạm tiện ích tại `about:debugging#/runtime/this-firefox` bằng cách chọn `manifest.json` đã giải nén. Tiện ích tạm thời sẽ bị gỡ khi đóng Firefox.

## Bảo vệ và quyền riêng tư

Chế độ chặn dừng thao tác ghi hoặc dán đáng ngờ cho đến khi bạn quyết định. Chế độ chỉ cảnh báo cho phép thao tác và hiển thị cảnh báo. Clip Guard không gửi yêu cầu mạng và không lưu văn bản trong bộ nhớ tạm. Nếu bật đo lường cục bộ tùy chọn, chỉ nguồn, mức độ, lý do và ngày được ghi lại. Văn bản chờ quyết định chỉ được giữ tạm trong bộ nhớ.

Giao diện dùng ngôn ngữ của trình duyệt. Xem [README dự án](../../README.md) để biết chi tiết kỹ thuật.
