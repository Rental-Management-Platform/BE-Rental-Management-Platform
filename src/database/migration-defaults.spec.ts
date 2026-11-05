import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	isAdminOnly,
	isManageKey,
	isPermissionKey,
} from '../common/auth/permission-catalog';

/**
 * Quyền mặc định của landlord và tenant được ghi thẳng thành danh sách khóa trong migration
 * (SQL không đọc được hằng số trong code). Migration đầu (`account_types_phone`) chèn danh sách đầy đủ
 * lúc đó; migration dọn (`mvp_permission_cleanup`) gỡ các khóa của module đã hoãn khỏi MVP; migration chat
 * (`chat_conversations_messages`, spec 0013) thêm bốn khóa chat. Test này ghép ba migration và canh để danh sách còn
 * lại luôn khớp danh mục trong code.
 */
const MIGRATIONS = join(__dirname, '..', '..', 'prisma', 'migrations');
const INSERT = join(
	MIGRATIONS,
	'20261008090000_account_types_phone',
	'migration.sql',
);
const CLEANUP = join(
	MIGRATIONS,
	'20261011090000_mvp_permission_cleanup',
	'migration.sql',
);

const CHAT = join(
	MIGRATIONS,
	'20261105090000_chat_conversations_messages',
	'migration.sql',
);

function quoted(list: string | undefined): string[] {
	return [...(list ?? '').matchAll(/'([^']+)'/g)].map((key) => key[1] ?? '');
}

/** Danh sách khóa chèn lúc tạo ba loại: admin, landlord, tenant. */
function readInserted(): string[][] {
	const sql = readFileSync(INSERT, 'utf8');
	return [...sql.matchAll(/ARRAY\[([^\]]*)\]/g)].map((block) =>
		quoted(block[1]),
	);
}

/** Module và khóa lẻ mà migration dọn gỡ khỏi quyền của landlord và tenant. */
function readRemoved(): { modules: string[]; keys: string[] } {
	const sql = readFileSync(CLEANUP, 'utf8');
	const modules = /split_part\(p, ':', 1\) NOT IN \(([^)]*)\)/.exec(sql);
	const keys = /AND p NOT IN \(([^)]*)\)/.exec(sql);
	return { modules: quoted(modules?.[1]), keys: quoted(keys?.[1]) };
}

/**
 * Khóa mà migration chat thêm cho từng loại tài khoản: mỗi câu `UPDATE "account_types"` có một mảng
 * `unnest(ARRAY[...])` và một `WHERE "key" = '<loại>'`.
 */
function readChatAdded(): Record<string, string[]> {
	const sql = readFileSync(CHAT, 'utf8');
	const added: Record<string, string[]> = {};
	for (const statement of sql.matchAll(
		/UPDATE "account_types"[\s\S]*?unnest\(ARRAY\[([^\]]*)\][\s\S]*?WHERE "key" = '(\w+)';/g,
	)) {
		added[statement[2] ?? ''] = quoted(statement[1]);
	}
	return added;
}

/** Quyền mặc định thực tế sau khi áp migration đầu và migration dọn (chưa tính chat). */
function effectiveDefaults(inserted: string[]): string[] {
	const { modules, keys } = readRemoved();
	return inserted.filter(
		(key) =>
			!modules.includes(key.split(':')[0] ?? '') && !keys.includes(key),
	);
}

/** Quyền mặc định thực tế sau khi áp cả ba migration. */
function currentDefaults(role: string, inserted: string[]): string[] {
	return [...effectiveDefaults(inserted), ...(readChatAdded()[role] ?? [])];
}

