-- Dùng thử miễn phí và tham số hệ thống (spec 0003 dùng thử, AC-12).
-- Thứ tự an toàn cho DB đang có dữ liệu: thêm cột cho phép rỗng, điền hạn cho chủ trọ có sẵn, rồi mới thêm CHECK.
-- Phần CreateTable, AddForeignKey do Prisma sinh; phần "Viết tay" (UPDATE điền hạn và CHECK) Prisma không diễn đạt
-- được và bỏ qua khi so lệch.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "trial_ends_at" TIMESTAMPTZ(6);

-- ===== Viết tay: điền hạn cho chủ trọ có sẵn =====

-- Chủ trọ đã đăng ký trước migration nhận 30 ngày tính từ lúc chạy migration (bằng giá trị mặc định của
-- `trial_days`). Tính cả tài khoản bị khóa hoặc xóa mềm vì CHECK bên dưới áp cho mọi dòng landlord.
UPDATE "users" SET "trial_ends_at" = now() + interval '30 days' WHERE "account_type" = 'landlord';

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===== Viết tay: CHECK =====

-- Khóa tham số dạng chữ thường, số, gạch dưới (danh sách khóa hợp lệ nằm trong code: SETTING_DEFINITIONS).
ALTER TABLE "settings" ADD CONSTRAINT "settings_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,59}$');

-- Chủ trọ luôn có hạn dùng thử (giống users_landlord_phone_check). Tenant và admin để rỗng.
ALTER TABLE "users" ADD CONSTRAINT "users_landlord_trial_check" CHECK ("account_type" <> 'landlord' OR "trial_ends_at" IS NOT NULL);
