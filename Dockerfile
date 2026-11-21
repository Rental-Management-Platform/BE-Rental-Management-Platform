# syntax=docker/dockerfile:1
#
# Image API (spec 0001/0006): nhiều giai đoạn, nền glibc để @node-rs/argon2 và công cụ Prisma có bản dựng sẵn.
# Chạy bằng người dùng `node` (không root). Không có .env trong image: biến môi trường do Compose truyền vào.
#
#   docker build -t rental-api:local .
#   docker compose up -d --build        # cách dùng thường ngày, xem compose.yaml

ARG NODE_IMAGE=node:24-bookworm-slim

# ---------- base: thêm OpenSSL cho schema-engine của Prisma (image slim không có) ----------
# Phải có CẢ lúc tải schema-engine (prod-deps) lẫn lúc chạy: Prisma chọn bản nhị phân theo phiên bản OpenSSL nó
# phát hiện, nên thiếu OpenSSL ở bước tải sẽ tải nhầm bản openssl-1.1.x rồi chạy hỏng (cần mạng để tải lại).
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# ---------- build: cài đủ dependencies, sinh Prisma client, biên dịch ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
# --ignore-scripts: `postinstall` (prisma generate) cần schema nên để bước build tự gọi qua `prebuild`.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- prod-deps: chỉ dependencies chạy thật, kèm công cụ migrate của Prisma ----------
FROM base AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    # `--ignore-scripts` cũng bỏ bước tải schema-engine (file nhị phân chạy `prisma migrate deploy`): tải ngay
    # lúc dựng image để container không cần mạng khi khởi động.
    && node node_modules/@prisma/engines/scripts/postinstall.js \
    && npm cache clean --force

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app

RUN mkdir -p /data/uploads && chown -R node:node /data

COPY --from=prod-deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/dist ./dist
# `prisma migrate deploy` đọc prisma.config.ts, và file này import hai tiện ích nhỏ ở src/database (Prisma tự
# biên dịch TypeScript lúc chạy); seed đọc prisma/seed-data theo đường dẫn tính từ dist/database.
COPY --chown=root:root package.json prisma.config.ts ./
COPY --chown=root:root prisma ./prisma
COPY --chown=root:root src/database/build-database-url.ts src/database/load-env.ts ./src/database/

# Mã nguồn thuộc root và chỉ đọc với người dùng `node`; chỉ /data/uploads ghi được.
USER node
EXPOSE 3000

# Image slim không có curl, nên dùng chính Node. `GET /api/v1/health` ping cả database: 200 khi cả hai còn sống,
# 503 khi database không trả lời (container chuyển sang unhealthy sau 3 lần liên tiếp).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# Dạng exec (không qua shell) để SIGTERM của `docker stop` tới thẳng Node và enableShutdownHooks đóng pool kết nối.
CMD ["node", "dist/main.js"]
