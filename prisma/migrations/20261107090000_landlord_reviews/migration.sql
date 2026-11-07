-- Đánh giá chủ trọ trên hồ sơ công khai (spec 0014, AC-14).
-- Phần CreateTable, CreateIndex, AddForeignKey do Prisma sinh. Hai phần "Viết tay" Prisma không diễn đạt được và
-- bỏ qua khi so lệch: bốn CHECK, và phần dữ liệu thêm khóa quyền mặc định cho người tìm trọ.

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "landlord_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "stars" SMALLINT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_landlord_id_created_at_idx" ON "reviews"("landlord_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_author_id_landlord_id_unique" ON "reviews"("author_id", "landlord_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Viết tay: CHECK của đánh giá =====

-- Số sao từ 1 đến 5.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_stars_check" CHECK ("stars" BETWEEN 1 AND 5);

-- Nhận xét có thể vắng (NULL), còn đã có thì 1 đến 1000 ký tự. `MaxLength` của DTO đếm ký tự Unicode (một emoji là một ký tự), đúng như `char_length`, nên giới hạn này không bao giờ bị vi phạm từ API.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_comment_check" CHECK ("comment" IS NULL OR char_length("comment") BETWEEN 1 AND 1000);

-- Chỉ hai trạng thái. Lý do ẩn không có cột riêng, nằm ở `moderation_logs` (loại đích `review`).
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_status_check" CHECK ("status" IN ('visible', 'hidden_by_admin'));

-- Người viết khác chủ trọ. Service đã chặn trước bằng 409 CANNOT_REVIEW_SELF; đây là lớp cuối ở DB.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_landlord_check" CHECK ("author_id" <> "landlord_id");

-- ===== Viết tay: khóa quyền mặc định của đánh giá =====

-- Tenant giữ bốn khóa `review:*`. Landlord không giữ khóa nào: chủ trọ không tự đánh giá mình hay ai khác (spec 0014,
-- "Security model"). `review:moderate` chỉ admin giữ, không có ở đây. Chỉ thêm khóa còn thiếu nên chạy lại không đổi
-- gì. Test `migration-defaults.spec.ts` đọc mảng ARRAY bên dưới, nên giữ nguyên dạng viết: mỗi khóa một dòng, tên loại
-- tài khoản ở `WHERE "key"`.
UPDATE "account_types"
SET "permissions" = "permissions" || ARRAY(
    SELECT k
    FROM unnest(ARRAY[
        'review:read',
        'review:create',
        'review:update',
        'review:delete'
    ]::TEXT[]) AS k
    WHERE k <> ALL ("permissions")
),
"updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'tenant';
