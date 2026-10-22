import { PrismaPg } from '@prisma/adapter-pg';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { PasswordHasher } from '../auth/password-hasher';
import {
	validateDatabaseEnv,
	validateDemoSeedEnv,
} from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { SETTING_DEFINITIONS } from '../settings/setting-definitions';
import { isStorageKey } from '../storage/storage.service';
import { buildDatabaseUrl } from './build-database-url';
import { amenityNameMap, buildDemoRows, demoEmail } from './demo/demo-build';
import type { DemoImageFile, DemoPlan } from './demo/demo-build';
import {
	DEMO_EMAIL_DOMAIN,
	DEMO_LANDLORDS,
	DEMO_TENANTS,
} from './demo/demo-data';
import { renderScene } from './demo/demo-images';
import { loadEnvFile } from './load-env';
import { SEED_PLANS } from './seed-plans';

const DEMO_EMAIL_FILTER = { endsWith: `@${DEMO_EMAIL_DOMAIN}` } as const;

function errorCode(error: unknown): unknown {
	return typeof error === 'object' && error !== null
		? Reflect.get(error, 'code')
		: undefined;
}

/** Đường dẫn tuyệt đối của một khóa ảnh, đã kiểm khóa và kiểm không thoát khỏi thư mục gốc (giống `DiskStorageService`). */
function pathOfKey(root: string, key: string): string {
	if (!isStorageKey(key)) throw new Error('Khóa lưu trữ không hợp lệ.');
	const full = resolve(root, key);
	if (!full.startsWith(root + sep)) {
		throw new Error('Khóa lưu trữ đi ra ngoài thư mục lưu ảnh.');
	}
	return full;
}

async function removeFiles(
	root: string,
	keys: readonly string[],
): Promise<void> {
	for (const key of keys) {
		try {
			await unlink(pathOfKey(root, key));
		} catch (error: unknown) {
			if (errorCode(error) !== 'ENOENT') throw error;
		}
	}
}

async function writeImages(
	root: string,
	files: readonly DemoImageFile[],
): Promise<void> {
	for (const file of files) {
		const full = pathOfKey(root, file.storageKey);
		await mkdir(dirname(full), { recursive: true });
		await writeFile(full, renderScene(file.scene, file.seed));
	}
}

/**
 * Xóa mọi thứ thuộc các tài khoản demo (nhận ra bằng đuôi email), theo thứ tự các khóa ngoại cho phép, và trả
 * khóa ảnh của chúng để xóa tệp sau khi giao dịch đã xong. Cũng xóa lượt lưu và theo dõi của người thật trỏ vào
 * tin hay chủ trọ demo, vì các dòng đó mất chỗ trỏ tới.
 */
async function deleteDemoData(tx: Prisma.TransactionClient): Promise<string[]> {
	const users = await tx.user.findMany({
		where: { email: DEMO_EMAIL_FILTER },
		select: { id: true },
	});
	const userIds = users.map((user) => user.id);
	const properties = await tx.property.findMany({
		where: { landlordId: { in: userIds } },
		select: { id: true },
	});
	const propertyIds = properties.map((property) => property.id);
	const listings = await tx.listing.findMany({
		where: { propertyId: { in: propertyIds } },
		select: { id: true },
	});
	const listingIds = listings.map((listing) => listing.id);
	const images = await tx.listingImage.findMany({
		where: { listingId: { in: listingIds } },
		select: { storageKey: true },
	});

	await tx.favorite.deleteMany({
		where: {
			OR: [
				{ userId: { in: userIds } },
				{ listingId: { in: listingIds } },
			],
		},
	});
	await tx.follow.deleteMany({
		where: {
			OR: [{ userId: { in: userIds } }, { landlordId: { in: userIds } }],
		},
	});
	await tx.moderationLog.deleteMany({
		where: {
			OR: [
				{ targetId: { in: [...userIds, ...listingIds] } },
				{ actorId: { in: userIds } },
			],
		},
	});
	await tx.listing.deleteMany({ where: { id: { in: listingIds } } });
	await tx.property.deleteMany({ where: { id: { in: propertyIds } } });
	await tx.subscription.deleteMany({ where: { userId: { in: userIds } } });
	await tx.order.deleteMany({ where: { userId: { in: userIds } } });
	await tx.user.deleteMany({ where: { id: { in: userIds } } });
	return images.map((image) => image.storageKey);
}

