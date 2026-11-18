-- Lượt xem tin đăng theo ngày giờ Việt Nam (spec 0016, AC-6 và AC-7).
-- Phần CreateTable và AddForeignKey do Prisma sinh. Phần "Viết tay" là một CHECK mà Prisma không diễn đạt được và bỏ qua khi so lệch.
-- Migration này chỉ tạo bảng mới, không có phần dữ liệu: lượt xem trước migration không có ngày nên không sao chép và không chia đều `view_count` cũ.

-- CreateTable
CREATE TABLE "listing_daily_views" (
    "listing_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL,

    CONSTRAINT "listing_daily_views_pkey" PRIMARY KEY ("listing_id","day")
);

-- AddForeignKey
ALTER TABLE "listing_daily_views" ADD CONSTRAINT "listing_daily_views_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Viết tay: CHECK của bộ đếm ngày =====

-- Một dòng chỉ tồn tại khi ngày đó có ít nhất một lượt đã tính, nên `views` luôn dương.
ALTER TABLE "listing_daily_views" ADD CONSTRAINT "listing_daily_views_views_check" CHECK ("views" > 0);
