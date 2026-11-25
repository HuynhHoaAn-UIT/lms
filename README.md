# Campus LMS

Demo SSO Microsoft 365 cho môn Thiết kế mạng. Hai màn hình là đăng nhập và trang chủ. Tên hiển thị và username lấy từ tài khoản Entra đã đăng nhập.

## Cấu hình một lần

1. Cài Node.js 22.12+ hoặc Node.js 24.
2. Trong Microsoft Entra admin center, mở **App registrations → New registration**. Chọn **Accounts in this organizational directory only**.
3. Trong **Authentication**, thêm platform **Single-page application** và đăng ký đúng URI `http://localhost:5173/auth-callback.html`.
4. Sao chép `.env.example` thành `.env.local`. Điền **Application (client) ID** và **Directory (tenant) ID** từ **Overview**. Không cần client secret.

Nút đăng nhập chỉ được bật khi các ID có định dạng hợp lệ. Trang chủ mở sau khi MSAL nhận được tài khoản Entra hoặc khôi phục phiên đăng nhập trong tab hiện tại. Lịch học, lịch thi, điểm thi và thông báo dùng dữ liệu mẫu.

## Chạy

```powershell
npm ci
npm run dev
```

Mở http://localhost:5173, bấm **Đăng nhập bằng Microsoft SSO**, rồi dùng tài khoản Microsoft 365 thuộc tenant đã cấu hình. Cho phép cửa sổ bật lên nếu trình duyệt chặn. Nếu sửa `.env.local`, khởi động lại Vite.

Chạy `npm run build` để tạo bản tĩnh trong `dist/`. Khi demo qua HTTPS trên AWS, thêm URI `https://TEN-MIEN/auth-callback.html` vào cùng cấu hình SPA và giữ cả hai tệp HTML khi triển khai.

MSAL Browser dùng OpenID Connect Authorization Code với PKCE. `auth-callback.html` là trang kỹ thuật cho cửa sổ đăng nhập. Trang chủ hiển thị thông tin demo và không chứa dữ liệu học vụ riêng tư.

## Ghi lịch sử đăng nhập vào RDS MySQL

1. Trong cùng tenant Entra, tạo app registration cho API. Trong Manifest đặt `api.requestedAccessTokenVersion` thành `2`. Trong **Expose an API**, dùng Application ID URI `api://<API_CLIENT_ID>` và thêm delegated scope `Login.Record`. Trong app registration của SPA, vào **API permissions → Add a permission → My APIs**, chọn scope này và cấp consent theo chính sách tenant.
2. Trong `.env.local`, đặt `VITE_ENTRA_API_CLIENT_ID` bằng Application (client) ID của API. Đặt `VITE_LOGIN_API_URL` bằng URL endpoint trên EC2, ví dụ `https://api.example.edu/api/login-history`. Khi chạy local dùng URL trong `.env.example`. Build lại frontend sau khi đổi cấu hình.
3. Từ thư mục gốc trên EC2 (Bash), chạy `mysql -h YOUR_RDS_ENDPOINT -u YOUR_DB_ADMIN -p < backend/database/schema.sql` để thêm bảng vào database `lms` (MySQL 8.0.16+). Tài khoản chạy API cần quyền INSERT trên `lms.login_history`.
4. Sao chép `backend/.env.example` thành `backend/.env`. Điền cấu hình MySQL, tenant ID, hai client ID tương ứng và `FRONTEND_ORIGIN` bằng origin chính xác của trang LMS. Với RDS, đặt `DB_SSL_CA` thành đường dẫn tới CA bundle của RDS. Từ thư mục `backend` chạy `npm ci`, sau đó `npm start`. Dùng HTTPS cho endpoint công khai trên AWS.
5. Bấm đăng nhập. Backend xác minh access token và ghi mã người dùng Entra, username nếu có và thời điểm UTC trước khi trang chủ mở. Tải lại trang dùng phiên hiện tại. Kiểm tra trong MySQL:

```sql
SELECT user_oid, username, logged_in_at
FROM lms.login_history
ORDER BY id DESC
LIMIT 10;
```
