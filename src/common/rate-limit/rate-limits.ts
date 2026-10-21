import { normalizeIp } from '@nestjs/throttler';

/**
 * Giới hạn tần suất (spec 0002 AC-10, spec 0006): hằng số trong code theo nhóm endpoint, bộ đếm trong
 * bộ nhớ (về 0 khi khởi động lại). Con số do bạn chốt ngày 2026-10-12.
 *
 * Mỗi nhóm chọn bộ đếm nào dùng. Mỗi bộ đếm là một khóa riêng nên đếm riêng:
 * - `ip`: theo IP khách (`req.ip`, tính cả `TRUST_PROXY_HOPS`).
 * - `email`: theo email trong body (đã chuẩn hóa chữ thường, cắt khoảng trắng).
 * - `user`: theo id người dùng đã đăng nhập (route cần đăng nhập).
 *
 * Vượt `limit` lần trong `ttlMs` thì bị chặn đúng `ttlMs` kể từ lần vượt (thư viện throttler đặt thời
 * gian chặn bằng độ dài cửa sổ); header `Retry-After` cho biết còn bao nhiêu giây.
 */
export type RateLimitName = 'ip' | 'email' | 'user';

export type RateLimitGroup =
	| 'register'
	| 'login'
	| 'refresh'
	| 'forgotPassword'
	| 'resetPassword'
	| 'changePassword'
	| 'propertyWrite'
	| 'listingWrite'
	| 'listingImage'
	| 'orderWrite'
	| 'followWrite'
	| 'favoriteWrite'
	| 'profileWrite'
	| 'publicRead'
	| 'publicDetail';

export interface RateLimit {
	/** Số lần được phép trong một cửa sổ. */
	readonly limit: number;
	/** Độ dài cửa sổ, tính bằng mili giây. */
	readonly ttlMs: number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const RATE_LIMIT_NAMES: readonly RateLimitName[] = [
	'ip',
	'email',
	'user',
];

export const RATE_LIMITS: Readonly<
	Record<RateLimitGroup, Readonly<Partial<Record<RateLimitName, RateLimit>>>>
> = {
	register: { ip: { limit: 10, ttlMs: HOUR } },
	login: {
		ip: { limit: 30, ttlMs: 15 * MINUTE },
		email: { limit: 10, ttlMs: 15 * MINUTE },
	},
	refresh: { ip: { limit: 60, ttlMs: MINUTE } },
	forgotPassword: {
		ip: { limit: 10, ttlMs: HOUR },
		email: { limit: 3, ttlMs: HOUR },
	},
	resetPassword: { ip: { limit: 20, ttlMs: HOUR } },
	// Ngoài AC-10: chặn dò mật khẩu hiện tại bằng access token bị đánh cắp.
	changePassword: { user: { limit: 10, ttlMs: 15 * MINUTE } },
	// Spec nhà trọ và tin đăng (0002) AC-15, con số bạn duyệt ngày 2026-10-14: tạo, sửa, xóa nhà trọ.
	propertyWrite: { user: { limit: 30, ttlMs: HOUR } },
	// Cùng bảng đã duyệt: đăng, sửa, xóa, ẩn, hiện tin của chủ trọ.
	listingWrite: { user: { limit: 60, ttlMs: HOUR } },
	// Cùng bảng đã duyệt: tải ảnh lên tin. Xóa ảnh và xem ảnh (`/media`) không giới hạn thêm.
	listingImage: { user: { limit: 60, ttlMs: HOUR } },
	// Spec mua gói (0004) AC-13: tạo, thanh toán, hủy đơn. Mỗi route đếm riêng, chỉ chung con số.
	orderWrite: { user: { limit: 30, ttlMs: HOUR } },
	// Spec theo dõi chủ trọ (0005) AC-9, con số bạn duyệt ngày 2026-10-20: theo dõi và bỏ theo dõi. Mỗi route đếm riêng.
	followWrite: { user: { limit: 60, ttlMs: HOUR } },
	// Spec lưu tin yêu thích (0006) AC-8, con số bạn duyệt ngày 2026-10-20: lưu và bỏ lưu. Mỗi route đếm riêng.
	favoriteWrite: { user: { limit: 120, ttlMs: HOUR } },
	// Spec hồ sơ cá nhân (0008) AC-9, con số bạn duyệt ngày 2026-10-21: sửa hồ sơ. Chỉ `PATCH /me/profile`; `GET` không giới hạn.
	profileWrite: { user: { limit: 30, ttlMs: HOUR } },
	// Danh sách công khai. 300 lần mỗi phút theo IP đủ rộng cho nhiều sinh viên dùng chung một IP ký túc xá.
	publicRead: { ip: { limit: 300, ttlMs: MINUTE } },
	// Chi tiết tin công khai. Bộ đếm `user` chỉ chạy khi request có người đăng nhập (xem `hasUser`), để một
	// tài khoản miễn phí không cào số điện thoại của mọi chủ trọ; khách chỉ chịu bộ đếm `ip`.
	publicDetail: {
		ip: { limit: 300, ttlMs: MINUTE },
		user: { limit: 60, ttlMs: MINUTE },
	},
};

/** Mặc định của ba bộ đếm; chỉ là lưới an toàn, vì mỗi route gắn `@RateLimited` đặt số riêng. */
export const RATE_LIMIT_DEFAULT: RateLimit = { limit: 100, ttlMs: MINUTE };

const MAX_EMAIL_LENGTH = 254;

function readString(value: unknown, key: string): string | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const field: unknown = Reflect.get(value, key);
	return typeof field === 'string' ? field : undefined;
}

function ipOf(req: Record<string, unknown>): string {
	const ip = req['ip'];
	return typeof ip === 'string' && ip.length > 0
		? normalizeIp(ip)
		: 'unknown';
}

/**
 * Khóa của bộ đếm `email`: email trong body, chuẩn hóa. Không có email hợp lệ (thiếu, sai kiểu, quá
 * dài) thì rơi về IP để không ai né giới hạn bằng body lạ. Chạy trước ValidationPipe nên body chưa được
 * kiểm tra: không bao giờ ném lỗi.
 */
export function emailTrackerKey(req: Record<string, unknown>): string {
	const email = readString(req['body'], 'email')?.trim().toLowerCase();
	if (
		email !== undefined &&
		email.length > 0 &&
		email.length <= MAX_EMAIL_LENGTH
	) {
		return `email:${email}`;
	}
	return `ip:${ipOf(req)}`;
}

/** Request có người đăng nhập (JwtAuthGuard đã gắn `req.user`)? Khách và token sai đều là `false`. */
export function hasUser(req: Record<string, unknown>): boolean {
	return readString(req['user'], 'userId') !== undefined;
}

/** Khóa của bộ đếm `user`: id người dùng do JwtAuthGuard gắn vào request; không có thì rơi về IP. */
export function userTrackerKey(req: Record<string, unknown>): string {
	const userId = readString(req['user'], 'userId');
	return userId === undefined ? `ip:${ipOf(req)}` : `user:${userId}`;
}
