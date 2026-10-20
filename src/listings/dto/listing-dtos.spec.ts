import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { ModerationReasonDto } from '../../moderation/dto/moderation-reason.dto';
import { CreateListingDto } from './create-listing.dto';
import {
	ListListingsQueryDto,
	ModerationListingsQueryDto,
	MyListingsQueryDto,
} from './listing-queries.dto';
import { UpdateListingDto } from './update-listing.dto';

type DtoClass = new () => object;
type Source = 'body' | 'query';

async function validate(
	metatype: DtoClass,
	payload: object,
	type: Source = 'body',
): Promise<{ errors: readonly FieldError[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(payload, {
			type,
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

const base = {
	title: 'Phòng đẹp có gác gần chợ',
	description: 'Phòng sạch sẽ, thoáng mát, giờ giấc tự do.',
	price: 3_500_000,
	areaM2: 22.5,
};

describe('CreateListingDto (spec 0002 AC-5)', () => {
	it('chấp nhận thân tối thiểu', async () => {
		const { errors } = await validate(CreateListingDto, base);
		expect(errors).toEqual([]);
	});

	it('chấp nhận thân đầy đủ kèm tiền cọc và ngày vào ở', async () => {
		const { errors } = await validate(CreateListingDto, {
			...base,
			deposit: 3_500_000,
			availableFrom: '2026-11-01',
		});
		expect(errors).toEqual([]);
	});

	it('cắt khoảng trắng đầu cuối của tiêu đề và mô tả', async () => {
		const { value } = await validate(CreateListingDto, {
			...base,
			title: '  Phòng đẹp có gác  ',
			description: '  Mô tả đủ dài để qua luật.  ',
		});
		expect(value).toMatchObject({
			title: 'Phòng đẹp có gác',
			description: 'Mô tả đủ dài để qua luật.',
		});
	});

	it.each([
		['thiếu tiêu đề', { ...base, title: undefined }, 'title'],
		['tiêu đề 4 ký tự', { ...base, title: 'Phòn' }, 'title'],
		['tiêu đề quá 120 ký tự', { ...base, title: 'a'.repeat(121) }, 'title'],
		['mô tả 9 ký tự', { ...base, description: 'ngắn quá!' }, 'description'],
		[
			'mô tả quá 5000 ký tự',
			{ ...base, description: 'a'.repeat(5001) },
			'description',
		],
		['giá dưới 100000', { ...base, price: 99_999 }, 'price'],
		['giá trên 100 triệu', { ...base, price: 100_000_001 }, 'price'],
		['giá thập phân', { ...base, price: 3_500_000.5 }, 'price'],
		['giá là chuỗi', { ...base, price: '3500000' }, 'price'],
		['thiếu giá', { ...base, price: undefined }, 'price'],
		['diện tích dưới 1', { ...base, areaM2: 0.9 }, 'areaM2'],
		['diện tích trên 1000', { ...base, areaM2: 1000.5 }, 'areaM2'],
		[
			'diện tích hai chữ số thập phân',
			{ ...base, areaM2: 22.55 },
			'areaM2',
		],
		['diện tích là chuỗi', { ...base, areaM2: '22' }, 'areaM2'],
		['tiền cọc âm', { ...base, deposit: -1 }, 'deposit'],
		['tiền cọc trên 1 tỷ', { ...base, deposit: 1_000_000_001 }, 'deposit'],
		['tiền cọc thập phân', { ...base, deposit: 100.5 }, 'deposit'],
		[
			'ngày dạng DD/MM/YYYY',
			{ ...base, availableFrom: '01/11/2026' },
			'availableFrom',
		],
		[
			'ngày không có thật',
			{ ...base, availableFrom: '2026-02-30' },
			'availableFrom',
		],
		[
			'ngày có giờ',
			{ ...base, availableFrom: '2026-11-01T00:00:00Z' },
			'availableFrom',
		],
		['năm 0000', { ...base, availableFrom: '0000-01-01' }, 'availableFrom'],
		['ngày là số', { ...base, availableFrom: 20261101 }, 'availableFrom'],
	])('từ chối %s', async (_name, payload, field) => {
		const { errors } = await validate(CreateListingDto, payload);
		expect(fields(errors)).toEqual([field]);
	});

	it.each([
		['diện tích đúng 1', 1],
		['diện tích đúng 1000', 1000],
		['diện tích một chữ số thập phân', 12.5],
	])('chấp nhận %s', async (_name, areaM2) => {
		const { errors } = await validate(CreateListingDto, {
			...base,
			areaM2,
		});
		expect(errors).toEqual([]);
	});

	it('chấp nhận giá đúng biên 100000 và 100 triệu, cọc 0 và đúng 1 tỷ', async () => {
		for (const payload of [
			{ ...base, price: 100_000 },
			{ ...base, price: 100_000_000 },
			{ ...base, deposit: 0 },
			{ ...base, deposit: 1_000_000_000 },
		]) {
			const { errors } = await validate(CreateListingDto, payload);
			expect(errors).toEqual([]);
		}
	});

	it('chấp nhận ngày đã qua (không kiểm cận dưới) và ngày 29/02 năm nhuận', async () => {
		for (const availableFrom of [
			'2020-01-01',
			'2028-02-29',
			'1999-12-31',
		]) {
			const { errors } = await validate(CreateListingDto, {
				...base,
				availableFrom,
			});
			expect(errors).toEqual([]);
		}
	});

	it('deposit và availableFrom null coi như không gửi', async () => {
		const { errors } = await validate(CreateListingDto, {
			...base,
			deposit: null,
			availableFrom: null,
		});
		expect(errors).toEqual([]);
	});

	it.each(['status', 'code', 'propertyId', 'viewCount', 'landlordId'])(
		'từ chối trường lạ %s (trạng thái, mã và nhà trọ không nhận từ body)',
		async (field) => {
			const { errors } = await validate(CreateListingDto, {
				...base,
				[field]: 'x',
			});
			expect(errors).toContainEqual(
				expect.objectContaining({ field, code: 'whitelistValidation' }),
			);
		},
	);

	it('thông báo lỗi của diện tích và ngày bằng tiếng Việt', async () => {
		const { errors } = await validate(CreateListingDto, {
			...base,
			areaM2: 22.55,
			availableFrom: 'mai',
		});
		for (const error of errors) expect(error.message).toMatch(/\P{ASCII}/u);
	});
});

describe('UpdateListingDto (spec 0002 AC-7)', () => {
	it('chấp nhận thân rỗng', async () => {
		expect((await validate(UpdateListingDto, {})).errors).toEqual([]);
	});

	it('chấp nhận đổi từng trường riêng lẻ', async () => {
		for (const payload of [
			{ title: 'Tiêu đề mới đủ dài' },
			{ description: 'Mô tả mới đủ dài.' },
			{ price: 4_000_000 },
			{ areaM2: 30 },
			{ deposit: 0 },
			{ availableFrom: '2026-12-01' },
		]) {
			expect((await validate(UpdateListingDto, payload)).errors).toEqual(
				[],
			);
		}
	});

	it.each(['title', 'description', 'price', 'areaM2'])(
		'từ chối %s là null, không để làm hỏng cột NOT NULL',
		async (field) => {
			const { errors } = await validate(UpdateListingDto, {
				[field]: null,
			});
			expect(fields(errors)).toEqual([field]);
		},
	);

	it('deposit và availableFrom nhận null để xóa giá trị', async () => {
		const { errors, value } = await validate(UpdateListingDto, {
			deposit: null,
			availableFrom: null,
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ deposit: null, availableFrom: null });
	});

	it('vẫn áp luật biên khi trường có mặt', async () => {
		const { errors } = await validate(UpdateListingDto, {
			title: 'abc',
			price: 1,
			areaM2: 2000,
			deposit: -5,
			availableFrom: 'sai',
		});
		expect(fields(errors).sort()).toEqual([
			'areaM2',
			'availableFrom',
			'deposit',
			'price',
			'title',
		]);
	});

	it.each(['propertyId', 'status', 'code'])(
		'không cho đổi %s',
		async (field) => {
			const { errors } = await validate(UpdateListingDto, {
				[field]: 'x',
			});
			expect(errors).toContainEqual(
				expect.objectContaining({ field, code: 'whitelistValidation' }),
			);
		},
	);
});

describe('ListListingsQueryDto (spec 0002 AC-10, "Biên của GET /listings")', () => {
	const parse = (query: Record<string, string>) =>
		validate(ListListingsQueryDto, query, 'query');

	it('mặc định trang 1, 20 dòng, mới nhất trước', async () => {
		const { errors, value } = await parse({});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ page: 1, pageSize: 20, sort: 'newest' });
	});

	it('nhận đủ bộ lọc và đổi chuỗi thành số', async () => {
		const { errors, value } = await parse({
			q: ' phong dep ',
			wardCode: '26743',
			minPrice: '2000000',
			maxPrice: '5000000',
			sort: 'price_asc',
			page: '2',
			pageSize: '10',
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({
			q: 'phong dep',
			wardCode: '26743',
			minPrice: 2_000_000,
			maxPrice: 5_000_000,
			sort: 'price_asc',
			page: 2,
			pageSize: 10,
		});
	});

	it.each([
		['pageSize 51', { pageSize: '51' }, 'pageSize'],
		['pageSize 0', { pageSize: '0' }, 'pageSize'],
		['page 0', { page: '0' }, 'page'],
		['sort lạ', { sort: 'cheapest' }, 'sort'],
		['wardCode 4 chữ số', { wardCode: '2674' }, 'wardCode'],
		['wardCode có chữ', { wardCode: '2674a' }, 'wardCode'],
		['minPrice âm', { minPrice: '-1' }, 'minPrice'],
		['minPrice thập phân', { minPrice: '1.5' }, 'minPrice'],
		['minPrice không phải số', { minPrice: 'rẻ' }, 'minPrice'],
		['maxPrice quá 100 triệu', { maxPrice: '100000001' }, 'maxPrice'],
		['q quá 500 ký tự', { q: 'a'.repeat(501) }, 'q'],
		['tham số lạ', { landlordId: 'x' }, 'landlordId'],
	])('từ chối %s', async (_name, query, field) => {
		const { errors } = await parse(query);
		expect(fields(errors)).toEqual([field]);
	});

	it('chấp nhận đúng biên pageSize 50 và giá 0 đến 100 triệu', async () => {
		const { errors } = await parse({
			pageSize: '50',
			minPrice: '0',
			maxPrice: '100000000',
		});
		expect(errors).toEqual([]);
	});

	it('minPrice lớn hơn maxPrice do Service chặn (cần so hai trường), DTO chỉ kiểm từng trường', async () => {
		const { errors } = await parse({
			minPrice: '5000000',
			maxPrice: '1000000',
		});
		expect(errors).toEqual([]);
	});
});

describe('MyListingsQueryDto (spec 0002 AC-14)', () => {
	const parse = (query: Record<string, string>) =>
		validate(MyListingsQueryDto, query, 'query');

	it.each(['visible', 'hidden_by_owner', 'hidden_by_admin'])(
		'nhận status %s',
		async (status) => {
			expect((await parse({ status })).errors).toEqual([]);
		},
	);

	it('từ chối status lạ bằng 400', async () => {
		expect(fields((await parse({ status: 'deleted' })).errors)).toEqual([
			'status',
		]);
	});

	it('không có status thì lấy mọi trạng thái', async () => {
		const { errors, value } = await parse({});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ page: 1, pageSize: 20 });
	});
});

describe('ModerationListingsQueryDto (spec 0002 AC-9)', () => {
	const parse = (query: Record<string, string>) =>
		validate(ModerationListingsQueryDto, query, 'query');
	const LANDLORD = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';

	it('không lọc gì thì lấy trang 1 với 20 dòng', async () => {
		const { errors, value } = await parse({});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ page: 1, pageSize: 20 });
	});

	it('nhận đủ ba bộ lọc cùng lúc', async () => {
		const { errors } = await parse({
			status: 'hidden_by_admin',
			landlordId: LANDLORD,
			q: 'bến thành',
		});
		expect(errors).toEqual([]);
	});

	it.each(['deleted', 'HIDDEN_BY_ADMIN', ''])(
		'từ chối status %p bằng 400 VALIDATION_FAILED',
		async (status) => {
			expect(fields((await parse({ status })).errors)).toEqual([
				'status',
			]);
		},
	);

	it('từ chối landlordId không phải UUID bằng 400 (không để Prisma báo lỗi kiểu thành 500)', async () => {
		expect(fields((await parse({ landlordId: 'abc' })).errors)).toEqual([
			'landlordId',
		]);
	});

	it('từ chối pageSize 51 và page 0', async () => {
		expect(fields((await parse({ pageSize: '51' })).errors)).toEqual([
			'pageSize',
		]);
		expect(fields((await parse({ page: '0' })).errors)).toEqual(['page']);
	});

	it('cắt khoảng trắng của q; q quá 500 ký tự bị từ chối', async () => {
		const { value } = await parse({ q: '  ben thanh  ' });
		expect(value).toMatchObject({ q: 'ben thanh' });
		expect(fields((await parse({ q: 'a'.repeat(501) })).errors)).toEqual([
			'q',
		]);
	});

	it('từ chối trường lạ', async () => {
		expect(fields((await parse({ sort: 'newest' })).errors)).toEqual([
			'sort',
		]);
	});
});

describe('ModerationReasonDto trên ẩn và gỡ ẩn tin (spec 0002 AC-9)', () => {
	const parse = (body: object) => validate(ModerationReasonDto, body);

	it('nhận lý do 1 đến 500 ký tự và cắt khoảng trắng', async () => {
		const { errors, value } = await parse({
			reason: '  Ảnh sai sự thật  ',
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ reason: 'Ảnh sai sự thật' });
		expect((await parse({ reason: 'a'.repeat(500) })).errors).toEqual([]);
	});

	it.each([
		{},
		{ reason: '' },
		{ reason: '   ' },
		{ reason: 'a'.repeat(501) },
		{ reason: 7 },
	])('từ chối %j bằng 400 VALIDATION_FAILED', async (body) => {
		expect(fields((await parse(body)).errors)).toEqual(['reason']);
	});
});
