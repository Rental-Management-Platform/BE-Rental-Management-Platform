import 'reflect-metadata';
import { HEADERS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { readRouteAccess } from '../common/auth/route-access';
import { RATE_LIMIT_GROUP_KEY } from '../common/rate-limit/rate-limited.decorator';
import type { RateLimitGroup } from '../common/rate-limit/rate-limits';
import { ListingReviewModerationController } from './listing-review-moderation.controller';
import { ListingReviewModerationService } from './listing-review-moderation.service';
import { ListingReviewsController } from './listing-reviews.controller';
import { ListingReviewsModule } from './listing-reviews.module';
import { ListingReviewsService } from './listing-reviews.service';

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

/** Năm route của người viết và danh sách công khai (spec 0015 AC-2, AC-8, AC-9, AC-13). */
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
	'ListingReviewsController.$handler: khai báo route (spec 0015 AC-9, AC-13)',
	({ handler: name, declaration, group, freshAuth, optionalAuth }) => {
		const handler = Reflect.get(
			ListingReviewsController.prototype,
			name,
		) as () => unknown;
		const access = readRouteAccess(new Reflector(), {
			getHandler: () => handler,
			getClass: () => ListingReviewsController,
		});

		it('đúng một kiểu khai báo quyền', () => {
			expect(access.declarationCount).toBe(1);
			expect(access.declaration).toEqual(declaration);
		});

		it(`thuộc nhóm giới hạn tần suất ${group} (nhóm có sẵn, không thêm nhóm mới)`, () => {
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

describe('ListingReviewsController: đường dẫn và mã trạng thái', () => {
	const route = (name: string): { path: unknown; method: unknown } => {
		const handler = Reflect.get(
			ListingReviewsController.prototype,
			name,
		) as () => unknown;
		return {
			path: Reflect.getMetadata('path', handler),
			method: Reflect.getMetadata('method', handler),
		};
	};

	it('nằm dưới /listings và có đúng năm route', () => {
		expect(Reflect.getMetadata('path', ListingReviewsController)).toBe(
			'listings',
		);
		const handlers = Object.getOwnPropertyNames(
			ListingReviewsController.prototype,
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
		'%s: đường dẫn %s có hai đoạn (không đụng GET /listings/:slugCode), không route nào nhận id của đánh giá',
		(name, path) => {
			expect(route(name).path).toBe(path);
			expect(path.split('/')).toHaveLength(2);
			expect(path).not.toMatch(/:reviewId|reviews\/:/);
		},
	);

	it('xóa trả 204; ghi trả 201 mặc định của POST', () => {
		const remove = Reflect.get(
			ListingReviewsController.prototype,
			'remove',
		) as () => unknown;
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, remove)).toBe(204);
		const create = Reflect.get(
			ListingReviewsController.prototype,
			'create',
		) as () => unknown;
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, create)).toBeUndefined();
	});
});

describe('ListingReviewsModule', () => {
	it('khai controller của người viết', () => {
		const declared = Reflect.getMetadata(
			'controllers',
			ListingReviewsModule,
		) as unknown[];
		expect(declared).toContain(ListingReviewsController);
	});

	it('khai cả controller kiểm duyệt của admin và hai Service', () => {
		const controllers = Reflect.getMetadata(
			'controllers',
			ListingReviewsModule,
		) as unknown[];
		expect(controllers).toContain(ListingReviewModerationController);
		const providers = Reflect.getMetadata(
			'providers',
			ListingReviewsModule,
		) as unknown[];
		expect(providers).toEqual(
			expect.arrayContaining([
				ListingReviewsService,
				ListingReviewModerationService,
			]),
		);
	});
});

/** Ba route kiểm duyệt của admin (spec 0015 AC-11, AC-12, AC-13): chỉ admin giữ review:moderate, không giới hạn tần suất thêm. */
describe.each([
	{ handler: 'list', freshAuth: false },
	{ handler: 'hide', freshAuth: true },
	{ handler: 'unhide', freshAuth: true },
])(
	'ListingReviewModerationController.$handler: khai báo route (spec 0015 AC-11, AC-12, AC-13)',
	({ handler: name, freshAuth }) => {
		const handler = Reflect.get(
			ListingReviewModerationController.prototype,
			name,
		) as () => unknown;
		const access = readRouteAccess(new Reflector(), {
			getHandler: () => handler,
			getClass: () => ListingReviewModerationController,
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

		it('không đọc đăng nhập tùy chọn: admin phải có token', () => {
			expect(access.optionalAuth).toBe(false);
		});

		it('không có giới hạn tần suất thêm (chỉ admin gọi, không thêm nhóm)', () => {
			expect(
				Reflect.getMetadata(RATE_LIMIT_GROUP_KEY, handler),
			).toBeUndefined();
		});
	},
);

describe('ListingReviewModerationController: đường dẫn và mã trạng thái', () => {
	it('nằm dưới /moderation/listing-reviews, có đúng ba route', () => {
		expect(
			Reflect.getMetadata('path', ListingReviewModerationController),
		).toBe('moderation/listing-reviews');
		expect(
			Object.getOwnPropertyNames(
				ListingReviewModerationController.prototype,
			)
				.filter((name) => name !== 'constructor')
				.sort(),
		).toEqual(['hide', 'list', 'unhide']);
	});

	it.each([
		['hide', ':id/hide'],
		['unhide', ':id/unhide'],
	])('%s: POST %s trả 200 (không phải 201)', (name, path) => {
		const handler = Reflect.get(
			ListingReviewModerationController.prototype,
			name,
		) as () => unknown;
		expect(Reflect.getMetadata('path', handler)).toBe(path);
		expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
	});

	it('đường dẫn kiểm duyệt khác đường dẫn đánh giá chủ trọ, nên hai danh sách không lẫn', () => {
		expect(
			Reflect.getMetadata('path', ListingReviewModerationController),
		).not.toBe('moderation/reviews');
	});
});
