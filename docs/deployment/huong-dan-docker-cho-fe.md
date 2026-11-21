# Docker và triển khai FE cạnh BE trên cùng một VPS (tài liệu gửi đội FE)

Tài liệu này mô tả phần Docker mà FE cần biết để chạy chung một máy chủ với BE. BE đã đóng gói Docker xong; FE tự đóng gói image của mình (repo riêng) theo các yêu cầu dưới đây. Cách gọi API, token và phiên nằm ở tài liệu API của BE (`api-for-frontend.md`, đặc biệt mục 2 và mục 4.1); tài liệu này không lặp lại, chỉ nói phần ghép nối và triển khai.

## 1. Tóm tắt

- Một máy chủ, một tên miền, **nginx trên máy chủ** là cổng duy nhất ra internet (HTTPS). `https://<tên-miền>/api/...` vào BE, **mọi đường dẫn còn lại vào FE**.
- Trình duyệt thấy FE và API cùng một origin: **không cần CORS**, cookie đăng nhập hoạt động, và JS đọc được header `Retry-After`, `X-Request-Id`.
- FE là **một container** lắng nghe cổng `3000` bên trong, được mở ra máy chủ ở `127.0.0.1:3001` (chỉ loopback, không mở ra ngoài).
- Server của FE (SSR) gọi BE trực tiếp qua mạng Docker `rental_edge` tại `http://api:3000`, không đi vòng qua tên miền công khai.

```
Internet ──443──▶ nginx ──┬─ /api/*  ──▶ 127.0.0.1:3000 ─▶ container api (BE) ──▶ db (PostgreSQL, không ai khác thấy)
                          └─ còn lại ──▶ 127.0.0.1:3001 ─▶ container web (FE)
                                                              │
                              mạng Docker `rental_edge` ◀─────┘  FE gọi BE: http://api:3000/api/v1/...
```

## 2. Yêu cầu với image FE

| # | Yêu cầu | Vì sao |
|---|---|---|
| 1 | Lắng nghe `0.0.0.0:3000` trong container (Next.js: `HOSTNAME=0.0.0.0`, `PORT=3000`) | Docker chỉ chuyển cổng được tới địa chỉ `0.0.0.0`. Lắng nghe `localhost` thì nginx không vào được |
| 2 | **Không dùng đường dẫn bắt đầu bằng `/api/`** (kể cả route handler `app/api/...` hay `pages/api/...` của Next.js) | nginx chuyển toàn bộ `/api/` cho BE nên route đó của FE không bao giờ được gọi tới |
| 3 | Trình duyệt gọi API bằng **đường dẫn tương đối** `/api/v1/...`, không cứng tên miền hay cổng | Cùng một image chạy được ở mọi tên miền; cùng origin nên không cần CORS và cookie `rt` đi đúng |
| 4 | Server FE (SSR, ISR, route handler server) gọi BE bằng `http://api:3000/api/v1/...`, địa chỉ này lấy từ **biến môi trường lúc chạy** (không phải biến inline lúc build) | Mạng nội bộ nhanh và không bị nginx giới hạn tần suất; địa chỉ đổi được mà không dựng lại image |
| 5 | Chạy bằng người dùng không root; image không chứa `.env`, khóa hay bí mật nào | FE là mã công khai, không có lý do mang bí mật. Phần bí mật duy nhất của hệ thống nằm ở `.env` của BE |
| 6 | Không tự làm HTTPS, không tự thêm header CORS | nginx lo HTTPS; cùng origin nên không có CORS |
| 7 | Có một route kiểm tra sức khỏe **không nằm dưới `/api/`** (ví dụ `/healthz`) và `HEALTHCHECK` trong image hoặc compose gọi nó | Docker biết FE còn sống, dễ viết giám sát |
| 8 | Ghi được thư mục cache của chính nó (Next.js: `.next/cache`) khi bật root filesystem chỉ đọc: gắn `tmpfs` hoặc volume | ISR và cache ảnh cần ghi |

