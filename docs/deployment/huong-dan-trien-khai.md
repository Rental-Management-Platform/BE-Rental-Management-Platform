# Triển khai BE lên máy chủ bằng Docker và nginx

Hướng dẫn đưa API lên một máy chủ Linux (Ubuntu 24.04 LTS) với tên miền và HTTPS. FE là repo riêng, đóng gói Docker riêng và chạy **cùng máy chủ** với BE; phần nối FE vào ở mục 7, và tài liệu gửi đội FE là [`huong-dan-docker-cho-fe.md`](huong-dan-docker-cho-fe.md).

## 1. Kiến trúc

```
Internet ──443──▶ nginx (cài trên máy chủ, TLS, giới hạn tần suất, header bảo mật)
                    │
                    ├─ /api/*  ──▶ 127.0.0.1:3000  container api  ─┐
                    └─ còn lại ──▶ 127.0.0.1:3001  container web   │  (FE, compose riêng)
                                                                    │
        mạng `backend` (internal, không ra internet)                │
        container db (PostgreSQL 18) ◀──────────────────────────────┘
        container migrate (chạy một lần mỗi lần `up`: migration + seed)
```

- **Một tên miền, một origin**: `https://rental.example.com/` là FE, `https://rental.example.com/api/` là API. Không cần CORS, và cookie refresh (`SameSite=Strict`, `Path=/api/v1/auth`) đi đúng. Nginx **không được cắt** tiền tố `/api`.
- **Chỉ nginx ra internet.** API chỉ mở `127.0.0.1:3000`, DB không mở cổng nào. Docker bỏ qua `ufw` khi mở cổng, nên việc gắn `127.0.0.1` trong `compose.yaml` chính là hàng rào, không phải firewall.
- **DB nằm trong mạng `internal`**: container `db` không có đường ra internet. API có thêm mạng `rental_edge` vì cần gửi email qua SMTP.
- **Quyền tối thiểu**: ứng dụng nối DB bằng role riêng (không phải superuser, chỉ làm chủ đúng database của nó). Mỗi container chỉ nhận các biến nó cần: API không thấy mật khẩu superuser Postgres lẫn mật khẩu admin dùng cho seed.
- Container API chạy bằng người dùng `node` (không root), root filesystem chỉ đọc (chỉ `/tmp` và volume ảnh ghi được), bỏ toàn bộ Linux capability, `no-new-privileges`, giới hạn RAM và số tiến trình.

## 2. Chuẩn bị máy chủ

Cần: VPS Ubuntu 24.04 LTS, **4 GB RAM** và 30 GB ổ đĩa khi chạy cả FE lẫn BE (API giới hạn 768 MB, FE khoảng 512 MB, cộng PostgreSQL và nginx; dựng image Node và Next.js ngay trên máy cũng tốn RAM, nên 2 GB dễ bị hết bộ nhớ: thêm swap hoặc dựng image ở máy khác rồi chuyển lên), một tên miền có bản ghi `A` (và `AAAA` nếu có IPv6) trỏ về máy chủ.

**Tài khoản và SSH** (làm bằng root lần đầu):

```bash
apt update && apt -y upgrade
adduser deploy && usermod -aG sudo deploy
# chép khóa SSH công khai của bạn vào /home/deploy/.ssh/authorized_keys (chmod 700 thư mục, 600 tệp)
```

Mở **một phiên SSH thứ hai** bằng `deploy` để chắc chắn đăng nhập bằng khóa được, rồi mới khóa mật khẩu:

```bash
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
EOF
sudo sshd -t && sudo systemctl reload ssh
```

**Firewall, chống dò mật khẩu, tự vá lỗi**:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit OpenSSH        # cho phép SSH và giới hạn tốc độ kết nối mới (chặn dò mật khẩu hàng loạt)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo apt install -y fail2ban unattended-upgrades
sudo systemctl enable --now fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Docker** (kho chính thức của Docker, không dùng gói `docker.io` của Ubuntu):

```bash
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy   # đăng xuất rồi đăng nhập lại để có hiệu lực
```

Thành viên nhóm `docker` có quyền tương đương root trên máy chủ: chỉ thêm người thật sự cần triển khai.

## 3. Lấy mã nguồn và cấu hình

```bash
sudo mkdir -p /opt/rental && sudo chown deploy: /opt/rental
cd /opt/rental
git clone <địa-chỉ-repo-BE> be && cd be
git checkout <nhánh-hoặc-tag-cần-chạy>

cp .env.production.example .env
chmod 600 .env
```

Điền `.env` (mọi giá trị `CHANGE_ME` phải thay, API từ chối khởi động nếu còn sót). Sinh mỗi bí mật một chuỗi riêng:

```bash
openssl rand -base64 36 | tr '+/' '-_'
```

