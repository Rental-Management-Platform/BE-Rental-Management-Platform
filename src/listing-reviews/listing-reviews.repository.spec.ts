import type { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
	REVIEW_ID,
	TENANT_ID,
	ownReviewRow,
} from '../reviews/reviews.fixtures';
import { moderationListingReviewRow } from './listing-reviews.fixtures';
import { ListingReviewsRepository } from './listing-reviews.repository';

const LISTING_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d09';

/** Điều kiện hiện công khai viết một lần (spec 0015 AC-1, AC-2). */
const PUBLIC_WHERE = {
	listingId: LISTING_ID,
	status: 'visible',
	author: { status: 'active', deletedAt: null },
};

interface SqlLike {
	readonly strings: readonly string[];
	readonly values: readonly unknown[];
}

function isSqlLike(value: unknown): value is SqlLike {
	return (
		typeof value === 'object' &&
		value !== null &&
		Array.isArray(Reflect.get(value, 'strings')) &&
		Array.isArray(Reflect.get(value, 'values'))
	);
}

function render(
	strings: readonly string[],
	values: readonly unknown[],
	params: unknown[],
): string {
	let text = '';
	strings.forEach((part, index) => {
		text += part;
		if (index >= values.length) return;
		const value = values[index];
		if (isSqlLike(value)) {
			text += render(value.strings, value.values, params);
		} else {
			params.push(value);
			text += `$${params.length}`;
		}
	});
	return text;
}

/** Gom lời gọi thẻ `$queryRaw` đầu tiên của một mock thành câu SQL có `$1`, `$2` và danh sách giá trị. */
function sqlOf(mock: jest.Mock): { text: string; values: unknown[] } {
	const [strings, ...values] = (mock.mock.calls[0] ?? []) as [
		readonly string[],
		...unknown[],
	];
	const params: unknown[] = [];
	const text = render(strings, values, params);
	return { text: text.replace(/\s+/g, ' ').trim(), values: params };
}