**Biến môi trường.** Biến `NEXT_PUBLIC_*` của Next.js bị nhúng cứng vào mã **lúc build**, nên đừng đặt tên miền vào đó (xem yêu cầu 3). Tên biến dưới đây (`API_INTERNAL_URL`) chỉ là ví dụ do FE tự đặt:

| Biến | Giá trị trên máy chủ | Khi nào đọc |
|---|---|---|
| `API_INTERNAL_URL` | `http://api:3000` | lúc chạy, chỉ ở server FE |
| `HOSTNAME`, `PORT` | `0.0.0.0`, `3000` | lúc chạy |

**Ảnh tin đăng.** API trả `coverImageUrl` dạng `/api/v1/media/public/<tên>.png` (đường dẫn tương đối, cùng origin). Dùng thẻ `<img>` bình thường là chạy. Nếu dùng `next/image`, lưu ý bộ tối ưu ảnh của Next sẽ tự tải ảnh có `src` tương đối **từ chính server FE** chứ không từ BE, nên ảnh có thể lỗi 404: dùng `unoptimized` cho các ảnh này, hoặc đặt `loader` riêng, và tự kiểm trên máy chủ.

## 3. Mẫu `compose.yaml` của FE

Đặt ở thư mục riêng của FE (ví dụ `/opt/rental/fe`). **BE phải chạy trước** vì mạng `rental_edge` do compose của BE tạo; FE chỉ gia nhập (`external: true`).

```yaml
name: rental-fe

services:
  web:
    image: rental-web:${WEB_TAG:-local}     # dựng bằng `docker compose build` hoặc nạp từ tệp (xem mục 6)
    build: .
    restart: unless-stopped
    init: true
    ports:
      - "127.0.0.1:3001:3000"               # CHỈ loopback; nginx proxy tới đây. Không bỏ 127.0.0.1
    environment:
      API_INTERNAL_URL: http://api:3000
      HOSTNAME: 0.0.0.0
      PORT: "3000"
    networks:
      - rental_edge
    # Khuyến nghị (nếu FE chạy được với các giới hạn này):
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp
      - /app/.next/cache                    # đường dẫn cache thực tế phụ thuộc cách FE đóng gói
    mem_limit: 512m
    pids_limit: 256
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

networks:
  rental_edge:
    external: true
```

Điều cần giữ nguyên:

- **Cổng `127.0.0.1:3001:3000`**: nginx đã cấu hình trỏ vào `127.0.0.1:3001`. Muốn đổi cổng thì báo người quản lý BE sửa một dòng trong cấu hình nginx. Docker bỏ qua tường lửa `ufw` khi mở cổng, nên **bỏ phần `127.0.0.1:` là mở FE thẳng ra internet, vòng qua nginx** (không HTTPS, không giới hạn tần suất).
- **Mạng `rental_edge`**: trong mạng này FE thấy duy nhất container `api` (tên máy `api`, cổng 3000). FE **không thấy database** (nằm ở mạng nội bộ khác, không ra internet). Đừng cố kết nối database từ FE.

## 4. Gọi BE từ server FE: nhớ chuyển IP người xem

BE giới hạn tần suất theo IP và tin header `X-Forwarded-For`. Với lượt gọi từ browser, nginx đã đặt header này đúng. Với lượt gọi **từ server FE qua `http://api:3000`**, BE chỉ thấy IP của container FE trừ khi FE tự chuyển IP người xem:

```ts
// ví dụ: trong server component hoặc route handler của Next.js, cho lượt gọi thay mặt MỘT người xem cụ thể
import { headers } from 'next/headers';

const h = await headers();
const clientIp = (h.get('x-forwarded-for') ?? '').split(',')[0].trim(); // nginx chỉ đặt MỘT IP thật ở đây
const res = await fetch(`${process.env.API_INTERNAL_URL}/api/v1/listings?pageSize=20`, {
  headers: clientIp ? { 'X-Forwarded-For': clientIp } : {},
});
```