| Biến | Giá trị trên máy chủ |
|---|---|
| `ALLOWED_ORIGINS`, `APP_BASE_URL` | `https://rental.example.com` (đúng tên miền thật, **không** dấu `/` cuối, đúng `https`). Sai ở đây thì `/auth/refresh` bị chặn `ORIGIN_NOT_ALLOWED` và liên kết trong email dẫn sai nơi |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY_HOPS` | `1` (chỉ nginx đứng trước API). Đặt `0` thì mọi khách dùng chung IP của nginx và giới hạn tần suất theo IP chặn nhầm tất cả cùng lúc; thêm Cloudflare thì **vẫn `1`** và dùng `realip` ở nginx (mục 5a) |
| `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `JWT_ACCESS_SECRET` | ba chuỗi ngẫu nhiên khác nhau |
| `MAIL_*` | thông tin Gmail App Password (hoặc SMTP khác) |
| `ADMIN_SEED_*` | admin đầu tiên, chỉ dùng khi database chưa có admin nào |
| `DEMO_SEED_PASSWORD` | chỉ khi nạp dữ liệu demo (mục 9a); để `CHANGE_ME` nếu không dùng |

`.env` đã bị git bỏ qua. Đừng gửi qua chat hay email; chép bằng `scp` hoặc gõ trực tiếp trên máy chủ.

## 4. Chạy API

```bash
docker compose up -d --build
docker compose ps
docker compose logs migrate        # phải kết thúc bằng "Đã tạo tài khoản admin đầu tiên"
curl -i http://127.0.0.1:3000/api/v1/health     # 200 {"status":"ok"}
```

Thứ tự tự động: `db` khỏe → `migrate` áp migration và seed (thoát mã 0) → `api` khởi động. Migration hoặc seed lỗi thì `docker compose up` dừng với thông báo `service "migrate" didn't complete successfully`, và container `api` đang chạy (nếu có) **không bị đụng tới**.

Sau lần chạy đầu: đăng nhập admin và **đổi mật khẩu trong ứng dụng**. Giá trị `ADMIN_SEED_PASSWORD` trong `.env` không còn được dùng nữa (nhưng vẫn phải là chuỗi hợp lệ).

Script tạo role và database (`deploy/postgres/init`) chỉ chạy khi volume `pgdata` còn trống. Đổi `APP_DB_*` sau đó không có tác dụng với database cũ; muốn đổi mật khẩu thì `ALTER ROLE` (mục 9).

## 5. nginx và HTTPS

```bash
sudo apt install -y nginx certbot
sudo rm -f /etc/nginx/sites-enabled/default            # tránh trùng default_server
sudo mkdir -p /etc/nginx/snippets /var/www/certbot

cd /opt/rental/be
sudo cp deploy/nginx/00-rental-zones.conf deploy/nginx/rental-http.conf /etc/nginx/conf.d/
sudo cp deploy/nginx/snippets/*.conf /etc/nginx/snippets/
sudo sed -i 's/rental.example.com/TÊN-MIỀN-THẬT/g' /etc/nginx/conf.d/rental-http.conf
sudo nginx -t && sudo systemctl reload nginx
```

Xin chứng chỉ (bản ghi DNS phải trỏ đúng về máy chủ và cổng 80 phải mở):

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d TÊN-MIỀN-THẬT -m EMAIL-CỦA-BẠN --agree-tos --no-eff-email
```

Có chứng chỉ rồi mới bật HTTPS (file này tham chiếu tới chứng chỉ nên nginx không nạp được nếu chưa có):

```bash
sudo cp deploy/nginx/rental-https.conf /etc/nginx/conf.d/
sudo sed -i 's/rental.example.com/TÊN-MIỀN-THẬT/g' /etc/nginx/conf.d/rental-https.conf
sudo nginx -t && sudo systemctl reload nginx
```

Tự gia hạn: gói `certbot` của Ubuntu đã có `certbot.timer`. Thêm lệnh nạp lại nginx sau mỗi lần gia hạn rồi thử khô:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run
```

Những gì cấu hình nginx trong `deploy/nginx/` làm:

- IP trần hoặc tên miền lạ (nơi bot quét theo dải IP rơi vào): cổng 80 đóng kết nối (444), cổng 443 từ chối bắt tay TLS. Không ai thấy ứng dụng khi quét theo IP.
- Chỉ TLS 1.2 và 1.3, bộ mã Mozilla "intermediate", không dùng session ticket. Cổng 80 chỉ để xin chứng chỉ và chuyển sang HTTPS.
- Header: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; riêng `/api/` thêm CSP chặt. Ẩn phiên bản nginx và `X-Powered-By`. API (có `helmet`) và FE cũng tự gửi một số header trùng tên: nginx bỏ bản của họ để mỗi header chỉ có một giá trị (CSP của trang FE được giữ nguyên, vì FE tự quyết).
- Giới hạn tần suất lớp thứ nhất theo IP, theo độ tốn kém của yêu cầu: các route nhận mật khẩu 30 lần/phút (burst 10), API 10 yêu cầu/giây (burst 40), trang FE 8/giây (burst 60), `/_next/image` 5/giây (burst 40), tệp tĩnh `/_next/static` 30/giây (burst 300), tối đa 40 kết nối đồng thời mỗi IP; vượt thì trả 429 ngay tại nginx, không tới Node. Ứng dụng vẫn có giới hạn riêng theo từng route phía sau.
- Thân request tối đa 1 MB; chỉ hai route nhận ảnh (`POST /api/v1/properties/:id/listings` và `POST /api/v1/listings/:id/images`) được nới tới 30 MB (5 ảnh × 5 MiB mặc định). Tăng `MAX_UPLOAD_BYTES` thì tăng số này cho khớp.
- Timeout ngắn cho header và thân request (chống kết nối giữ chậm), nginx nhận đủ thân rồi mới chuyển cho API.
- `X-Forwarded-For` bị **ghi đè** bằng IP thật nginx thấy, nên khách không giả được IP bằng cách tự gửi header này.
- **Chống bot quét** (mục 5a): đường dẫn dò (tệp ẩn ở mọi cấp như `/.env` và `/api/.git/config`, đuôi `.php` `.sql` `.log`..., `/wp-login`, `/phpmyadmin`, `/actuator`...), phương thức lạ và User-Agent của công cụ quét bị **đóng kết nối (444) trước khi tới Node**, ghi vào `rental.blocked.log`; fail2ban khóa IP lặp lại ở tường lửa.
- Nhật ký truy cập không ghi query string và Referer, vì liên kết đặt lại mật khẩu mang `?token=...`.

Nginx trên Ubuntu 24.04 là bản 1.24: cú pháp `listen 443 ssl http2;` trong file mẫu chạy được. Từ nginx 1.25.1 nó chỉ bị cảnh báo "deprecated" (có thể đổi sang `http2 on;`).

## 5a. Mở cổng 80 và 443 ra internet (NAT 1:1) và chống bot quét

Máy chủ của bạn đang chỉ có SSH ra ngoài. Ngay khi 80 và 443 mở, bot quét theo dải IP sẽ tới trong vài phút (và sau khi có chứng chỉ, tên miền xuất hiện công khai trong nhật ký Certificate Transparency nên bot biết cả tên miền). Mục tiêu không phải là chặn hết mà là: **yêu cầu của bot không tới Node**, bot lặp lại **bị khóa ở tường lửa** nên không chạm tới nginx nữa, và nhật ký thật không bị nhiễu.

### Các lớp phòng thủ (từ ngoài vào trong)

| Lớp | Chặn gì | Chi phí cho máy chủ | Cấu hình |
|---|---|---|---|
| NAT và tường lửa `ufw` | Mọi cổng khác 22, 80, 443 | Không | thiết bị NAT, `ufw` (mục 2) |
| fail2ban (tường lửa máy chủ) | IP đã lộ bản chất bot: bị khóa từ 1 giờ đến 1 tuần, **không còn tới nginx** | Gần như không | `deploy/fail2ban/` |
| nginx: server mặc định | Quét theo IP trần hoặc tên miền lạ: cổng 80 đóng kết nối (444), cổng 443 từ chối bắt tay TLS | Một lần bắt tay | `rental-http.conf`, `rental-https.conf` |
| nginx: nhận diện bot | Đường dẫn dò (`/wp-login.php`, `/.env`, `/api/.git/config`, `*.php`, `*.sql`, `/phpmyadmin`, `/actuator`...), phương thức lạ (TRACE, PROPFIND...), User-Agent rỗng hoặc của công cụ quét (sqlmap, nikto, nmap, masscan, zgrab, nuclei...): **đóng kết nối ngay (444)**, ghi vào `rental.blocked.log` | Không tới Node | `00-rental-zones.conf` |
| nginx: giới hạn tần suất theo IP | API 10 yêu cầu/giây (burst 40); trang FE 8/giây (burst 60); `/_next/image` 5/giây (burst 40); tệp tĩnh `/_next/static` 30/giây (burst 300); các route nhận mật khẩu 30/phút (burst 10); tối đa 40 kết nối đồng thời mỗi IP | Trả 429 tại nginx | `00-rental-zones.conf`, `rental-https.conf` |
| Ứng dụng (API) | Giới hạn riêng theo từng route (đăng nhập theo IP và email, ghi dữ liệu theo người dùng...) | Có chạm Node | trong mã API |

### Việc phải làm TRƯỚC khi mở cổng

1. Hoàn tất mục 2 đến mục 5 (Docker, `.env`, nginx). Xin chứng chỉ cần cổng 80 từ ngoài vào nên bước đó đòi mở cổng 80 trước (nếu ISP chặn cổng 80 đến, dùng xác thực DNS-01 của certbot); phần còn lại chuẩn bị xong rồi hãy mở 443.
2. Tường lửa máy chủ: kiểm `sudo ufw status verbose` đúng như mục 2 (mặc định chặn chiều vào; SSH ở chế độ `LIMIT`; 80 và 443 mở).
3. Cài và bật fail2ban cho nginx:

```bash
cd /opt/rental/be
sudo cp deploy/fail2ban/filter.d/*.conf /etc/fail2ban/filter.d/
sudo cp deploy/fail2ban/jail.d/rental.local /etc/fail2ban/jail.d/
sudo nano /etc/fail2ban/jail.d/rental.local      # SỬA dòng ignoreip: máy bạn quản trị, mạng nội bộ, IP của thiết bị NAT
sudo fail2ban-client -t && sudo systemctl restart fail2ban
sudo fail2ban-client status                      # phải thấy: recidive, rental-abuse, rental-scan, sshd
```

4. Cấu hình NAT chỉ chuyển **TCP 80 và TCP 443** về máy chủ. **Không** chuyển 3000, 3001, 5432 (chúng vốn chỉ nghe ở `127.0.0.1`, đây là lớp bảo hiểm thứ hai), và không cần chuyển UDP 443 (không dùng HTTP/3).

### Kiểm tra NGAY SAU KHI mở cổng

**Quan trọng nhất: nginx phải thấy IP thật của khách.** Thiết bị NAT 1:1 thường giữ nguyên IP nguồn, nhưng nếu nó đổi IP nguồn thành IP của chính nó (masquerade hoặc SNAT cho chiều vào, hoặc có một reverse proxy ở giữa) thì mọi người dùng chung một IP: giới hạn tần suất chặn tất cả cùng lúc, và fail2ban sẽ khóa nhầm chính thiết bị NAT, tức là khóa cả thế giới.

```bash
# Dùng điện thoại bằng 4G (không dùng Wi-Fi nhà), mở https://TÊN-MIỀN-THẬT/api/v1/health, rồi trên máy chủ:
sudo tail -n 3 /var/log/nginx/rental.access.log
```

Cột đầu tiên phải là **IP công khai của điện thoại**, không phải IP nội bộ hay IP của router. Nếu sai: sửa NAT cho bảo toàn IP nguồn **trước khi tiếp tục** (và tạm `sudo systemctl stop fail2ban`). Nếu máy chủ buộc phải đứng sau một proxy khác thì nginx cần module `realip` (xem đoạn Cloudflare bên dưới).

Rồi quét thử từ ngoài (điện thoại 4G hoặc máy khác):

```bash
nmap -Pn -p 22,80,443,3000,3001,5432 IP-CÔNG-KHAI    # chỉ 22, 80, 443 mở
curl -k -I https://IP-CÔNG-KHAI/                      # bắt tay TLS bị từ chối
curl -I https://TÊN-MIỀN-THẬT/wp-login.php            # không nhận được phản hồi (nginx đóng kết nối)
```

**Thử khóa (từ điện thoại 4G, nhớ gỡ sau khi thử):** gọi `https://TÊN-MIỀN-THẬT/wp-login.php` ba lần, rồi trên máy chủ `sudo fail2ban-client status rental-scan` phải liệt kê IP điện thoại, và điện thoại không còn kết nối được tới máy chủ nữa. Gỡ khóa: `sudo fail2ban-client set rental-scan unbanip IP-ĐIỆN-THOẠI`.

### Theo dõi hằng ngày

```bash
sudo fail2ban-client status rental-scan              # số IP đang bị khóa
sudo fail2ban-client status rental-abuse
sudo awk '{print $1}' /var/log/nginx/rental.blocked.log | sort | uniq -c | sort -rn | head      # ai quét nhiều nhất
sudo grep -c '" 429 ' /var/log/nginx/rental.access.log                                          # số lần bị giới hạn tần suất
sudo tail -n 20 /var/log/fail2ban.log
```

`rental.blocked.log` chỉ chứa yêu cầu bị chặn nên nhiễu của bot không lẫn vào `rental.access.log`; cả hai được `logrotate` của gói nginx xoay vòng.

### Khi khóa nhầm người dùng thật

Dấu hiệu: người dùng bị mất kết nối đột ngột, hoặc nhiều 429 từ cùng một IP. Gỡ khóa bằng `sudo fail2ban-client set <jail> unbanip <ip>`. Nếu nhiều người chung một IP (ký túc xá, quán cà phê), nới các số: `maxretry` của `rental-abuse` trong `jail.d/rental.local` (mặc định 60 lần trong 5 phút), và `rate` hoặc `burst` của các vùng `rental_page` và `rental_api` trong `00-rental-zones.conf`. Trình thu thập của Google, Bing, Apple, DuckDuckGo và Zalo không bị tính vào jail `rental-abuse` (tránh mất SEO).

Nếu FE của bạn thật sự có một đường dẫn trùng mẫu bot (ví dụ một trang tên `vendor/...` hoặc đuôi `.log`), nó sẽ bị chặn: sửa danh sách ở `map $uri $rental_bad_path` trong `00-rental-zones.conf`.

### Không có, hoặc không tự động

