import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { CreatePropertyDto } from './create-property.dto';
import { UpdatePropertyDto } from './update-property.dto';

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

const base = {
	name: 'Nhà trọ Hoa Hồng',
	addressText: '12 Lê Lợi',
	wardCode: '26743',
};

const fee = {
	kind: 'electricity',
	price: 3500,
	unit: 'per_kwh',
};

describe('CreatePropertyDto (spec 0002 AC-3)', () => {
	it('chấp nhận thân tối thiểu: tên, địa chỉ, phường', async () => {
		const { errors } = await validate(CreatePropertyDto, base);
		expect(errors).toEqual([]);
	});

	it('chấp nhận thân đầy đủ kèm phí, tiện ích và tọa độ', async () => {
		const { errors } = await validate(CreatePropertyDto, {
			...base,
			latitude: 10.7721,
			longitude: 106.6983,
			fees: [
				fee,
				{
					kind: 'water',
					price: 20000,
					unit: 'per_m3',
					note: 'Theo đầu người',
				},
			],
			amenityKeys: ['wifi', 'loft'],
		});
		expect(errors).toEqual([]);
	});

	it('cắt khoảng trắng đầu cuối của tên, địa chỉ, mã phường và ghi chú phí', async () => {
		const { value } = await validate(CreatePropertyDto, {
			name: '  Nhà trọ A  ',
			addressText: '  12 Lê Lợi  ',
			wardCode: ' 26743 ',
			fees: [{ ...fee, note: '  ghi chú  ' }],
		});
		expect(value).toMatchObject({
			name: 'Nhà trọ A',
			addressText: '12 Lê Lợi',
			wardCode: '26743',
			fees: [{ note: 'ghi chú' }],
		});
	});

	it.each([
		['thiếu tên', { ...base, name: undefined }, 'name'],
		['tên một ký tự', { ...base, name: 'A' }, 'name'],
		['tên quá 100 ký tự', { ...base, name: 'A'.repeat(101) }, 'name'],
		[
			'địa chỉ dưới 5 ký tự',
			{ ...base, addressText: '12 L' },
			'addressText',
		],
		[
			'địa chỉ quá 200 ký tự',
			{ ...base, addressText: 'A'.repeat(201) },
			'addressText',
		],
		['mã phường 4 chữ số', { ...base, wardCode: '2674' }, 'wardCode'],
		['mã phường có chữ', { ...base, wardCode: '2674a' }, 'wardCode'],
		['mã phường là số', { ...base, wardCode: 26743 }, 'wardCode'],
	])('từ chối %s', async (_name, payload, field) => {
		const { errors } = await validate(CreatePropertyDto, payload);
		expect(fields(errors)).toEqual([field]);
	});

	describe('phí', () => {
		it('từ chối hai khoản cùng loại, không để UNIQUE của DB thành 500', async () => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				fees: [fee, { ...fee, price: 4000 }],
			});
			expect(errors).toContainEqual({
				field: 'fees',
				code: 'arrayUnique',
				message: 'Mỗi loại phí chỉ được khai một khoản.',
			});
		});

		it('từ chối bảy khoản', async () => {
			const kinds = [
				'electricity',
				'water',
				'internet',
				'parking',
				'service',
				'other',
				'electricity',
			];
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				fees: kinds.map((kind) => ({ ...fee, kind })),
			});
			expect(fields(errors)).toContain('fees');
		});

		it('nhận đủ sáu loại, mỗi loại một khoản', async () => {
			const kinds = [
				'electricity',
				'water',
				'internet',
				'parking',
				'service',
				'other',
			];
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				fees: kinds.map((kind) => ({ ...fee, kind })),
			});
			expect(errors).toEqual([]);
		});

		it.each([
			['loại lạ', { ...fee, kind: 'gas' }, 'fees.0.kind'],
			['đơn vị lạ', { ...fee, unit: 'per_day' }, 'fees.0.unit'],
			['giá âm', { ...fee, price: -1 }, 'fees.0.price'],
			['giá thập phân', { ...fee, price: 3500.5 }, 'fees.0.price'],
			[
				'giá quá 100 triệu',
				{ ...fee, price: 100_000_001 },
				'fees.0.price',
			],
			[
				'ghi chú quá 100 ký tự',
				{ ...fee, note: 'a'.repeat(101) },
				'fees.0.note',
			],
			[
				'trường lạ trong khoản phí',
				{ ...fee, discount: 5 },
				'fees.0.discount',
			],
		])('từ chối khoản phí có %s', async (_name, badFee, field) => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				fees: [badFee],
			});
			expect(fields(errors)).toEqual([field]);
		});

		it('chấp nhận giá 0 (miễn phí) và đúng 100 triệu', async () => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				fees: [
					{ ...fee, price: 0 },
					{ kind: 'parking', price: 100_000_000, unit: 'per_month' },
				],
			});
			expect(errors).toEqual([]);
		});

		it('từ chối fees là null (null không hợp lệ ở trường danh sách)', async () => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				fees: null,
			});
			expect(fields(errors)).toEqual(['fees']);
		});
	});

	describe('tiện ích', () => {
		it('từ chối khóa trùng', async () => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				amenityKeys: ['wifi', 'wifi'],
			});
			expect(errors).toContainEqual({
				field: 'amenityKeys',
				code: 'arrayUnique',
				message: 'Tiện ích bị gửi trùng.',
			});
		});

		it('từ chối quá 30 khóa', async () => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				amenityKeys: Array.from({ length: 31 }, (_, i) => `key_${i}`),
			});
			expect(fields(errors)).toEqual(['amenityKeys']);
		});

		it('nhận đúng 30 khóa', async () => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				amenityKeys: Array.from({ length: 30 }, (_, i) => `key_${i}`),
			});
			expect(errors).toEqual([]);
		});

		it('từ chối phần tử không phải chuỗi hoặc quá dài', async () => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				amenityKeys: [5, 'a'.repeat(31)],
			});
			expect(fields(errors)).toEqual(['amenityKeys']);
		});
	});

	describe('tọa độ', () => {
		it.each([
			['chỉ vĩ độ', { latitude: 10.77 }],
			['chỉ kinh độ', { longitude: 106.69 }],
			['vĩ độ số, kinh độ null', { latitude: 10.77, longitude: null }],
			['vĩ độ ngoài biên', { latitude: 91, longitude: 106.69 }],
			['kinh độ ngoài biên', { latitude: 10.77, longitude: 181 }],
			['vĩ độ là chuỗi', { latitude: '10.77', longitude: 106.69 }],
		])('từ chối %s', async (_name, coordinates) => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				...coordinates,
			});
			expect(errors.length).toBeGreaterThan(0);
			for (const error of errors) {
				expect(['latitude', 'longitude']).toContain(error.field);
				expect(error.message).toMatch(/\P{ASCII}/u);
			}
		});

		it('báo lỗi ở cả hai trường khi chỉ gửi một', async () => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				latitude: 10.77,
			});
			expect(fields(errors).sort()).toEqual(['latitude', 'longitude']);
		});

		it.each([
			['cả hai là số', { latitude: -90, longitude: 180 }],
			['cả hai là null', { latitude: null, longitude: null }],
			['cả hai vắng mặt', {}],
		])('chấp nhận %s', async (_name, coordinates) => {
			const { errors } = await validate(CreatePropertyDto, {
				...base,
				...coordinates,
			});
			expect(errors).toEqual([]);
		});
	});

	it('từ chối trường lạ như landlordId (chủ nhà trọ lấy từ token)', async () => {
		const { errors } = await validate(CreatePropertyDto, {
			...base,
			landlordId: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d9e',
		});
		expect(errors).toContainEqual(
			expect.objectContaining({
				field: 'landlordId',
				code: 'whitelistValidation',
			}),
		);
	});
});

