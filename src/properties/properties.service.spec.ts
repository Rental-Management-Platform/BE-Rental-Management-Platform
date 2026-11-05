import type { CatalogService } from '../catalog/catalog.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { Prisma } from '../generated/prisma/client';
import type { ListingsRepository } from '../listings/listings.repository';
import type { CreatePropertyDto } from './dto/create-property.dto';
import type { UpdatePropertyDto } from './dto/update-property.dto';
import { COORDINATE_MARGIN_DEGREES } from './coordinate-area';
import {
	amenityRow,
	BEN_THANH,
	BEN_THANH_BOUNDS,
	fee,
	OWNER_ID,
	PROPERTY_ID,
	propertyDetail,
	propertyListRow,
} from './properties.fixtures';
import type {
	PropertiesRepository,
	PropertyDetail,
} from './properties.repository';
import { PropertiesService } from './properties.service';

const TAN_DINH = {
	...BEN_THANH,
	code: '26737',
	name: 'Phường Tân Định',
};

const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;

const owner = { userId: OWNER_ID } as RequestUser;
const stranger = {
	userId: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d99',
} as RequestUser;

interface Harness {
	service: PropertiesService;
	repository: Record<keyof PropertiesRepository, jest.Mock>;
	listings: Record<
		'countLiveByProperty' | 'findLiveTitlesByProperty' | 'setSearchKey',
		jest.Mock
	>;
	catalog: Record<'findWard' | 'findUnknownAmenityKeys', jest.Mock>;
}

/** Dựng Service với các Repository giả; giao dịch giả chạy hàm ngay và đưa vào đúng một `tx` để so khớp. */
function build(
	options: {
		current?: PropertyDetail | null;
		/** Dòng nhà trọ đang lưu mà `findAddressSource` đọc sau khi khóa (tên, địa chỉ, phường, tọa độ). */
		stored?: PropertyDetail;
		locked?: { landlordId: string } | null;
		liveListings?: number;
		titles?: { id: string; title: string }[];
		wards?: Record<string, typeof BEN_THANH | undefined>;
		unknownAmenities?: string[];
	} = {},
): Harness {
	const current =
		options.current === undefined ? propertyDetail() : options.current;
	const repository = {
		create: jest.fn(() => Promise.resolve(PROPERTY_ID)),
		findById: jest.fn(() => Promise.resolve(current)),
		findAddressSource: jest.fn(() => {
			const { name, addressText, wardCode, ward, latitude, longitude } =
				options.stored ?? propertyDetail();
			return Promise.resolve({
				name,
				addressText,
				wardCode,
				ward,
				latitude,
				longitude,
			});
		}),
		findPageByLandlord: jest.fn(() =>
			Promise.resolve({
				rows: [propertyListRow(2), propertyListRow(0)],
				total: 7,
			}),
		),
		lockLiveById: jest.fn(() =>
			Promise.resolve(
				options.locked === undefined
					? { landlordId: OWNER_ID }
					: options.locked,
			),
		),
		update: jest.fn(() => Promise.resolve()),
		replaceFees: jest.fn(() => Promise.resolve()),
		replaceAmenities: jest.fn(() => Promise.resolve()),
		markDeleted: jest.fn(() => Promise.resolve()),
	};
	const listings = {
		countLiveByProperty: jest.fn(() =>
			Promise.resolve(options.liveListings ?? 0),
		),
		findLiveTitlesByProperty: jest.fn(() =>
			Promise.resolve(options.titles ?? []),
		),
		setSearchKey: jest.fn(() => Promise.resolve()),
	};
	const wards = options.wards ?? { [BEN_THANH.code]: BEN_THANH };
	const catalog = {
		findWard: jest.fn((code: string) =>
			Promise.resolve(wards[code] ?? null),
		),
		findUnknownAmenityKeys: jest.fn(() =>
			Promise.resolve(options.unknownAmenities ?? []),
		),
	};
	const transactions = {
		run: <T>(fn: (client: Prisma.TransactionClient) => Promise<T>) =>
			fn(tx),
	};
	return {
		service: new PropertiesService(
			repository as unknown as PropertiesRepository,
			listings as unknown as ListingsRepository,
			catalog as unknown as CatalogService,
			transactions as unknown as TransactionRunner,
		),
		repository: repository,
		listings: listings,
		catalog,
	};
}

const createDto = (overrides: Partial<CreatePropertyDto> = {}) => ({
	name: 'Nhà trọ Hoa Hồng',
	addressText: '12 Lê Lợi',
	wardCode: BEN_THANH.code,
	...overrides,
});

const updateDto = (dto: Partial<UpdatePropertyDto>) => dto as UpdatePropertyDto;

