-- Nhà trọ, tin đăng và danh mục phường, tiện ích (spec 0002, spec 0005).
-- Địa chỉ theo đơn vị hành chính hai cấp sau sáp nhập (tỉnh hoặc thành phố, rồi phường hoặc xã): bảng wards
-- không có cột quận huyện. Dữ liệu phường do `npm run seed` thêm từ prisma/seed-data/wards.json.
-- Phần CreateTable, CreateIndex, AddForeignKey do Prisma sinh; phần "Viết tay" cuối file (CHECK và chỉ mục
-- một phần) Prisma không diễn đạt được và bỏ qua khi so lệch. Phần mở rộng pg_trgm đã bật ở migration đầu.

-- CreateTable
CREATE TABLE "wards" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province_code" TEXT NOT NULL,
    "province_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "amenities" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "landlord_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address_text" TEXT NOT NULL,
    "ward_code" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_fees" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "property_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "property_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_amenities" (
    "property_id" UUID NOT NULL,
    "amenity_key" TEXT NOT NULL,

    CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("property_id","amenity_key")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "property_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "area_m2" DOUBLE PRECISION NOT NULL,
    "deposit" INTEGER,
    "available_from" DATE,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "search_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_images" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "listing_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "properties_landlord_id_idx" ON "properties"("landlord_id");

-- CreateIndex
CREATE INDEX "properties_ward_code_idx" ON "properties"("ward_code");

-- CreateIndex
CREATE UNIQUE INDEX "property_fees_property_id_kind_unique" ON "property_fees"("property_id", "kind");

-- CreateIndex
CREATE INDEX "property_amenities_amenity_key_idx" ON "property_amenities"("amenity_key");

-- CreateIndex
CREATE UNIQUE INDEX "listings_code_unique" ON "listings"("code");

-- CreateIndex
CREATE INDEX "listings_property_id_idx" ON "listings"("property_id");

-- CreateIndex
CREATE INDEX "listings_search_key_gin" ON "listings" USING GIN ("search_key" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_storage_key_unique" ON "listing_images"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "listing_images_listing_id_position_unique" ON "listing_images"("listing_id", "position");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_ward_code_fk" FOREIGN KEY ("ward_code") REFERENCES "wards"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_fees" ADD CONSTRAINT "property_fees_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_key_fk" FOREIGN KEY ("amenity_key") REFERENCES "amenities"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===== Viết tay: CHECK =====

-- Danh mục: khóa tiện ích dạng chữ thường, số, gạch dưới.
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,29}$');

-- Nhà trọ: tọa độ hợp lệ, và cả hai cùng có hoặc cùng rỗng.
ALTER TABLE "properties" ADD CONSTRAINT "properties_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90);
ALTER TABLE "properties" ADD CONSTRAINT "properties_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);
ALTER TABLE "properties" ADD CONSTRAINT "properties_coordinates_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

-- Phí: sáu loại cố định, năm đơn vị tính, giá không âm. UNIQUE (property_id, kind) ở trên nên tối đa 6 dòng.
ALTER TABLE "property_fees" ADD CONSTRAINT "property_fees_kind_check" CHECK ("kind" IN ('electricity', 'water', 'internet', 'parking', 'service', 'other'));
ALTER TABLE "property_fees" ADD CONSTRAINT "property_fees_unit_check" CHECK ("unit" IN ('per_kwh', 'per_m3', 'per_month', 'per_person_month', 'per_vehicle_month'));
ALTER TABLE "property_fees" ADD CONSTRAINT "property_fees_price_check" CHECK ("price" >= 0);

-- Tin: ba trạng thái, các số hợp lý.
ALTER TABLE "listings" ADD CONSTRAINT "listings_status_check" CHECK ("status" IN ('visible', 'hidden_by_owner', 'hidden_by_admin'));
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_check" CHECK ("price" > 0);
ALTER TABLE "listings" ADD CONSTRAINT "listings_area_m2_check" CHECK ("area_m2" > 0);
ALTER TABLE "listings" ADD CONSTRAINT "listings_deposit_check" CHECK ("deposit" IS NULL OR "deposit" >= 0);
ALTER TABLE "listings" ADD CONSTRAINT "listings_view_count_check" CHECK ("view_count" >= 0);

-- Ảnh: vị trí 0 đến 4 cộng UNIQUE (listing_id, position) ở trên nên tối đa 5 ảnh mỗi tin.
ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_position_check" CHECK ("position" BETWEEN 0 AND 4);

-- ===== Viết tay: chỉ mục một phần cho điều kiện hiển thị công khai (tin visible và chưa xóa mềm) =====

CREATE INDEX "listings_visible_created_at_idx" ON "listings" ("created_at" DESC, "id" DESC) WHERE "status" = 'visible' AND "deleted_at" IS NULL;
CREATE INDEX "listings_visible_price_idx" ON "listings" ("price", "id") WHERE "status" = 'visible' AND "deleted_at" IS NULL;
