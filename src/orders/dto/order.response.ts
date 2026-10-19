import type { OrderStatus } from '../order-status';

/** Một đơn, dùng chung cho mọi API đơn (spec 0004, "Hình dạng một đơn"). */
export interface OrderResponse {
	readonly id: string;
	/** Mã ngắn 8 ký tự để đối chiếu với người dùng. */
	readonly code: string;
	readonly planId: string;
	/** Bốn trường bản chốt: gói lúc tạo đơn, không đổi khi admin sửa gói về sau. */
	readonly planName: string;
	/** Đồng Việt Nam. */
	readonly price: number;
	readonly maxListings: number;
	readonly durationDays: number;
	readonly status: OrderStatus;
	readonly paidAt: Date | null;
	readonly cancelledAt: Date | null;
	/** Kỳ gói của đơn `paid`; `null` khi đơn chưa trả hoặc đã hủy. */
	readonly startsAt: Date | null;
	readonly endsAt: Date | null;
	readonly createdAt: Date;
}