- **Lượt xem (`viewCount`) vẫn có thể bị bot "lịch sự" làm phồng.** API đếm tối đa một lượt mỗi IP hoặc mỗi tài khoản cho mỗi tin trong 30 phút và không phân biệt bot với người. Các lớp trên chặn công cụ quét và giữ tốc độ thấp, nhưng một trình thu thập dùng User-Agent giống trình duyệt và đi chậm vẫn được đếm. Lọc theo User-Agent trong mã API là một thay đổi riêng (chưa làm).
- **Từ chối ở tầng TLS** (IP trần, tên lạ) không để lại dòng nhật ký, nên fail2ban không khóa được các IP chỉ làm việc đó; chúng chỉ tốn một lần bắt tay.
- **Cloudflare (tùy chọn, chưa kiểm):** đặt Cloudflare phía trước giấu IP máy chủ và lọc bot ở rìa mạng, và là biện pháp hiệu quả nhất nếu bị tấn công thật. Khi đó: (1) chỉ cho phép IP của Cloudflare vào cổng 80 và 443 (`ufw`), (2) bật `realip` trong nginx (`set_real_ip_from` cho từng dải của Cloudflare, `real_ip_header CF-Connecting-IP;`) để `$remote_addr` là IP thật của khách, (3) **giữ `TRUST_PROXY_HOPS=1`**: nginx ghi đè `X-Forwarded-For` bằng `$remote_addr` (đã là IP thật sau `realip`), nên API vẫn chỉ có một lớp proxy. Không tăng lên 2.
- **Tấn công từ chối dịch vụ phân tán (DDoS)** vượt khả năng đường truyền của bạn thì không cấu hình nào trên máy chủ cứu được; cần nhà mạng hoặc Cloudflare.

## 6. Kiểm tra sau khi triển khai

Từ máy khác (không phải máy chủ):

```bash
curl -I http://TÊN-MIỀN-THẬT/                 # 301 sang https
curl -i https://TÊN-MIỀN-THẬT/api/v1/health   # 200 {"status":"ok"}, mỗi header bảo mật đúng một lần, không có X-Powered-By / phiên bản nginx
curl -k -I https://IP-MÁY-CHỦ/                # kết nối bị từ chối (bắt tay TLS thất bại)
nmap -Pn -p 22,80,443,3000,3001,5432 IP-MÁY-CHỦ   # chỉ 22, 80, 443 mở
```

Trên máy chủ:

```bash
sudo ss -tlnp | grep -E ':(3000|3001|5432)\b'     # 3000/3001 chỉ ở 127.0.0.1, không có 5432
docker compose exec api id                        # uid=1000(node)
docker compose exec api touch /app/x              # Read-only file system
docker compose exec db psql -U postgres -Atc "select rolname, rolsuper from pg_roles where rolname = 'rental_app'"   # rental_app|f
```

Trong trình duyệt: đăng nhập, mở DevTools → Application → Cookies, cookie `rt` phải có `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`. Rồi chạy thử https://www.ssllabs.com/ssltest/ (mục tiêu A hoặc A+).

## 7. Nối FE (compose riêng, cùng máy chủ)

FE chạy ở `127.0.0.1:3001` (đổi `upstream rental_web` trong `rental-https.conf` nếu dùng cổng khác) và gia nhập mạng `rental_edge` do compose của BE tạo (nên **chạy BE trước**). Mọi yêu cầu, mẫu `compose.yaml`, cách server FE gọi API qua `http://api:3000` và danh sách kiểm nằm trong [`huong-dan-docker-cho-fe.md`](huong-dan-docker-cho-fe.md): gửi file đó cho đội FE.

Các điểm phía BE cần nhớ:

- FE **không được dùng đường dẫn `/api/...`** (nginx chuyển hết cho BE).
- `ALLOWED_ORIGINS` và `APP_BASE_URL` phải khớp chính xác tên miền FE; đổi tên miền thì sửa `.env` và `docker compose up -d`, nếu không `/auth/refresh` bị 403.
- Container FE chỉ thấy container `api` (không thấy `db`). Server FE gọi API không chuyển IP người xem thì mọi lượt đó dùng chung một khóa giới hạn tần suất; điều này đã được ghi cho FE.

## 8. Vận hành

**Nâng cấp** (luôn sao lưu trước, vì migration chỉ đi tiến, không có bước lùi tự động):

```bash
cd /opt/rental/be
bash deploy/backup.sh
git pull                         # hoặc git checkout <tag mới>
# đặt API_TAG trong .env sang nhãn mới (ví dụ ngày giờ: 20261121-1430) để giữ lại image bản trước
docker compose build --pull
docker compose up -d
docker compose ps && docker compose logs --tail=50 migrate api
```

`docker compose up -d` không tự dựng lại image; `build` mới dựng. Image cũ vẫn còn trên máy, nên **quay lại bản trước** là đặt lại `API_TAG` cũ trong `.env` rồi `docker compose up -d`. Nếu bản mới đã thêm migration, quay lại mã cũ thường vẫn chạy được khi migration chỉ thêm cột hoặc bảng; nếu không thì khôi phục database từ bản sao lưu (mục 9). Dọn image cũ khi ổ đầy: `docker image prune -f`.