/**
 * Nạp dữ liệu demo cho FE làm việc (không thuộc `npm run seed`, chỉ chạy khi gọi riêng): chủ trọ ở đủ các trạng
 * thái gói và dùng thử, người tìm trọ, nhà trọ, tin kèm ảnh, đơn mua gói, kỳ gói, theo dõi và tin đã lưu. Nội dung nằm ở
 * `demo/demo-data.ts`, mốc thời gian tính từ lúc chạy. Cần `npm run seed` chạy trước (phường, tiện ích, gói mẫu
 * và admin). Chạy lại khi đã có dữ liệu demo thì dừng; thêm `--reset` để xóa dữ liệu demo cũ rồi tạo lại (làm mới
 * mốc thời gian). Chỉ đụng tài khoản có email đuôi `@demo.example.com`.
 */
async function main(): Promise<void> {
	loadEnvFile();
	if (process.env.NODE_ENV === 'production') {
		throw new Error(
			'Không nạp dữ liệu demo ở môi trường production: mọi tài khoản demo dùng chung một mật khẩu.',
		);
	}
	if (process.env.DEMO_SEED_PASSWORD === undefined) {
		throw new Error(
			'Thiếu DEMO_SEED_PASSWORD trong .env: hãy đặt một mật khẩu từ 8 ký tự dùng chung cho mọi tài khoản demo (xem .env.example).',
		);
	}
	const database = validateDatabaseEnv(process.env);
	const demo = validateDemoSeedEnv(process.env);
	const reset = process.argv.includes('--reset');
	const uploadRoot = resolve(demo.UPLOAD_DIR);

	const prisma = new PrismaClient({
		adapter: new PrismaPg({
			connectionString: buildDatabaseUrl({
				host: database.DATABASE_HOST,
				port: database.DATABASE_PORT,
				database: database.DATABASE_NAME,
				username: database.DATABASE_USER,
				password: database.DATABASE_PASSWORD,
			}),
			max: 1,
			options: '-c timezone=UTC',
		}),
	});

	try {
		const existing = await prisma.user.count({
			where: { email: DEMO_EMAIL_FILTER },
		});
		if (existing > 0 && !reset) {
			console.log(
				`Đã có ${existing} tài khoản demo, không tạo thêm. Chạy "npm run seed:demo -- --reset" để xóa và tạo lại (làm mới mốc thời gian).`,
			);
			return;
		}

		const admin = await prisma.user.findFirst({
			where: { accountType: 'admin', status: 'active', deletedAt: null },
			orderBy: { createdAt: 'asc' },
			select: { id: true },
		});
		if (admin === null) {
			throw new Error(
				'Chưa có tài khoản admin. Hãy chạy npm run seed trước.',
			);
		}

		const [wardRows, planRows, amenityRows, trialLimit] = await Promise.all(
			[
				prisma.ward.findMany({ select: { code: true, name: true } }),
				prisma.plan.findMany({
					select: {
						id: true,
						name: true,
						price: true,
						maxListings: true,
						durationDays: true,
					},
				}),
				prisma.amenity.findMany({ select: { key: true, name: true } }),
				prisma.setting.findUnique({
					where: { key: 'trial_listing_limit' },
				}),
			],
		);
		if (wardRows.length === 0) {
			throw new Error(
				'Chưa có danh mục phường, xã. Hãy chạy npm run seed trước.',
			);
		}

		const warnings: string[] = [];
		const trialDefault = String(
			SETTING_DEFINITIONS.trial_listing_limit.defaultValue,
		);
		if (trialLimit !== null && trialLimit.value !== trialDefault) {
			warnings.push(
				`trial_listing_limit đang là ${trialLimit.value} (kịch bản giả định ${trialDefault}): số tin công khai của chủ trọ đang dùng thử sẽ lệch.`,
			);
		}
		for (const seeded of SEED_PLANS) {
			const row = planRows.find((plan) => plan.name === seeded.name);
			if (row !== undefined && row.maxListings !== seeded.maxListings) {
				warnings.push(
					`Gói "${seeded.name}" đang cho ${row.maxListings} tin (mặc định ${seeded.maxListings}): kịch bản vượt hạn mức sẽ lệch.`,
				);
			}
		}

		const plans = new Map<string, DemoPlan>(
			planRows.map((plan) => [plan.name, plan]),
		);
		const rows = buildDemoRows(
			{
				now: new Date(),
				passwordHash: await new PasswordHasher().hash(
					demo.DEMO_SEED_PASSWORD,
				),
				adminId: admin.id,
				wards: new Map<string, { readonly name: string }>(
					wardRows.map((ward) => [ward.code, ward]),
				),
				plans,
			},
			amenityNameMap(amenityRows),
		);

		// Ảnh ghi trước, dòng bảng ghi sau trong một giao dịch: lỗi giữa chừng thì xóa ảnh vừa ghi, không để dòng
		// trỏ vào tệp không có.
		await writeImages(uploadRoot, rows.imageFiles);
		const written = rows.imageFiles.map((file) => file.storageKey);
		let removedKeys: string[] = [];
		try {
			removedKeys = await prisma.$transaction(
				async (tx) => {
					const old = existing > 0 ? await deleteDemoData(tx) : [];
					await tx.user.createMany({ data: rows.users });
					await tx.property.createMany({ data: rows.properties });
					await tx.propertyFee.createMany({
						data: rows.propertyFees,
					});
					await tx.propertyAmenity.createMany({
						data: rows.propertyAmenities,
					});
					await tx.listing.createMany({ data: rows.listings });
					await tx.listingImage.createMany({
						data: rows.listingImages,
					});
					await tx.order.createMany({ data: rows.orders });
					await tx.subscription.createMany({
						data: rows.subscriptions,
					});
					await tx.moderationLog.createMany({
						data: rows.moderationLogs,
					});
					await tx.follow.createMany({ data: rows.follows });
					await tx.favorite.createMany({ data: rows.favorites });
					return old;
				},
				{ timeout: 60_000, maxWait: 10_000 },
			);
		} catch (error: unknown) {
			await removeFiles(uploadRoot, written);
			throw error;
		}
		await removeFiles(uploadRoot, removedKeys);

		const publicNow = rows.listings.filter(
			(listing) => listing.status === 'visible',
		).length;
		console.log(
			`Dữ liệu demo${existing > 0 ? ' (đã làm mới)' : ''}: ${rows.users.length} tài khoản (${DEMO_LANDLORDS.length} chủ trọ, ${DEMO_TENANTS.length} người tìm trọ), ${rows.properties.length} nhà trọ, ${rows.listings.length} tin (${publicNow} đang ở trạng thái hiện), ${rows.listingImages.length} ảnh, ${rows.orders.length} đơn, ${rows.subscriptions.length} kỳ gói, ${rows.follows.length} lượt theo dõi, ${rows.favorites.length} tin đã lưu.`,
		);
		for (const warning of warnings) console.warn(`Cảnh báo: ${warning}`);
		console.log(
			'Mật khẩu của mọi tài khoản demo là giá trị DEMO_SEED_PASSWORD trong .env.',
		);
		console.log('Chủ trọ:');
		for (const landlord of DEMO_LANDLORDS) {
			console.log(
				`  ${demoEmail(landlord.emailName)}  ${landlord.name}: ${landlord.scenario}`,
			);
		}
		console.log('Người tìm trọ:');
		for (const tenant of DEMO_TENANTS) {
			console.log(
				`  ${demoEmail(tenant.emailName)}  ${tenant.name}: ${tenant.scenario}`,
			);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((error: unknown) => {
	console.error(
		error instanceof Error
			? `Seed demo thất bại: ${error.message}`
			: 'Seed demo thất bại.',
	);
	process.exitCode = 1;
});