describe('PropertiesService.create (AC-3)', () => {
	it('chủ nhà trọ là người đang đăng nhập, không phải ai khác', async () => {
		const { service, repository } = build();
		await service.create(owner, createDto());
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({ landlordId: OWNER_ID }),
			tx,
		);
	});

	it('không gửi tọa độ, phí, tiện ích thì lưu null và hai danh sách rỗng', async () => {
		const { service, repository } = build();
		await service.create(owner, createDto());
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				latitude: null,
				longitude: null,
				fees: [],
				amenityKeys: [],
			}),
			tx,
		);
	});

	it('ghi chú phí rỗng lưu thành null, ghi chú có chữ giữ nguyên', async () => {
		const { service, repository } = build();
		await service.create(
			owner,
			createDto({
				fees: [
					{ kind: 'water', price: 1, unit: 'per_m3', note: '' },
					{
						kind: 'electricity',
						price: 2,
						unit: 'per_kwh',
						note: 'Giá nhà nước',
					},
					{ kind: 'internet', price: 3, unit: 'per_month' },
				],
			}),
		);
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				fees: [
					{ kind: 'water', price: 1, unit: 'per_m3', note: null },
					{
						kind: 'electricity',
						price: 2,
						unit: 'per_kwh',
						note: 'Giá nhà nước',
					},
					{
						kind: 'internet',
						price: 3,
						unit: 'per_month',
						note: null,
					},
				],
			}),
			tx,
		);
	});

	it('trả nhà trọ kèm fullAddress', async () => {
		const { service } = build();
		const response = await service.create(owner, createDto());
		expect(response.fullAddress).toBe(
			'12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		);
	});

	it('phường không có trong danh mục thì 400 WARD_UNKNOWN và không ghi gì', async () => {
		const { service, repository } = build();
		await expect(
			service.create(owner, createDto({ wardCode: '00000' })),
		).rejects.toMatchObject({
			code: ErrorCode.WARD_UNKNOWN,
			fieldErrors: [expect.objectContaining({ field: 'wardCode' })],
		});
		expect(repository.create).not.toHaveBeenCalled();
	});

	it('tiện ích lạ thì 400 AMENITY_UNKNOWN, nêu đúng các khóa lạ, và không ghi gì', async () => {
		const { service, repository } = build({
			unknownAmenities: ['pool', 'sauna'],
		});
		const error: unknown = await service
			.create(
				owner,
				createDto({ amenityKeys: ['wifi', 'pool', 'sauna'] }),
			)
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(AppException);
		const { code, fieldErrors } = error as AppException;
		expect(code).toBe(ErrorCode.AMENITY_UNKNOWN);
		expect(fieldErrors).toHaveLength(1);
		expect(fieldErrors[0]?.field).toBe('amenityKeys');
		expect(fieldErrors[0]?.message).toContain('pool, sauna');
		expect(repository.create).not.toHaveBeenCalled();
	});
});

describe('PropertiesService.list', () => {
	it('chỉ hỏi nhà trọ của người gọi, trả trang kèm listingCount', async () => {
		const { service, repository } = build();
		const page = await service.list(owner, { page: 2, pageSize: 3 });
		expect(repository.findPageByLandlord).toHaveBeenCalledWith(
			OWNER_ID,
			3,
			3,
		);
		expect(page).toMatchObject({ total: 7, page: 2, pageSize: 3 });
		expect(page.items.map((item) => item.listingCount)).toEqual([2, 0]);
	});
});

describe('PropertiesService.get (AC-3)', () => {
	it('chủ nhà trọ xem được chi tiết', async () => {
		const { service } = build();
		const response = await service.get(owner, PROPERTY_ID);
		expect(response.id).toBe(PROPERTY_ID);
	});

	it('nhà trọ không có hoặc đã xóa mềm thì 404 PROPERTY_NOT_FOUND', async () => {
		const { service } = build({ current: null });
		await expect(service.get(owner, PROPERTY_ID)).rejects.toMatchObject({
			code: ErrorCode.PROPERTY_NOT_FOUND,
		});
	});

	it('chủ trọ khác thì 403 NOT_RESOURCE_OWNER', async () => {
		const { service } = build();
		await expect(service.get(stranger, PROPERTY_ID)).rejects.toMatchObject({
			code: ErrorCode.NOT_RESOURCE_OWNER,
		});
	});
});

