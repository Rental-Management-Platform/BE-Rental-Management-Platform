import type { CatalogService } from '../catalog/catalog.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { Prisma } from '../generated/prisma/client';
import type { ListingsRepository } from '../listings/listings.repository';
import type { CreatePropertyDto } from './dto/create-property.dto';
import type { UpdatePropertyDto } from './dto/update-property.dto';
import {
	amenityRow,
	BEN_THANH,
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
			const { name, addressText, wardCode, ward } = propertyDetail();
			return Promise.resolve({ name, addressText, wardCode, ward });
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
					latitude: 10,
					longitude: 106,
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