describe('UpdatePropertyDto (spec 0002 AC-3)', () => {
	it('chấp nhận thân rỗng (không đổi gì)', async () => {
		const { errors } = await validate(UpdatePropertyDto, {});
		expect(errors).toEqual([]);
	});

	it('chấp nhận đổi từng trường riêng lẻ', async () => {
		for (const payload of [
			{ name: 'Tên mới' },
			{ addressText: '99 Hai Bà Trưng' },
			{ wardCode: '26737' },
			{ fees: [] },
			{ amenityKeys: [] },
		]) {
			const { errors } = await validate(UpdatePropertyDto, payload);
			expect(errors).toEqual([]);
		}
	});

	it.each([
		['name', null],
		['addressText', null],
		['wardCode', null],
		['fees', null],
		['amenityKeys', null],
	])(
		'từ chối %s là null, không để làm hỏng cột NOT NULL',
		async (field, value) => {
			const { errors } = await validate(UpdatePropertyDto, {
				[field]: value,
			});
			expect(fields(errors)).toEqual([field]);
		},
	);

	it('vẫn áp luật độ dài khi trường có mặt', async () => {
		const { errors } = await validate(UpdatePropertyDto, { name: 'A' });
		expect(fields(errors)).toEqual(['name']);
	});

	it('xóa tọa độ bằng null cả hai', async () => {
		const { errors, value } = await validate(UpdatePropertyDto, {
			latitude: null,
			longitude: null,
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ latitude: null, longitude: null });
	});

	it.each([
		['chỉ latitude null', { latitude: null }],
		['chỉ longitude null', { longitude: null }],
		['chỉ latitude số', { latitude: 10 }],
		['một null một số', { latitude: null, longitude: 106 }],
	])('từ chối %s', async (_name, coordinates) => {
		const { errors } = await validate(UpdatePropertyDto, coordinates);
		expect(fields(errors).sort()).toEqual(['latitude', 'longitude']);
	});

	it('thay danh sách phí hợp lệ', async () => {
		const { errors } = await validate(UpdatePropertyDto, {
			fees: [fee, { kind: 'water', price: 18000, unit: 'per_m3' }],
		});
		expect(errors).toEqual([]);
	});

	it('từ chối phí trùng loại ở PATCH', async () => {
		const { errors } = await validate(UpdatePropertyDto, {
			fees: [fee, fee],
		});
		expect(fields(errors)).toEqual(['fees']);
	});
});