describe('PropertiesService.update (AC-3, AC-7)', () => {
	it('khóa dòng nhà trọ trước khi ghi', async () => {
		const { service, repository } = build();
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ name: 'Tên mới' }),
		);
		expect(repository.lockLiveById).toHaveBeenCalledWith(PROPERTY_ID, tx);
		const lockOrder =
			repository.lockLiveById.mock.invocationCallOrder[0] ?? 0;
		const writeOrder = repository.update.mock.invocationCallOrder[0] ?? 0;
		expect(lockOrder).toBeLessThan(writeOrder);
	});

	it('nhà trọ không có hoặc đã xóa mềm thì 404, không ghi', async () => {
		const { service, repository } = build({ locked: null });
		await expect(
			service.update(owner, PROPERTY_ID, updateDto({ name: 'X Y' })),
		).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('chủ trọ khác thì 403 NOT_RESOURCE_OWNER, không ghi', async () => {
		const { service, repository } = build();
		await expect(
			service.update(stranger, PROPERTY_ID, updateDto({ name: 'X Y' })),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('chỉ ghi các cột có gửi lên', async () => {
		const { service, repository } = build();
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ name: 'Tên mới' }),
		);
		expect(repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ name: 'Tên mới' },
			tx,
		);
		expect(repository.replaceFees).not.toHaveBeenCalled();
		expect(repository.replaceAmenities).not.toHaveBeenCalled();
	});

	it('thân rỗng vẫn gọi update để đặt lại updated_at và giữ nguyên dữ liệu', async () => {
		const { service, repository } = build();
		await service.update(owner, PROPERTY_ID, updateDto({}));
		expect(repository.update).toHaveBeenCalledWith(PROPERTY_ID, {}, tx);
	});

	it('fees và amenityKeys gửi lên thì thay cả danh sách, mảng rỗng là xóa hết', async () => {
		const { service, repository } = build();
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({
				fees: [{ kind: 'water', price: 5, unit: 'per_m3' }],
				amenityKeys: [],
			}),
		);
		expect(repository.replaceFees).toHaveBeenCalledWith(
			PROPERTY_ID,
			[{ kind: 'water', price: 5, unit: 'per_m3', note: null }],
			tx,
		);
		expect(repository.replaceAmenities).toHaveBeenCalledWith(
			PROPERTY_ID,
			[],
			tx,
		);
	});

	it('cặp tọa độ đi cùng nhau, null cả hai là xóa', async () => {
		const { service, repository } = build();
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ latitude: 10.5, longitude: 106.5 }),
		);
		expect(repository.update).toHaveBeenLastCalledWith(
			PROPERTY_ID,
			{ latitude: 10.5, longitude: 106.5 },
			tx,
		);
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ latitude: null, longitude: null }),
		);
		expect(repository.update).toHaveBeenLastCalledWith(
			PROPERTY_ID,
			{ latitude: null, longitude: null },
			tx,
		);
	});

	it('phường mới không có trong danh mục thì 400 WARD_UNKNOWN, không ghi', async () => {
		const { service, repository } = build();
		await expect(
			service.update(
				owner,
				PROPERTY_ID,
				updateDto({ wardCode: '00000' }),
			),
		).rejects.toMatchObject({ code: ErrorCode.WARD_UNKNOWN });
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('tiện ích lạ thì 400 AMENITY_UNKNOWN, không ghi', async () => {
		const { service, repository } = build({ unknownAmenities: ['pool'] });
		await expect(
			service.update(
				owner,
				PROPERTY_ID,
				updateDto({ amenityKeys: ['pool'] }),
			),
		).rejects.toMatchObject({ code: ErrorCode.AMENITY_UNKNOWN });
		expect(repository.update).not.toHaveBeenCalled();
		expect(repository.replaceAmenities).not.toHaveBeenCalled();
	});

	describe('làm mới search_key của tin (AC-7)', () => {
		const titles = [
			{ id: 'listing-1', title: 'Phòng đẹp có gác' },
			{ id: 'listing-2', title: 'Phòng giá rẻ' },
		];

		it('đổi tên nhà trọ thì dựng lại khóa của mọi tin chưa xóa, trong cùng giao dịch', async () => {
			const { service, listings } = build({ titles });
			await service.update(
				owner,
				PROPERTY_ID,
				updateDto({ name: 'Nhà trọ Hoa Lài' }),
			);
			expect(listings.findLiveTitlesByProperty).toHaveBeenCalledWith(
				PROPERTY_ID,
				tx,
			);
			expect(listings.setSearchKey).toHaveBeenCalledTimes(2);
			expect(listings.setSearchKey).toHaveBeenCalledWith(
				'listing-1',
				'phong dep co gac nha tro hoa lai 12 le loi phuong ben thanh',
				tx,
			);
			expect(listings.setSearchKey).toHaveBeenCalledWith(
				'listing-2',
				'phong gia re nha tro hoa lai 12 le loi phuong ben thanh',
				tx,
			);
		});

		it('đổi địa chỉ thì dựng lại khóa với địa chỉ mới', async () => {
			const { service, listings } = build({ titles: [titles[0]] });
			await service.update(
				owner,
				PROPERTY_ID,
				updateDto({ addressText: '99 Hai Bà Trưng' }),
			);
			expect(listings.setSearchKey).toHaveBeenCalledWith(
				'listing-1',
				'phong dep co gac nha tro hoa hong 99 hai ba trung phuong ben thanh',
				tx,
			);
		});

		it('đổi phường thì dùng tên phường mới trong khóa', async () => {
			const { service, listings } = build({
				titles: [titles[0]],
				wards: {
					[BEN_THANH.code]: BEN_THANH,
					[TAN_DINH.code]: TAN_DINH,
				},
			});
			await service.update(
				owner,
				PROPERTY_ID,
				updateDto({ wardCode: TAN_DINH.code }),
			);
			expect(listings.setSearchKey).toHaveBeenCalledWith(
				'listing-1',
				'phong dep co gac nha tro hoa hong 12 le loi phuong tan dinh',
				tx,
			);
		});

		it('gửi lại đúng tên, địa chỉ, phường hiện tại thì không làm mới (không đổi gì)', async () => {
			const { service, listings } = build({ titles });
			await service.update(
				owner,
				PROPERTY_ID,
				updateDto({
					name: 'Nhà trọ Hoa Hồng',
					addressText: '12 Lê Lợi',
					wardCode: BEN_THANH.code,
				}),
			);
			expect(listings.findLiveTitlesByProperty).not.toHaveBeenCalled();
			expect(listings.setSearchKey).not.toHaveBeenCalled();
		});

		it('chỉ đổi phí, tiện ích hay tọa độ thì không đụng khóa tìm kiếm', async () => {
			const { service, listings } = build({ titles });
			await service.update(
				owner,
				PROPERTY_ID,
				updateDto({
					fees: [{ kind: 'water', price: 5, unit: 'per_m3' }],
					amenityKeys: ['wifi'],
					latitude: 10.5,
					longitude: 106.5,
				}),
			);
			expect(listings.setSearchKey).not.toHaveBeenCalled();
		});

		it('nhà trọ chưa có tin thì không ghi khóa nào', async () => {
			const { service, listings } = build({ titles: [] });
			await service.update(
				owner,
				PROPERTY_ID,
				updateDto({ name: 'Tên mới' }),
			);
			expect(listings.setSearchKey).not.toHaveBeenCalled();
		});
	});

	it('trả nhà trọ đọc lại sau khi giao dịch xong, không đọc nhiều quan hệ trong giao dịch', async () => {
		const updated = propertyDetail({
			name: 'Tên mới',
			fees: [fee('water', 5, 'per_m3')],
			amenities: [amenityRow('wifi', 'Wifi')],
		});
		const { service, repository } = build();
		repository.findById.mockResolvedValueOnce(updated);
		const response = await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ name: 'Tên mới' }),
		);
		expect(response.name).toBe('Tên mới');
		expect(response.fees).toHaveLength(1);
		expect(response.amenities).toEqual([{ key: 'wifi', name: 'Wifi' }]);
		// findById không nhận giao dịch: chạy trên kết nối thường, sau commit
		expect(repository.findById).toHaveBeenCalledWith(PROPERTY_ID);
	});

	it('nhà trọ bị chính chủ xóa ngay giữa commit và lần đọc lại thì 404', async () => {
		const { service, repository } = build();
		repository.findById.mockResolvedValueOnce(null);
		await expect(
			service.update(owner, PROPERTY_ID, updateDto({ name: 'Tên mới' })),
		).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });
	});
});

