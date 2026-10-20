import { Readable } from 'node:stream';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { Prisma } from '../generated/prisma/client';
import type { SettingsService } from '../settings/settings.service';
import { STORAGE_KEY_PATTERN } from '../storage/storage.service';
import type { ListingImagesRepository } from './listing-images.repository';
import {
	ListingImagesService,
	MAX_IMAGES_PER_LISTING,
	nextFreePosition,
} from './listing-images.service';
import type { UploadedImage } from './listing-images.service';
import type { ListingsRepository } from './listings.repository';

const NOW = new Date('2026-10-19T03:00:00.000Z');
const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
const STRANGER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d09';
const LISTING_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';
const IMAGE_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d04';
const FILE_NAME = '0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d05.png';
const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;

const owner = { userId: LANDLORD_ID } as RequestUser;
const stranger = { userId: STRANGER_ID } as RequestUser;

const PNG = Uint8Array.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

const png = (fieldname = 'file'): UploadedImage => ({
	fieldname,
	buffer: PNG,
});

interface Options {
	ownership?: { property: { landlordId: string } } | null;
	locked?: boolean;
	taken?: number[];
	createError?: Error;
	putError?: Error;
	commitError?: Error;
	deleteFileError?: Error;
	image?: { id: string; position: number; storageKey: string } | null;
	deleteRowResult?: boolean;
	imageOfKey?: { listingId: string } | null;
	visible?: boolean;
	stored?: { stream: Readable; size: number } | null;
	trialListingLimit?: number;
}

function build(options: Options = {}) {
	const calls: string[] = [];
	const track = <T>(name: string, value: T) => {
		calls.push(name);
		return Promise.resolve(value);
	};

	const listings = {
		findOwnership: jest.fn(() =>
			track(
				'findOwnership',
				options.ownership === undefined
					? { id: LISTING_ID, property: { landlordId: LANDLORD_ID } }
					: options.ownership,
			),
		),
		isPubliclyVisible: jest.fn(() =>
			track('isPubliclyVisible', options.visible ?? true),
		),
	};
	const images = {
		lockListing: jest.fn(() =>
			track('lockListing', options.locked ?? true),
		),
		findPositions: jest.fn(() =>
			track('findPositions', options.taken ?? []),
		),
		create: jest.fn((input: { position: number; storageKey: string }) => {
			calls.push('create');
			if (options.createError !== undefined) {
				return Promise.reject(options.createError);
			}
			return Promise.resolve({ id: IMAGE_ID, ...input });
		}),
		findInListing: jest.fn(() =>
			track(
				'findInListing',
				options.image === undefined
					? {
							id: IMAGE_ID,
							position: 0,
							storageKey: `public/${FILE_NAME}`,
						}
					: options.image,
			),
		),
		delete: jest.fn(() =>
			track('deleteRow', options.deleteRowResult ?? true),
		),
		findByStorageKey: jest.fn(() =>
			track(
				'findByStorageKey',
				options.imageOfKey === undefined
					? { listingId: LISTING_ID }
					: options.imageOfKey,
			),
		),
	};
	const storage = {
		put: jest.fn(() => {
			calls.push('put');
			return options.putError === undefined
				? Promise.resolve()
				: Promise.reject(options.putError);
		}),
		get: jest.fn(() =>
			track(
				'get',
				options.stored === undefined
					? { stream: Readable.from([Buffer.from('x')]), size: 1 }
					: options.stored,
			),
		),
		delete: jest.fn(() => {
			calls.push('deleteFile');
			return options.deleteFileError === undefined
				? Promise.resolve()
				: Promise.reject(options.deleteFileError);
		}),
	};
	const transactions = {
		run: jest.fn(
			async <T>(fn: (client: Prisma.TransactionClient) => Promise<T>) => {
				const result = await fn(tx);
				if (options.commitError !== undefined)
					throw options.commitError;
				return result;
			},
		),
	};
	const settings = {
		getValue: jest.fn(() =>
			Promise.resolve(options.trialListingLimit ?? 2),
		),
	};
	const service = new ListingImagesService(
		listings as unknown as ListingsRepository,
		images as unknown as ListingImagesRepository,
		storage,
		transactions as unknown as TransactionRunner,
		settings as unknown as SettingsService,
	);
	return {
		service,
		listings,
		images,
		storage,
		transactions,
		settings,
		calls,
	};
}

