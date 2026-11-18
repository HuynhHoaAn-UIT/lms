# Campus LMS

Demo SSO Microsoft 365 cho môn Thiết kế mạng. Hai màn hình là đăng nhập và trang chủ. Tên hiển thị và username lấy từ tài khoản Entra đã đăng nhập.

## Cấu hình một lần

1. Cài Node.js 22.12+ hoặc Node.js 24.
2. Trong Microsoft Entra admin center, mở **App registrations → New registration**. Chọn **Accounts in this organizational directory only**.
3. Trong **Authentication**, thêm platform **Single-page application** và đăng ký đúng URI `http://localhost:5173/auth-callback.html`.
4. Sao chép `.env.example` thành `.env.local`. Điền **Application (client) ID** và **Directory (tenant) ID** từ **Overview**. Không cần client secret.

Nút đăng nhập chỉ được bật khi cả hai ID có định dạng hợp lệ. Trang chủ mở sau khi MSAL nhận được tài khoản Entra hoặc khôi phục phiên đăng nhập trong tab hiện tại. Lịch học, lịch thi, điểm thi và thông báo dùng dữ liệu mẫu.

## Chạy

```powershell
npm ci
npm run dev
```

Mở http://localhost:5173, bấm **Đăng nhập bằng Microsoft SSO**, rồi dùng tài khoản Microsoft 365 thuộc tenant đã cấu hình. Cho phép cửa sổ bật lên nếu trình duyệt chặn. Nếu sửa `.env.local`, khởi động lại Vite.

Chạy `npm run build` để tạo bản tĩnh trong `dist/`. Khi demo qua HTTPS trên AWS, thêm URI `https://TEN-MIEN/auth-callback.html` vào cùng cấu hình SPA và giữ cả hai tệp HTML khi triển khai.

MSAL Browser dùng OpenID Connect Authorization Code với PKCE. `auth-callback.html` là trang kỹ thuật cho cửa sổ đăng nhập. Trang chủ hiển thị thông tin demo và không chứa dữ liệu học vụ riêng tư.