/** Hà Nội, (0, 0), giữa biển giữa hai khung, ngoài khơi phía đông: bốn điểm ngoài của spec 0012 AC-1. */
const OUTSIDE_POINTS = [
	{ latitude: 21.0285, longitude: 105.8542 },
	{ latitude: 0, longitude: 0 },
	{ latitude: 9.5, longitude: 106.5 },
	{ latitude: 10.5, longitude: 108.5 },
];

/** Hai trường lỗi của `COORDINATE_OUT_OF_AREA`: cùng mã, câu riêng, cả hai đều có. */
function expectOutOfAreaOn(error: unknown): void {
	expect(error).toBeInstanceOf(AppException);
	const { code, fieldErrors } = error as AppException;
	expect(code).toBe(ErrorCode.COORDINATE_OUT_OF_AREA);
	expect(fieldErrors.map((item) => item.field)).toEqual([
		'latitude',
		'longitude',
	]);
	for (const item of fieldErrors) {
		expect(item.code).toBe(ErrorCode.COORDINATE_OUT_OF_AREA);
		expect(item.message.length).toBeGreaterThan(0);
	}
	expect(fieldErrors[0]?.message).not.toBe(fieldErrors[1]?.message);
}

describe('PropertiesService: khung thành phố khi tạo (spec 0012 AC-1, AC-3, AC-4)', () => {
	it.each(OUTSIDE_POINTS)(
		'tọa độ ngoài khung %j thì 400 COORDINATE_OUT_OF_AREA và không ghi gì',
		async (point) => {
			const { service, repository } = build();
			const error: unknown = await service
				.create(owner, createDto(point))
				.catch((caught: unknown) => caught);
			expectOutOfAreaOn(error);
			expect(repository.create).not.toHaveBeenCalled();
		},
	);

	it('điểm trong khung đất liền được nhận và lưu nguyên xi', async () => {
		const { service, repository } = build();
		await service.create(
			owner,
			createDto({ latitude: 10.7721, longitude: 106.698 }),
		);
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({ latitude: 10.7721, longitude: 106.698 }),
			tx,
		);
	});

	it('điểm trên Côn Đảo và đúng biên khung được nhận', async () => {
		const { service, repository } = build();
		await service.create(
			owner,
			createDto({ latitude: 8.6934, longitude: 106.6086 }),
		);
		await service.create(
			owner,
			createDto({ latitude: 10.2, longitude: 107.7 }),
		);
		expect(repository.create).toHaveBeenCalledTimes(2);
	});

	it('không gửi tọa độ, hoặc gửi null cả hai, thì lưu null và không kiểm gì', async () => {
		const { service, repository } = build();
		await service.create(owner, createDto());
		await service.create(
			owner,
			createDto({ latitude: null, longitude: null }),
		);
		expect(repository.create).toHaveBeenCalledTimes(2);
		expect(repository.create).toHaveBeenLastCalledWith(
			expect.objectContaining({ latitude: null, longitude: null }),
			tx,
		);
	});

	it('thứ tự lỗi: mã phường lạ kèm điểm ở Hà Nội ra WARD_UNKNOWN', async () => {
		const { service } = build();
		await expect(
			service.create(
				owner,
				createDto({ wardCode: '00000', ...OUTSIDE_POINTS[0] }),
			),
		).rejects.toMatchObject({ code: ErrorCode.WARD_UNKNOWN });
	});

	it('thứ tự lỗi: tiện ích lạ kèm điểm ở Hà Nội ra AMENITY_UNKNOWN', async () => {
		const { service } = build({ unknownAmenities: ['pool'] });
		await expect(
			service.create(
				owner,
				createDto({ amenityKeys: ['pool'], ...OUTSIDE_POINTS[0] }),
			),
		).rejects.toMatchObject({ code: ErrorCode.AMENITY_UNKNOWN });
	});
});