describe('nextFreePosition (spec 0002 AC-8)', () => {
	it.each([
		[[], 0],
		[[0], 1],
		[[1], 0],
		[[0, 1, 3], 2],
		[[0, 1, 2, 3], 4],
		[[4], 0],
	])('đã dùng %j thì vị trí trống nhỏ nhất là %i', (taken, expected) => {
		expect(nextFreePosition(taken)).toBe(expected);
	});

	it('đủ 5 ảnh thì null', () => {
		expect(nextFreePosition([0, 1, 2, 3, 4])).toBeNull();
		expect(MAX_IMAGES_PER_LISTING).toBe(5);
	});
});

describe('ListingImagesService.upload (spec 0002 AC-8)', () => {
	it('chủ tin tải PNG thật: 201 trả { id, position, url }, khóa sinh từ loại ảnh nhận ra bằng nội dung', async () => {
		const { service, storage, images } = build();
		const result = await service.upload(owner, LISTING_ID, [png()]);

		const key = (storage.put.mock.calls[0] as unknown[])[0] as string;
		expect(STORAGE_KEY_PATTERN.test(key)).toBe(true);
		expect(key.endsWith('.png')).toBe(true);
		expect(result).toEqual({
			id: IMAGE_ID,
			position: 0,
			url: `/api/v1/media/${key}`,
		});
		expect(images.create).toHaveBeenCalledWith(
			{ listingId: LISTING_ID, position: 0, storageKey: key },
			tx,
		);
	});

	it('đuôi tệp theo nội dung chứ không theo tên trường hay đuôi gốc: JPEG ra .jpg', async () => {
		const { service, storage } = build();
		await service.upload(owner, LISTING_ID, [
			{ fieldname: 'file', buffer: JPEG },
		]);
		const key = (storage.put.mock.calls[0] as unknown[])[0] as string;
		expect(key.endsWith('.jpg')).toBe(true);
	});

	it('thứ tự: kiểm chủ, khóa dòng tin, đọc vị trí, ghi tệp, rồi chèn dòng ảnh, tất cả trong một giao dịch', async () => {
		const { service, calls, transactions } = build();
		await service.upload(owner, LISTING_ID, [png()]);
		expect(calls).toEqual([
			'findOwnership',
			'lockListing',
			'findPositions',
			'put',
			'create',
		]);
		expect(transactions.run).toHaveBeenCalledTimes(1);
	});

	it.each([
		[[1], 0],
		[[0, 1, 3], 2],
		[[0, 1, 2, 3], 4],
	])(
		'vị trí đã dùng %j thì ảnh mới nhận vị trí %i',
		async (taken, position) => {
			const { service, images } = build({ taken });
			const result = await service.upload(owner, LISTING_ID, [png()]);
			expect(result.position).toBe(position);
			expect(images.create).toHaveBeenCalledWith(
				expect.objectContaining({ position }),
				tx,
			);
		},
	);

	it('ảnh thứ 6: 409 LISTING_IMAGE_LIMIT, không ghi tệp, không chèn, không có gì để xóa', async () => {
		const { service, storage, images } = build({ taken: [0, 1, 2, 3, 4] });
		await expect(
			service.upload(owner, LISTING_ID, [png()]),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_IMAGE_LIMIT });
		expect(storage.put).not.toHaveBeenCalled();
		expect(images.create).not.toHaveBeenCalled();
		expect(storage.delete).not.toHaveBeenCalled();
	});

	it('tin không có hoặc đã xóa mềm: 404 LISTING_NOT_FOUND và không đụng khóa hay tệp', async () => {
		const { service, images, storage } = build({ ownership: null });
		await expect(
			service.upload(owner, LISTING_ID, [png()]),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
		expect(images.lockListing).not.toHaveBeenCalled();
		expect(storage.put).not.toHaveBeenCalled();
	});

	it('tin bị xóa mềm đúng giữa lúc kiểm chủ và lúc khóa: 404, không ghi tệp', async () => {
		const { service, storage } = build({ locked: false });
		await expect(
			service.upload(owner, LISTING_ID, [png()]),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
		expect(storage.put).not.toHaveBeenCalled();
	});

	it('tin của chủ trọ khác: 403 NOT_RESOURCE_OWNER, đến trước cả lỗi tệp', async () => {
		const { service, images } = build();
		await expect(
			service.upload(stranger, LISTING_ID, undefined),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
		await expect(
			service.upload(stranger, LISTING_ID, [png()]),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
		expect(images.lockListing).not.toHaveBeenCalled();
	});

	it.each([
		['không có tệp (undefined)', undefined],
		['không có tệp (mảng rỗng)', []],
		['sai tên trường', [png('photo')]],
		['gửi hai tệp', [png(), png()]],
		[
			'văn bản đặt tên như ảnh',
			[{ fieldname: 'file', buffer: Buffer.from('chỉ là văn bản') }],
		],
		['tệp rỗng', [{ fieldname: 'file', buffer: new Uint8Array() }]],
		['GIF', [{ fieldname: 'file', buffer: Buffer.from('GIF89a......') }]],
	])(
		'%s: 400 IMAGE_INVALID, không khóa, không ghi tệp',
		async (_label, files) => {
			const { service, images, storage } = build();
			await expect(
				service.upload(owner, LISTING_ID, files),
			).rejects.toMatchObject({ code: ErrorCode.IMAGE_INVALID });
			expect(images.lockListing).not.toHaveBeenCalled();
			expect(storage.put).not.toHaveBeenCalled();
		},
	);

	it('lỗi lúc chèn dòng ảnh: tệp đã ghi bị xóa, lỗi gốc vẫn được ném', async () => {
		const failure = new Error('chèn lỗi');
		const { service, storage, calls } = build({ createError: failure });
		await expect(service.upload(owner, LISTING_ID, [png()])).rejects.toBe(
			failure,
		);
		const written = (storage.put.mock.calls[0] as unknown[])[0];
		expect(storage.delete).toHaveBeenCalledWith(written);
		expect(calls.slice(-2)).toEqual(['create', 'deleteFile']);
	});

	it('lỗi lúc commit (sau khi đã chèn): tệp cũng bị xóa', async () => {
		const failure = new Error('commit lỗi');
		const { service, storage } = build({ commitError: failure });
		await expect(service.upload(owner, LISTING_ID, [png()])).rejects.toBe(
			failure,
		);
		const written = (storage.put.mock.calls[0] as unknown[])[0];
		expect(storage.delete).toHaveBeenCalledWith(written);
	});

	it('ghi tệp lỗi giữa chừng (có thể còn tệp dở): vẫn xóa, không chèn dòng', async () => {
		const failure = new Error('đĩa đầy');
		const { service, storage, images } = build({ putError: failure });
		await expect(service.upload(owner, LISTING_ID, [png()])).rejects.toBe(
			failure,
		);
		expect(images.create).not.toHaveBeenCalled();
		expect(storage.delete).toHaveBeenCalledTimes(1);
	});

	it('xóa tệp dọn dẹp cũng lỗi thì lỗi gốc vẫn là thứ được ném (lỗi dọn dẹp chỉ ghi log)', async () => {
		const failure = new Error('chèn lỗi');
		const { service } = build({
			createError: failure,
			deleteFileError: new Error('không xóa được'),
		});
		await expect(service.upload(owner, LISTING_ID, [png()])).rejects.toBe(
			failure,
		);
	});

	it('mỗi lần tải sinh khóa khác nhau', async () => {
		const first = build();
		const second = build();
		await first.service.upload(owner, LISTING_ID, [png()]);
		await second.service.upload(owner, LISTING_ID, [png()]);
		expect((first.storage.put.mock.calls[0] as unknown[])[0]).not.toEqual(
			(second.storage.put.mock.calls[0] as unknown[])[0],
		);
	});
});

describe('ListingImagesService.remove (spec 0002 AC-8)', () => {
	it('xóa dòng trước, tệp sau; không trả gì', async () => {
		const { service, calls, storage } = build();
		await expect(
			service.remove(owner, LISTING_ID, IMAGE_ID),
		).resolves.toBeUndefined();
		expect(calls).toEqual([
			'findOwnership',
			'findInListing',
			'deleteRow',
			'deleteFile',
		]);
		expect(storage.delete).toHaveBeenCalledWith(`public/${FILE_NAME}`);
	});

	it('tin không có: 404 LISTING_NOT_FOUND; của người khác: 403 NOT_RESOURCE_OWNER; cả hai trước khi tra ảnh', async () => {
		const missing = build({ ownership: null });
		await expect(
			missing.service.remove(owner, LISTING_ID, IMAGE_ID),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
		expect(missing.images.findInListing).not.toHaveBeenCalled();

		const foreign = build();
		await expect(
			foreign.service.remove(stranger, LISTING_ID, IMAGE_ID),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
		expect(foreign.images.findInListing).not.toHaveBeenCalled();
	});

	it('ảnh không thuộc tin này: 404 NOT_FOUND chung, không xóa gì', async () => {
		const { service, images, storage } = build({ image: null });
		await expect(
			service.remove(owner, LISTING_ID, IMAGE_ID),
		).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
		expect(images.delete).not.toHaveBeenCalled();
		expect(storage.delete).not.toHaveBeenCalled();
	});

	it('dòng ảnh biến mất đúng giữa chừng (xóa đua nhau): 404, không xóa tệp', async () => {
		const { service, storage } = build({ deleteRowResult: false });
		await expect(
			service.remove(owner, LISTING_ID, IMAGE_ID),
		).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
		expect(storage.delete).not.toHaveBeenCalled();
	});

	it('xóa tệp lỗi thì chỉ ghi log: yêu cầu vẫn thành công vì dòng ảnh đã xóa', async () => {
		const { service } = build({ deleteFileError: new Error('khóa tệp') });
		await expect(
			service.remove(owner, LISTING_ID, IMAGE_ID),
		).resolves.toBeUndefined();
	});
});

describe('ListingImagesService.findPublicFile (spec 0002 AC-8, "Ảnh của tin không hiển thị")', () => {
	it.each([
		'../x.png',
		'abc',
		`${FILE_NAME}.exe`,
		FILE_NAME.toUpperCase(),
		'public/' + FILE_NAME,
		'',
	])('tên tệp sai dạng %j: null và không tra DB', async (file) => {
		const { service, images, storage } = build();
		await expect(service.findPublicFile(file, NOW)).resolves.toBeNull();
		expect(images.findByStorageKey).not.toHaveBeenCalled();
		expect(storage.get).not.toHaveBeenCalled();
	});

	it('không có dòng ảnh: null, không đọc tệp', async () => {
		const { service, storage, listings } = build({ imageOfKey: null });
		await expect(
			service.findPublicFile(FILE_NAME, NOW),
		).resolves.toBeNull();
		expect(listings.isPubliclyVisible).not.toHaveBeenCalled();
		expect(storage.get).not.toHaveBeenCalled();
	});

	it('tin không hiện công khai (ẩn, xóa mềm, chủ trọ bị khóa hoặc hết hạn mức): null và không đọc tệp', async () => {
		const { service, storage } = build({ visible: false });
		await expect(
			service.findPublicFile(FILE_NAME, NOW),
		).resolves.toBeNull();
		expect(storage.get).not.toHaveBeenCalled();
	});

	it('hỏi hiển thị với đúng tin, đúng `now` và hạn mức dùng thử đọc từ settings', async () => {
		const { service, listings, settings } = build({ trialListingLimit: 7 });
		await service.findPublicFile(FILE_NAME, NOW);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(listings.isPubliclyVisible).toHaveBeenCalledWith(LISTING_ID, {
			now: NOW,
			trialListingLimit: 7,
		});
	});

	it.each([
		['0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d05.jpg', 'image/jpeg'],
		['0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d05.png', 'image/png'],
		['0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d05.webp', 'image/webp'],
	])(
		'ảnh %s hiện công khai: trả luồng, dung lượng và Content-Type %s theo đuôi',
		async (file, mime) => {
			const stream = Readable.from([Buffer.from('abc')]);
			const { service, storage } = build({ stored: { stream, size: 3 } });
			const found = await service.findPublicFile(file, NOW);
			expect(found).toEqual({ stream, size: 3, mime });
			expect(storage.get).toHaveBeenCalledWith(`public/${file}`);
		},
	);

	it('dòng ảnh có mà tệp mất khỏi ổ đĩa: null', async () => {
		const { service } = build({ stored: null });
		await expect(
			service.findPublicFile(FILE_NAME, NOW),
		).resolves.toBeNull();
	});
});
