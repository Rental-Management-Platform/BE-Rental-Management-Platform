-- Chat giữa người tìm trọ và chủ trọ (spec 0013, AC-8, AC-13).
-- Phần CreateTable, CreateIndex, AddForeignKey do Prisma sinh. Hai phần "Viết tay" Prisma không diễn đạt được và
-- bỏ qua khi so lệch: bốn CHECK, và phần dữ liệu thêm khóa quyền mặc định cho hai loại tài khoản.

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "listing_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "landlord_id" UUID NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    "tenant_read_seq" INTEGER NOT NULL DEFAULT 0,
    "landlord_read_seq" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conversation_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_tenant_id_last_message_at_idx" ON "conversations"("tenant_id", "last_message_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "conversations_landlord_id_last_message_at_idx" ON "conversations"("landlord_id", "last_message_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_listing_id_tenant_id_unique" ON "conversations"("listing_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversation_id_seq_unique" ON "messages"("conversation_id", "seq");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_landlord_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Viết tay: CHECK của cuộc trò chuyện và tin nhắn =====

-- Người nhắn khác chủ trọ. Service đã chặn trước bằng 409 CANNOT_CHAT_WITH_SELF; đây là lớp cuối ở DB.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_landlord_check" CHECK ("tenant_id" <> "landlord_id");

-- `last_seq` là số tin hiện có nên không âm, và mỗi mốc đã đọc nằm trong 0 đến `last_seq` (không đọc quá tin cuối).
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seq_check" CHECK (
    "last_seq" >= 0
    AND "tenant_read_seq" BETWEEN 0 AND "last_seq"
    AND "landlord_read_seq" BETWEEN 0 AND "last_seq"
);

-- `seq` đếm từ 1.
ALTER TABLE "messages" ADD CONSTRAINT "messages_seq_check" CHECK ("seq" >= 1);

-- Nội dung 1 đến 1000 ký tự. `MaxLength` của DTO đếm ký tự Unicode (một emoji là một ký tự), đúng như `char_length`, nên giới hạn này không bao giờ bị vi phạm từ API.
ALTER TABLE "messages" ADD CONSTRAINT "messages_body_check" CHECK (char_length("body") BETWEEN 1 AND 1000);

-- ===== Viết tay: khóa quyền mặc định của chat =====

-- Tenant giữ cả bốn khóa. Landlord giữ ba khóa và không giữ `conversation:create`: chủ trọ trả lời, không tự mở
-- cuộc trò chuyện (spec 0013, "Security model"). Chỉ thêm khóa còn thiếu nên chạy lại không đổi gì. Test
-- `migration-defaults.spec.ts` đọc hai mảng ARRAY bên dưới, nên giữ nguyên dạng viết: mỗi khóa một dòng, tên loại tài
-- khoản ở `WHERE "key"`.
UPDATE "account_types"
SET "permissions" = "permissions" || ARRAY(
    SELECT k
    FROM unnest(ARRAY[
        'conversation:read',
        'conversation:update',
        'message:create'
    ]::TEXT[]) AS k
    WHERE k <> ALL ("permissions")
),
"updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'landlord';

UPDATE "account_types"
SET "permissions" = "permissions" || ARRAY(
    SELECT k
    FROM unnest(ARRAY[
        'conversation:read',
        'conversation:create',
        'conversation:update',
        'message:create'
    ]::TEXT[]) AS k
    WHERE k <> ALL ("permissions")
),
"updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'tenant';
