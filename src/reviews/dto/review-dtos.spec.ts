import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { CreateReviewDto } from './create-review.dto';
import { ReviewModerationQueryDto } from './review-queries.dto';
import { UpdateReviewDto } from './update-review.dto';

type DtoClass = new () => object;

async function validate(
	metatype: DtoClass,
	payload: object,
): Promise<{ errors: readonly FieldError[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(payload, {
			type: 'body',
			metatype,
		});
		return { errors: [], value };
	} catch (error: unknown) {
		if (error instanceof AppException) {
			return { errors: error.fieldErrors, value: undefined };
		}
		throw error;
	}
}

const fields = (errors: readonly FieldError[]): string[] => [
	...new Set(errors.map((error) => error.field)),
];

describe('CreateReviewDto (spec 0014 AC-3)', () => {
	it.each([1, 2, 3, 4, 5])('stars %i qua', async (stars) => {
		const { errors } = await validate(CreateReviewDto, { stars });
		expect(errors).toEqual([]);
	});

	it.each([
		['0', { stars: 0 }],
		['6', { stars: 6 }],
		['-1', { stars: -1 }],
		['4.5', { stars: 4.5 }],
		['chuỗi "5"', { stars: '5' }],
		['null', { stars: null }],
		['mảng', { stars: [5] }],
		['thiếu', {}],
	])('stars %s: 400 kèm trường stars', async (_name, payload) => {
		const { errors } = await validate(CreateReviewDto, payload);
		expect(fields(errors)).toEqual(['stars']);
	});

	it('comment vắng hoặc null là không có nhận xét', async () => {
		expect((await validate(CreateReviewDto, { stars: 5 })).errors).toEqual(
			[],
		);
		const { errors, value } = await validate(CreateReviewDto, {
			stars: 5,
			comment: null,
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ comment: null });
	});

	it('comment hợp lệ qua và bỏ khoảng trắng hai đầu', async () => {
		const { errors, value } = await validate(CreateReviewDto, {
			stars: 4,
			comment: '   Chủ trọ tốt  ',
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ comment: 'Chủ trọ tốt' });
	});

	it('xuống dòng ở giữa được giữ nguyên', async () => {
		const { errors, value } = await validate(CreateReviewDto, {
			stars: 4,
			comment: 'Dòng một\nDòng hai',
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ comment: 'Dòng một\nDòng hai' });
	});

	it('đúng 1 ký tự và đúng 1000 ký tự đều qua; 1000 ký tự cộng khoảng trắng hai đầu vẫn qua vì đếm sau khi bỏ', async () => {
		for (const comment of [
			'a',
			'a'.repeat(1000),
			`  ${'a'.repeat(1000)}\n `,
		]) {
			expect(
				(await validate(CreateReviewDto, { stars: 3, comment })).errors,
			).toEqual([]);
		}
	});

	it.each([
		['rỗng', ''],
		['toàn khoảng trắng', '   \n\t '],
		['1001 ký tự', 'a'.repeat(1001)],
		['là số', 42],
		['là mảng', ['tốt']],
		['là object', { text: 'tốt' }],
		['có NUL ở giữa', 'tốt\u0000lắm'],
		['chỉ có NUL', '\u0000'],
	])('comment %s: 400 kèm trường comment', async (_name, comment) => {
		const { errors } = await validate(CreateReviewDto, {
			stars: 5,
			comment,
		});
		expect(fields(errors)).toEqual(['comment']);
	});

	it('đếm ký tự Unicode như char_length của DB: 1000 emoji qua, 1001 emoji bị từ chối', async () => {
		expect(
			(
				await validate(CreateReviewDto, {
					stars: 5,
					comment: '😀'.repeat(1000),
				})
			).errors,
		).toEqual([]);
		expect(
			fields(
				(
					await validate(CreateReviewDto, {
						stars: 5,
						comment: '😀'.repeat(1001),
					})
				).errors,
			),
		).toEqual(['comment']);
	});

	it.each([
		['authorId', { authorId: 'x' }],
		['landlordId', { landlordId: 'x' }],
		['status', { status: 'hidden_by_admin' }],
		['id', { id: 'x' }],
		['hiddenReason', { hiddenReason: 'x' }],
	])(
		'trường lạ %s bị từ chối: người viết và chủ trọ không bao giờ nhận từ body',
		async (_name, extra) => {
			const { errors } = await validate(CreateReviewDto, {
				stars: 5,
				...extra,
			});
			expect(errors.length).toBeGreaterThan(0);
		},
	);
});

