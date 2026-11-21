# Đơn mua gói (`src/orders/`)

## Overview

Chủ trọ mua gói bằng thanh toán thử, mỗi lần mua thêm một kỳ gói nối tiếp, và gói quyết định hạn mức tin. Admin xem đơn và doanh thu của mọi chủ trọ. Kỳ gói (`src/subscriptions/`), hạn mức (`src/memberships/`) và bảng giá (`src/plans/`) là các phần mà luồng này chạm tới.

## Key files

| File | Owns |
|---|---|
| `orders.service.ts` | Tạo đơn, thanh toán thử, hủy, đọc đơn của chính mình |
| `orders.repository.ts` | Nơi duy nhất chạm bảng `orders` |
| `admin-orders.*` | `GET /orders/all` và `GET /orders/revenue` cho admin (quyền `order:report`) |
| `order-code.ts` | Mã đơn duy nhất; trùng thì sinh lại, thử tối đa 5 lần ngoài giao dịch |
| `../subscriptions/subscriptions.repository.ts` | Nơi duy nhất chạm bảng `subscriptions` (kỳ gói) |
| `../memberships/memberships.service.ts` | `resolve`: hạn mức hiện hành của một chủ trọ (kỳ gói, dùng thử, hết hạn) |
| `../plans/` | Bảng giá; chỉ admin sửa (`plan:*`) |

## Conventions

- Mọi lệnh ghi khóa dòng `users` của người gọi trước, rồi mới khóa dòng đơn: cùng thứ tự ở tạo, thanh toán và hủy, nên không có vòng chờ và hai lệnh của cùng một chủ trọ chạy tuần tự.
- Tạo đơn `pending` chốt giá, số tin và số ngày của gói ngay lúc tạo. Mỗi chủ trọ tối đa một đơn chờ: đơn chờ cũ thành `cancelled` trong cùng giao dịch.
- Thanh toán thử chạy trong một giao dịch: đơn `pending` thành `paid` và một kỳ gói được tạo. Đơn đã `paid` thì trả đúng kết quả lần trước, nên bấm đúp an toàn.
- Kỳ mới bắt đầu ở thời điểm lớn hơn giữa `now` và `ends_at` lớn nhất của các kỳ của chủ trọ, dài đúng số ngày đã chốt trên đơn. Mua khi đang có gói thì nối vào cuối, kể cả gói khác.
- Kỳ gói không có trạng thái lưu: đang chạy suy ra từ `starts_at <= now < ends_at`. Ràng buộc loại trừ ở database chặn hai kỳ của cùng một chủ trọ chồng nhau.
- Hạn mức chỉ có một hàm trả lời là `MembershipsService.resolve` (kỳ gói, rồi dùng thử còn hạn, rồi 0). `publicListingCondition` ở `src/listings/` là bản SQL của cùng luật, đổi một nơi thì đổi cả hai.
- Admin bị chặn ở Service (không tự mua gói rồi đăng tin) dù giữ quyền trong code. Hủy đơn đã `paid` bị từ chối vì hoàn tiền đã hoãn khỏi MVP.
- Tiền là số nguyên đồng, chốt trên đơn. Thanh toán chỉ là thanh toán thử, không có cổng ngoài và không có tiền thật.

## Gotchas

- `@FreshAuth()` ở hai route admin không được bỏ: token chủ trọ cấp trước khi có `order:report` mang `order:manage`, và `manage` bung ra cả `report`.
- Gói đã tắt thì thanh toán bị 409 `PLAN_INACTIVE` và đơn vẫn `pending`.

## Related specs

[0004](../../docs/specs/0004-membership-packages-payment/index.md), [0010](../../docs/specs/0010-admin-order-list-revenue/index.md), [0003](../../docs/specs/0003-free-trial-listing-quota/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
