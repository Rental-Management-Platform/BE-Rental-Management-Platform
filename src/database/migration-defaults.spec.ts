import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	isAdminOnly,
	isManageKey,
	isPermissionKey,
} from '../common/auth/permission-catalog';

/**
 * Quyền mặc định của landlord và tenant được ghi thẳng thành danh sách khóa trong migration
 * (SQL không đọc được hằng số trong code). Test này canh để danh sách đó luôn khớp danh mục.
 */
const MIGRATION = join(
	__dirname,
	'..',
	'..',
	'prisma',
	'migrations',
	'20261008090000_account_types_phone',
	'migration.sql',
);

function readDefaults(): string[][] {
	const sql = readFileSync(MIGRATION, 'utf8');
	return [...sql.matchAll(/ARRAY\[([^\]]*)\]/g)].map((block) =>
		[...(block[1] ?? '').matchAll(/'([^']+)'/g)].map((key) => key[1] ?? ''),
	);
}

describe('quyền mặc định trong migration account_types_phone', () => {
	const [admin, landlord, tenant] = readDefaults();

	it('có đúng ba danh sách: admin, landlord, tenant', () => {
		expect(readDefaults()).toHaveLength(3);
	});

	it('admin để rỗng vì quyền admin tính trong code', () => {
		expect(admin).toEqual([]);
	});

	it.each([
		['landlord', landlord],
		['tenant', tenant],
	])('mọi khóa của %s có trong danh mục', (_name, keys) => {
		expect((keys ?? []).length).toBeGreaterThan(0);
		for (const key of keys ?? []) expect(isPermissionKey(key)).toBe(true);
	});

	it.each([
		['landlord', landlord],
		['tenant', tenant],
	])('%s không giữ khóa manage hay quyền chỉ admin', (_name, keys) => {
		for (const key of keys ?? []) {
			if (!isPermissionKey(key)) continue;
			expect(isManageKey(key)).toBe(false);
			expect(isAdminOnly(key)).toBe(false);
		}
	});

	it('không khóa nào bị lặp trong một danh sách', () => {
		for (const keys of [landlord, tenant]) {
			expect(new Set(keys).size).toBe((keys ?? []).length);
		}
	});
});