describe('PropertiesService: khung thành phố khi sửa (spec 0012 AC-1, AC-3, AC-4, AC-5 a và c)', () => {
	it.each(OUTSIDE_POINTS)(
		'tọa độ ngoài khung %j thì 400 COORDINATE_OUT_OF_AREA và không đổi trường nào',
		async (point) => {
			const { service, repository } = build();
			const error: unknown = await service
				.update(
					owner,
					PROPERTY_ID,
					updateDto({
						name: 'Tên mới',
						fees: [{ kind: 'water', price: 5, unit: 'per_m3' }],
						amenityKeys: ['wifi'],
						...point,
					}),
				)
				.catch((caught: unknown) => caught);
			expectOutOfAreaOn(error);
			expect(repository.update).not.toHaveBeenCalled();
			expect(repository.replaceFees).not.toHaveBeenCalled();
			expect(repository.replaceAmenities).not.toHaveBeenCalled();
		},
	);

	it('điểm trong khung được nhận và ghi cả cặp', async () => {
		const { service, repository } = build();
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ latitude: 8.6934, longitude: 106.6086 }),
		);
		expect(repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ latitude: 8.6934, longitude: 106.6086 },
			tx,
		);
	});

	it('gửi null cả hai luôn xóa được tọa độ', async () => {
		const { service, repository } = build();
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ latitude: null, longitude: null }),
		);
		expect(repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ latitude: null, longitude: null },
			tx,
		);
	});

	it('không gửi tọa độ thì không kiểm gì: nhà trọ cũ đang giữ tọa độ ngoài vùng vẫn sửa được tên, địa chỉ, phí, tiện ích', async () => {
		const stale = propertyDetail({
			latitude: 21.0285,
			longitude: 105.8542,
		});
		const { service, repository } = build({ current: stale });
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({
				name: 'Tên mới',
				addressText: '99 Hai Bà Trưng',
				fees: [{ kind: 'water', price: 5, unit: 'per_m3' }],
				amenityKeys: ['wifi'],
			}),
		);
		expect(repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ name: 'Tên mới', addressText: '99 Hai Bà Trưng' },
			tx,
		);
	});

	it('thứ tự lỗi: 404 rồi 403 đứng trước tọa độ sai', async () => {
		const missing = build({ locked: null });
		await expect(
			missing.service.update(
				owner,
				PROPERTY_ID,
				updateDto({ ...OUTSIDE_POINTS[0] }),
			),
		).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });
		const other = build();
		await expect(
			other.service.update(
				stranger,
				PROPERTY_ID,
				updateDto({ ...OUTSIDE_POINTS[0] }),
			),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
	});

	it('thứ tự lỗi: mã phường lạ kèm điểm ở Hà Nội ra WARD_UNKNOWN', async () => {
		const { service } = build();
		await expect(
			service.update(
				owner,
				PROPERTY_ID,
				updateDto({ wardCode: '00000', ...OUTSIDE_POINTS[0] }),
			),
		).rejects.toMatchObject({ code: ErrorCode.WARD_UNKNOWN });
	});

	it('thứ tự lỗi: tiện ích lạ kèm điểm ở Hà Nội ra AMENITY_UNKNOWN', async () => {
		const { service } = build({ unknownAmenities: ['pool'] });
		await expect(
			service.update(
				owner,
				PROPERTY_ID,
				updateDto({ amenityKeys: ['pool'], ...OUTSIDE_POINTS[0] }),
			),
		).rejects.toMatchObject({ code: ErrorCode.AMENITY_UNKNOWN });
	});
});

describe('PropertiesService.remove (AC-4)', () => {
	it('xóa mềm khi không còn tin', async () => {
		const { service, repository, listings } = build({ liveListings: 0 });
		await service.remove(owner, PROPERTY_ID);
		expect(listings.countLiveByProperty).toHaveBeenCalledWith(
			PROPERTY_ID,
			tx,
		);
		expect(repository.markDeleted).toHaveBeenCalledWith(PROPERTY_ID, tx);
	});

	it('đếm tin sau khi khóa dòng nhà trọ, để không lọt tin đăng cùng lúc', async () => {
		const { service, repository, listings } = build();
		await service.remove(owner, PROPERTY_ID);
		const lockOrder =
			repository.lockLiveById.mock.invocationCallOrder[0] ?? 0;
		const countOrder =
			listings.countLiveByProperty.mock.invocationCallOrder[0] ?? 0;
		expect(lockOrder).toBeLessThan(countOrder);
	});

	it('còn tin chưa xóa thì 409 PROPERTY_HAS_LISTINGS và không xóa', async () => {
		const { service, repository } = build({ liveListings: 1 });
		await expect(service.remove(owner, PROPERTY_ID)).rejects.toMatchObject({
			code: ErrorCode.PROPERTY_HAS_LISTINGS,
		});
		expect(repository.markDeleted).not.toHaveBeenCalled();
	});

	it('nhà trọ không có hoặc đã xóa rồi thì 404', async () => {
		const { service, repository } = build({ locked: null });
		await expect(service.remove(owner, PROPERTY_ID)).rejects.toMatchObject({
			code: ErrorCode.PROPERTY_NOT_FOUND,
		});
		expect(repository.markDeleted).not.toHaveBeenCalled();
	});

	it('chủ trọ khác thì 403 NOT_RESOURCE_OWNER, không đếm tin, không xóa', async () => {
		const { service, repository, listings } = build();
		await expect(
			service.remove(stranger, PROPERTY_ID),
		).rejects.toMatchObject({
			code: ErrorCode.NOT_RESOURCE_OWNER,
		});
		expect(listings.countLiveByProperty).not.toHaveBeenCalled();
		expect(repository.markDeleted).not.toHaveBeenCalled();
	});
});

/** Phường có hộp thật (Bến Thành, Bình Tây) và phường không có hộp (Tân Định), cho các ca lớp 2 của spec 0012. */
const BEN_THANH_BOXED = { ...BEN_THANH, ...BEN_THANH_BOUNDS };
const BINH_TAY_BOXED = {
	...BEN_THANH,
	code: '27367',
	name: 'Phường Bình Tây',
	minLatitude: 10.74643,
	maxLatitude: 10.75474,
	minLongitude: 106.63679,
	maxLongitude: 106.65386,
};
const BOXED_WARDS = {
	[BEN_THANH.code]: BEN_THANH_BOXED,
	[BINH_TAY_BOXED.code]: BINH_TAY_BOXED,
	[TAN_DINH.code]: TAN_DINH,
};

