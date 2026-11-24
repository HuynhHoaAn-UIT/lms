# Campus LMS

Mở tên miền LMS để xem màn hình đăng nhập. Sau khi Microsoft Entra ID xác thực, backend trên EC2 xác minh access token và ghi một bản ghi vào RDS MySQL. Trang chủ chỉ hiển thị khi thao tác ghi thành công. Mỗi lần tải lại trang sẽ hiện màn hình đăng nhập.

## Microsoft Entra ID

Tạo hai app registration loại single-tenant trong cùng tenant.

1. **SPA LMS**. Trong Authentication, thêm platform **Single-page application**. Thêm redirect URI `https://lms.example.com/auth-callback.html`, thay bằng tên miền thật. Nếu cần demo local, thêm `http://localhost:8080/auth-callback.html`.
2. **API LMS**. Trong Expose an API, đặt Application ID URI thành `api://<API_CLIENT_ID>` và tạo delegated scope `LoginHistory.Write`. Trong manifest của API, đặt `api.requestedAccessTokenVersion` thành `2`.
3. Trong app SPA, thêm delegated permission `LoginHistory.Write` cho API LMS. Cấp consent theo chính sách của tenant. Luồng này dùng SPA và access token, không dùng client secret.

## RDS MySQL

Tạo database `lms`, sau đó chạy [schema.sql](backend/schema.sql) trong database đó bằng tài khoản quản trị. Cấp quyền `INSERT` trên `lms.login_history` cho tài khoản ứng dụng. Cho phép TCP 3306 từ Security Group của EC2 tới RDS. Tải [CA bundle của RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html) và trỏ `DB_CA_FILE` tới đường dẫn file trên EC2.

## Chạy trên EC2

Dùng Node.js 22.12+ hoặc 24. Sao chép `.env.example` thành `.env.local` và `backend/.env.example` thành `backend/.env`, rồi điền cấu hình.

- **Frontend** dùng `VITE_ENTRA_CLIENT_ID` là ID của SPA, `VITE_ENTRA_API_CLIENT_ID` là ID của API và `VITE_ENTRA_TENANT_ID` là ID của tenant. Các giá trị được đưa vào bản build.
- **Backend** dùng các ID tương ứng trong `ENTRA_SPA_CLIENT_ID`, `ENTRA_API_CLIENT_ID` và `ENTRA_TENANT_ID`. Điền thêm endpoint, database, tài khoản và CA của RDS. Giữ file này trên máy chạy backend.

```bash
npm ci
npm run build
npm start
```

Node.js phục vụ cả giao diện và API trên cổng `8080`. Trên AWS, dùng ALB nhận HTTPS và chuyển tiếp HTTP tới cổng này, với health check `GET /`. Giới hạn Security Group của EC2 cho phép cổng 8080 từ ALB. EC2 cần đường HTTPS ra Microsoft Entra để lấy khóa xác minh token.

## Kiểm tra demo

Mở tên miền, đăng nhập Microsoft SSO và kiểm tra trang chủ có hiện tên tài khoản. Dùng tài khoản quản trị RDS để xem bản ghi vừa tạo. Thời gian được ghi theo UTC.

```sql
SELECT id, entra_user_id, logged_in_at
FROM login_history ORDER BY id DESC LIMIT 5;
```
