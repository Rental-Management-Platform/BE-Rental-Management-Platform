import 'reflect-metadata';
import { Body, Controller, Param, Post, UseInterceptors } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import {
	createValidationPipe,
	uuidParam,
} from '../common/errors/create-validation-pipe';
import { requestIdMiddleware } from '../common/errors/request-id.middleware';
import { MultipartFilesInterceptor } from '../common/files/multipart-files.interceptor';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingImagesController } from './listing-images.controller';
import { ListingImagesService } from './listing-images.service';
import { PropertyListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

const PROPERTY_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
const LISTING_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';
const MAX_FILE_BYTES = 64;

const PNG = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

const fields = {
	title: 'Phòng đẹp có gác gần chợ',
	description: 'Phòng sạch sẽ, thoáng mát, giờ giấc tự do.',
	price: '3500000',
	areaM2: '22.5',
};

interface ErrorBody {
	code?: string;
	errors?: { field: string; code: string }[];
}

interface Harness {
	app: INestApplication<App>;
	create: jest.Mock;
	upload: jest.Mock;
}

async function boot(): Promise<Harness> {
	const create = jest.fn(() => Promise.resolve({ id: LISTING_ID }));
	const upload = jest.fn(() => Promise.resolve({ id: 'image' }));
	const moduleRef = await Test.createTestingModule({
		imports: [
			MulterModule.register({
				limits: { fileSize: MAX_FILE_BYTES, files: 5 },
			}),
		],
		controllers: [PropertyListingsController, ListingImagesController],
		providers: [
			{ provide: ListingsService, useValue: { create } },
			{ provide: ListingImagesService, useValue: { upload } },
		],
	}).compile();
	const app = moduleRef.createNestApplication<INestApplication<App>>();
	app.use(requestIdMiddleware);
	app.useGlobalFilters(new AllExceptionsFilter());
	app.useGlobalPipes(createValidationPipe());
	await app.init();
	return { app, create, upload };
}

/** Gửi form đăng tin với các trường chữ và danh sách tệp (tên trường, nội dung). */
function post(
	app: INestApplication<App>,
	propertyId: string,
	textFields: Record<string, string | string[]>,
	files: [string, Buffer][],
) {
	const call = request(app.getHttpServer()).post(
		`/properties/${propertyId}/listings`,
	);
	for (const [name, value] of Object.entries(textFields)) {
		for (const item of Array.isArray(value) ? value : [value]) {
			call.field(name, item);
		}
	}
	for (const [name, content] of files) {
		call.attach(name, content, {
			filename: 'a.png',
			contentType: 'image/png',
		});
	}
	return call;
}

describe('PropertyListingsController.create: multipart (spec 0011)', () => {
	let harness: Harness;
	beforeEach(async () => {
		harness = await boot();
	});
	afterEach(async () => {
		await harness.app.close();
	});

	it('nhận các trường chữ đã đổi thành số và các tệp ở trường images theo thứ tự gửi (AC-1)', async () => {
		const { app, create } = harness;
		const res = await post(app, PROPERTY_ID, fields, [
			['images', PNG],
			['images', Buffer.concat([PNG, Buffer.from('b')])],
		]);
		expect(res.status).toBe(201);
		const call = (create.mock.calls as unknown as unknown[][])[0] ?? [];
		const [, propertyId, dto, files, now] = call;
		expect(propertyId).toBe(PROPERTY_ID);
		expect(dto).toMatchObject({
			title: fields.title,
			price: 3_500_000,
			areaM2: 22.5,
		});
		expect((dto as { deposit?: number }).deposit).toBeUndefined();
		expect(
			(files as { fieldname: string; size: number }[]).map((file) => [
				file.fieldname,
				file.size,
			]),
		).toEqual([
			['images', PNG.length],
			['images', PNG.length + 1],
		]);
		expect(now).toBeInstanceOf(Date);
	});

	it('UUID sai kèm thân sai ra INVALID_ID, không phải VALIDATION_FAILED (AC-5: pipe chạy theo thứ tự tham số)', async () => {
		const { app, create } = harness;
		const res = await post(
			app,
			'khong-phai-uuid',
			{ ...fields, price: 'abc' },
			[['images', PNG]],
		);
		expect(res.status).toBe(400);
		expect((res.body as ErrorBody).code).toBe('INVALID_ID');
		expect(create).not.toHaveBeenCalled();
	});

	it('lỗi multer đến trước INVALID_ID: UUID sai kèm ảnh quá dung lượng ra 413 (AC-5)', async () => {
		const { app, create } = harness;
		const res = await post(app, 'khong-phai-uuid', fields, [
			['images', Buffer.alloc(MAX_FILE_BYTES + 1, 1)],
		]);
		expect(res.status).toBe(413);
		expect(create).not.toHaveBeenCalled();
	});

	it('đối chứng: bỏ RejectInvalidUuidParam thì UUID sai kèm thân sai ra VALIDATION_FAILED, vì Nest giải tham số song song chứ không theo thứ tự khai báo (đây là lỗi interceptor canh giữ)', async () => {
		@Controller('properties/:propertyId/listings')
		class WithoutInterceptor {
			@Post()
			@UseInterceptors(MultipartFilesInterceptor)
			create(
				@Param('propertyId', uuidParam()) propertyId: string,
				@Body() dto: CreateListingDto,
			): string {
				return `${propertyId} ${dto.title}`;
			}
		}
		const moduleRef = await Test.createTestingModule({
			imports: [MulterModule.register({})],
			controllers: [WithoutInterceptor],
		}).compile();
		const app = moduleRef.createNestApplication<INestApplication<App>>();
		app.useGlobalFilters(new AllExceptionsFilter());
		app.useGlobalPipes(createValidationPipe());
		await app.init();
		try {
			const res = await post(
				app,
				'khong-phai-uuid',
				{ ...fields, price: 'abc' },
				[['images', PNG]],
			);
			expect(res.status).toBe(400);
			expect((res.body as ErrorBody).code).toBe('VALIDATION_FAILED');
		} finally {
			await app.close();
		}
	});

	it('UUID đúng, trường sai: 400 VALIDATION_FAILED kèm tên trường, Service không được gọi', async () => {
		const { app, create } = harness;
		const res = await post(
			app,
			PROPERTY_ID,
			{ ...fields, price: '1e5', areaM2: '' },
			[['images', PNG]],
		);
		expect(res.status).toBe(400);
		const body = res.body as ErrorBody;
		expect(body.code).toBe('VALIDATION_FAILED');
		expect(
			[...new Set((body.errors ?? []).map((item) => item.field))].sort(),
		).toEqual(['areaM2', 'price']);
		expect(create).not.toHaveBeenCalled();
	});

	it.each([
		['trường lạ', { ...fields, status: 'hidden_by_admin' }, 'status'],
		[
			'title gửi hai lần',
			{ ...fields, title: ['Phòng một', 'Phòng hai'] },
			'title',
		],
		['deposit để trống', { ...fields, deposit: '' }, 'deposit'],
		[
			'availableFrom để trống',
			{ ...fields, availableFrom: '' },
			'availableFrom',
		],
		[
			'price[x]=1',
			{ ...fields, price: undefined, 'price[x]': '1' },
			'price',
		],
	] as [string, Record<string, string | string[]>, string][])(
		'%s: 400 VALIDATION_FAILED ở trường %s (AC-4)',
		async (_name, textFields, field) => {
			const { app, create } = harness;
			const clean = Object.fromEntries(
				Object.entries(textFields).filter(
					([, value]) => value !== undefined,
				),
			);
			const res = await post(app, PROPERTY_ID, clean, [['images', PNG]]);
			expect(res.status).toBe(400);
			const body = res.body as ErrorBody;
			expect(body.code).toBe('VALIDATION_FAILED');
			expect((body.errors ?? []).map((item) => item.field)).toContain(
				field,
			);
			expect(create).not.toHaveBeenCalled();
		},
	);

	it('một ảnh quá MAX_UPLOAD_BYTES: 413 PAYLOAD_TOO_LARGE, Service không được gọi (AC-3)', async () => {
		const { app, create } = harness;
		const res = await post(app, PROPERTY_ID, fields, [
			['images', PNG],
			['images', Buffer.alloc(MAX_FILE_BYTES + 1, 1)],
		]);
		expect(res.status).toBe(413);
		expect((res.body as ErrorBody).code).toBe('PAYLOAD_TOO_LARGE');
		expect(create).not.toHaveBeenCalled();
	});

	it('sáu tệp: 400 BAD_REQUEST chung của multer, không phải IMAGE_INVALID (AC-3)', async () => {
		const { app, create } = harness;
		const res = await post(
			app,
			PROPERTY_ID,
			fields,
			Array.from(
				{ length: 6 },
				() => ['images', PNG] as [string, Buffer],
			),
		);
		expect(res.status).toBe(400);
		expect((res.body as ErrorBody).code).toBe('BAD_REQUEST');
		expect(create).not.toHaveBeenCalled();
	});

	it('yêu cầu JSON: tới Service với files là undefined để Service trả IMAGE_INVALID (AC-3)', async () => {
		const { app, create } = harness;
		const res = await request(app.getHttpServer())
			.post(`/properties/${PROPERTY_ID}/listings`)
			.send({ ...fields, price: 3_500_000, areaM2: 22.5 });
		expect(res.status).toBe(201);
		const call = (create.mock.calls as unknown as unknown[][])[0] ?? [];
		expect(call[3]).toBeUndefined();
	});

	it('multipart không có tệp: tới Service với mảng rỗng (AC-3)', async () => {
		const { app, create } = harness;
		const res = await post(app, PROPERTY_ID, fields, []);
		expect(res.status).toBe(201);
		const call = (create.mock.calls as unknown as unknown[][])[0] ?? [];
		expect(call[3]).toEqual([]);
	});

	it('lỗi KHÔNG phải HttpException ném từ chính Service vẫn là 500, không bị interceptor đổi thành 400', async () => {
		const { app, create } = harness;
		create.mockRejectedValueOnce(new Error('database sập'));
		const res = await post(app, PROPERTY_ID, fields, [['images', PNG]]);
		expect(res.status).toBe(500);
		expect((res.body as ErrorBody).code).toBe('INTERNAL_ERROR');
	});
});

describe('multipart hỏng là 400 BAD_REQUEST, không phải 500 (spec 0011 AC-3, AC-9)', () => {
	const BOUNDARY = 'XBOUNDARYX';
	const part = (name: string, value: string) =>
		`--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
	const filePart = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="images"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n${PNG.toString('latin1')}`;

	const malformed: [string, string, string][] = [
		[
			'thân bị cắt giữa một tệp',
			`multipart/form-data; boundary=${BOUNDARY}`,
			`${part('title', 'x')}${filePart}`,
		],
		[
			'thiếu ranh giới kết thúc',
			`multipart/form-data; boundary=${BOUNDARY}`,
			`${part('title', 'x')}${part('price', '1')}`,
		],
		[
			'Content-Type thiếu tham số boundary',
			'multipart/form-data',
			part('title', 'x'),
		],
		['thân rỗng', `multipart/form-data; boundary=${BOUNDARY}`, ''],
		[
			'tiêu đề phần bị hỏng',
			`multipart/form-data; boundary=${BOUNDARY}`,
			`--${BOUNDARY}\r\nContent-Disposition form-data name=title\r\n\r\nx\r\n--${BOUNDARY}--\r\n`,
		],
	];

	let harness: Harness;
	beforeEach(async () => {
		harness = await boot();
	});
	afterEach(async () => {
		await harness.app.close();
	});

	it.each(malformed)('đăng tin, %s', async (_name, contentType, raw) => {
		const { app, create } = harness;
		const res = await request(app.getHttpServer())
			.post(`/properties/${PROPERTY_ID}/listings`)
			.set('Content-Type', contentType)
			.send(raw);
		expect(res.status).toBe(400);
		expect((res.body as ErrorBody).code).toBe('BAD_REQUEST');
		expect(create).not.toHaveBeenCalled();
	});

	it.each(malformed)(
		'tải ảnh lẻ POST /listings/:id/images, %s',
		async (_name, contentType, raw) => {
			const { app, upload } = harness;
			const res = await request(app.getHttpServer())
				.post(`/listings/${LISTING_ID}/images`)
				.set('Content-Type', contentType)
				.send(raw);
			expect(res.status).toBe(400);
			expect((res.body as ErrorBody).code).toBe('BAD_REQUEST');
			expect(upload).not.toHaveBeenCalled();
		},
	);
});