const IN_BEN_THANH = { latitude: 10.7721, longitude: 106.698 };
const IN_BINH_TAY = { latitude: 10.7505, longitude: 106.645 };
/** Vũng Tàu: trong khung thành phố nhưng xa mọi phường nội thành. */
const VUNG_TAU = { latitude: 10.346, longitude: 107.0843 };
const HA_NOI = { latitude: 21.0285, longitude: 105.8542 };
/** Biên của hộp Bến Thành đã nới, tính bằng đúng biểu thức trong code. */
const EDGE_NORTH = BEN_THANH_BOUNDS.maxLatitude + COORDINATE_MARGIN_DEGREES;
const JUST = 0.000001;

/** Hai trường lỗi của `COORDINATE_FAR_FROM_WARD`: cùng mã, câu riêng, đều nêu tên phường. */
function expectFarFromWardOn(error: unknown, wardName: string): AppException {
	expect(error).toBeInstanceOf(AppException);
	const { code, fieldErrors } = error as AppException;
	expect(code).toBe(ErrorCode.COORDINATE_FAR_FROM_WARD);
	expect(fieldErrors.map((item) => item.field)).toEqual([
		'latitude',
		'longitude',
	]);
	for (const item of fieldErrors) {
		expect(item.code).toBe(ErrorCode.COORDINATE_FAR_FROM_WARD);
		expect(item.message).toContain(wardName);
	}
	expect(fieldErrors[0]?.message).not.toBe(fieldErrors[1]?.message);
	return error as AppException;
}

describe('PropertiesService: hộp phường khi tạo (spec 0012 AC-2, AC-3, AC-4)', () => {
	it('điểm trong hộp phường đã chọn được nhận và lưu nguyên xi', async () => {
		const { service, repository } = build({ wards: BOXED_WARDS });
		await service.create(owner, createDto(IN_BEN_THANH));
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining(IN_BEN_THANH),
			tx,
		);
	});

	it('điểm trong khung thành phố nhưng ở xa phường đã chọn thì 400 COORDINATE_FAR_FROM_WARD nêu tên phường, không ghi gì', async () => {
		const { service, repository } = build({ wards: BOXED_WARDS });
		const error: unknown = await service
			.create(owner, createDto(VUNG_TAU))
			.catch((caught: unknown) => caught);
		expectFarFromWardOn(error, 'Phường Bến Thành');
		expect(repository.create).not.toHaveBeenCalled();
	});

	it('điểm của phường này mà chọn phường kia thì 400; chọn đúng phường thì được nhận', async () => {
		const { service, repository } = build({ wards: BOXED_WARDS });
		const wrong: unknown = await service
			.create(owner, createDto({ wardCode: '27367', ...IN_BEN_THANH }))
			.catch((caught: unknown) => caught);
		expectFarFromWardOn(wrong, 'Phường Bình Tây');
		expect(repository.create).not.toHaveBeenCalled();

		await service.create(
			owner,
			createDto({ wardCode: '27367', ...IN_BINH_TAY }),
		);
		expect(repository.create).toHaveBeenCalledTimes(1);
	});

	it('đúng biên hộp đã nới được nhận, lệch thêm một phần triệu độ thì 400', async () => {
		const { service, repository } = build({ wards: BOXED_WARDS });
		await service.create(
			owner,
			createDto({
				latitude: EDGE_NORTH,
				longitude: IN_BEN_THANH.longitude,
			}),
		);
		expect(repository.create).toHaveBeenCalledTimes(1);

		const error: unknown = await service
			.create(
				owner,
				createDto({
					latitude: EDGE_NORTH + JUST,
					longitude: IN_BEN_THANH.longitude,
				}),
			)
			.catch((caught: unknown) => caught);
		expectFarFromWardOn(error, 'Phường Bến Thành');
		expect(repository.create).toHaveBeenCalledTimes(1);
	});

	it('phường không có hộp thì bỏ lớp 2: mọi điểm trong khung thành phố được nhận', async () => {
		const { service, repository } = build({ wards: BOXED_WARDS });
		await service.create(
			owner,
			createDto({ wardCode: TAN_DINH.code, ...VUNG_TAU }),
		);
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining(VUNG_TAU),
			tx,
		);
	});

	it('lớp 1 đứng trước lớp 2: điểm ngoài khung thành phố ra COORDINATE_OUT_OF_AREA, không phải FAR_FROM_WARD', async () => {
		const { service } = build({ wards: BOXED_WARDS });
		const error: unknown = await service
			.create(owner, createDto(HA_NOI))
			.catch((caught: unknown) => caught);
		expectOutOfAreaOn(error);
	});

	it('thứ tự lỗi: mã phường lạ ra WARD_UNKNOWN, tiện ích lạ ra AMENITY_UNKNOWN, đều trước điểm xa phường', async () => {
		const unknownWard = build({ wards: BOXED_WARDS });
		await expect(
			unknownWard.service.create(
				owner,
				createDto({ wardCode: '00000', ...VUNG_TAU }),
			),
		).rejects.toMatchObject({ code: ErrorCode.WARD_UNKNOWN });

		const unknownAmenity = build({
			wards: BOXED_WARDS,
			unknownAmenities: ['pool'],
		});
		await expect(
			unknownAmenity.service.create(
				owner,
				createDto({ amenityKeys: ['pool'], ...VUNG_TAU }),
			),
		).rejects.toMatchObject({ code: ErrorCode.AMENITY_UNKNOWN });
	});

	it('không gửi tọa độ, hoặc null cả hai, thì không kiểm gì dù phường có hộp', async () => {
		const { service, repository } = build({ wards: BOXED_WARDS });
		await service.create(owner, createDto());
		await service.create(
			owner,
			createDto({ latitude: null, longitude: null }),
		);
		expect(repository.create).toHaveBeenCalledTimes(2);
	});
});

