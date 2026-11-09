import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { ListingReviewModerationQueryDto } from './listing-review-moderation-query.dto';

const fields = (errors: readonly FieldError[]): string[] => [
	...new Set(errors.map((error) => error.field)),
];

describe('ListingReviewModerationQueryDto (spec 0015 AC-11)', () => {
	const UUID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';

	async function validateQuery(payload: object) {
		try {
			const value: unknown = await createValidationPipe().transform(
				payload,
				{
					type: 'query',
					metatype: ListingReviewModerationQueryDto,
				},
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
			listingId: UUID,
			authorId: UUID,
			page: '2',
			pageSize: '10',
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({
			status: 'hidden_by_admin',
			listingId: UUID,
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
		['listingId không phải UUID', { listingId: 'abc' }, 'listingId'],
		['authorId không phải UUID', { authorId: '123' }, 'authorId'],
		['page 0', { page: '0' }, 'page'],
		['pageSize 51', { pageSize: '51' }, 'pageSize'],
	])('%s: 400 kèm đúng trường', async (_name, payload, field) => {
		const { errors } = await validateQuery(payload);
		expect(fields(errors)).toEqual([field]);
	});

	it.each([['q'], ['sort'], ['reason'], ['landlordId']])(
		'tham số lạ %s bị từ chối (landlordId là bộ lọc của đánh giá chủ trọ, không phải của đánh giá phòng)',
		async (name) => {
			const { errors } = await validateQuery({ [name]: UUID });
			expect(errors.length).toBeGreaterThan(0);
		},
	);
});