describe('UpdateReviewDto (spec 0014 AC-6)', () => {
	it('chỉ stars qua; chỉ comment qua; cả hai qua', async () => {
		expect((await validate(UpdateReviewDto, { stars: 2 })).errors).toEqual(
			[],
		);
		expect(
			(await validate(UpdateReviewDto, { comment: 'Mới' })).errors,
		).toEqual([]);
		expect(
			(await validate(UpdateReviewDto, { stars: 2, comment: 'Mới' }))
				.errors,
		).toEqual([]);
	});

	it('body rỗng bị từ chối ngay ở pipe (nên admin gửi body rỗng nhận 400 chứ không phải 403)', async () => {
		const { errors } = await validate(UpdateReviewDto, {});
		expect(fields(errors)).toEqual(['stars']);
		expect(errors[0]?.message).toContain('ít nhất một');
	});

	it('comment: null xóa nhận xét và tự nó là một body hợp lệ', async () => {
		const { errors, value } = await validate(UpdateReviewDto, {
			comment: null,
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ comment: null });
	});

	it('stars: null không hợp lệ (cột bắt buộc), kể cả khi có comment', async () => {
		expect(
			fields((await validate(UpdateReviewDto, { stars: null })).errors),
		).toEqual(['stars']);
		expect(
			fields(
				(
					await validate(UpdateReviewDto, {
						stars: null,
						comment: 'Mới',
					})
				).errors,
			),
		).toEqual(['stars']);
	});

	it.each([
		['0', { stars: 0 }],
		['6', { stars: 6 }],
		['4.5', { stars: 4.5 }],
		['chuỗi "5"', { stars: '5' }],
	])('stars %s bị từ chối', async (_name, payload) => {
		expect(
			fields((await validate(UpdateReviewDto, payload)).errors),
		).toEqual(['stars']);
	});

	it.each([
		['rỗng', ''],
		['toàn khoảng trắng', '  '],
		['1001 ký tự', 'a'.repeat(1001)],
		['có NUL', 'a\u0000b'],
		['là số', 7],
	])(
		'comment %s bị từ chối, kể cả khi có stars hợp lệ',
		async (_name, comment) => {
			expect(
				fields(
					(await validate(UpdateReviewDto, { stars: 3, comment }))
						.errors,
				),
			).toEqual(['comment']);
		},
	);

	it('trường lạ bị từ chối', async () => {
		const { errors } = await validate(UpdateReviewDto, {
			stars: 3,
			status: 'visible',
		});
		expect(errors.length).toBeGreaterThan(0);
	});
});

describe('ReviewModerationQueryDto (spec 0014 AC-11)', () => {
	const UUID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';

	async function validateQuery(payload: object) {
		try {
			const value: unknown = await createValidationPipe().transform(
				payload,
				{ type: 'query', metatype: ReviewModerationQueryDto },
			);
			return { errors: [] as readonly FieldError[], value };
		} catch (error: unknown) {
			if (error instanceof AppException) {
				return { errors: error.fieldErrors, value: undefined };
			}
			throw error;
		}
	}

	it('không có tham số nào: mặc định trang 1, 20 dòng', async () => {
		const { errors, value } = await validateQuery({});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ page: 1, pageSize: 20 });
	});

	it('nhận đủ ba bộ lọc hợp lệ cùng phân trang', async () => {
		const { errors, value } = await validateQuery({
			status: 'hidden_by_admin',
			landlordId: UUID,
			authorId: UUID,
			page: '2',
			pageSize: '10',
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({
			status: 'hidden_by_admin',
			landlordId: UUID,
			authorId: UUID,
			page: 2,
			pageSize: 10,
		});
	});

	it.each(['visible', 'hidden_by_admin'])('status %s qua', async (status) => {
		expect((await validateQuery({ status })).errors).toEqual([]);
	});

	it.each([
		['status lạ', { status: 'deleted' }, 'status'],
		['status hoa thường khác', { status: 'Visible' }, 'status'],
		['landlordId không phải UUID', { landlordId: 'abc' }, 'landlordId'],
		['authorId không phải UUID', { authorId: '123' }, 'authorId'],
		['page 0', { page: '0' }, 'page'],
		['pageSize 51', { pageSize: '51' }, 'pageSize'],
	])('%s: 400 kèm đúng trường', async (_name, payload, field) => {
		const { errors } = await validateQuery(payload);
		expect(fields(errors)).toEqual([field]);
	});

	it.each([['q'], ['sort'], ['reason']])(
		'tham số lạ %s bị từ chối',
		async (name) => {
			const { errors } = await validateQuery({ [name]: 'x' });
			expect(errors.length).toBeGreaterThan(0);
		},
	);
});