describe('PropertiesService: hộp phường khi sửa (spec 0012 AC-2, AC-3, AC-5)', () => {
	/** Nhà trọ đang lưu ở Bến Thành (có hộp) với một điểm trong phường. */
	const storedAtBenThanh = propertyDetail({
		ward: BEN_THANH_BOXED,
		...IN_BEN_THANH,
	});

	it('AC-5 a: gửi cặp số mà không gửi wardCode thì kiểm với phường đang lưu', async () => {
		const ok = build({ wards: BOXED_WARDS, stored: storedAtBenThanh });
		await ok.service.update(
			owner,
			PROPERTY_ID,
			updateDto({ latitude: 10.77, longitude: 106.69 }),
		);
		expect(ok.repository.update).toHaveBeenCalledTimes(1);

		const far = build({ wards: BOXED_WARDS, stored: storedAtBenThanh });
		const error: unknown = await far.service
			.update(owner, PROPERTY_ID, updateDto(VUNG_TAU))
			.catch((caught: unknown) => caught);
		expectFarFromWardOn(error, 'Phường Bến Thành');
		expect(far.repository.update).not.toHaveBeenCalled();
	});

	it('AC-5 a: gửi wardCode kèm cặp số thì kiểm với phường MỚI, không phải phường đang lưu', async () => {
		const wrong = build({ wards: BOXED_WARDS, stored: storedAtBenThanh });
		const error: unknown = await wrong.service
			.update(
				owner,
				PROPERTY_ID,
				updateDto({ wardCode: '27367', ...IN_BEN_THANH }),
			)
			.catch((caught: unknown) => caught);
		const exception = expectFarFromWardOn(error, 'Phường Bình Tây');
		// Tọa độ vừa gửi, không phải tọa độ đang lưu: câu lỗi không nói "đang lưu".
		expect(exception.fieldErrors[0]?.message).not.toContain('đang lưu');
		expect(wrong.repository.update).not.toHaveBeenCalled();

		const right = build({ wards: BOXED_WARDS, stored: storedAtBenThanh });
		await right.service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: '27367', ...IN_BINH_TAY }),
		);
		expect(right.repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ wardCode: '27367', ...IN_BINH_TAY },
			tx,
		);
	});

	it('AC-5 b: chỉ đổi wardCode sang phường xa tọa độ đang lưu thì 400, câu nói đây là tọa độ đang lưu, không ghi gì', async () => {
		const { service, repository } = build({
			wards: BOXED_WARDS,
			stored: storedAtBenThanh,
		});
		const error: unknown = await service
			.update(owner, PROPERTY_ID, updateDto({ wardCode: '27367' }))
			.catch((caught: unknown) => caught);
		const exception = expectFarFromWardOn(error, 'Phường Bình Tây');
		for (const item of exception.fieldErrors) {
			expect(item.message).toContain('đang lưu');
			expect(item.message).toContain('null');
		}
		expect(repository.update).not.toHaveBeenCalled();
		expect(repository.replaceFees).not.toHaveBeenCalled();
		expect(repository.replaceAmenities).not.toHaveBeenCalled();
	});

	it('AC-5 b: đổi phường kèm tọa độ mới hợp lệ, hoặc kèm null cả hai, thì thành công', async () => {
		const withPoint = build({
			wards: BOXED_WARDS,
			stored: storedAtBenThanh,
		});
		await withPoint.service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: '27367', ...IN_BINH_TAY }),
		);
		expect(withPoint.repository.update).toHaveBeenCalledTimes(1);

		const cleared = build({ wards: BOXED_WARDS, stored: storedAtBenThanh });
		await cleared.service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: '27367', latitude: null, longitude: null }),
		);
		expect(cleared.repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ wardCode: '27367', latitude: null, longitude: null },
			tx,
		);
	});

	it('AC-5 b: tọa độ đang lưu vẫn nằm trong hộp nới của phường mới thì đổi phường được', async () => {
		const neighbour = {
			...BEN_THANH_BOXED,
			code: '26750',
			name: 'Phường Kề Bên',
			minLatitude: IN_BEN_THANH.latitude - 0.001,
			maxLatitude: IN_BEN_THANH.latitude + 0.001,
			minLongitude: IN_BEN_THANH.longitude - 0.001,
			maxLongitude: IN_BEN_THANH.longitude + 0.001,
		};
		const { service, repository } = build({
			wards: { ...BOXED_WARDS, [neighbour.code]: neighbour },
			stored: storedAtBenThanh,
		});
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: neighbour.code }),
		);
		expect(repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ wardCode: neighbour.code },
			tx,
		);
	});

	it('AC-5 b: nhà trọ chưa có tọa độ thì đổi phường bình thường', async () => {
		const { service, repository } = build({
			wards: BOXED_WARDS,
			stored: propertyDetail({ ward: BEN_THANH_BOXED }),
		});
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: '27367' }),
		);
		expect(repository.update).toHaveBeenCalledTimes(1);
	});

	it('AC-5 b: gửi null cả hai khi đổi phường là xóa tọa độ, tọa độ cũ không bị kiểm', async () => {
		const legacy = propertyDetail({ ward: BEN_THANH_BOXED, ...HA_NOI });
		const { service, repository } = build({
			wards: BOXED_WARDS,
			stored: legacy,
		});
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: '27367', latitude: null, longitude: null }),
		);
		expect(repository.update).toHaveBeenCalledTimes(1);
	});

	it('AC-5 b: tọa độ đang lưu ngoài khung thành phố (dòng cũ) mà đổi phường thì 400 OUT_OF_AREA, câu nói tọa độ đang lưu', async () => {
		const legacy = propertyDetail({ ward: BEN_THANH_BOXED, ...HA_NOI });
		const { service, repository } = build({
			wards: BOXED_WARDS,
			stored: legacy,
		});
		const error: unknown = await service
			.update(owner, PROPERTY_ID, updateDto({ wardCode: '27367' }))
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(AppException);
		const { code, fieldErrors } = error as AppException;
		expect(code).toBe(ErrorCode.COORDINATE_OUT_OF_AREA);
		expect(fieldErrors.map((item) => item.field)).toEqual([
			'latitude',
			'longitude',
		]);
		for (const item of fieldErrors) {
			expect(item.message).toContain('đang lưu');
		}
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('AC-5 b: đổi sang phường không có hộp thì chỉ còn lớp 1 cho tọa độ đang lưu', async () => {
		const inCity = build({
			wards: BOXED_WARDS,
			stored: propertyDetail({ ward: BEN_THANH_BOXED, ...VUNG_TAU }),
		});
		// Vũng Tàu đang lưu ở Bến Thành là dòng cũ lệch phường; sang Tân Định (không hộp) thì chỉ cần trong khung.
		await inCity.service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: TAN_DINH.code }),
		);
		expect(inCity.repository.update).toHaveBeenCalledTimes(1);

		const legacy = build({
			wards: BOXED_WARDS,
			stored: propertyDetail({ ward: BEN_THANH_BOXED, ...HA_NOI }),
		});
		await expect(
			legacy.service.update(
				owner,
				PROPERTY_ID,
				updateDto({ wardCode: TAN_DINH.code }),
			),
		).rejects.toMatchObject({ code: ErrorCode.COORDINATE_OUT_OF_AREA });
	});

	it('AC-5 c: không gửi tọa độ và gửi đúng phường đang lưu thì không kiểm gì, dòng cũ lệch phường vẫn sửa được', async () => {
		const stale = propertyDetail({ ward: BEN_THANH_BOXED, ...VUNG_TAU });
		const { service, repository } = build({
			wards: BOXED_WARDS,
			stored: stale,
		});
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: BEN_THANH.code, name: 'Tên mới' }),
		);
		expect(repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ wardCode: BEN_THANH.code, name: 'Tên mới' },
			tx,
		);
	});

	it('AC-5 c: sửa tên, phí, tiện ích của dòng cũ lệch phường mà không đụng phường lẫn tọa độ thì không kiểm gì', async () => {
		const stale = propertyDetail({ ward: BEN_THANH_BOXED, ...VUNG_TAU });
		const { service, repository } = build({
			wards: BOXED_WARDS,
			stored: stale,
		});
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({
				name: 'Tên mới',
				fees: [{ kind: 'water', price: 5, unit: 'per_m3' }],
				amenityKeys: ['wifi'],
			}),
		);
		expect(repository.update).toHaveBeenCalledTimes(1);
		expect(repository.replaceFees).toHaveBeenCalledTimes(1);
	});

	it('AC-4: gửi null cả hai luôn xóa được tọa độ, kể cả dòng cũ lệch phường', async () => {
		const stale = propertyDetail({ ward: BEN_THANH_BOXED, ...VUNG_TAU });
		const { service, repository } = build({
			wards: BOXED_WARDS,
			stored: stale,
		});
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ latitude: null, longitude: null }),
		);
		expect(repository.update).toHaveBeenCalledWith(
			PROPERTY_ID,
			{ latitude: null, longitude: null },
			tx,
		);
	});

	it('AC-3: 404 rồi 403 đứng trước tọa độ xa phường; WARD_UNKNOWN và AMENITY_UNKNOWN cũng trước', async () => {
		const missing = build({ wards: BOXED_WARDS, locked: null });
		await expect(
			missing.service.update(owner, PROPERTY_ID, updateDto(VUNG_TAU)),
		).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });

		const other = build({ wards: BOXED_WARDS, stored: storedAtBenThanh });
		await expect(
			other.service.update(stranger, PROPERTY_ID, updateDto(VUNG_TAU)),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });

		const unknownWard = build({
			wards: BOXED_WARDS,
			stored: storedAtBenThanh,
		});
		await expect(
			unknownWard.service.update(
				owner,
				PROPERTY_ID,
				updateDto({ wardCode: '00000', ...VUNG_TAU }),
			),
		).rejects.toMatchObject({ code: ErrorCode.WARD_UNKNOWN });

		const unknownAmenity = build({
			wards: BOXED_WARDS,
			stored: storedAtBenThanh,
			unknownAmenities: ['pool'],
		});
		await expect(
			unknownAmenity.service.update(
				owner,
				PROPERTY_ID,
				updateDto({ amenityKeys: ['pool'], ...VUNG_TAU }),
			),
		).rejects.toMatchObject({ code: ErrorCode.AMENITY_UNKNOWN });
	});

	it('AC-5 d: tọa độ đang lưu được đọc sau khi khóa dòng, trong cùng giao dịch', async () => {
		const { service, repository } = build({
			wards: BOXED_WARDS,
			stored: storedAtBenThanh,
		});
		await service.update(
			owner,
			PROPERTY_ID,
			updateDto({ wardCode: BINH_TAY_BOXED.code, ...IN_BINH_TAY }),
		);
		const lockOrder = repository.lockLiveById.mock.invocationCallOrder[0];
		const readOrder =
			repository.findAddressSource.mock.invocationCallOrder[0];
		expect(lockOrder).toBeDefined();
		expect(readOrder).toBeDefined();
		expect(lockOrder ?? 0).toBeLessThan(readOrder ?? 0);
		expect(repository.findAddressSource).toHaveBeenCalledWith(
			PROPERTY_ID,
			tx,
		);
	});
});
