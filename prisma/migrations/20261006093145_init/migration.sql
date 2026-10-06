-- Phần mở rộng cho tìm từ khóa tiếng Việt về sau (spec 0005). Có sẵn trong image postgres chính thức.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    -- Prisma sinh cột mảng cho phép rỗng; thêm NOT NULL bằng tay (Prisma không phản đối, đã kiểm chứng).
    "roles" TEXT[] NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    -- CHECK không có trong schema.prisma nên viết tay ở đây; Prisma bỏ qua nó (đã kiểm chứng).
    CONSTRAINT "users_status_check" CHECK ("status" IN ('active', 'locked'))
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_unique" ON "users"("email");