describe('quyền mặc định trong các migration', () => {
	const [admin, landlord, tenant] = readInserted();

	it('migration đầu có đúng ba danh sách: admin, landlord, tenant', () => {
		expect(readInserted()).toHaveLength(3);
	});

	it('admin để rỗng vì quyền admin tính trong code', () => {
		expect(admin).toEqual([]);
	});

	it('migration dọn có cả hai danh sách gỡ, không rỗng', () => {
		const { modules, keys } = readRemoved();
		expect(modules.length).toBeGreaterThan(0);
		expect(keys.length).toBeGreaterThan(0);
	});

	it('khóa bị gỡ không còn là khóa hợp lệ trong danh mục', () => {
		const { modules, keys } = readRemoved();
		for (const module of modules) {
			expect(isPermissionKey(`${module}:read`)).toBe(false);
		}
		for (const key of keys) expect(isPermissionKey(key)).toBe(false);
	});

	it.each([
		['landlord', landlord],
		['tenant', tenant],
	])('mọi khóa còn lại của %s có trong danh mục', (name, keys) => {
		const remaining = currentDefaults(name, keys ?? []);
		expect(remaining.length).toBeGreaterThan(0);
		for (const key of remaining) expect(isPermissionKey(key)).toBe(true);
	});

	it.each([
		['landlord', landlord],
		['tenant', tenant],
	])('%s không giữ khóa manage hay quyền chỉ admin', (name, keys) => {
		for (const key of currentDefaults(name, keys ?? [])) {
			if (!isPermissionKey(key)) continue;
			expect(isManageKey(key)).toBe(false);
			expect(isAdminOnly(key)).toBe(false);
		}
	});

	it('không khóa nào bị lặp trong một danh sách', () => {
		for (const keys of [landlord, tenant]) {
			expect(new Set(keys).size).toBe((keys ?? []).length);
		}
		const added = readChatAdded();
		for (const [role, keys] of [
			['landlord', landlord],
			['tenant', tenant],
		] as const) {
			const mine = added[role] ?? [];
			expect(new Set(mine).size).toBe(mine.length);
			for (const key of mine) {
				expect(effectiveDefaults(keys ?? [])).not.toContain(key);
			}
		}
	});

	it('quyền mặc định sau dọn đúng bảng ở spec 0003', () => {
		expect(currentDefaults('landlord', landlord ?? []).sort()).toEqual(
			[
				'profile:read',
				'profile:update',
				'property:read',
				'property:create',
				'property:update',
				'property:delete',
				'listing:read',
				'listing:create',
				'listing:update',
				'listing:delete',
				'order:create',
				'order:read',
				'order:cancel',
				'subscription:read',
				'conversation:read',
				'conversation:update',
				'message:create',
			].sort(),
		);
		expect(currentDefaults('tenant', tenant ?? []).sort()).toEqual(
			[
				'profile:read',
				'profile:update',
				'favorite:read',
				'favorite:create',
				'favorite:delete',
				'follow:create',
				'follow:delete',
				'conversation:read',
				'conversation:create',
				'conversation:update',
				'message:create',
			].sort(),
		);
	});

	describe('migration chat (spec 0013)', () => {
		it('chỉ đụng landlord và tenant, mỗi loại đúng một câu UPDATE', () => {
			expect(Object.keys(readChatAdded()).sort()).toEqual([
				'landlord',
				'tenant',
			]);
			const sql = readFileSync(CHAT, 'utf8');
			expect(sql.match(/UPDATE "account_types"/g)).toHaveLength(2);
		});

		it('chủ trọ không được thêm conversation:create, người tìm trọ được thêm đủ bốn khóa', () => {
			const added = readChatAdded();
			expect(added['landlord']).not.toContain('conversation:create');
			expect([...(added['landlord'] ?? [])].sort()).toEqual([
				'conversation:read',
				'conversation:update',
				'message:create',
			]);
			expect([...(added['tenant'] ?? [])].sort()).toEqual([
				'conversation:create',
				'conversation:read',
				'conversation:update',
				'message:create',
			]);
		});

		it('chỉ thêm khóa còn thiếu nên chạy lại không đổi gì', () => {
			const sql = readFileSync(CHAT, 'utf8');
			expect(sql.match(/WHERE k <> ALL \("permissions"\)/g)).toHaveLength(
				2,
			);
		});

		it('chạy sau migration dọn, nếu không bốn khóa mới bị dọn nhầm', () => {
			expect(
				'20261105090000_chat_conversations_messages' >
					'20261011090000_mvp_permission_cleanup',
			).toBe(true);
			const { modules } = readRemoved();
			expect(modules).not.toContain('conversation');
			expect(modules).not.toContain('message');
		});
	});
});
