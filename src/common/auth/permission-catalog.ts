interface ModuleDefinition {
	readonly actions: readonly string[];
	/** Quyền read, update, delete chỉ áp cho tài nguyên của chính người gọi (spec 0003 AC-5). */
	readonly ownerScoped: boolean;
	/** Hành động chỉ admin được giữ; liệt kê đủ mọi hành động nghĩa là cả module chỉ dành cho admin. */
	readonly adminActions: readonly string[];
}

/**
 * Danh mục quyền của MVP (spec 0003, cập nhật 2026-10-11). Nằm trong code vì mỗi quyền phải có đoạn
 * code kiểm tra nó. Mỗi tính năng sau thêm khóa của mình ở đây, kèm migration thêm khóa mặc định cho
 * landlord và tenant. Các module đã hoãn khỏi MVP (liên hệ, báo cáo tin, xác thực, đẩy tin, kiểm tra
 * tại chỗ, quảng cáo, thu chi, dashboard, thống kê) không có ở đây; thêm lại cùng tính năng của chúng.
 */
export const PERMISSION_CATALOG = {
	profile: {
		actions: ['read', 'update'],
		ownerScoped: true,
		adminActions: [],
	},
	user: {
		actions: ['read', 'lock', 'revoke'],
		ownerScoped: false,
		adminActions: ['read', 'lock', 'revoke'],
	},
	account_type: {
		actions: ['read', 'update'],
		ownerScoped: false,
		adminActions: ['read', 'update'],
	},
	catalog: {
		actions: ['read', 'create', 'update', 'delete'],
		ownerScoped: false,
		adminActions: ['read', 'create', 'update', 'delete'],
	},
	setting: {
		actions: ['read', 'update'],
		ownerScoped: false,
		adminActions: ['read', 'update'],
	},
	property: {
		actions: ['read', 'create', 'update', 'delete'],
		ownerScoped: true,
		adminActions: [],
	},
	listing: {
		actions: ['read', 'create', 'update', 'delete', 'moderate'],
		ownerScoped: true,
		adminActions: ['moderate'],
	},
	favorite: {
		actions: ['read', 'create', 'delete'],
		ownerScoped: true,
		adminActions: [],
	},
	follow: {
		actions: ['create', 'delete'],
		ownerScoped: true,
		adminActions: [],
	},
	plan: {
		actions: ['read', 'create', 'update', 'delete'],
		ownerScoped: false,
		adminActions: ['read', 'create', 'update', 'delete'],
	},
	order: {
		actions: ['create', 'read', 'cancel', 'report'],
		ownerScoped: true,
		adminActions: ['report'],
	},
	subscription: {
		actions: ['read'],
		ownerScoped: true,
		adminActions: [],
	},
} as const satisfies Record<string, ModuleDefinition>;

export type PermissionModule = keyof typeof PERMISSION_CATALOG;
type ActionOf<M extends PermissionModule> =
	(typeof PERMISSION_CATALOG)[M]['actions'][number];

/** `module:action`, hoặc `module:manage` là toàn quyền module đó. */
export type PermissionKey = {
	[M in PermissionModule]: `${M}:${ActionOf<M>}` | `${M}:manage`;
}[PermissionModule];

export const MANAGE = 'manage';

const DEFINITIONS: ReadonlyMap<string, ModuleDefinition> = new Map(
	Object.entries(PERMISSION_CATALOG),
);

function splitKey(key: string): { module: string; action: string } | null {
	const separator = key.indexOf(':');
	if (separator <= 0 || separator === key.length - 1) return null;
	return {
		module: key.slice(0, separator),
		action: key.slice(separator + 1),
	};
}

export function isPermissionKey(value: string): value is PermissionKey {
	const parts = splitKey(value);
	if (parts === null) return false;
	const definition = DEFINITIONS.get(parts.module);
	return (
		definition !== undefined &&
		(parts.action === MANAGE || definition.actions.includes(parts.action))
	);
}

/** Mở `module:manage` thành từng hành động; khóa lẻ giữ nguyên. Kết quả không trùng. */
export function expandPermissions(
	keys: readonly PermissionKey[],
): PermissionKey[] {
	const result = new Set<PermissionKey>();
	for (const key of keys) {
		const parts = splitKey(key);
		const definition =
			parts === null ? undefined : DEFINITIONS.get(parts.module);
		if (parts === null || definition === undefined) continue;
		if (parts.action !== MANAGE) {
			result.add(key);
			continue;
		}
		for (const action of definition.actions) {
			const candidate = `${parts.module}:${action}`;
			if (isPermissionKey(candidate)) result.add(candidate);
		}
	}
	return [...result];
}

/** Ngược lại với mở rộng: module nào có đủ mọi hành động thì chỉ ghi `module:manage`, để token ngắn. */
export function compressPermissions(
	keys: readonly PermissionKey[],
): PermissionKey[] {
	const held = new Set<string>(expandPermissions(keys));
	const result: PermissionKey[] = [];
	for (const [module, definition] of DEFINITIONS) {
		const mine = definition.actions.filter((action) =>
			held.has(`${module}:${action}`),
		);
		if (mine.length === 0) continue;
		if (mine.length === definition.actions.length) {
			const manage = `${module}:${MANAGE}`;
			if (isPermissionKey(manage)) result.push(manage);
			continue;
		}
		for (const action of mine) {
			const single = `${module}:${action}`;
			if (isPermissionKey(single)) result.push(single);
		}
	}
	return result;
}

/** Quyền của admin: `manage` mọi module, mở rộng thành từng hành động. Tính trong code, không lưu DB. */
export const ADMIN_PERMISSIONS: readonly PermissionKey[] = expandPermissions(
	[...DEFINITIONS.keys()].flatMap((module) => {
		const manage = `${module}:${MANAGE}`;
		return isPermissionKey(manage) ? [manage] : [];
	}),
);

/** Người giữ `held` có đủ mọi quyền `required` không (hiểu cả `module:manage` ở hai phía). */
export function hasPermissions(
	held: readonly PermissionKey[],
	required: readonly PermissionKey[],
): boolean {
	const heldSet = new Set<string>(expandPermissions(held));
	return expandPermissions(required).every((key) => heldSet.has(key));
}

/**
 * Khóa này chỉ admin được giữ không? `module:manage` luôn tính là có, nếu module có hành động
 * chỉ admin, vì `manage` bao hàm cả hành động đó (spec 0003 AC-6).
 */
export function isAdminOnly(key: PermissionKey): boolean {
	const parts = splitKey(key);
	const definition =
		parts === null ? undefined : DEFINITIONS.get(parts.module);
	if (parts === null || definition === undefined) return false;
	if (parts.action === MANAGE) return definition.adminActions.length > 0;
	return definition.adminActions.includes(parts.action);
}

export function isManageKey(key: PermissionKey): boolean {
	return splitKey(key)?.action === MANAGE;
}

export interface CatalogEntry {
	readonly module: string;
	readonly actions: readonly string[];
	readonly ownerScoped: boolean;
	readonly adminActions: readonly string[];
}

/** Danh mục cho màn hình chọn quyền của admin (`GET /permissions`). */
export function describeCatalog(): CatalogEntry[] {
	return [...DEFINITIONS].map(([module, definition]) => ({
		module,
		actions: definition.actions,
		ownerScoped: definition.ownerScoped,
		adminActions: definition.adminActions,
	}));
}