- **Chỉ gửi một IP, không nối chuỗi.** BE lấy mục cuối cùng làm IP khách. Nếu FE nối thêm vào chuỗi cũ, IP bị lấy sai.
- Lượt gọi **không thay mặt người xem nào** (ISR, `revalidate`, tác vụ nền) thì không có IP để chuyển; chúng tính chung theo IP container FE. Vì vậy giới hạn 300 lần mỗi phút của các API đọc công khai (danh sách và chi tiết tin) dồn vào một khóa: dùng ISR hoặc `revalidate` để mỗi trang chỉ gọi BE khoảng một lần mỗi chu kỳ, đừng gọi mỗi lượt xem.
- **Không bao giờ gắn token đăng nhập của ai vào request server có cache dùng chung** (số điện thoại chủ trọ sẽ nằm trong HTML của người khác). Mô hình hai lớp (server render bản khách, trình duyệt gọi lại kèm token) ở mục 4.1 của tài liệu API.

## 5. Cookie, phiên và các điều nginx làm giúp

- Cookie refresh `rt` là `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. `Secure` nghĩa là chỉ hoạt động qua HTTPS, đúng với máy chủ thật. Server FE **không bao giờ nhận được** cookie này.
- Hai API dùng cookie là `POST /api/v1/auth/refresh` và `POST /api/v1/auth/logout`. BE chặn (`403 ORIGIN_NOT_ALLOWED`) nếu header `Origin` không khớp **chính xác** địa chỉ công khai của FE (`https://<tên-miền>`, không dấu `/` cuối). Hệ quả: **đổi tên miền hoặc chạy FE ở tên miền phụ khác thì phải báo người quản lý BE sửa cấu hình**, nếu không đăng nhập vẫn được nhưng refresh bị 403 và người dùng mất phiên.
- nginx thêm các header cho **mọi phản hồi**: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (**FE không nhúng được vào iframe**, kể cả của chính mình), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (tắt camera, micro, thanh toán; cho phép định vị `geolocation=(self)`). Nếu FE cũng gửi một trong năm header này, **giá trị của nginx thắng** (nginx bỏ bản của FE để không bị trùng); muốn khác thì báo người quản lý BE sửa cấu hình nginx.
- **CSP của trang web do FE tự đặt** (Next.js `headers()` hoặc middleware); nginx không đặt CSP cho trang FE. Riêng `/api/` có CSP chặt do nginx đặt, không ảnh hưởng FE.
- Giới hạn tần suất của nginx theo từng IP, tùy độ tốn kém của yêu cầu (vượt thì nhận `429`): API 10 yêu cầu mỗi giây (cho phép bùng lên 40), **trang web 8 mỗi giây (bùng lên 60)**, `/_next/image` 5 mỗi giây (bùng lên 40), tệp tĩnh `/_next/static` 30 mỗi giây (bùng lên 300). Thân request tối đa 1 MB (riêng đăng tin kèm ảnh và tải ảnh được 30 MB). Một trang Next.js nạp vài chục tệp tĩnh cùng lúc, hay bắn vài chục yêu cầu tải trước liên kết, vẫn nằm trong mức cho phép; **nếu gặp 429 với lưu lượng bình thường hãy báo lại**, người quản lý BE sẽ nới số.
- **nginx đóng kết nối ngay (người dùng thấy lỗi mạng, không có mã HTTP) với yêu cầu của bot quét.** Đừng đặt đường dẫn của FE trùng các mẫu sau: bất kỳ đoạn đường dẫn nào bắt đầu bằng dấu chấm (ngoại trừ `.well-known`), đường dẫn kết thúc bằng `.php`, `.asp`, `.aspx`, `.jsp`, `.cgi`, `.sh`, `.sql`, `.log`, `.conf`, `.yml`, `.yaml`, `.ini`, `.bak`, `.pem`, `.key`, `.zip`, `.tar`, `.gz`... hoặc bắt đầu bằng `/wp-`, `/wordpress`, `/phpmyadmin`, `/vendor/`, `/actuator`, `/cgi-bin`, `/server-status`, `/solr/`, `/jenkins`... Đường dẫn FE thông thường (trang, `.html`, `.js`, `.css`, ảnh, phông chữ) không bị ảnh hưởng. Ngoài ra bị chặn: phương thức HTTP ngoài GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS, và User-Agent rỗng hoặc của công cụ quét (sqlmap, nikto, nmap, masscan, zgrab, nuclei...); curl, python-requests và Go-http-client **không** bị chặn. IP của bot lặp lại còn bị khóa ở tường lửa, nên một kiểm thử tải tự động hay công cụ quét lỗ hổng chạy từ máy bạn tới máy chủ thật có thể làm **chính IP của bạn bị khóa**: báo người quản lý BE trước khi chạy, hoặc thêm IP của bạn vào danh sách bỏ qua.
- Header `X-Request-Id` và `Retry-After` của API đọc được từ JS (cùng origin); khi báo lỗi cho BE hãy kèm `requestId` trong body lỗi.