**Xem log**: `docker compose logs -f --tail=100 api`; nginx ở `/var/log/nginx/rental.access.log` và `rental.error.log` (logrotate của gói nginx đã xoay vòng). Log của container tự xoay vòng ở 5 tệp × 10 MB.

**Khởi động lại**: `docker compose restart api`. Dừng và khởi động lại trong khi `migrate` đang ở trạng thái lỗi (sau một lần triển khai hỏng) sẽ không chạy được `api` cho tới khi `migrate` thành công: sửa nguyên nhân rồi `docker compose up -d`.

**Giám sát tối thiểu**: một dịch vụ kiểm tra bên ngoài (UptimeRobot, Better Stack, ...) gọi `https://TÊN-MIỀN-THẬT/api/v1/health` mỗi phút (200 khi API và database còn sống, 503 khi database không trả lời); cảnh báo khi ổ đĩa quá 80% (`/var/lib/docker` chứa `pgdata` và ảnh tải lên).

## 9. Sao lưu, khôi phục, đổi bí mật

**Sao lưu hằng ngày** bằng `deploy/backup.sh`: `pg_dump` định dạng custom và nén ảnh vào `/var/backups/rental`, giữ 14 ngày:

```bash
sudo mkdir -p /var/backups/rental && sudo chown deploy: /var/backups/rental
crontab -e
# 30 3 * * * /bin/bash /opt/rental/be/deploy/backup.sh >> /var/log/rental-backup.log 2>&1
```

Bản sao nằm **cùng máy chủ** thì mất máy là mất cả hai. Chép sang nơi khác mỗi ngày (ví dụ `rclone` lên một bucket, hoặc `rsync` về máy khác bằng khóa SSH chỉ có quyền ghi vào thư mục đó). Dữ liệu người dùng nằm trong các tệp này: mã hóa nếu đưa lên dịch vụ ngoài.

**Khôi phục database** (làm thử trên máy khác hoặc database tạm trước khi phải dùng thật):

```bash
cd /opt/rental/be
docker compose stop api
docker compose exec -T db psql -U postgres -c "ALTER DATABASE rental_management RENAME TO rental_management_old"
docker compose exec -T db psql -U postgres -c "CREATE DATABASE rental_management OWNER rental_app ENCODING 'UTF8' TEMPLATE template0"
docker compose exec -T db psql -U postgres -c "REVOKE ALL ON DATABASE rental_management FROM PUBLIC"
docker compose exec -T db pg_restore -U rental_app -d rental_management --single-transaction --no-privileges < /var/backups/rental/db-NGÀY-GIỜ.dump
docker compose up -d
# kiểm ứng dụng chạy đúng rồi mới xóa bản cũ:
# docker compose exec -T db psql -U postgres -c "DROP DATABASE rental_management_old"
```

(Đổi `rental_management` thành `APP_DB_NAME` của bạn nếu khác.)

**Khôi phục ảnh**: `docker compose exec -T api tar xzf - -C /data/uploads < /var/backups/rental/uploads-NGÀY-GIỜ.tar.gz`.

**Đổi bí mật**:

- `JWT_ACCESS_SECRET`: sửa `.env`, `docker compose up -d`. Mọi access token đang dùng mất hiệu lực ngay (tối đa 15 phút); người dùng được cấp lại qua refresh token.
- Mật khẩu role ứng dụng: `docker compose exec db psql -U postgres -c "ALTER ROLE rental_app PASSWORD '...'"`, rồi sửa `APP_DB_PASSWORD` trong `.env` và `docker compose up -d`. Script init **không** chạy lại.
- Mật khẩu superuser: `ALTER ROLE postgres PASSWORD '...'` rồi sửa `POSTGRES_PASSWORD`.
- Lộ `.env` hoặc nghi ngờ bị xâm nhập: đổi tất cả bí mật trên, thu hồi App Password của `MAIL_PASSWORD` trong tài khoản Google, và buộc mọi người đăng nhập lại bằng cách xóa phiên (`docker compose exec db psql -U rental_app -d rental_management -c "DELETE FROM auth_sessions"`). Access token cũ hết hiệu lực nhờ đổi `JWT_ACCESS_SECRET`.

**Cập nhật thường xuyên**: `sudo apt upgrade` (đã bật tự vá bản bảo mật), dựng lại image định kỳ bằng `docker compose build --pull` để nhận bản vá của image nền. Nâng PostgreSQL trong cùng bản chính (đổi thẻ `postgres:18.x` trong `compose.yaml`, `docker compose up -d`) an toàn khi đã sao lưu; nâng bản chính (19 trở đi) phải `pg_dump` rồi khôi phục vào volume mới.

## 9a. Dữ liệu demo cho FE

Bộ dữ liệu demo (`npm run seed:demo`: 19 tài khoản `@demo.example.com`, nhà trọ, tin kèm ảnh, đơn, chat, đánh giá, lượt xem theo ngày) chạy trong container một lần, **không bao giờ tự chạy** cùng `docker compose up`:

