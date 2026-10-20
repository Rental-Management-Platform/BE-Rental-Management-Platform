import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { CreateAmenityDto, UpdateAmenityDto } from './amenity.dto';
import { CreateWardDto, UpdateWardDto } from './ward.dto';

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

const ward = {
	code: '26743',
	name: 'Phường Bến Thành',
	provinceCode: '79',
	provinceName: 'Thành phố Hồ Chí Minh',
};

describe('CreateWardDto (spec 0002 AC-2)', () => {
	it('nhận thân đầy đủ', async () => {
		expect((await validate(CreateWardDto, ward)).errors).toEqual([]);
	});

	it('cắt khoảng trắng của tên', async () => {
		const { value } = await validate(CreateWardDto, {
			...ward,
			name: '  Phường Bến Thành  ',
		});
		expect(value).toMatchObject({ name: 'Phường Bến Thành' });
	});

	it.each(['2674', '267430', 'abcde', '2674a', ' 26743', ''])(
		'từ chối mã phường %p (phải đúng 5 chữ số)',
		async (code) => {
			expect(
				fields(
					(await validate(CreateWardDto, { ...ward, code })).errors,
				),
			).toEqual(['code']);
		},
	);

	it.each(['7', '790', 'ab', ''])(
		'từ chối mã tỉnh %p (phải đúng 2 chữ số)',
		async (provinceCode) => {
			expect(
				fields(
					(await validate(CreateWardDto, { ...ward, provinceCode }))
						.errors,
				),
			).toEqual(['provinceCode']);
		},
	);

	it('bắt buộc cả bốn trường', async () => {
		expect(
			fields((await validate(CreateWardDto, {})).errors).sort(),
		).toEqual(['code', 'name', 'provinceCode', 'provinceName']);
	});

	it('từ chối tên rỗng hoặc dài quá 100 ký tự và trường lạ', async () => {
		expect(
			fields(
				(await validate(CreateWardDto, { ...ward, name: ' ' })).errors,
			),
		).toEqual(['name']);
		expect(
			fields(
				(
					await validate(CreateWardDto, {
						...ward,
						name: 'a'.repeat(101),
					})
				).errors,
			),
		).toEqual(['name']);
		expect(
			fields(
				(await validate(CreateWardDto, { ...ward, quan: 'Quận 1' }))
					.errors,
			),
		).toEqual(['quan']);
	});
});

describe('UpdateWardDto (spec 0002 AC-2)', () => {
	it('nhận thân rỗng (không đổi gì) và từng trường riêng', async () => {
		expect((await validate(UpdateWardDto, {})).errors).toEqual([]);
		expect(
			(await validate(UpdateWardDto, { name: 'Phường Sài Gòn' })).errors,
		).toEqual([]);
		expect(
			(
				await validate(UpdateWardDto, {
					provinceName: 'Thành phố Hồ Chí Minh',
				})
			).errors,
		).toEqual([]);
	});

	it('không cho đổi mã hay mã tỉnh (khóa của dòng)', async () => {
		expect(
			fields((await validate(UpdateWardDto, { code: '11111' })).errors),
		).toEqual(['code']);
		expect(
			fields(
				(await validate(UpdateWardDto, { provinceCode: '01' })).errors,
			),
		).toEqual(['provinceCode']);
	});

	it('từ chối tên rỗng', async () => {
		expect(
			fields((await validate(UpdateWardDto, { name: '' })).errors),
		).toEqual(['name']);
	});
});

describe('CreateAmenityDto (spec 0002 AC-2)', () => {
	it('nhận khóa hợp lệ và tên', async () => {
		expect(
			(
				await validate(CreateAmenityDto, {
					key: 'air_conditioner',
					name: 'Máy lạnh',
				})
			).errors,
		).toEqual([]);
	});

	it.each([
		'W',
		'Wifi',
		'1wifi',
		'wi fi',
		'wi-fi',
		'_wifi',
		'a'.repeat(31),
		'',
	])(
		'từ chối khóa %p (khớp ^[a-z][a-z0-9_]{1,29}$ của CHECK)',
		async (key) => {
			expect(
				fields(
					(await validate(CreateAmenityDto, { key, name: 'Tên' }))
						.errors,
				),
			).toEqual(['key']);
		},
	);

	it('chấp nhận khóa dài đúng 30 ký tự và hai ký tự', async () => {
		expect(
			(
				await validate(CreateAmenityDto, {
					key: 'a'.repeat(30),
					name: 'Tên',
				})
			).errors,
		).toEqual([]);
		expect(
			(await validate(CreateAmenityDto, { key: 'ab', name: 'Tên' }))
				.errors,
		).toEqual([]);
	});

	it('bắt buộc tên và cắt khoảng trắng', async () => {
		expect(
			fields((await validate(CreateAmenityDto, { key: 'wifi' })).errors),
		).toEqual(['name']);
		const { value } = await validate(CreateAmenityDto, {
			key: 'wifi',
			name: '  Wifi  ',
		});
		expect(value).toMatchObject({ name: 'Wifi' });
	});
});

describe('UpdateAmenityDto (spec 0002 AC-2)', () => {
	it('chỉ nhận tên; thiếu tên hoặc có khóa là lỗi', async () => {
		expect(
			(await validate(UpdateAmenityDto, { name: 'Wifi mạnh' })).errors,
		).toEqual([]);
		expect(fields((await validate(UpdateAmenityDto, {})).errors)).toEqual([
			'name',
		]);
		expect(
			fields(
				(await validate(UpdateAmenityDto, { name: 'Wifi', key: 'x1' }))
					.errors,
			),
		).toEqual(['key']);
	});
});
