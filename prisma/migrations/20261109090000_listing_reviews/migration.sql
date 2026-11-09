-- Đánh giá từng phòng trọ trên tin đăng (spec 0015, AC-14).
-- Phần CreateTable, CreateIndex, AddForeignKey do Prisma sinh. Phần "Viết tay" là ba CHECK mà Prisma không diễn đạt
-- được và bỏ qua khi so lệch. Migration này không có phần dữ liệu: `tenant` đã giữ bốn khóa `review:*` từ spec 0014.

-- CreateTable
CREATE TABLE "listing_reviews" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "listing_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "stars" SMALLINT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_reviews_listing_id_created_at_idx" ON "listing_reviews"("listing_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "listing_reviews_author_id_listing_id_unique" ON "listing_reviews"("author_id", "listing_id");

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Viết tay: CHECK của đánh giá phòng =====

-- Số sao từ 1 đến 5.
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_stars_check" CHECK ("stars" BETWEEN 1 AND 5);

-- Nhận xét có thể vắng (NULL), còn đã có thì 1 đến 1000 ký tự. `MaxLength` của DTO đếm ký tự Unicode (một emoji là một ký tự), đúng như `char_length`, nên giới hạn này không bao giờ bị vi phạm từ API.
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_comment_check" CHECK ("comment" IS NULL OR char_length("comment") BETWEEN 1 AND 1000);

-- Chỉ hai trạng thái. Lý do ẩn không có cột riêng, nằm ở `moderation_logs` (loại đích `listing_review`).
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_status_check" CHECK ("status" IN ('visible', 'hidden_by_admin'));
