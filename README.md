# Campus LMS

Ứng dụng demo dùng cùng tài khoản Windows AD `CAMPUS` cho Wi-Fi và LMS. Người
dùng nhập mã tài khoản, ví dụ `24520055`, và mật khẩu AD. Backend xác thực qua
LDAPS, ghi một dòng vào RDS rồi mới mở phiên web. Trang chủ hiển thị dữ liệu
học vụ mẫu.

## Chuẩn bị

- **AD**: DC cần chứng chỉ LDAPS được tin cậy, với tên DNS khớp chứng chỉ.
  EC2 LMS phải phân giải tên đó về IP private của DC và đi được TCP 636.
  Giới hạn rule TCP 636 của DC ở security group của EC2 LMS. Lấy CA cấp
  chứng chỉ LDAPS từ quản trị viên AD và lưu thành `certs/ad-ca.pem`.
  Backend bind bằng tài khoản được nhập tại form.
- **RDS**: Dùng MySQL database `lms` với schema trong
  [backend/database/schema.sql](backend/database/schema.sql). Schema đã import
  có thể dùng tiếp. Tài khoản ứng dụng chỉ cần quyền INSERT trên
  `lms.login_history`. Cột `token_id` lưu UUID của lần đăng nhập và `user_oid`
  lưu objectGUID chuẩn hóa của tài khoản AD.
- **ALB**: Dùng listener HTTPS và target HTTP cổng 3001. Health check
  `/api/config` kiểm tra ứng dụng đang phục vụ HTTP. Dùng cùng một
  `SESSION_SECRET` cho mọi EC2 trong cùng Auto Scaling Group.

## Build và chạy trên EC2

```bash
mkdir -p certs
curl -fsSLo certs/rds-ca.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
install -m 600 backend/.env.example backend/.env
openssl rand -hex 32
nano backend/.env
```

Điền endpoint, tài khoản và mật khẩu MySQL. Kiểm tra `AD_URL` là tên DNS
thật của DC, các biến `AD_*` khớp môi trường, rồi điền chuỗi ngẫu nhiên vào
`SESSION_SECRET`. Đặt `FRONTEND_ORIGIN` theo URL HTTPS chính xác của web.
Hai đường dẫn CA trong file môi trường là đường dẫn bên trong container.

```bash
docker build -t campus-lms:ad-rds .
docker run -d --name lms --restart unless-stopped --env-file backend/.env \
  --mount "type=bind,src=$PWD/certs,dst=/app/certs,readonly" \
  -p 3001:3001 campus-lms:ad-rds
curl -fsS http://localhost:3001/api/config
```

Cho ALB tới port 3001 từ security group của ALB. Khi dùng Auto Scaling,
đưa bước chạy container, nạp CA và lấy cấu hình qua IAM/Secrets Manager vào
quy trình khởi tạo mỗi EC2. Giữ file môi trường và khóa phiên ngoài Git và image.

## Kiểm tra

Mở URL HTTPS, thử tài khoản sai rồi đăng nhập với tài khoản CAMPUS hợp lệ.
Sau lần đăng nhập hợp lệ, kiểm tra trên RDS:

```sql
SELECT username, logged_in_at
FROM lms.login_history
ORDER BY id DESC
LIMIT 5;
```
