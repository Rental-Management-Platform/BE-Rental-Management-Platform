import {
	ADMIN_PERMISSIONS,
	compressPermissions,
	describeCatalog,
	expandPermissions,
	hasPermissions,
	isAdminOnly,
	isManageKey,
	isPermissionKey,
} from './permission-catalog';

describe('permission catalog', () => {
	describe('isPermissionKey', () => {
		it.each(['listing:read', 'listing:manage', 'account_type:update'])(
			'nhận khóa hợp lệ %s',
			(key) => {
				expect(isPermissionKey(key)).toBe(true);
			},
		);

		it.each([
			'listing:fly',
			'nope:read',
			'listing',
			':read',
			'listing:',
			'',
		])('từ chối khóa lạ %j', (key) => {
			expect(isPermissionKey(key)).toBe(false);
		});
	});

	describe('expandPermissions và compressPermissions', () => {
		it('mở manage thành từng hành động, giữ khóa lẻ, bỏ trùng', () => {
			const expanded = expandPermissions([
				'follow:manage',
				'follow:create',
				'listing:read',
			]);
			expect(expanded.sort()).toEqual([
				'follow:create',
				'follow:delete',
				'listing:read',
			]);
		});

		it('gộp module đủ mọi hành động thành manage, module thiếu thì giữ khóa lẻ', () => {
			expect(
				compressPermissions([
					'follow:create',
					'follow:delete',
					'listing:read',
				]).sort(),
			).toEqual(['follow:manage', 'listing:read']);
		});

		it('mở rồi gộp không làm đổi ý nghĩa', () => {
			const original = ['profile:manage', 'listing:read'] as const;
			const roundTrip = compressPermissions(expandPermissions(original));
			expect(hasPermissions(roundTrip, original)).toBe(true);
			expect(hasPermissions(original, roundTrip)).toBe(true);
		});

		it('quyền của admin gồm mọi hành động của mọi module', () => {
			const everything = describeCatalog().flatMap((entry) =>
				entry.actions.map((action) => `${entry.module}:${action}`),
			);
			expect([...ADMIN_PERMISSIONS].sort()).toEqual(everything.sort());
		});
	});

	describe('hasPermissions', () => {
		it('manage ở phía người giữ đủ cho từng hành động', () => {
			expect(
				hasPermissions(['property:manage'], ['property:update']),
			).toBe(true);
		});

		it('manage ở phía yêu cầu đòi đủ mọi hành động', () => {
			expect(
				hasPermissions(
					['property:read', 'property:create'],
					['property:manage'],
				),
			).toBe(false);
			expect(
				hasPermissions(['property:manage'], ['property:manage']),
			).toBe(true);
		});

		it('thiếu một quyền là không đủ', () => {
			expect(
				hasPermissions(
					['listing:read'],
					['listing:read', 'listing:update'],
				),
			).toBe(false);
		});
	});

	describe('quyền chỉ admin giữ', () => {
		it('hành động chỉ admin và module chỉ admin', () => {
			expect(isAdminOnly('listing:moderate')).toBe(true);
			expect(isAdminOnly('plan:create')).toBe(true);
			expect(isAdminOnly('setting:update')).toBe(true);
			expect(isAdminOnly('account_type:update')).toBe(true);
		});

		it('hành động thường thì không', () => {
			expect(isAdminOnly('listing:read')).toBe(false);
			expect(isAdminOnly('order:create')).toBe(false);
		});

		it('manage của module có hành động chỉ admin cũng là chỉ admin (lỗ hổng listing:manage)', () => {
			expect(isAdminOnly('listing:manage')).toBe(true);
			expect(isAdminOnly('plan:manage')).toBe(true);
			expect(isAdminOnly('profile:manage')).toBe(false);
			expect(isAdminOnly('order:manage')).toBe(false);
			expect(isManageKey('listing:manage')).toBe(true);
			expect(isManageKey('listing:read')).toBe(false);
		});
	});

	describe('phạm vi MVP', () => {
		it('đúng 12 module của MVP', () => {
			expect(
				describeCatalog()
					.map((entry) => entry.module)
					.sort(),
			).toEqual(
				[
					'profile',
					'user',
					'account_type',
					'catalog',
					'setting',
					'property',
					'listing',
					'favorite',
					'follow',
					'plan',
					'order',
					'subscription',
				].sort(),
			);
		});

		it.each([
			'contact:reveal',
			'report:create',
			'verification:create',
			'boost:create',
			'product:read',
			'inspection:create',
			'ad:read',
			'expense:read',
			'finance:read',
			'dashboard:read',
			'stats:read',
			'order:refund',
			'order:gift',
		])('khóa của phần đã hoãn %s không còn hợp lệ', (key) => {
			expect(isPermissionKey(key)).toBe(false);
		});
	});
});