## 6. Triển khai trên VPS chung

Người quản lý BE đã chuẩn bị: Docker, nginx, HTTPS, tên miền, thư mục `/opt/rental/be` (BE đang chạy). FE làm:

1. Đưa mã FE lên máy chủ (`git clone` vào `/opt/rental/fe`) hoặc dựng ở máy khác rồi chuyển image:
   `docker save rental-web:TAG | gzip | ssh deploy@máy-chủ 'gunzip | docker load'`.
2. Tạo `compose.yaml` như mục 3. Nếu cần biến, dùng file `.env` riêng của FE (`chmod 600`, không đưa vào git).
3. Chạy: `docker compose up -d --build`, rồi `docker compose ps` (phải `healthy`).
4. Thử trực tiếp trên máy chủ trước khi thử qua tên miền: `curl -I http://127.0.0.1:3001/`.
5. Mở `https://<tên-miền>/` và đi qua danh sách kiểm ở mục 7.

**Nâng cấp FE**: dựng image mới với nhãn mới (`WEB_TAG=20261121-1430 docker compose build`), `docker compose up -d`. **Quay lại bản cũ**: đặt lại `WEB_TAG` cũ, `docker compose up -d` (image cũ vẫn còn trên máy cho tới khi bị dọn). Nâng cấp FE **không làm gián đoạn BE** và ngược lại; hai compose độc lập, chỉ chung mạng `rental_edge`. Thứ tự khi khởi động lại cả máy: BE lên trước (có `restart: unless-stopped`, Docker tự lên cả hai; nếu FE lên trước mà mạng chưa có thì khởi động lại FE sau: `docker compose up -d`).

## 7. Danh sách kiểm sau khi triển khai

- [ ] `https://<tên-miền>/` ra trang FE; `https://<tên-miền>/api/v1/health` trả `{"status":"ok"}`.
- [ ] Mở mã nguồn trang (`view-source`) của chi tiết tin: **không** có số điện thoại chủ trọ.
- [ ] Đăng nhập, **tải lại cứng** trang: vẫn đăng nhập (cookie `rt` đi qua `/api/v1/auth/refresh`). DevTools → Application → Cookies: `rt` có `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/v1/auth`.
- [ ] Ảnh tin hiện đủ (cả ở danh sách lẫn chi tiết).
- [ ] Không có route nào của FE nằm dưới `/api/`; `/healthz` (hoặc route sức khỏe của FE) trả 200.
- [ ] Response của trang có đủ header của nginx (xem mục 5), và **mỗi header chỉ xuất hiện một lần**.
- [ ] Cổng `3001` **không** truy cập được từ ngoài: từ máy khác `curl http://IP-MÁY-CHỦ:3001/` phải thất bại.
- [ ] Gọi API từ server FE (trang SSR) không nhận 429 khi duyệt bình thường; nếu có, xem mục 4.
- [ ] Gửi một yêu cầu lỗi (ví dụ đăng nhập sai) và đọc được `requestId`, và (khi bị 429) đọc được header `Retry-After` từ JS.

## 8. Dữ liệu demo trên máy chủ

