#!/usr/bin/env bash
# Sao lưu database (pg_dump định dạng custom) và ảnh tải lên (tar.gz) vào BACKUP_DIR, giữ KEEP_DAYS ngày.
# Chạy trên máy chủ, không cần dừng ứng dụng:
#   sudo mkdir -p /var/backups/rental && sudo chown "$USER" /var/backups/rental
#   bash deploy/backup.sh
# Chạy hằng ngày bằng cron (crontab -e):
#   30 3 * * * /bin/bash /opt/rental/be/deploy/backup.sh >> /var/log/rental-backup.log 2>&1
# Bản sao nằm CÙNG máy chủ chưa phải sao lưu thật: hãy chép BACKUP_DIR sang nơi khác (xem hướng dẫn, mục sao lưu).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # thư mục gốc repo: nơi có compose.yaml và .env
BACKUP_DIR="${BACKUP_DIR:-/var/backups/rental}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE="${COMPOSE:-docker compose}"      # ghi đè khi cần, ví dụ COMPOSE="docker compose -p rental --env-file /đường/dẫn/.env"

umask 077                                 # bản sao chứa dữ liệu người dùng: chỉ chủ file đọc được
mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
db_file="$BACKUP_DIR/db-$stamp.dump"
img_file="$BACKUP_DIR/uploads-$stamp.tar.gz"

# Ghi ra tệp tạm rồi đổi tên: lỗi giữa chừng không để lại tệp dở dang trông như bản sao hợp lệ.
cleanup() { rm -f "$db_file.tmp" "$img_file.tmp"; }
trap cleanup EXIT

echo "[$(date -Is)] Sao lưu database..."
$COMPOSE exec -T db sh -c 'pg_dump -U "$APP_DB_USER" -d "$APP_DB_NAME" -Fc' > "$db_file.tmp"
# Kiểm tệp đọc lại được (không thể kiểm nội dung đầy đủ nếu không khôi phục thử, xem hướng dẫn).
$COMPOSE exec -T db pg_restore --list < "$db_file.tmp" > /dev/null
mv "$db_file.tmp" "$db_file"

echo "[$(date -Is)] Sao lưu ảnh..."
$COMPOSE exec -T api tar czf - -C /data/uploads . > "$img_file.tmp"
mv "$img_file.tmp" "$img_file"

echo "[$(date -Is)] Xóa bản sao cũ hơn $KEEP_DAYS ngày..."
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime "+$KEEP_DAYS" -delete

echo "[$(date -Is)] Xong: $db_file ($(du -h "$db_file" | cut -f1)), $img_file ($(du -h "$img_file" | cut -f1))"
