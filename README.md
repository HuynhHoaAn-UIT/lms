# Campus LMS — demo 3 EC2

Một tài khoản AD dùng cho cả Wi-Fi và LMS. EC2 1 chạy AD DS + DNS, EC2 2
chạy FreeRADIUS, EC2 3 chạy Campus LMS. Trang sinh viên hiển thị dữ liệu học
vụ mẫu. Phiên web lưu trong bộ nhớ của tiến trình và hết hạn sau một giờ hoặc
khi khởi động lại ứng dụng.

## Chuẩn bị AD

- Tạo và bật ba tài khoản `sv001`, `sv002`, `sv003`, với UPN tương ứng
  `sv001@campus.test`, `sv002@campus.test`, `sv003@campus.test`. Bản demo
  chỉ cho phép ba mã này đăng nhập.
- Cài chứng chỉ LDAPS trên DC. Tên DNS của DC phải khớp chứng chỉ và phân giải
  về IP private từ EC2 LMS. Cho phép TCP 636 từ security group của LMS tới DC.
  Chép chứng chỉ công khai của CA cấp chứng chỉ đó vào EC2 LMS. Kiểm tra từ LMS:

  ```bash
  openssl s_client -connect dc01.campus.test:636 -servername dc01.campus.test \
    -verify_hostname dc01.campus.test -verify_return_error \
    -CAfile /etc/campus-lms/ad-ca.pem </dev/null
  ```

## Chạy trên EC2 LMS

Với Node.js 22.12+ hoặc 24:

```bash
npm ci
npm run build
cp backend/.env.example backend/.env
chmod 600 backend/.env
openssl rand -hex 32
nano backend/.env
npm start
```

Điền chuỗi ngẫu nhiên vừa tạo vào `SESSION_SECRET`, tên DNS thật của DC vào
`AD_URL`, domain vào `AD_DOMAIN`, đường dẫn chứng chỉ CA vào `AD_CA_FILE`
và URL HTTPS của LMS vào `APP_ORIGIN`. Mỗi cấu hình nằm trên một dòng.
Ứng dụng mở tại `127.0.0.1:3000`. Trong vhost HTTPS của Nginx trên cùng EC2,
chuyển tiếp cả trang web và API:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Để thử cục bộ, đặt `APP_ORIGIN=http://localhost:3000` rồi mở
`http://localhost:3000`. Khi dùng `npm run dev` để sửa giao diện, chạy backend
song song và đặt `APP_ORIGIN=http://localhost:5173`.

## Demo

1. Dùng `sv001` xác thực Wi-Fi qua FreeRADIUS và quan sát `Access-Accept`.
2. Dùng cùng mã và mật khẩu ở LMS. Tải lại trang để kiểm tra phiên còn hiệu lực.
3. Đăng xuất, rồi nhập sai mật khẩu để kiểm tra trang từ chối đăng nhập.