```bash
# trong .env, đặt DEMO_SEED_PASSWORD (từ 8 ký tự, KHÔNG để CHANGE_ME): mật khẩu CHUNG của mọi tài khoản demo
docker compose --profile demo run --rm demo-seed             # lần đầu (chạy lại khi đã có dữ liệu demo thì tự dừng, không tạo trùng)
docker compose --profile demo run --rm demo-seed --reset     # xoá dữ liệu demo cũ, tạo lại (làm mới các mốc thời gian)
```

- Cần `migrate` đã chạy xong (nó tạo admin mà seed demo cần). Ảnh demo ghi vào cùng volume `uploads` với ảnh thật.
- Chỉ đụng tài khoản email đuôi `@demo.example.com` và dữ liệu trỏ vào chúng; người dùng thật không bị ảnh hưởng.
- `seed:demo` cố ý **từ chối chạy khi `NODE_ENV=production`** (chống nạp nhầm vào hệ thống thật). Service `demo-seed` chỉ đặt `NODE_ENV=development` riêng cho container một lần này; `api` vẫn chạy production.
- **Mọi tài khoản demo có chung mật khẩu**: máy chủ nằm trên internet nên hãy đặt chuỗi dài, không đoán được (ai biết nó đăng nhập được mọi tài khoản demo, gồm cả các tài khoản chủ trọ). Admin thật không thuộc bộ demo.
- Dữ liệu demo được làm mới (`--reset`) sẽ đổi id; đừng cứng id demo vào FE hay test.

## 10. Danh sách kiểm an toàn

| Hạng mục | Trạng thái |
|---|---|
| Chỉ 22, 80, 443 mở ra ngoài; DB và API không mở cổng công khai | `ufw` + `127.0.0.1` trong compose + mạng `internal` |
| SSH chỉ dùng khóa, không đăng nhập root, giới hạn tốc độ kết nối, có fail2ban | mục 2, mục 5a |
| Bot quét: đường dẫn dò, phương thức và User-Agent công cụ quét bị đóng kết nối trước khi tới Node; IP lặp lại bị khóa ở tường lửa | mục 5a, `deploy/nginx/`, `deploy/fail2ban/` |
| Nginx thấy IP thật của khách (không phải IP của thiết bị NAT), đã kiểm từ mạng ngoài | mục 5a (**bạn phải kiểm sau khi mở cổng**) |
| HTTPS bắt buộc, TLS 1.2+, HSTS, gia hạn tự động | mục 5 |
| Container không root, rootfs chỉ đọc, bỏ capability, giới hạn RAM | `compose.yaml` |
| Header bảo mật: `helmet` ở API, nginx ở phía công khai (mỗi header một giá trị) | `src/app.factory.ts`, `deploy/nginx/` |
| Biết API và database còn sống: `GET /api/v1/health`, `HEALTHCHECK` của Docker | mục 8 |
| App dùng role DB không phải superuser; mỗi service chỉ nhận biến nó cần | `compose.yaml`, `deploy/postgres/init` |
| Bí mật chỉ nằm trong `.env` (chmod 600), không có trong image hay git | `.dockerignore`, `.gitignore` |
| Giới hạn tần suất hai lớp (nginx và ứng dụng), đọc đúng IP khách | `TRUST_PROXY_HOPS=1`, `X-Forwarded-For` bị ghi đè |
| Sao lưu hằng ngày, có bản sao ngoài máy chủ, đã thử khôi phục | mục 9 (**bạn phải tự làm phần chép đi và thử khôi phục**) |
| Cập nhật hệ điều hành và image nền | `unattended-upgrades`, `build --pull` |

## 11. Giới hạn đã biết của bản này

- **Giới hạn tần suất của ứng dụng nằm trong bộ nhớ**: về 0 khi API khởi động lại, và chỉ đúng khi chạy **một** container API. Đừng tăng số bản sao.
- **Chưa có CI và registry** (hàng 23 còn dở): image dựng ngay trên máy chủ bằng `docker compose build`. Muốn dựng ở nơi khác thì `docker save rental-api:TAG | gzip | ssh deploy@máy-chủ 'gunzip | docker load'`.
- **Ảnh chưa nén và chưa xóa EXIF** (đã hoãn ở spec 0011): ảnh chụp bằng điện thoại có thể mang tọa độ GPS gốc. Ứng dụng kiểm loại ảnh bằng nội dung tệp và dung lượng, không quét virus.
- **Một máy chủ, không dự phòng**: máy hỏng là ngừng dịch vụ tới khi khôi phục từ bản sao lưu.
- **Dữ liệu demo dùng chung một mật khẩu** (mục 9a) và chưa có lệnh xoá riêng dữ liệu demo khi muốn chuyển sang dùng thật (chỉ có `--reset`, xoá rồi tạo lại).
- **Truy cập thẳng cổng 3000** (chỉ làm được từ chính máy chủ) có header của `helmet` nhưng không có HSTS/CSP chặt của nginx; mọi truy cập từ ngoài đều qua nginx.
- Email đi qua Gmail SMTP: máy chủ phải ra được cổng 465 (một số nhà cung cấp VPS chặn cổng SMTP ra ngoài; nếu bị chặn thì dùng cổng 587 hoặc dịch vụ gửi thư khác).

