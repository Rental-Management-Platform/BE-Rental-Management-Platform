-- Thống kê cho chủ trọ (spec 0017, AC-15). Không bảng, cột hay chỉ mục mới: migration này chỉ là phần dữ liệu thêm khóa
-- quyền mặc định `statistic:read` cho loại tài khoản landlord. Tenant không được thêm (người tìm trọ không có thống kê).

-- ===== Viết tay: khóa quyền mặc định của thống kê =====

-- Chỉ thêm khóa còn thiếu nên chạy lại không thêm trùng. Test `migration-defaults.spec.ts` đọc mảng ARRAY bên dưới, nên
-- giữ nguyên dạng viết: mỗi khóa một dòng, tên loại tài khoản ở `WHERE "key"`. Phải chạy sau migration dọn
-- (`mvp_permission_cleanup`), nếu không khóa mới bị dọn nhầm.
UPDATE "account_types"
SET "permissions" = "permissions" || ARRAY(
    SELECT k
    FROM unnest(ARRAY[
        'statistic:read'
    ]::TEXT[]) AS k
    WHERE k <> ALL ("permissions")
),
"updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'landlord';
