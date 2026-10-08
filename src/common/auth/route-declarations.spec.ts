import 'reflect-metadata';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../database/prisma.service';
import { readRouteAccess } from './route-access';

/**
 * Test này chỉ đọc metadata của controller nên dùng bản cấu hình giả, đọc thẳng `process.env`: không cần
 * file `.env`, không cần database. Các gói @nestjs/config, jwt, passport là ES module nên cả bộ test
 * chạy qua `npm test` (có cờ --experimental-vm-modules).
 */
jest.mock('@nestjs/config', () => {
	class FakeConfigService {
		get(key: string): string | undefined {
			return process.env[key];
		}
	}
	class FakeConfigModule {}
	return {
		ConfigService: FakeConfigService,
		ConfigModule: {
			forRoot: () => ({
				module: FakeConfigModule,
				global: true,
				providers: [FakeConfigService],
				exports: [FakeConfigService],
			}),
		},
	};
});

// Giá trị giả chỉ cho test, không phải bí mật thật.
Object.assign(process.env, {
	JWT_ACCESS_SECRET: 'fixture-jwt-secret-that-is-long-enough-123',
	ALLOWED_ORIGINS: 'http://localhost:5173',
});

describe('mọi route đều khai báo quyền (spec 0003 AC-4)', () => {
	it('không route nào thiếu khai báo hoặc khai báo nhiều hơn một kiểu', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [AppModule, DiscoveryModule],
		})
			.overrideProvider(PrismaService)
			.useValue({}) // không cần DB thật: chỉ đọc metadata của controller
			.compile();

		const discovery = moduleRef.get(DiscoveryService);
		const reflector = moduleRef.get(Reflector, { strict: false });

		const problems: string[] = [];
		const checked: string[] = [];
		for (const wrapper of discovery.getControllers()) {
			const instance: unknown = wrapper.instance;
			if (typeof instance !== 'object' || instance === null) continue;
			const prototype: unknown = Object.getPrototypeOf(instance);
			if (typeof prototype !== 'object' || prototype === null) continue;
			const controller = instance.constructor;

			for (const name of Object.getOwnPropertyNames(prototype)) {
				const handler: unknown = Reflect.get(prototype, name);
				if (typeof handler !== 'function') continue;
				if (
					Reflect.getMetadata(METHOD_METADATA, handler) === undefined
				) {
					continue; // không phải route
				}

				const access = readRouteAccess(reflector, {
					getHandler: () => handler,
					getClass: () => controller,
				});
				const route = `${controller.name}.${name}`;
				checked.push(route);
				if (access.declarationCount !== 1) {
					problems.push(
						`${route}: có ${access.declarationCount} khai báo (phải đúng 1)`,
					);
				}
			}
		}

		expect(checked.length).toBeGreaterThan(10); // đã duyệt thật chứ không phải rỗng
		expect(problems).toEqual([]);
		await moduleRef.close();
	}, 60_000);
});
