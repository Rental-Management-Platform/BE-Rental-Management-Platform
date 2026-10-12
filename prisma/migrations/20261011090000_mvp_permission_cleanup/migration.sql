-- Dọn danh mục quyền theo phạm vi MVP (spec 0003, cập nhật 2026-10-11).
-- Chỉ sửa dữ liệu, không đổi schema: gỡ khỏi quyền của landlord và tenant các khóa của module đã hoãn
-- khỏi MVP, cùng hai hành động order:refund và order:gift. Admin không bị ảnh hưởng (cột của admin rỗng,
-- quyền admin tính trong code). Khóa lạ vốn đã bị bỏ qua khi đọc và ghi log; migration này làm sạch DB
-- (kể cả quyền admin đã tự chỉnh bằng API trước đó) để log hết cảnh báo.
-- Danh sách module gỡ phải khớp mục "Danh mục quyền của MVP" ở spec 0003; test migration-defaults.spec.ts
-- đọc hai danh sách NOT IN bên dưới nên giữ nguyên dạng viết.
UPDATE "account_types"
SET "permissions" = ARRAY(
    SELECT p
    FROM unnest("permissions") WITH ORDINALITY AS t(p, n)
    WHERE split_part(p, ':', 1) NOT IN ('contact', 'report', 'verification', 'boost', 'product', 'inspection', 'ad', 'expense', 'finance', 'dashboard', 'stats')
    AND p NOT IN ('order:refund', 'order:gift')
    ORDER BY n
),
"updated_at" = CURRENT_TIMESTAMP
WHERE "key" IN ('landlord', 'tenant');
