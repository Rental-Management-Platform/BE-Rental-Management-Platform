import {
	averageStars,
	toModerationReview,
	toMyReview,
	toPublicReview,
} from './reviews.mapper';
import {
	CREATED,
	LANDLORD_ID,
	REVIEW_ID,
	TENANT_ID,
	UPDATED,
	moderationReviewRow,
	ownReviewRow,
	publicReviewRow,
} from './reviews.fixtures';

describe('averageStars (spec 0014 AC-1)', () => {
	it('chưa có đánh giá nào thì null, không phải 0', () => {
		expect(averageStars(0, 0)).toBeNull();
	});

	it.each([
		[1, 5, 5],
		[1, 1, 1],
		[2, 9, 4.5],
		[3, 13, 4.3],
		[3, 14, 4.7],
		[3, 8, 2.7],
		[20, 100, 5],
		[7, 7, 1],
	])('%i đánh giá, tổng %i sao thì trung bình %f', (count, sum, expected) => {
		expect(averageStars(count, sum)).toBe(expected);
	});

	it('làm tròn nửa lên: 87 sao trên 20 đánh giá là đúng 4.35 nên ra 4.4', () => {
		expect(averageStars(20, 87)).toBe(4.4);
	});

	it('khớp công thức round(tổng * 10 / số lượng) / 10 của spec với mọi tổng hợp lệ từ 1 đến 60 đánh giá', () => {
		for (let count = 1; count <= 60; count += 1) {
			for (let sum = count; sum <= 5 * count; sum += 1) {
				expect(averageStars(count, sum)).toBe(
					Math.round((sum * 10) / count) / 10,
				);
			}
		}
	});

	it.each([
		[40, 3 * 40 + 1, 3],
		[40, 3 * 40 + 2, 3.1],
		[8, 3 * 8 + 1, 3.1],
		[200, 3 * 200 + 5, 3],
		[200, 3 * 200 + 10, 3.1],
	])(
		'các nửa đúng ở ranh giới: %i đánh giá, tổng %i sao thì %f',
		(count, sum, expected) => {
			expect(averageStars(count, sum)).toBe(expected);
		},
	);

	it('không bao giờ ra giá trị ngoài 1 đến 5 khi mọi đánh giá nằm trong 1 đến 5', () => {
		for (let count = 1; count <= 60; count += 1) {
			for (const sum of [count, count * 3, count * 5]) {
				const average = averageStars(count, sum);
				expect(average).toBeGreaterThanOrEqual(1);
				expect(average).toBeLessThanOrEqual(5);
			}
		}
	});
});

describe('toPublicReview (spec 0014 AC-2)', () => {
	it('đúng bảy trường: không email, số điện thoại, id người viết hay trạng thái', () => {
		const row = {
			...publicReviewRow(),
			status: 'visible',
			author: {
				name: 'Bạn Lan',
				email: 'lan@example.com',
				phone: '0901',
			},
		} as unknown as Parameters<typeof toPublicReview>[0];
		const item = toPublicReview(row, undefined);
		expect(Object.keys(item).sort()).toEqual([
			'author',
			'comment',
			'createdAt',
			'id',
			'isMine',
			'stars',
			'updatedAt',
		]);
		expect(Object.keys(item.author)).toEqual(['name']);
		expect(JSON.stringify(item)).not.toMatch(
			/lan@example|0901|authorId|status/,
		);
	});

	it('giá trị đi qua đúng', () => {
		expect(toPublicReview(publicReviewRow(), undefined)).toEqual({
			id: REVIEW_ID,
			stars: 4,
			comment: 'Chủ trọ trả lời nhanh, phòng đúng như ảnh.',
			author: { name: 'Bạn Lan' },
			isMine: null,
			createdAt: CREATED,
			updatedAt: UPDATED,
		});
	});

	it('isMine: null với khách, true ở dòng của mình, false ở dòng của người khác', () => {
		expect(toPublicReview(publicReviewRow(), undefined).isMine).toBeNull();
		expect(toPublicReview(publicReviewRow(), TENANT_ID).isMine).toBe(true);
		expect(
			toPublicReview(
				publicReviewRow(),
				'0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d99',
			).isMine,
		).toBe(false);
	});

	it('không có nhận xét thì comment là null', () => {
		expect(
			toPublicReview(publicReviewRow({ comment: null }), TENANT_ID)
				.comment,
		).toBeNull();
	});

	it.each([[null], [''], ['   '], ['\t\n']])(
		'tên người viết trống (%j) thì author.name là null',
		(name) => {
			expect(
				toPublicReview(publicReviewRow({ author: { name } }), undefined)
					.author.name,
			).toBeNull();
		},
	);

	it('tên có chữ thì giữ nguyên như đã lưu', () => {
		expect(
			toPublicReview(
				publicReviewRow({ author: { name: ' Chị  Hoa ' } }),
				undefined,
			).author.name,
		).toBe(' Chị  Hoa ');
	});
});

