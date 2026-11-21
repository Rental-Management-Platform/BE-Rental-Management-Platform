# Tin đăng (`src/listings/`)

## Overview

Tin phòng của chủ trọ: đăng, sửa, ẩn, hiện, xóa mềm, ảnh, đọc công khai (danh sách, chi tiết theo mã ngắn, lượt xem) và kiểm duyệt của admin. Đây là nơi duy nhất viết luật "tin nào hiện ra công khai", các module khác dùng lại luật này.

## Key files

| File | Owns |
|---|---|
| `listings.repository.ts` | Nơi duy nhất chạm bảng `listings`. Có `publicListingFrom` và `publicListingCondition` (luật hiển thị công khai), đọc công khai hai bước (`findPublicPage`, `findPublicByCode`), `isPubliclyVisible`, `findPublicIds` |
| `listings.service.ts` | Đăng, sửa, ẩn, hiện, xóa; cổng hạn mức ở `create` và `show`; đăng kèm 1 đến 5 ảnh trong một giao dịch |
| `listing-images.*` | Thêm và xóa ảnh (`/listings/:id/images`) và phục vụ ảnh công khai (`/media/public/:file`) |
| `listing-moderation.*` | Admin tìm tin, ẩn và gỡ ẩn kèm lý do (`listing:moderate`, hai route ghi gắn `@FreshAuth()`) |
| `view-deduplicator.ts` | Chống cộng lượt xem lặp, nhận ra người xem bằng tài khoản hoặc IP |
| `listing-code.ts` | Mã ngắn duy nhất của tin; trùng thì sinh mã khác và thử lại tối đa 5 lần, vòng thử bọc ngoài giao dịch |

## Conventions

- Luật hiển thị chỉ viết một lần ở `publicListingCondition`: tin `visible`, chưa xóa mềm, nhà trọ chưa xóa mềm, chủ trọ `active`, và hạng của tin nhỏ hơn hạn mức hiệu lực. Hạng là số tin `visible` đăng sớm hơn của cùng chủ trọ. Hạn mức hiệu lực là kỳ gói đang chạy, không thì dùng thử còn hạn, không thì 0. `landlords`, `favorites`, `chat`, `listing-reviews`, `statistics` dùng lại các hàm này, đừng chép điều kiện sang chỗ khác.
- Đọc công khai đi hai bước vì Prisma không diễn đạt được phép xếp hạng: hai câu SQL thô chạy song song lấy `id` của trang và `total`, rồi Prisma lấy dữ liệu theo `id` và xếp lại đúng thứ tự.
- `now` đi vào SQL dưới dạng chuỗi ISO có `Z`, không phải `Date` (tham số `Date` của Prisma bị hiểu theo múi giờ của phiên và lệch).
- Chỉ `create` và `show` có cửa hạn mức: trong một giao dịch, khóa dòng `users` trước, rồi dòng nhà trọ, kiểm hạn mức rồi ghi. Thứ tự khóa của dự án là `users`, `properties`, `listings`. `hide`, `update`, `remove` không bị hạn mức chặn.
- Chuyển trạng thái là một câu `updateMany` có điều kiện trạng thái nguồn, nên admin ẩn đua với chủ trọ thì admin thắng. Chủ trọ không tự gỡ lệnh ẩn của admin.
- Đăng tin kèm ảnh: tệp ghi cuối cùng, tuần tự, sau khi tin và dòng ảnh đã chèn. Lỗi sau khi bắt đầu ghi thì xóa mọi tệp của lần đăng; lỗi đúng lúc COMMIT thì hỏi lại xem tin đã lưu chưa. Giao dịch này được nới thời hạn.
- Route vừa có `:id` vừa có thân bị validator kiểm phải dùng `RejectInvalidUuidParam`: Nest giải tham số song song nên `INVALID_ID` không tự đến trước `VALIDATION_FAILED`.

## Gotchas

- Tin vượt hạn mức vẫn có `status = 'visible'` nhưng biến khỏi công khai, và vẫn tính vào số tin đang hiện khi chủ trọ muốn đăng thêm.
- Ảnh của tin bị ẩn, bị khóa hay hết hạn mức cũng biến khỏi `/media/public` vì dùng cùng luật hiển thị.
- Đổi luật hiển thị hay hạn mức thì đổi cả `MembershipsService.resolve` ở `src/memberships/`, hai nơi là hai bản của cùng một luật.

## Related specs

[0002](../../docs/specs/0002-property-listings/index.md), [0003](../../docs/specs/0003-free-trial-listing-quota/index.md), [0004](../../docs/specs/0004-membership-packages-payment/index.md), [0009](../../docs/specs/0009-landlord-profile-listings/index.md), [0011](../../docs/specs/0011-listing-with-images-in-one-request/index.md), [0016](../../docs/specs/0016-daily-listing-views/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
