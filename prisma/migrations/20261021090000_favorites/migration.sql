-- Lưu tin yêu thích (spec 0006, AC-1, AC-5).
-- Toàn bộ do Prisma sinh (CreateTable, CreateIndex, AddForeignKey); không có phần viết tay.
-- Khóa chính (user_id, listing_id) chặn lưu trùng một cặp. Chỉ mục theo (user_id, created_at DESC, listing_id DESC)
-- phục vụ thứ tự "mới lưu trước" của danh sách đã lưu. Hai khóa ngoại RESTRICT vì người dùng và tin chỉ xóa mềm.

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at" DESC, "listing_id" DESC);

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