## 12. Đã kiểm thật và chưa kiểm

Đã chạy thật trên Docker Desktop (Linux, amd64) với nginx 1.30 và PostgreSQL 18.7:

- Dựng image; `docker compose up`: db khỏe → migrate (16 migration, seed) → api khỏe; chạy lại `up` thì seed không ghi đè gì; migrate lỗi thì `up` báo lỗi và API đang chạy không bị đụng tới.
- Mật khẩu DB chứa `@ / : '` đi qua script init, migration và API đúng; role ứng dụng không phải superuser nhưng tạo được `pg_trgm` và `btree_gist`; dữ liệu còn nguyên sau `down` rồi `up`; `docker stop` kết thúc trong dưới 1 giây.
- Container API chạy `uid=1000`, rootfs chỉ đọc, `/data/uploads` ghi được; `db` không ra được internet, `api` ra được.
- Đăng nhập admin bằng mật khẩu seed (argon2 chạy trong image), cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, refresh qua nginx, `Origin` lạ bị 403.
- `TRUST_PROXY_HOPS=1`: 30 lần đăng nhập sai từ cùng một IP cuối chuỗi thì lần 31 bị 429 dù khách đổi giá trị đầu chuỗi `X-Forwarded-For`; IP khác không bị chặn.
- nginx: chuyển http sang https, 444 và từ chối TLS với host lạ, đủ header bảo mật, ẩn `X-Powered-By`, ghi đè `X-Forwarded-For`, 413 với thân 2 MB ở route thường và cho qua ở route ảnh, 429 từ nginx sau burst, `.env` và `.git` trả 404, log không có query string.
- `GET /api/v1/health`: 200 `{"status":"ok"}`; dừng container `db` thì 503 `DB_UNAVAILABLE` sau khoảng 3 giây, bật lại thì 200 trở lại. `helmet` bật; nginx bỏ header trùng của API và của một upstream giả lập FE, mỗi header bảo mật chỉ còn một lần.
- Service `demo-seed`: thiếu hoặc để `CHANGE_ME` mật khẩu thì dừng với thông báo rõ; nạp lần đầu (19 tài khoản), chạy lại thì dừng, `--reset` chạy được; `docker compose up -d` không khởi động nó; tin demo, ảnh demo (ghi bởi container demo, đọc bởi API) và đăng nhập tài khoản demo hoạt động. Một container giả lập FE trên `rental_edge` gọi được `http://api:3000`.
- Chống bot (nginx 1.30, container, upstream giả lập): 14 đường dẫn dò, ba User-Agent công cụ quét, User-Agent rỗng và phương thức PROPFIND đều bị đóng kết nối (curl nhận "empty reply"); `.env` và `.git` ở mọi cấp bị chặn, `.well-known` và đường dẫn FE hợp lệ (kể cả `.html`, slug có chữ `php`) không bị chặn nhầm; curl và python-requests, POST/PATCH/DELETE/OPTIONS tới API đi qua bình thường; yêu cầu bị chặn vào `rental.blocked.log` chứ không vào `rental.access.log`. Giới hạn theo tầng với 150 yêu cầu song song: trang 91 qua và 59 bị 429, API 75/75, ảnh 52/48, tệp tĩnh 250/250 qua hết.
- fail2ban 1.0.2 trong container: cả hai bộ lọc khớp đúng trên nhật ký thật của nginx (IPv4, IPv6; trình thu thập Googlebot được bỏ qua; 200 và 401 không khớp), `fail2ban-client -t` báo cấu hình hợp lệ, và với hành động giả (`dummy`): 3 lần bị chặn trong 10 phút thì khóa, 2 lần thì chưa, IP nội bộ trong `ignoreip` không bị khóa, 60 lần 404 thì khóa, 59 lần thì chưa.
- `deploy/backup.sh` (tệp dump đọc lại được, tar ảnh đúng nội dung, xóa bản cũ) và khôi phục dump vào database mới bằng chính role ứng dụng (số phường và số người dùng khớp).

**Chưa kiểm** (cần máy chủ thật hoặc môi trường khác): hành động khóa thật của fail2ban qua tường lửa của Ubuntu (đã kiểm phần phát hiện và quyết định khóa, chưa kiểm phần ghi luật tường lửa), việc thiết bị NAT của bạn có giữ IP nguồn hay không, xin chứng chỉ Let's Encrypt và gia hạn, nginx 1.24 của Ubuntu 24.04, dựng và chạy trên arm64, gửi email qua Gmail từ container, nối FE thật qua mạng `rental_edge`, `--clean` khi khôi phục đè lên database có dữ liệu (hướng dẫn dùng đổi tên rồi tạo mới để tránh), tải ảnh thật qua nginx (mới thử giới hạn dung lượng, chưa gửi multipart hợp lệ).