BE có bộ dữ liệu demo (các tài khoản có email đuôi `@demo.example.com`, nhà trọ, tin, đánh giá, chat, đơn hàng; danh sách tài khoản và kịch bản ở mục "Dữ liệu demo có sẵn" trong tài liệu API). Người quản lý BE nạp bằng `docker compose --profile demo run --rm demo-seed` và làm mới bằng `... demo-seed --reset`. Lưu ý:

- **Mật khẩu chung của mọi tài khoản demo do người quản lý BE giữ** (biến `DEMO_SEED_PASSWORD`); xin họ khi cần, đừng đưa vào mã nguồn FE hay commit.
- `--reset` xoá rồi tạo lại dữ liệu demo (làm mới mốc thời gian) nên id của nhà trọ, tin demo **đổi sau mỗi lần làm mới**. Đừng cứng id demo vào FE hay test.
- Dữ liệu của người dùng thật đăng ký trên máy chủ **không bị đụng** (`--reset` chỉ xoá đúng dữ liệu demo và phần liên quan tới chúng).

## 9. Chạy thử toàn bộ trên máy dev bằng Docker (tùy chọn)

Muốn thử đúng mô hình trên máy của mình (BE trong Docker, FE chạy `next dev`): xin người quản lý BE cách chạy `compose.yaml` của BE với file `.env` thử (cổng API mở ở `127.0.0.1:3000`). Khi FE chạy ngoài Docker ở `http://localhost:5173`:

- Đặt rewrite chỉ cho môi trường dev trong `next.config` để `/api/:path*` chuyển tới `http://localhost:3000/api/:path*`, giữ nguyên mô hình cùng origin.
- Nếu thay vào đó gọi API ở origin khác, `ALLOWED_ORIGINS` của BE phải có `http://localhost:5173` và BE đặt `COOKIE_SECURE=false` (HTTP thuần không lưu cookie `Secure`). Dùng `localhost` ở cả hai, đừng trộn `127.0.0.1`.
- `next dev` mặc định chiếm cổng 3000, **trùng cổng API**: chạy FE ở cổng khác (`next dev -p 5173`).

## 10. Cần báo lại cho người quản lý BE

- Tên miền cuối cùng (BE cần để cấu hình `ALLOWED_ORIGINS`, `APP_BASE_URL` và nginx).
- Cổng FE nếu khác `3001`.
- FE có cần nhúng trong iframe, hay tải tài nguyên từ nguồn ngoài (CDN, bản đồ, phông chữ) hay không: ảnh hưởng `X-Frame-Options` của nginx và CSP mà FE tự đặt.
- Có route nào của FE bị ảnh hưởng bởi quy tắc `/api/` (yêu cầu 2 ở mục 2) hay không.
- Có đường dẫn nào của FE bị chặn nhầm bởi danh sách bot ở mục 5 (nginx đóng kết nối, trình duyệt báo lỗi mạng), và IP nào cần được bỏ qua khi kiểm thử tải.

## 11. Đã kiểm và chưa kiểm

Đã chạy thật trên Docker với một container giả lập FE gia nhập `rental_edge`: container này gọi được `http://api:3000/api/v1/health` (200), nginx chuyển `/` vào container FE và `/api/` vào BE, nginx ghi đè `X-Forwarded-For` bằng IP thật (FE nhận đúng một IP), header nginx xuất hiện một lần trên cả hai đường, cookie refresh đi đúng qua nginx, tên miền lạ và truy cập bằng IP bị từ chối. Giới hạn theo tầng (trang, ảnh, tệp tĩnh, API) và việc chặn bot (đường dẫn dò, User-Agent công cụ quét) đã được thử, kể cả việc đường dẫn FE hợp lệ không bị chặn nhầm.

**Chưa kiểm** (cần FE thật): image FE thật chạy qua nginx, `next/image` với ảnh tin, SSR chuyển `X-Forwarded-For` như mục 4, mẫu compose ở mục 3 với `read_only` và các giới hạn tài nguyên (đã chạy cho BE, FE có thể cần nới), đường dẫn cache của FE trong `tmpfs`.
