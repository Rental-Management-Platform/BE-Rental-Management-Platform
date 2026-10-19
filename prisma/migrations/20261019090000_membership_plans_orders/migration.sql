-- Gói, đơn mua gói và kỳ gói (spec 0004, AC-12).
-- Phần CreateTable, CreateIndex, AddForeignKey do Prisma sinh; các phần "Viết tay" (phần mở rộng, CHECK, chỉ mục
-- duy nhất một phần, ràng buộc loại trừ) Prisma không diễn đạt được và bỏ qua khi so lệch.

-- ===== Viết tay: phần mở rộng =====

-- Cần cho ràng buộc loại trừ trên (user_id WITH =, khoảng thời gian WITH &&): kiểu uuid chỉ so sánh bằng trong
-- chỉ mục GiST nhờ phần mở rộng này. Là phần mở rộng "tin cậy": role chủ database tạo được.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "max_listings" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "max_listings" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_unique" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_unique" ON "orders"("code");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "orders_plan_id_idx" ON "orders"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_order_id_unique" ON "subscriptions"("order_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_ends_at_idx" ON "subscriptions"("user_id", "ends_at" DESC);

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Viết tay: CHECK của gói =====

-- Khoảng giá trị admin được đặt (cùng con số với DTO ở src/plans/plan-limits.ts).
ALTER TABLE "plans" ADD CONSTRAINT "plans_name_check" CHECK (char_length("name") BETWEEN 2 AND 60);
ALTER TABLE "plans" ADD CONSTRAINT "plans_price_check" CHECK ("price" BETWEEN 0 AND 100000000);
ALTER TABLE "plans" ADD CONSTRAINT "plans_max_listings_check" CHECK ("max_listings" BETWEEN 1 AND 1000);
ALTER TABLE "plans" ADD CONSTRAINT "plans_duration_days_check" CHECK ("duration_days" BETWEEN 1 AND 365);

-- ===== Viết tay: CHECK và chỉ mục một phần của đơn =====

ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("status" IN ('pending', 'paid', 'cancelled'));

-- paid_at có khi và chỉ khi đơn đã trả; cancelled_at có khi và chỉ khi đơn đã hủy.
ALTER TABLE "orders" ADD CONSTRAINT "orders_paid_at_check" CHECK (("status" = 'paid') = ("paid_at" IS NOT NULL));
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_at_check" CHECK (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL));

-- Mỗi chủ trọ tối đa một đơn đang chờ. Tạo đơn mới hủy đơn chờ cũ trong cùng giao dịch, nên chỉ mục này chỉ
-- chặn được khi code bỏ sót khóa dòng users.
CREATE UNIQUE INDEX "orders_user_pending_unique" ON "orders"("user_id") WHERE "status" = 'pending';

-- ===== Viết tay: CHECK và ràng buộc loại trừ của kỳ gói =====

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_period_check" CHECK ("ends_at" > "starts_at");

-- Hai kỳ của cùng một chủ trọ không bao giờ chồng thời gian. tstzrange mặc định nửa mở [starts_at, ends_at):
-- kỳ sau bắt đầu đúng lúc kỳ trước kết thúc thì được.
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_period_excl"
    EXCLUDE USING gist ("user_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&);
