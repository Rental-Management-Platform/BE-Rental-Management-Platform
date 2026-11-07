import 'reflect-metadata';
import { HEADERS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { readRouteAccess } from '../common/auth/route-access';
import { RATE_LIMIT_GROUP_KEY } from '../common/rate-limit/rate-limited.decorator';
import type { RateLimitGroup } from '../common/rate-limit/rate-limits';
import { ReviewModerationController } from './review-moderation.controller';
import { LandlordReviewsController } from './reviews.controller';
import { ReviewsModule } from './reviews.module';

type Declaration =
	{ kind: 'permissions'; required: string[] } | { kind: 'public' };

interface Expected {
	handler: string;
	declaration: Declaration;
	group: RateLimitGroup;
	freshAuth: boolean;
	/** Chỉ danh sách công khai đọc đăng nhập tùy chọn: khách và token sai vẫn nhận 200, không bao giờ 401. */
	optionalAuth: boolean;
}

/** Năm route của người viết và danh sách công khai (spec 0014 AC-2, AC-8, AC-9, AC-13). */
const ROUTES: Expected[] = [
	{
		handler: 'list',
		declaration: { kind: 'public' },
		group: 'publicRead',
		freshAuth: false,
		optionalAuth: true,
	},
	{
		handler: 'mine',
		declaration: { kind: 'permissions', required: ['review:read'] },
		group: 'publicRead',
		freshAuth: false,
		optionalAuth: false,
	},
	{
		handler: 'create',
		declaration: { kind: 'permissions', required: ['review:create'] },
		group: 'reviewWrite',
		freshAuth: true,
		optionalAuth: false,
	},
	{
		handler: 'update',
		declaration: { kind: 'permissions', required: ['review:update'] },
		group: 'reviewWrite',
		freshAuth: true,
		optionalAuth: false,
	},
	{
		handler: 'remove',
		declaration: { kind: 'permissions', required: ['review:delete'] },
		group: 'reviewWrite',
		freshAuth: true,
		optionalAuth: false,
	},
];

describe.each(ROUTES)(
	'LandlordReviewsController.$handler: khai báo route (spec 0014 AC-9, AC-13)',
	({ handler: name, declaration, group, freshAuth, optionalAuth }) => {
		const handler = Reflect.get(
			LandlordReviewsController.prototype,
			name,
		) as () => unknown;
		const access = readRouteAccess(new Reflector(), {
			getHandler: () => handler,
			getClass: () => LandlordReviewsController,
		});

		it('đúng một kiểu khai báo quyền', () => {
			expect(access.declarationCount).toBe(1);
			expect(access.declaration).toEqual(declaration);
		});

		it(`thuộc nhóm giới hạn tần suất ${group}`, () => {
			expect(Reflect.getMetadata(RATE_LIMIT_GROUP_KEY, handler)).toBe(
				group,
			);
		});

		it(`${freshAuth ? 'có' : 'không có'} @FreshAuth()`, () => {
			expect(access.freshAuth).toBe(freshAuth);
		});

		it(`${optionalAuth ? 'có' : 'không có'} @OptionalAuth()`, () => {
			expect(access.optionalAuth).toBe(optionalAuth);
		});

		it('trả Cache-Control: private, no-store vì nội dung đổi theo người xem', () => {
			expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([
				{ name: 'Cache-Control', value: 'private, no-store' },
			]);
		});
	},
);

describe('LandlordReviewsController: đường dẫn và mã trạng thái', () => {
	const route = (name: string): { path: unknown; method: unknown } => {
		const handler = Reflect.get(
			LandlordReviewsController.prototype,
			name,
		) as () => unknown;
		return {
			path: Reflect.getMetadata('path', handler),
			method: Reflect.getMetadata('method', handler),
		};
	};

	it('nằm dưới /landlords và có đúng năm route', () => {
		expect(Reflect.getMetadata('path', LandlordReviewsController)).toBe(
			'landlords',
		);
		const handlers = Object.getOwnPropertyNames(
			LandlordReviewsController.prototype,
		).filter((name) => name !== 'constructor');
		expect(handlers.sort()).toEqual(
			['create', 'list', 'mine', 'remove', 'update'].sort(),
		);
	});

	it.each([
		['list', ':id/reviews'],
		['mine', ':id/review'],
		['create', ':id/review'],
		['update', ':id/review'],
		['remove', ':id/review'],
	])(
		'%s: đường dẫn %s, không route nào nhận id của đánh giá',
		(name, path) => {
			expect(route(name).path).toBe(path);
			expect(path).not.toMatch(/:reviewId|reviews\/:/);
		},
	);

	it('xóa trả 204; ghi trả 201 mặc định của POST', () => {
		const remove = Reflect.get(
			LandlordReviewsController.prototype,
			'remove',
		) as () => unknown;
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, remove)).toBe(204);
		const create = Reflect.get(
			LandlordReviewsController.prototype,
			'create',
		) as () => unknown;
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, create)).toBeUndefined();
	});
});

describe('ReviewsModule', () => {
	it('khai controller của người viết', () => {
		const declared = Reflect.getMetadata(
			'controllers',
			ReviewsModule,
		) as unknown[];
		expect(declared).toContain(LandlordReviewsController);
	});
});

/** Ba route kiểm duyệt của admin (spec 0014 AC-11, AC-12, AC-13): chỉ admin giữ review:moderate, không giới hạn tần suất thêm. */
describe.each([
	{ handler: 'list', freshAuth: false },
	{ handler: 'hide', freshAuth: true },
	{ handler: 'unhide', freshAuth: true },
])(
	'ReviewModerationController.$handler: khai báo route',
	({ handler: name, freshAuth }) => {
		const handler = Reflect.get(
			ReviewModerationController.prototype,
			name,
		) as () => unknown;
		const access = readRouteAccess(new Reflector(), {
			getHandler: () => handler,
			getClass: () => ReviewModerationController,
		});

		it('chỉ cần quyền review:moderate, đúng một kiểu khai báo', () => {
			expect(access.declarationCount).toBe(1);
			expect(access.declaration).toEqual({
				kind: 'permissions',
				required: ['review:moderate'],
			});
		});

		it(`${freshAuth ? 'có' : 'không có'} @FreshAuth()`, () => {
			expect(access.freshAuth).toBe(freshAuth);
		});

		it('không có giới hạn tần suất thêm (chỉ admin gọi)', () => {
			expect(
				Reflect.getMetadata(RATE_LIMIT_GROUP_KEY, handler),
			).toBeUndefined();
		});
	},
);

describe('ReviewModerationController: đường dẫn và mã trạng thái', () => {
	it('nằm dưới /moderation/reviews, có đúng ba route', () => {
		expect(Reflect.getMetadata('path', ReviewModerationController)).toBe(
			'moderation/reviews',
		);
		expect(
			Object.getOwnPropertyNames(ReviewModerationController.prototype)
				.filter((name) => name !== 'constructor')
				.sort(),
		).toEqual(['hide', 'list', 'unhide']);
	});

	it.each([
		['hide', ':id/hide'],
		['unhide', ':id/unhide'],
	])('%s: POST %s trả 200 (không phải 201)', (name, path) => {
		const handler = Reflect.get(
			ReviewModerationController.prototype,
			name,
		) as () => unknown;
		expect(Reflect.getMetadata('path', handler)).toBe(path);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
	});

	it('ReviewsModule khai cả hai controller', () => {
		const declared = Reflect.getMetadata(
			'controllers',
			ReviewsModule,
		) as unknown[];
		expect(declared).toContain(ReviewModerationController);
	});
});
