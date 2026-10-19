import { PrismaPg } from '@prisma/adapter-pg';
import { PasswordHasher } from '../auth/password-hasher';
import { isAccountType } from '../common/auth/account-type';
import { validateDatabaseEnv, validateSeedEnv } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';
import { normalizeEmail } from '../users/users.service';
import { buildDatabaseUrl } from './build-database-url';
import { loadEnvFile } from './load-env';
import { seedCatalog } from './seed-catalog';
import { seedPlans } from './seed-plans';
import { seedSettings } from './seed-settings';

/**
 * Seed chạy lại nhiều lần vẫn đúng (spec 0003 AC-9 của phân quyền, spec 0002 AC-1, spec 0003 AC-12 của dùng
 * thử). Làm năm việc: kiểm ba loại tài khoản đã có (do migration tạo; thiếu thì dừng), thêm danh mục phường và
 * tiện ích còn thiếu, thêm hai tham số dùng thử mặc định còn thiếu, thêm ba gói mẫu còn thiếu (spec 0004 AC-12),
 * và tạo admin đầu tiên khi chưa có admin nào. Không bao giờ ghi đè quyền của loại, tên danh mục, giá trị tham
 * số hay giá của gói, vì admin có thể đã chỉnh.
 */
async function main(): Promise<void> {
	loadEnvFile();
	const database = validateDatabaseEnv(process.env);
	const seed = validateSeedEnv(process.env);

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
		const types = await prisma.accountType.findMany({
			select: { key: true },
		});
		const missing = ['admin', 'landlord', 'tenant'].filter(
			(key) => !types.some((row) => row.key === key),
		);
		if (missing.length > 0) {
			throw new Error(
				`Thiếu loại tài khoản: ${missing.join(', ')}. Hãy chạy migration trước: npm run migration:deploy.`,
			);
		}

		// Danh mục và tham số chạy trước phần admin vì phần admin có thể kết thúc sớm (đã có admin).
		await seedCatalog(prisma);
		await seedSettings(prisma);
		await seedPlans(prisma);

		// Tính cả admin bị khóa và đã xóa mềm: đã từng có admin thì không tự tạo thêm.
		const admins = await prisma.user.count({
			where: { accountType: 'admin' },
		});
		if (admins > 0) {
			console.log(`Đã có ${admins} tài khoản admin, không tạo thêm.`);
			return;
		}

		const email = normalizeEmail(seed.ADMIN_SEED_EMAIL);
		const existing = await prisma.user.findFirst({
			where: { email },
			select: { accountType: true, deletedAt: true },
		});
		if (existing !== null) {
			const kind = isAccountType(existing.accountType)
				? existing.accountType
				: 'không rõ';
			throw new Error(
				`Email ${email} đã thuộc một tài khoản ${kind}${existing.deletedAt === null ? '' : ' (đã xóa mềm)'}, không phải admin. Loại tài khoản không đổi được: hãy đặt ADMIN_SEED_EMAIL sang email khác trong .env rồi chạy lại.`,
			);
		}

		const passwordHash = await new PasswordHasher().hash(
			seed.ADMIN_SEED_PASSWORD,
		);
		await prisma.user.create({
			data: {
				email,
				passwordHash,
				name: seed.ADMIN_SEED_NAME.trim(),
				accountType: 'admin',
			},
		});
		console.log(`Đã tạo tài khoản admin đầu tiên: ${email}`);
	} finally {
		await prisma.$disconnect();
	}
}

main().catch((error: unknown) => {
	console.error(
		error instanceof Error
			? `Seed thất bại: ${error.message}`
			: 'Seed thất bại.',
	);
	process.exitCode = 1;
});
