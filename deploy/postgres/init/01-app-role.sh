#!/bin/bash
# Chạy MỘT LẦN, đúng lúc thư mục dữ liệu còn trống (image postgres bỏ qua script này ở các lần khởi động sau).
# Tạo role ứng dụng (không phải superuser) và database do role đó làm chủ: ứng dụng và `prisma migrate deploy`
# chỉ cần quyền chủ database. Hai extension của migration (pg_trgm, btree_gist) là extension "trusted",
# chủ database tạo được mà không cần superuser.
set -euo pipefail

: "${APP_DB_NAME:?thiếu APP_DB_NAME}"
: "${APP_DB_USER:?thiếu APP_DB_USER}"
: "${APP_DB_PASSWORD:?thiếu APP_DB_PASSWORD}"

# Giá trị đi vào psql qua biến (-v) và được trích dẫn bằng :"tên" (định danh) và :'giá trị' (chuỗi),
# nên ký tự đặc biệt trong mật khẩu không phá câu lệnh và không có chuỗi SQL nối tay.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v app_db="$APP_DB_NAME" -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
-- UTF8 bắt buộc cho tiếng Việt; template0 cho phép chọn bảng mã độc lập với mặc định của cụm.
CREATE DATABASE :"app_db" OWNER :"app_user" ENCODING 'UTF8' TEMPLATE template0;
-- Chỉ role ứng dụng (và superuser) được kết nối vào database này.
REVOKE ALL ON DATABASE :"app_db" FROM PUBLIC;
SQL

echo "Đã tạo role '$APP_DB_USER' và database '$APP_DB_NAME'."
