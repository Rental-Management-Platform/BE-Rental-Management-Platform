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

const REVIEWS = join(
	MIGRATIONS,
	'20261107090000_landlord_reviews',
	'migration.sql',
);

const STATISTIC = join(
	MIGRATIONS,
	'20261116100000_landlord_statistic_permission',
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
 * Khóa mà một migration thêm cho từng loại tài khoản: mỗi câu `UPDATE "account_types"` có một mảng
 * `unnest(ARRAY[...])` và một `WHERE "key" = '<loại>'`.
 */
function readAdded(file: string): Record<string, string[]> {
	const sql = readFileSync(file, 'utf8');
	const added: Record<string, string[]> = {};
	for (const statement of sql.matchAll(
		/UPDATE "account_types"[\s\S]*?unnest\(ARRAY\[([^\]]*)\][\s\S]*?WHERE "key" = '(\w+)';/g,
	)) {
		added[statement[2] ?? ''] = quoted(statement[1]);
	}
	return added;
}

function readChatAdded(): Record<string, string[]> {
	return readAdded(CHAT);
}

function readReviewsAdded(): Record<string, string[]> {
	return readAdded(REVIEWS);
}

function readStatisticAdded(): Record<string, string[]> {
	return readAdded(STATISTIC);
}

/** Quyền mặc định thực tế sau khi áp migration đầu và migration dọn (chưa tính chat, đánh giá và thống kê). */
function effectiveDefaults(inserted: string[]): string[] {
	const { modules, keys } = readRemoved();
	return inserted.filter(
		(key) =>
			!modules.includes(key.split(':')[0] ?? '') && !keys.includes(key),
	);
}

/** Quyền mặc định thực tế sau khi áp cả năm migration. */
function currentDefaults(role: string, inserted: string[]): string[] {
	return [
		...effectiveDefaults(inserted),
		...(readChatAdded()[role] ?? []),
		...(readReviewsAdded()[role] ?? []),
		...(readStatisticAdded()[role] ?? []),
	];
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
		for (const added of [
			readChatAdded(),
			readReviewsAdded(),
			readStatisticAdded(),
		]) {
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
				'statistic:read',
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
				'review:read',
				'review:create',
				'review:update',
				'review:delete',
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

	describe('migration thống kê chủ trọ (spec 0017 AC-15)', () => {
		it('chỉ đụng landlord, đúng một câu UPDATE: người tìm trọ không giữ khóa statistic nào', () => {
			expect(Object.keys(readStatisticAdded())).toEqual(['landlord']);
			const sql = readFileSync(STATISTIC, 'utf8');
			expect(sql.match(/UPDATE "account_types"/g)).toHaveLength(1);
			expect(currentDefaults('tenant', tenant ?? [])).not.toEqual(
				expect.arrayContaining([expect.stringMatching(/^statistic:/)]),
			);
		});

		it('chủ trọ được thêm đúng một khóa statistic:read', () => {
			expect(readStatisticAdded()['landlord']).toEqual([
				'statistic:read',
			]);
		});

		it('chỉ thêm khóa còn thiếu nên chạy lại không thêm trùng', () => {
			const sql = readFileSync(STATISTIC, 'utf8');
			expect(sql.match(/WHERE k <> ALL \("permissions"\)/g)).toHaveLength(
				1,
			);
		});

		it('chạy sau migration dọn, chat và đánh giá, nếu không khóa mới bị dọn nhầm', () => {
			expect(
				'20261116100000_landlord_statistic_permission' >
					'20261109090000_listing_reviews',
			).toBe(true);
			const { modules } = readRemoved();
			expect(modules).not.toContain('statistic');
		});

		it('không đổi bảng nào: chỉ có câu UPDATE, không CREATE hay ALTER', () => {
			const sql = readFileSync(STATISTIC, 'utf8');
			expect(sql).not.toMatch(/\b(CREATE|ALTER|DROP)\b\s+(TABLE|INDEX)/i);
		});
	});

	describe('migration đánh giá chủ trọ (spec 0014 AC-14)', () => {
		it('chỉ đụng tenant, đúng một câu UPDATE: chủ trọ không giữ khóa review nào', () => {
			expect(Object.keys(readReviewsAdded())).toEqual(['tenant']);
			const sql = readFileSync(REVIEWS, 'utf8');
			expect(sql.match(/UPDATE "account_types"/g)).toHaveLength(1);
			expect(currentDefaults('landlord', landlord ?? [])).not.toEqual(
				expect.arrayContaining([expect.stringMatching(/^review:/)]),
			);
		});

		it('tenant được thêm đúng bốn khóa, không có review:moderate (chỉ admin giữ)', () => {
			const added = readReviewsAdded();
			expect([...(added['tenant'] ?? [])].sort()).toEqual([
				'review:create',
				'review:delete',
				'review:read',
				'review:update',
			]);
			expect(added['tenant']).not.toContain('review:moderate');
		});

		it('chỉ thêm khóa còn thiếu nên chạy lại không đổi gì', () => {
			const sql = readFileSync(REVIEWS, 'utf8');
			expect(sql.match(/WHERE k <> ALL \("permissions"\)/g)).toHaveLength(
				1,
			);
		});

		it('chạy sau migration dọn và migration chat, nếu không bốn khóa mới bị dọn nhầm', () => {
			expect(
				'20261107090000_landlord_reviews' >
					'20261105090000_chat_conversations_messages',
			).toBe(true);
			const { modules } = readRemoved();
			expect(modules).not.toContain('review');
		});

		it('có đủ bốn CHECK của bảng reviews, khớp spec: sao 1 đến 5, nhận xét 1 đến 1000 ký tự hoặc vắng, hai trạng thái, người viết khác chủ trọ', () => {
			const sql = readFileSync(REVIEWS, 'utf8');
			for (const name of [
				'reviews_stars_check',
				'reviews_comment_check',
				'reviews_status_check',
				'reviews_author_landlord_check',
			]) {
				expect(sql).toContain(`ADD CONSTRAINT "${name}" CHECK`);
			}
			expect(sql).toContain(`"stars" BETWEEN 1 AND 5`);
			expect(sql).toContain(
				`"comment" IS NULL OR char_length("comment") BETWEEN 1 AND 1000`,
			);
			expect(sql).toContain(`"status" IN ('visible', 'hidden_by_admin')`);
			expect(sql).toContain(`"author_id" <> "landlord_id"`);
		});
	});
});
