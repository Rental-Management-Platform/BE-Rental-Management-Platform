-- Theo dõi chủ trọ (spec 0005, AC-2, AC-3).
-- Phần CreateTable, CreateIndex, AddForeignKey do Prisma sinh; phần "Viết tay" (CHECK) Prisma không diễn đạt
-- được và bỏ qua khi so lệch.

-- CreateTable
CREATE TABLE "follows" (
    "user_id" UUID NOT NULL,
    "landlord_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("user_id","landlord_id")
);

-- CreateIndex
CREATE INDEX "follows_landlord_id_idx" ON "follows"("landlord_id");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Viết tay: CHECK của dòng theo dõi =====

-- Không ai theo dõi chính mình. Service đã chặn trước bằng 409 CANNOT_FOLLOW_SELF; đây là lớp cuối ở DB.
ALTER TABLE "follows" ADD CONSTRAINT "follows_self_check" CHECK ("user_id" <> "landlord_id");
