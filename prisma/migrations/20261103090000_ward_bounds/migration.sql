-- Hộp bao của phường để kiểm tọa độ nhà trọ nằm gần phường đã chọn (spec 0012, AC-6).
-- Bốn cột cho phép rỗng: phường đã có sẵn không phải điền ngay, `npm run seed` điền hộp vào ô còn rỗng, và phường
-- admin thêm qua API không có hộp (lớp kiểm "gần phường" bỏ qua phường đó). Không chỉ mục: đọc theo khóa chính.
-- Phần AlterTable do Prisma sinh; phần "Viết tay" cuối file (CHECK) Prisma không diễn đạt được và bỏ qua khi so lệch.
-- Không thêm CHECK nào vào `properties`: bản NOT VALID sẽ làm mọi UPDATE một dòng cũ ngoài vùng lỗi (spec 0012 AC-5 c).

-- AlterTable
ALTER TABLE "wards" ADD COLUMN     "max_latitude" DOUBLE PRECISION,
ADD COLUMN     "max_longitude" DOUBLE PRECISION,
ADD COLUMN     "min_latitude" DOUBLE PRECISION,
ADD COLUMN     "min_longitude" DOUBLE PRECISION;

-- ===== Viết tay: CHECK =====

-- Bốn cột cùng rỗng, hoặc cùng có với min <= max, vĩ độ trong [-90, 90] và kinh độ trong [-180, 180].
ALTER TABLE "wards" ADD CONSTRAINT "wards_bounds_check" CHECK (
  ("min_latitude" IS NULL AND "max_latitude" IS NULL AND "min_longitude" IS NULL AND "max_longitude" IS NULL)
  OR (
    "min_latitude" IS NOT NULL AND "max_latitude" IS NOT NULL AND "min_longitude" IS NOT NULL AND "max_longitude" IS NOT NULL
    AND "min_latitude" <= "max_latitude"
    AND "min_longitude" <= "max_longitude"
    AND "min_latitude" BETWEEN -90 AND 90
    AND "max_latitude" BETWEEN -90 AND 90
    AND "min_longitude" BETWEEN -180 AND 180
    AND "max_longitude" BETWEEN -180 AND 180
  )
);
