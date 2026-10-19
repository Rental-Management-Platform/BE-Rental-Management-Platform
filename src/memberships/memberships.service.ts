import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `plan` (gói còn hiệu lực) do hàng 10 thêm vào đây. */
export type MembershipState = 'trial' | 'expired';

/** Hạn mức tin đang hiện của một chủ trọ tại một thời điểm, suy ra lúc đọc và không lưu (spec 0003, AC-3). */
export interface Membership {
	readonly state: MembershipState;
	/** Số tin `visible` tối đa được hiện cùng lúc; 0 khi `expired`. */
	readonly limit: number;
	/** Cột `users.trial_ends_at`; `null` với tài khoản không phải chủ trọ. */
	readonly trialEndsAt: Date | null;
}

/**
 * Nơi duy nhất trả lời "chủ trọ này được hiện bao nhiêu tin" (spec 0003, "Hạn mức hiện hành"). Mọi chỗ cần
 * hạn mức (cổng đăng và hiện tin, `/me/membership`, mảnh SQL hiển thị công khai) hỏi qua đây để hàng 10 chỉ
 * phải thêm nhánh "gói còn hiệu lực" vào `resolve`. `now` luôn do nơi gọi truyền xuống (một đồng hồ mỗi request).
 */
@Injectable()
export class MembershipsService {
	constructor(
		private readonly users: UsersService,
		private readonly settings: SettingsService,
	) {}

	/**
	 * Các nhánh theo thứ tự (nhánh 1 thuộc hàng 10):
	 * 1. (hàng 10) gói còn hiệu lực: `state = 'plan'`, hạn mức của gói.
	 * 2. `trial_ends_at` lớn hơn `now` (so sánh chặt: đúng lúc `trial_ends_at` là hết): `state = 'trial'`, hạn mức
	 *    là `trial_listing_limit`.
	 * 3. Còn lại, kể cả tài khoản không có `trial_ends_at` hoặc không còn trong DB: `expired`, hạn mức 0.
	 *
	 * Có `tx` thì mọi lần đọc đi qua giao dịch đó (lúc đang giữ khóa dòng `users`, tránh mượn thêm kết nối).
	 */
	async resolve(
		userId: string,
		now: Date,
		tx?: Prisma.TransactionClient,
	): Promise<Membership> {
		const user = await this.users.findById(userId, tx);
		const trialEndsAt = user?.trialEndsAt ?? null;
		if (trialEndsAt !== null && trialEndsAt.getTime() > now.getTime()) {
			return {
				state: 'trial',
				limit: await this.settings.getValue('trial_listing_limit', tx),
				trialEndsAt,
			};
		}
		return { state: 'expired', limit: 0, trialEndsAt };
	}

	/**
	 * Hạn dùng thử của chủ trọ vừa đăng ký: `now` cộng `trial_days` ngày, chính xác đến mili giây (không làm tròn
	 * theo ngày). `trial_days` đọc ngay lúc đăng ký; đổi sau đó không đụng người đã đăng ký (AC-1).
	 */
	async trialEndsAtForNewLandlord(now: Date): Promise<Date> {
		const days = await this.settings.getValue('trial_days');
		return new Date(now.getTime() + days * DAY_MS);
	}
}
