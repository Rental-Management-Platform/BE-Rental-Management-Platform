import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

const WINDOW_MS = 30 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 1000;
const MAX_ENTRIES = 100_000;

/**
 * Đếm lượt xem không trùng (spec 0002 AC-13): mỗi người xem chỉ được cộng một lượt cho mỗi tin trong 30 phút.
 * Một `Map` trong bộ nhớ từ `<người xem>:<id tin>` sang thời điểm hết hạn; không thêm bảng. Mất khi API khởi
 * động lại và không chia sẻ giữa nhiều bản sao API: đánh đổi đã chấp nhận ở bản demo.
 *
 * Dọn dòng hết hạn mỗi phút bằng `setInterval` có `unref` (không quét theo từng request). Nếu sau khi dọn vẫn
 * quá 100000 dòng thì xóa sạch (chấp nhận cộng dư vài lượt). Phòng khi có hàng loạt người xem mới giữa hai lần
 * dọn, lúc thêm dòng mà đã đủ 100000 thì cũng xóa sạch ngay (chỉ so một con số, không quét).
 */
@Injectable()
export class ViewDeduplicator implements OnModuleInit, OnModuleDestroy {
	private readonly expiries = new Map<string, number>();
	private timer: NodeJS.Timeout | undefined;

	onModuleInit(): void {
		this.timer = setInterval(() => this.sweep(), SWEEP_EVERY_MS);
		this.timer.unref();
	}

	onModuleDestroy(): void {
		if (this.timer !== undefined) clearInterval(this.timer);
		this.timer = undefined;
	}

	/**
	 * Lượt đầu của cặp (người xem, tin) trong cửa sổ thì trả `true` và ghi nhớ; các lượt sau trong cửa sổ trả
	 * `false`. `viewer` là `user:<id>` khi đã đăng nhập, không thì `ip:<địa chỉ>`.
	 */
	shouldCount(viewer: string, listingId: string, now = Date.now()): boolean {
		const key = `${viewer}:${listingId}`;
		const expiresAt = this.expiries.get(key);
		if (expiresAt !== undefined && expiresAt > now) return false;
		if (this.expiries.size >= MAX_ENTRIES) this.expiries.clear();
		this.expiries.set(key, now + WINDOW_MS);
		return true;
	}

	/** Bỏ các dòng hết hạn, rồi xóa sạch nếu vẫn quá nhiều. Công khai để test gọi trực tiếp. */
	sweep(now = Date.now()): void {
		for (const [key, expiresAt] of this.expiries) {
			if (expiresAt <= now) this.expiries.delete(key);
		}
		if (this.expiries.size > MAX_ENTRIES) this.expiries.clear();
	}

	/** Số dòng đang giữ, cho test. */
	get size(): number {
		return this.expiries.size;
	}
}

export const VIEW_WINDOW_MS = WINDOW_MS;
export const VIEW_MAX_ENTRIES = MAX_ENTRIES;