describe('toMyReview (spec 0014 AC-8)', () => {
	it('đánh giá đang hiện: có status visible và hiddenReason là null', () => {
		expect(toMyReview(ownReviewRow(), null)).toEqual({
			id: REVIEW_ID,
			stars: 4,
			comment: 'Chủ trọ trả lời nhanh, phòng đúng như ảnh.',
			status: 'visible',
			hiddenReason: null,
			createdAt: CREATED,
			updatedAt: UPDATED,
		});
	});

	it('đánh giá đang bị ẩn: hiện lý do ẩn gần nhất', () => {
		const item = toMyReview(
			ownReviewRow({ status: 'hidden_by_admin' }),
			'Nội dung xúc phạm cá nhân.',
		);
		expect(item.status).toBe('hidden_by_admin');
		expect(item.hiddenReason).toBe('Nội dung xúc phạm cá nhân.');
	});

	it('đánh giá đang hiện không bao giờ mang lý do, dù lý do truyền vào là của một lần ẩn cũ', () => {
		expect(
			toMyReview(ownReviewRow({ status: 'visible' }), 'Lý do cũ')
				.hiddenReason,
		).toBeNull();
	});

	it('đang bị ẩn mà không có dòng log thì hiddenReason là null', () => {
		expect(
			toMyReview(ownReviewRow({ status: 'hidden_by_admin' }), null)
				.hiddenReason,
		).toBeNull();
	});

	it('không lộ id người viết, id chủ trọ hay cột nào khác', () => {
		const row = {
			...ownReviewRow(),
			authorId: TENANT_ID,
			landlordId: LANDLORD_ID,
		};
		expect(Object.keys(toMyReview(row, null)).sort()).toEqual([
			'comment',
			'createdAt',
			'hiddenReason',
			'id',
			'stars',
			'status',
			'updatedAt',
		]);
	});

	it('trạng thái lạ trong DB là lỗi hệ thống, không lọt ra ngoài', () => {
		expect(() =>
			toMyReview(ownReviewRow({ status: 'deleted' }), null),
		).toThrow('Trạng thái đánh giá không hợp lệ trong DB');
	});
});

describe('toModerationReview (spec 0014 AC-11)', () => {
	it('có id và tên hai bên, đúng chín trường, không email hay số điện thoại', () => {
		const item = toModerationReview(moderationReviewRow(), null);
		expect(Object.keys(item).sort()).toEqual([
			'author',
			'comment',
			'createdAt',
			'hiddenReason',
			'id',
			'landlord',
			'stars',
			'status',
			'updatedAt',
		]);
		expect(item.author).toEqual({ id: TENANT_ID, name: 'Bạn Lan' });
		expect(item.landlord).toEqual({ id: LANDLORD_ID, name: 'Anh Minh' });
	});

	it('hiddenReason chỉ có khi đang bị ẩn', () => {
		expect(
			toModerationReview(
				moderationReviewRow({ status: 'hidden_by_admin' }),
				'Spam',
			).hiddenReason,
		).toBe('Spam');
		expect(
			toModerationReview(moderationReviewRow(), 'Spam').hiddenReason,
		).toBeNull();
	});

	it('tên trống của hai bên thì null', () => {
		const item = toModerationReview(
			moderationReviewRow({
				author: { id: TENANT_ID, name: null },
				landlord: { id: LANDLORD_ID, name: '  ' },
			}),
			null,
		);
		expect(item.author.name).toBeNull();
		expect(item.landlord.name).toBeNull();
	});
});