describe('ListingReviewsRepository.insertIfAbsent (spec 0015 AC-5)', () => {
	function build(rows: unknown[]) {
		const queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new ListingReviewsRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('một câu INSERT ... ON CONFLICT (author_id, listing_id) DO NOTHING RETURNING vào listing_reviews, người viết và tin là tham số', async () => {
		const { repository, queryRaw } = build([ownReviewRow()]);
		await repository.insertIfAbsent(TENANT_ID, LISTING_ID, 5, 'Tốt');
		expect(queryRaw).toHaveBeenCalledTimes(1);
		const { text, values } = sqlOf(queryRaw);
		expect(text).toContain('INSERT INTO listing_reviews');
		expect(text).not.toContain('INSERT INTO reviews');
		expect(text).toContain(
			'ON CONFLICT (author_id, listing_id) DO NOTHING',
		);
		expect(text).toContain('RETURNING');
		expect(values).toEqual([TENANT_ID, LISTING_ID, 5, 'Tốt']);
	});

	it('không đặt id, status, created_at hay updated_at: DB sinh uuidv7(), visible và giờ hiện tại', async () => {
		const { repository, queryRaw } = build([ownReviewRow()]);
		await repository.insertIfAbsent(TENANT_ID, LISTING_ID, 5, null);
		expect(sqlOf(queryRaw).text).toContain(
			'INSERT INTO listing_reviews (author_id, listing_id, stars, comment)',
		);
	});

	it('nhận xét null được truyền xuống như null', async () => {
		const { repository, queryRaw } = build([ownReviewRow()]);
		await repository.insertIfAbsent(TENANT_ID, LISTING_ID, 3, null);
		expect(sqlOf(queryRaw).values[3]).toBeNull();
	});

	it('cặp đã có (không trả dòng nào) thì trả null', async () => {
		const { repository } = build([]);
		await expect(
			repository.insertIfAbsent(TENANT_ID, LISTING_ID, 5, null),
		).resolves.toBeNull();
	});

	it('trả đúng dòng RETURNING', async () => {
		const row = ownReviewRow();
		const { repository } = build([row]);
		await expect(
			repository.insertIfAbsent(TENANT_ID, LISTING_ID, 4, 'x'),
		).resolves.toBe(row);
	});
});

describe('ListingReviewsRepository.updateOwnVisible (spec 0015 AC-6)', () => {
	function build(rows: unknown[] = [ownReviewRow()]) {
		const queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new ListingReviewsRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('điều kiện visible và đúng cặp (người viết, tin) nằm TRONG câu UPDATE, kèm RETURNING', async () => {
		const { repository, queryRaw } = build();
		await repository.updateOwnVisible(TENANT_ID, LISTING_ID, { stars: 2 });
		const { text, values } = sqlOf(queryRaw);
		expect(text).toContain('UPDATE listing_reviews SET');
		expect(text).toContain("AND status = 'visible'");
		expect(text).toContain('WHERE author_id =');
		expect(text).toContain('AND listing_id =');
		expect(text).toContain('RETURNING');
		expect(values).toEqual([2, TENANT_ID, LISTING_ID]);
	});

	it('luôn đặt updated_at, kể cả khi gửi lại giá trị cũ', async () => {
		const { repository, queryRaw } = build();
		await repository.updateOwnVisible(TENANT_ID, LISTING_ID, { stars: 4 });
		expect(sqlOf(queryRaw).text).toContain(
			'updated_at = clock_timestamp()',
		);
	});

	it('chỉ đặt stars khi chỉ có stars: không đụng cột comment', async () => {
		const { repository, queryRaw } = build();
		await repository.updateOwnVisible(TENANT_ID, LISTING_ID, { stars: 1 });
		const { text } = sqlOf(queryRaw);
		expect(text).toContain('stars =');
		expect(text).not.toContain('comment =');
	});

	it('chỉ đặt comment khi chỉ có comment: không đụng cột stars', async () => {
		const { repository, queryRaw } = build();
		await repository.updateOwnVisible(TENANT_ID, LISTING_ID, {
			comment: 'Mới',
		});
		const { text, values } = sqlOf(queryRaw);
		expect(text).toContain('comment =');
		expect(text).not.toContain('stars =');
		expect(values).toEqual(['Mới', TENANT_ID, LISTING_ID]);
	});

	it('comment null đặt cột về NULL (xóa nhận xét), khác với vắng (giữ nguyên)', async () => {
		const { repository, queryRaw } = build();
		await repository.updateOwnVisible(TENANT_ID, LISTING_ID, {
			comment: null,
		});
		const { text, values } = sqlOf(queryRaw);
		expect(text).toContain('comment =');
		expect(values[0]).toBeNull();
	});

	it('đặt cả hai cột khi có cả hai, theo thứ tự stars rồi comment', async () => {
		const { repository, queryRaw } = build();
		await repository.updateOwnVisible(TENANT_ID, LISTING_ID, {
			stars: 3,
			comment: 'Ổn',
		});
		const { text, values } = sqlOf(queryRaw);
		expect(text.indexOf('stars =')).toBeLessThan(text.indexOf('comment ='));
		expect(values).toEqual([3, 'Ổn', TENANT_ID, LISTING_ID]);
	});

	it('không dòng nào khớp (chưa có, hoặc đang bị ẩn) thì trả null', async () => {
		const { repository } = build([]);
		await expect(
			repository.updateOwnVisible(TENANT_ID, LISTING_ID, { stars: 1 }),
		).resolves.toBeNull();
	});
});

describe('ListingReviewsRepository.deleteOwn (spec 0015 AC-7)', () => {
	it.each([
		[1, true],
		[0, false],
	])(
		'deleteMany đúng cặp (người viết, tin), count %i thì %s',
		async (count, expected) => {
			const deleteMany = jest.fn(() => Promise.resolve({ count }));
			const repository = new ListingReviewsRepository({
				listingReview: { deleteMany },
			} as unknown as PrismaService);
			await expect(
				repository.deleteOwn(TENANT_ID, LISTING_ID),
			).resolves.toBe(expected);
			expect(deleteMany).toHaveBeenCalledWith({
				where: { authorId: TENANT_ID, listingId: LISTING_ID },
			});
		},
	);

	it('không có điều kiện status: xóa được cả đánh giá đang bị ẩn', async () => {
		const deleteMany = jest.fn(() => Promise.resolve({ count: 1 }));
		const repository = new ListingReviewsRepository({
			listingReview: { deleteMany },
		} as unknown as PrismaService);
		await repository.deleteOwn(TENANT_ID, LISTING_ID);
		const call = deleteMany.mock.calls[0] as unknown as [
			{ where: Record<string, unknown> },
		];
		expect(call[0].where).not.toHaveProperty('status');
	});
});

describe('ListingReviewsRepository.findOwn', () => {
	it('tra theo khóa duy nhất (author_id, listing_id), mọi trạng thái, chỉ chọn sáu cột', async () => {
		const findUnique = jest.fn(() => Promise.resolve(ownReviewRow()));
		const repository = new ListingReviewsRepository({
			listingReview: { findUnique },
		} as unknown as PrismaService);
		await repository.findOwn(TENANT_ID, LISTING_ID);
		expect(findUnique).toHaveBeenCalledWith({
			where: {
				authorId_listingId: {
					authorId: TENANT_ID,
					listingId: LISTING_ID,
				},
			},
			select: {
				id: true,
				stars: true,
				comment: true,
				status: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	});
});

describe('ListingReviewsRepository.findPublicPage và summarize dùng CHUNG một điều kiện (spec 0015 AC-1, AC-2)', () => {
	function build() {
		const findMany = jest.fn(() => Promise.resolve([]));
		const count = jest.fn(() => Promise.resolve(0));
		const aggregate = jest.fn(() =>
			Promise.resolve({ _count: { _all: 3 }, _sum: { stars: 12 } }),
		);
		const repository = new ListingReviewsRepository({
			listingReview: { findMany, count, aggregate },
		} as unknown as PrismaService);
		return { repository, findMany, count, aggregate };
	}

	it('danh sách: đánh giá visible của tin mà người viết đang hoạt động và chưa xóa mềm', async () => {
		const { repository, findMany } = build();
		await repository.findPublicPage(LISTING_ID, 0, 20);
		const call = findMany.mock.calls[0] as unknown as [{ where: unknown }];
		expect(call[0].where).toEqual(PUBLIC_WHERE);
	});

	it('sắp mới viết trước (created_at giảm dần rồi id giảm dần), phân trang đúng skip và take', async () => {
		const { repository, findMany } = build();
		await repository.findPublicPage(LISTING_ID, 40, 10);
		const call = findMany.mock.calls[0] as unknown as [
			{ orderBy: unknown; skip: number; take: number },
		];
		expect(call[0].orderBy).toEqual([
			{ createdAt: 'desc' },
			{ id: 'desc' },
		]);
		expect(call[0].skip).toBe(40);
		expect(call[0].take).toBe(10);
	});

	it('chỉ chọn tên người viết: không bao giờ đọc email hay số điện thoại', async () => {
		const { repository, findMany } = build();
		await repository.findPublicPage(LISTING_ID, 0, 20);
		const call = findMany.mock.calls[0] as unknown as [
			{ select: { author: { select: Record<string, boolean> } } },
		];
		expect(call[0].select.author).toEqual({ select: { name: true } });
	});

	it('total đếm đúng điều kiện của danh sách', async () => {
		const { repository, count } = build();
		await repository.findPublicPage(LISTING_ID, 0, 20);
		expect(count).toHaveBeenCalledWith({ where: PUBLIC_WHERE });
	});

	it('hai con số: aggregate với ĐÚNG điều kiện của danh sách, đếm và cộng sao', async () => {
		const { repository, aggregate } = build();
		await expect(repository.summarize(LISTING_ID)).resolves.toEqual({
			count: 3,
			starSum: 12,
		});
		expect(aggregate).toHaveBeenCalledWith({
			where: PUBLIC_WHERE,
			_count: { _all: true },
			_sum: { stars: true },
		});
	});

	it('chưa có đánh giá nào (tổng sao là null) thì starSum là 0', async () => {
		const repository = new ListingReviewsRepository({
			listingReview: {
				aggregate: jest.fn(() =>
					Promise.resolve({
						_count: { _all: 0 },
						_sum: { stars: null },
					}),
				),
			},
		} as unknown as PrismaService);
		await expect(repository.summarize(LISTING_ID)).resolves.toEqual({
			count: 0,
			starSum: 0,
		});
	});

	it('chỉ đọc bảng đánh giá phòng: không chạm model review của đánh giá chủ trọ', async () => {
		const review = {
			findMany: jest.fn(),
			count: jest.fn(),
			aggregate: jest.fn(),
		};
		const listingReview = {
			findMany: jest.fn(() => Promise.resolve([])),
			count: jest.fn(() => Promise.resolve(0)),
			aggregate: jest.fn(() =>
				Promise.resolve({ _count: { _all: 0 }, _sum: { stars: null } }),
			),
		};
		const repository = new ListingReviewsRepository({
			review,
			listingReview,
		} as unknown as PrismaService);
		await repository.findPublicPage(LISTING_ID, 0, 20);
		await repository.summarize(LISTING_ID);
		expect(review.findMany).not.toHaveBeenCalled();
		expect(review.count).not.toHaveBeenCalled();
		expect(review.aggregate).not.toHaveBeenCalled();
	});
});

describe('ListingReviewsRepository.findModerationPage (spec 0015 AC-11)', () => {
	function build() {
		const findMany = jest.fn(() => Promise.resolve([]));
		const count = jest.fn(() => Promise.resolve(0));
		const repository = new ListingReviewsRepository({
			listingReview: { findMany, count },
		} as unknown as PrismaService);
		return { repository, findMany, count };
	}

	it('không lọc: mọi trạng thái, mọi người viết, mọi tin, không điều kiện nào (không áp điều kiện hiện công khai)', async () => {
		const { repository, findMany, count } = build();
		await repository.findModerationPage({}, 0, 20);
		const call = findMany.mock.calls[0] as unknown as [{ where: unknown }];
		expect(call[0].where).toEqual({});
		expect(count).toHaveBeenCalledWith({ where: {} });
	});

	it('lọc theo status, listingId, authorId khi có, và total đếm đúng điều kiện đó', async () => {
		const { repository, findMany, count } = build();
		await repository.findModerationPage(
			{
				status: 'hidden_by_admin',
				listingId: LISTING_ID,
				authorId: TENANT_ID,
			},
			0,
			20,
		);
		const where = {
			status: 'hidden_by_admin',
			listingId: LISTING_ID,
			authorId: TENANT_ID,
		};
		const call = findMany.mock.calls[0] as unknown as [{ where: unknown }];
		expect(call[0].where).toEqual(where);
		expect(count).toHaveBeenCalledWith({ where });
	});

	it('chỉ một bộ lọc thì chỉ một điều kiện', async () => {
		const { repository, findMany } = build();
		await repository.findModerationPage({ listingId: LISTING_ID }, 0, 20);
		const call = findMany.mock.calls[0] as unknown as [{ where: unknown }];
		expect(call[0].where).toEqual({ listingId: LISTING_ID });
	});

	it('mới viết trước, chỉ chọn id và tên người viết, id, mã và tiêu đề của tin: không email hay số điện thoại', async () => {
		const { repository, findMany } = build();
		await repository.findModerationPage({}, 20, 10);
		const call = findMany.mock.calls[0] as unknown as [
			{
				orderBy: unknown;
				skip: number;
				take: number;
				select: {
					author: { select: unknown };
					listing: { select: unknown };
				};
			},
		];
		expect(call[0].orderBy).toEqual([
			{ createdAt: 'desc' },
			{ id: 'desc' },
		]);
		expect(call[0].skip).toBe(20);
		expect(call[0].take).toBe(10);
		expect(call[0].select.author).toEqual({
			select: { id: true, name: true },
		});
		expect(call[0].select.listing).toEqual({
			select: { id: true, code: true, title: true },
		});
	});

	it('chỉ đọc bảng đánh giá phòng: không chạm model review của đánh giá chủ trọ', async () => {
		const review = { findMany: jest.fn(), count: jest.fn() };
		const listingReview = {
			findMany: jest.fn(() => Promise.resolve([])),
			count: jest.fn(() => Promise.resolve(0)),
		};
		const repository = new ListingReviewsRepository({
			review,
			listingReview,
		} as unknown as PrismaService);
		await repository.findModerationPage({}, 0, 20);
		expect(review.findMany).not.toHaveBeenCalled();
		expect(review.count).not.toHaveBeenCalled();
	});
});

describe('ListingReviewsRepository.transition (spec 0015 AC-12)', () => {
	function build(changed: number) {
		const executeRaw = jest.fn(() => Promise.resolve(changed));
		const repository = new ListingReviewsRepository({
			$executeRaw: executeRaw,
		} as unknown as PrismaService);
		return { repository, executeRaw };
	}

	it('MỘT câu UPDATE listing_reviews có điều kiện trạng thái nguồn nằm trong câu, không đụng updated_at', async () => {
		const { repository, executeRaw } = build(1);
		await repository.transition(REVIEW_ID, 'visible', 'hidden_by_admin');
		const { text, values } = sqlOf(executeRaw);
		expect(text).toContain('UPDATE listing_reviews SET status =');
		expect(text).toContain('WHERE id =');
		expect(text).toContain('AND status =');
		expect(text).not.toContain('updated_at');
		expect(values).toEqual(['hidden_by_admin', REVIEW_ID, 'visible']);
	});

	it.each([
		[1, true],
		[0, false],
	])('đổi %i dòng thì trả %s', async (changed, expected) => {
		const { repository } = build(changed);
		await expect(
			repository.transition(REVIEW_ID, 'hidden_by_admin', 'visible'),
		).resolves.toBe(expected);
	});

	it('trong giao dịch thì dùng đúng client của giao dịch, không dùng client chung', async () => {
		const { repository, executeRaw } = build(1);
		const txExecute = jest.fn(() => Promise.resolve(1));
		await repository.transition(REVIEW_ID, 'visible', 'hidden_by_admin', {
			$executeRaw: txExecute,
		} as unknown as Prisma.TransactionClient);
		expect(txExecute).toHaveBeenCalledTimes(1);
		expect(executeRaw).not.toHaveBeenCalled();
	});
});

describe('ListingReviewsRepository.findStatus và findModerationRow (spec 0015 AC-12)', () => {
	it('findStatus trả trạng thái hoặc null khi không có đánh giá', async () => {
		const findUnique = jest
			.fn()
			.mockResolvedValueOnce({ status: 'hidden_by_admin' })
			.mockResolvedValueOnce(null);
		const repository = new ListingReviewsRepository({
			listingReview: { findUnique },
		} as unknown as PrismaService);
		await expect(repository.findStatus(REVIEW_ID)).resolves.toBe(
			'hidden_by_admin',
		);
		await expect(repository.findStatus(REVIEW_ID)).resolves.toBeNull();
		expect(findUnique).toHaveBeenCalledWith({
			where: { id: REVIEW_ID },
			select: { status: true },
		});
	});

	it('findModerationRow tra theo id với đúng phần chọn của admin, hoặc null', async () => {
		const findUnique = jest
			.fn()
			.mockResolvedValueOnce(moderationListingReviewRow())
			.mockResolvedValueOnce(null);
		const repository = new ListingReviewsRepository({
			listingReview: { findUnique },
		} as unknown as PrismaService);
		await expect(repository.findModerationRow(REVIEW_ID)).resolves.toEqual(
			moderationListingReviewRow(),
		);
		await expect(
			repository.findModerationRow(REVIEW_ID),
		).resolves.toBeNull();
		const call = findUnique.mock.calls[0] as unknown as [
			{ where: unknown; select: { listing: unknown } },
		];
		expect(call[0].where).toEqual({ id: REVIEW_ID });
		expect(call[0].select.listing).toEqual({
			select: { id: true, code: true, title: true },
		});
	});
});
