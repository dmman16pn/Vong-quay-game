# 🎰 Vòng Quay May Mắn

Ứng dụng tạo và quản lý vòng quay trúng thưởng.

## Cài đặt & Chạy

```bash
npm install
node server.js
```

Truy cập: http://localhost:3000

## Tính năng

- Tạo nhiều vòng quay với phần thưởng tuỳ chỉnh
- Tỉ lệ trúng thưởng theo % cài đặt
- Giới hạn lượt quay theo thiết bị (localStorage)
- Âm thanh Web Audio API
- Hiệu ứng confetti, glow
- QR Code chia sẻ
- Thống kê lượt quay
- Responsive (mobile + desktop)

## API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | /api/wheels | Danh sách vòng quay |
| POST | /api/wheels | Tạo mới |
| GET | /api/wheels/:id | Chi tiết |
| PUT | /api/wheels/:id | Cập nhật |
| DELETE | /api/wheels/:id | Xoá |
| POST | /api/spin-result | Ghi kết quả quay |
| GET | /api/wheels/:id/stats | Thống kê |
| GET | /api/qrcode/:id | Tạo QR Code |
