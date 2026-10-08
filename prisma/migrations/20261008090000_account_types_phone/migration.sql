-- Loại tài khoản (spec 0003), số điện thoại (spec 0002 AC-13) và lịch sử kiểm duyệt (spec 0003 AC-7).
-- Migration này KHÔNG chuyển dữ liệu cũ: DB dev được làm lại từ đầu bằng `npx prisma migrate reset`.

-- Dừng với thông báo rõ nếu bảng users còn dòng, thay vì đoán dữ liệu.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "users") THEN
        RAISE EXCEPTION 'Bảng users còn dữ liệu. Migration này không chuyển dữ liệu cũ: hãy làm lại database dev từ đầu (npx prisma migrate reset) rồi chạy lại.';
    END IF;
END $$;

-- CreateTable
CREATE TABLE "account_types" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    -- Prisma sinh cột mảng cho phép rỗng; thêm NOT NULL bằng tay (Prisma không coi đó là lệch).
    "permissions" TEXT[] NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_types_pkey" PRIMARY KEY ("key"),
    -- CHECK viết tay (schema.prisma không diễn đạt được, Prisma bỏ qua nó): chỉ ba loại cố định.
    CONSTRAINT "account_types_key_check" CHECK ("key" IN ('admin', 'landlord', 'tenant'))
);

-- Ba loại cố định kèm quyền mặc định (bảng danh mục ở spec 0003). Quyền của admin tính trong code
-- nên cột để mảng rỗng. Migration của mỗi tính năng sau thêm khóa mặc định của nó vào landlord và tenant.
-- Mỗi khóa một dòng để test đọc được và kiểm với danh mục trong code.
INSERT INTO "account_types" ("key", "name", "description", "permissions") VALUES
    ('admin', 'Quản trị viên', 'Toàn quyền; quyền được tính trong code, cột này không dùng.', ARRAY[]::TEXT[]),
    ('landlord', 'Người đăng bài', 'Chủ trọ: quản lý nhà trọ và tin đăng của mình.', ARRAY[
        'profile:read',
        'profile:update',
        'property:read',
        'property:create',
        'property:update',
        'property:delete',
        'listing:read',
        'listing:create',
        'listing:update',
        'listing:delete',
        'verification:create',
        'boost:create',
        'order:create',
        'order:read',
        'order:cancel',
        'subscription:read',
        'inspection:create',
        'stats:read'
    ]::TEXT[]),
    ('tenant', 'Người tìm trọ', 'Người thuê: tìm phòng, lưu phòng, theo dõi chủ trọ, xem liên hệ.', ARRAY[
        'profile:read',
        'profile:update',
        'favorite:read',
        'favorite:create',
        'favorite:delete',
        'follow:create',
        'follow:delete',
        'contact:reveal',
        'report:create'
    ]::TEXT[]);

-- AlterTable: vai trò chuyển từ mảng roles sang một loại duy nhất; thêm số điện thoại và lý do khóa.
ALTER TABLE "users" DROP COLUMN "roles",
ADD COLUMN     "account_type" TEXT NOT NULL,
ADD COLUMN     "locked_reason" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_logs_target_idx" ON "moderation_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "users_account_type_idx" ON "users"("account_type");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_account_type_fk" FOREIGN KEY ("account_type") REFERENCES "account_types"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Landlord bắt buộc có số điện thoại (spec 0002 AC-13). CHECK viết tay, Prisma bỏ qua.
ALTER TABLE "users" ADD CONSTRAINT "users_landlord_phone_check" CHECK ("account_type" <> 'landlord' OR "phone" IS NOT NULL);

-- Một số điện thoại chỉ thuộc một tài khoản landlord, tính cả dòng xóa mềm (không lọc deleted_at).
-- Chỉ mục duy nhất một phần viết tay, Prisma bỏ qua.
CREATE UNIQUE INDEX "users_landlord_phone_unique" ON "users"("phone") WHERE "account_type" = 'landlord';
