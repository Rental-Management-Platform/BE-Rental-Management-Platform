import {
	emailTrackerKey,
	hasUser,
	RATE_LIMIT_NAMES,
	RATE_LIMITS,
	userTrackerKey,
} from './rate-limits';
import type { RateLimitGroup } from './rate-limits';

describe('giới hạn tần suất: khóa của bộ đếm', () => {
	describe('emailTrackerKey', () => {
		it('chuẩn hóa chữ thường và cắt khoảng trắng', () => {
			expect(
				emailTrackerKey({
					ip: '1.2.3.4',
					body: { email: '  An@Example.COM ' },
				}),
			).toBe('email:an@example.com');
		});

		it('cùng một email viết khác kiểu cho cùng một khóa', () => {
			const a = emailTrackerKey({ body: { email: 'an@example.com' } });
			const b = emailTrackerKey({ body: { email: 'AN@EXAMPLE.COM' } });
			expect(a).toBe(b);
		});

		it.each([
			['không có body', {}],
			['body là null', { body: null }],
			['body là chuỗi', { body: 'email=a@b.c' }],
			['thiếu email', { body: { password: 'x' } }],
			['email là số', { body: { email: 123 } }],
			['email là mảng', { body: { email: ['a@b.c', 'd@e.f'] } }],
			['email là object', { body: { email: { $ne: '' } } }],
			['email rỗng', { body: { email: '   ' } }],
			[
				'email dài hơn 254 ký tự',
				{ body: { email: `${'a'.repeat(300)}@x.y` } },
			],
		])('rơi về IP khi %s, không ném lỗi', (_name, partial) => {
			expect(emailTrackerKey({ ip: '1.2.3.4', ...partial })).toBe(
				'ip:1.2.3.4',
			);
		});

		it('không có cả email lẫn IP thì dùng khóa chung "unknown"', () => {
			expect(emailTrackerKey({})).toBe('ip:unknown');
		});
	});

	describe('userTrackerKey', () => {
		it('lấy id người dùng do JwtAuthGuard gắn vào request', () => {
			expect(
				userTrackerKey({ ip: '1.2.3.4', user: { userId: 'u-1' } }),
			).toBe('user:u-1');
		});

		it.each([
			['chưa đăng nhập', {}],
			['user là null', { user: null }],
			['userId không phải chuỗi', { user: { userId: 42 } }],
		])('rơi về IP khi %s', (_name, partial) => {
			expect(userTrackerKey({ ip: '1.2.3.4', ...partial })).toBe(
				'ip:1.2.3.4',
			);
		});
	});
});

describe('hasUser', () => {
	it('có người đăng nhập khi JwtAuthGuard đã gắn userId', () => {
		expect(hasUser({ user: { userId: 'u-1' } })).toBe(true);
	});

	it.each([
		['khách', {}],
		['user là null', { user: null }],
		['userId không phải chuỗi', { user: { userId: 42 } }],
	])('không có người dùng với %s', (_name, req) => {
		expect(hasUser(req)).toBe(false);
	});
});

describe('giới hạn tần suất: bảng RATE_LIMITS', () => {
	const groups = Object.keys(RATE_LIMITS) as RateLimitGroup[];

	it('có đủ mười bốn nhóm: spec đăng nhập AC-10, đổi mật khẩu, nhà trọ và ảnh tin AC-15 (spec 0002), đơn mua gói (spec 0004 AC-13), theo dõi chủ trọ (spec 0005 AC-9) và lưu tin yêu thích (spec 0006 AC-8)', () => {
		expect([...groups].sort()).toEqual(
			[
				'changePassword',
				'favoriteWrite',
				'followWrite',
				'forgotPassword',
				'listingImage',
				'listingWrite',
				'login',
				'orderWrite',
				'propertyWrite',
				'publicDetail',
				'publicRead',
				'refresh',
				'register',
				'resetPassword',
			].sort(),
		);
	});

	it.each(groups)('nhóm %s có ít nhất một bộ đếm và số hợp lệ', (group) => {
		const entries = Object.entries(RATE_LIMITS[group]);
		expect(entries.length).toBeGreaterThan(0);
		for (const [name, rule] of entries) {
			expect(RATE_LIMIT_NAMES).toContain(name);
			expect(Number.isInteger(rule.limit)).toBe(true);
			expect(rule.limit).toBeGreaterThan(0);
			expect(Number.isInteger(rule.ttlMs)).toBe(true);
			expect(rule.ttlMs).toBeGreaterThanOrEqual(60 * 1000);
		}
	});

	it('route công khai không dùng bộ đếm user, route cần đăng nhập chỉ dùng user', () => {
		for (const group of [
			'register',
			'login',
			'refresh',
			'forgotPassword',
			'resetPassword',
		] as const) {
			expect(RATE_LIMITS[group].user).toBeUndefined();
			expect(RATE_LIMITS[group].ip).toBeDefined();
		}
		expect(Object.keys(RATE_LIMITS.changePassword)).toEqual(['user']);
		expect(Object.keys(RATE_LIMITS.propertyWrite)).toEqual(['user']);
		expect(Object.keys(RATE_LIMITS.listingWrite)).toEqual(['user']);
		expect(Object.keys(RATE_LIMITS.listingImage)).toEqual(['user']);
		expect(Object.keys(RATE_LIMITS.orderWrite)).toEqual(['user']);
		expect(Object.keys(RATE_LIMITS.followWrite)).toEqual(['user']);
		expect(Object.keys(RATE_LIMITS.favoriteWrite)).toEqual(['user']);
		expect(Object.keys(RATE_LIMITS.publicRead)).toEqual(['ip']);
		expect(Object.keys(RATE_LIMITS.publicDetail).sort()).toEqual([
			'ip',
			'user',
		]);
	});

	it('chỉ login và forgotPassword đếm theo email', () => {
		const withEmail = groups.filter(
			(group) => RATE_LIMITS[group].email !== undefined,
		);
		expect(withEmail.sort()).toEqual(['forgotPassword', 'login']);
	});

	it('con số đúng bảng đã chốt ngày 2026-10-12, cộng nhóm nhà trọ và ảnh tin chốt ngày 2026-10-14, nhóm đơn chốt ngày 2026-10-19 và các nhóm theo dõi, lưu tin chốt ngày 2026-10-20', () => {
		const minute = 60 * 1000;
		const hour = 60 * minute;
		expect(RATE_LIMITS).toEqual({
			register: { ip: { limit: 10, ttlMs: hour } },
			login: {
				ip: { limit: 30, ttlMs: 15 * minute },
				email: { limit: 10, ttlMs: 15 * minute },
			},
			refresh: { ip: { limit: 60, ttlMs: minute } },
			forgotPassword: {
				ip: { limit: 10, ttlMs: hour },
				email: { limit: 3, ttlMs: hour },
			},
			resetPassword: { ip: { limit: 20, ttlMs: hour } },
			changePassword: { user: { limit: 10, ttlMs: 15 * minute } },
			propertyWrite: { user: { limit: 30, ttlMs: hour } },
			listingWrite: { user: { limit: 60, ttlMs: hour } },
			listingImage: { user: { limit: 60, ttlMs: hour } },
			orderWrite: { user: { limit: 30, ttlMs: hour } },
			followWrite: { user: { limit: 60, ttlMs: hour } },
			favoriteWrite: { user: { limit: 120, ttlMs: hour } },
			publicRead: { ip: { limit: 300, ttlMs: minute } },
			publicDetail: {
				ip: { limit: 300, ttlMs: minute },
				user: { limit: 60, ttlMs: minute },
			},
		});
	});
});
