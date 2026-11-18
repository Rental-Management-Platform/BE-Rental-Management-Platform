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
			expect(isAdminOnly('order:report')).toBe(true);
		});

		it('hành động thường thì không', () => {
			expect(isAdminOnly('listing:read')).toBe(false);
			expect(isAdminOnly('order:create')).toBe(false);
			expect(isAdminOnly('order:read')).toBe(false);
			expect(isAdminOnly('order:cancel')).toBe(false);
		});

		it('manage của module có hành động chỉ admin cũng là chỉ admin (lỗ hổng listing:manage)', () => {
			expect(isAdminOnly('listing:manage')).toBe(true);
			expect(isAdminOnly('plan:manage')).toBe(true);
			expect(isAdminOnly('profile:manage')).toBe(false);
			expect(isAdminOnly('order:manage')).toBe(true);
			expect(isManageKey('listing:manage')).toBe(true);
			expect(isManageKey('listing:read')).toBe(false);
		});

		it('order:report là của admin (spec 0010 AC-10): chủ trọ giữ ba khóa lẻ nên token không còn gộp thành order:manage', () => {
			const landlordOrderKeys = [
				'order:create',
				'order:read',
				'order:cancel',
			] as const;
			expect(compressPermissions(landlordOrderKeys).sort()).toEqual([
				'order:cancel',
				'order:create',
				'order:read',
			]);
			expect(hasPermissions(landlordOrderKeys, ['order:report'])).toBe(
				false,
			);
			// Token cấp trước thay đổi này mang order:manage: nay bung ra cả order:report. Hai route admin chỉ an toàn nhờ @FreshAuth().
			expect(hasPermissions(['order:manage'], ['order:report'])).toBe(
				true,
			);
			expect(ADMIN_PERMISSIONS).toContain('order:report');
		});

		it('GET /permissions liệt kê order:report là hành động chỉ admin', () => {
			const order = describeCatalog().find(
				(entry) => entry.module === 'order',
			);
			expect(order?.actions).toEqual([
				'create',
				'read',
				'cancel',
				'report',
			]);
			expect(order?.adminActions).toEqual(['report']);
		});
	});

	describe('quyền chat (spec 0013)', () => {
		const chatKeys = [
			'conversation:read',
			'conversation:create',
			'conversation:update',
			'message:create',
		] as const;

		it.each(chatKeys)('%s là khóa hợp lệ và không chỉ admin giữ', (key) => {
			expect(isPermissionKey(key)).toBe(true);
			expect(isAdminOnly(key)).toBe(false);
		});

		it('admin vẫn giữ đủ bốn khóa vì manage mọi module: Service mới là nơi chặn admin (AC-8)', () => {
			for (const key of chatKeys)
				expect(ADMIN_PERMISSIONS).toContain(key);
		});

		it('hai module chat chỉ áp cho tài nguyên của chính người gọi và không có hành động chỉ admin', () => {
			const entries = describeCatalog().filter((entry) =>
				['conversation', 'message'].includes(entry.module),
			);
			expect(entries.map((entry) => entry.module).sort()).toEqual([
				'conversation',
				'message',
			]);
			for (const entry of entries) {
				expect(entry.ownerScoped).toBe(true);
				expect(entry.adminActions).toEqual([]);
			}
			expect(
				entries.find((entry) => entry.module === 'conversation')
					?.actions,
			).toEqual(['read', 'create', 'update']);
			expect(
				entries.find((entry) => entry.module === 'message')?.actions,
			).toEqual(['create']);
		});

		it('chủ trọ mặc định giữ ba khóa nhưng không giữ conversation:create (trả lời được, không tự mở)', () => {
			const landlord = [
				'conversation:read',
				'conversation:update',
				'message:create',
			] as const;
			expect(hasPermissions(landlord, ['conversation:read'])).toBe(true);
			expect(hasPermissions(landlord, ['message:create'])).toBe(true);
			expect(hasPermissions(landlord, ['conversation:create'])).toBe(
				false,
			);
		});

		it('tenant giữ đủ bốn khóa nên token gộp conversation thành conversation:manage', () => {
			expect(compressPermissions(chatKeys).sort()).toEqual([
				'conversation:manage',
				'message:manage',
			]);
		});
	});

	describe('quyền đánh giá (spec 0014)', () => {
		const writerKeys = [
			'review:read',
			'review:create',
			'review:update',
			'review:delete',
		] as const;

		it.each(writerKeys)(
			'%s là khóa hợp lệ và không chỉ admin giữ',
			(key) => {
				expect(isPermissionKey(key)).toBe(true);
				expect(isAdminOnly(key)).toBe(false);
			},
		);

		it('review:moderate là khóa hợp lệ và chỉ admin giữ', () => {
			expect(isPermissionKey('review:moderate')).toBe(true);
			expect(isAdminOnly('review:moderate')).toBe(true);
		});

		it('admin giữ đủ năm khóa vì manage mọi module: Service chặn bốn route của người viết (AC-9)', () => {
			for (const key of [...writerKeys, 'review:moderate'] as const)
				expect(ADMIN_PERMISSIONS).toContain(key);
		});

		it('module review chỉ áp cho tài nguyên của chính người gọi và chỉ có hành động moderate dành cho admin', () => {
			const review = describeCatalog().find(
				(entry) => entry.module === 'review',
			);
			expect(review?.actions).toEqual([
				'read',
				'create',
				'update',
				'delete',
				'moderate',
			]);
			expect(review?.ownerScoped).toBe(true);
			expect(review?.adminActions).toEqual(['moderate']);
		});

		it('tenant mặc định giữ bốn khóa nhưng không giữ review:moderate; chủ trọ không giữ khóa review nào', () => {
			const tenant = [...writerKeys] as const;
			for (const key of writerKeys)
				expect(hasPermissions(tenant, [key])).toBe(true);
			expect(hasPermissions(tenant, ['review:moderate'])).toBe(false);
			expect(hasPermissions([], ['review:create'])).toBe(false);
		});

		it('manage của review bao hàm cả review:moderate: token cũ mang review:manage chỉ an toàn nhờ @FreshAuth() ở route admin', () => {
			expect(hasPermissions(['review:manage'], ['review:moderate'])).toBe(
				true,
			);
			expect(isAdminOnly('review:manage')).toBe(true);
		});
	});

	describe('quyền thống kê của chủ trọ (spec 0017 AC-15) và của admin (spec 0018 AC-15, AC-16)', () => {
		it('statistic:read là khóa hợp lệ và không chỉ admin giữ', () => {
			expect(isPermissionKey('statistic:read')).toBe(true);
			expect(isAdminOnly('statistic:read')).toBe(false);
		});

		it('admin giữ khóa này vì manage mọi module: Service mới là nơi từ chối admin', () => {
			expect(ADMIN_PERMISSIONS).toContain('statistic:read');
		});

		it('statistic:report là khóa hợp lệ, chỉ admin giữ và nằm trong quyền của admin', () => {
			expect(isPermissionKey('statistic:report')).toBe(true);
			expect(isAdminOnly('statistic:report')).toBe(true);
			expect(ADMIN_PERMISSIONS).toContain('statistic:report');
		});

		it('module có hai hành động, áp cho tài nguyên của chính người gọi, hành động chỉ admin là report', () => {
			const statistic = describeCatalog().find(
				(entry) => entry.module === 'statistic',
			);
			expect(statistic?.actions).toEqual(['read', 'report']);
			expect(statistic?.ownerScoped).toBe(true);
			expect(statistic?.adminActions).toEqual(['report']);
			expect(isAdminOnly('statistic:manage')).toBe(true);
		});

		it('khóa lẻ statistic:read của chủ trọ không còn gộp thành statistic:manage, nên token mới không mang quyền report', () => {
			expect(compressPermissions(['statistic:read'])).toEqual([
				'statistic:read',
			]);
			expect(
				hasPermissions(['statistic:read'], ['statistic:report']),
			).toBe(false);
			expect(hasPermissions([], ['statistic:read'])).toBe(false);
		});

		it('admin gộp đủ hai hành động thành statistic:manage', () => {
			expect(
				compressPermissions(['statistic:read', 'statistic:report']),
			).toEqual(['statistic:manage']);
		});

		it('token chủ trọ cũ mang statistic:manage vẫn đủ cho statistic:read, và manage bung ra cả report: chỉ @FreshAuth() ở route admin giữ nó ở 403', () => {
			expect(
				hasPermissions(['statistic:manage'], ['statistic:read']),
			).toBe(true);
			expect(
				hasPermissions(['statistic:manage'], ['statistic:report']),
			).toBe(true);
		});
	});

	describe('phạm vi MVP', () => {
		it('đúng 16 module của MVP', () => {
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
					'conversation',
					'message',
					'review',
					'statistic',
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
