-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "previous_token_hash" TEXT,
    "rotated_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
    -- CHECK viết tay (schema.prisma không diễn đạt được, Prisma bỏ qua nó). NULL vẫn hợp lệ: phiên chưa bị hủy.
    -- 'session_limit' là giá trị thêm so với spec 0002: dùng khi vượt MAX_SESSIONS_PER_USER.
    CONSTRAINT "auth_sessions_revoked_reason_check" CHECK ("revoked_reason" IN ('logout', 'logout_all', 'reuse_detected', 'password_changed', 'locked', 'admin_revoked', 'session_limit'))
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_unique" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_previous_token_hash_idx" ON "auth_sessions"("previous_token_hash");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
