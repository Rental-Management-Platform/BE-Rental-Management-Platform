import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { AdminUserRow, UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const CREATED_AT = new Date('2026-10-05T03:00:00.000Z');

function row(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
	return {
		id: 'u1',
		email: 'nam@example.com',
		name: null,
		phone: null,
		accountType: 'tenant',
		status: 'active',
		lockedReason: null,
		createdAt: CREATED_AT,
		...overrides,
	};
}

function query(fields: Partial<ListUsersQueryDto> = {}): ListUsersQueryDto {
	return { page: 1, pageSize: 20, ...fields };
}

function build(rows: AdminUserRow[] = [], total = 0) {
	const findAdminPage = jest.fn(() => Promise.resolve({ rows, total }));
	const service = new UsersService({
		findAdminPage,
	} as unknown as UsersRepository);
	return { service, findAdminPage };
}

describe('UsersService.listForAdmin (spec 0007)', () => {
	it('không bộ lọc, không q: gọi Repository không có search, bỏ qua (trang - 1) * pageSize dòng', async () => {
		const { service, findAdminPage } = build();
		await service.listForAdmin(query({ page: 3, pageSize: 10 }));
		expect(findAdminPage).toHaveBeenCalledWith(
			{ accountType: undefined, status: undefined, search: undefined },
			20,
			10,
		);
	});

	it('trả { items, total, page, pageSize } với total của Repository', async () => {
		const { service } = build([row({ id: 'u1' }), row({ id: 'u2' })], 57);
		const page = await service.listForAdmin(
			query({ page: 2, pageSize: 20 }),
		);
		expect(page).toMatchObject({ total: 57, page: 2, pageSize: 20 });
		expect(page.items.map((item) => item.id)).toEqual(['u1', 'u2']);
	});

	it('trang quá cuối: items rỗng và total đúng (AC-1)', async () => {
		const { service } = build([], 12);
		await expect(
			service.listForAdmin(query({ page: 99, pageSize: 20 })),
		).resolves.toEqual({ items: [], total: 12, page: 99, pageSize: 20 });
	});

	it('chuyển bộ lọc loại và trạng thái nguyên vẹn xuống Repository (AC-2)', async () => {
		const { service, findAdminPage } = build();
		await service.listForAdmin(
			query({ accountType: 'landlord', status: 'locked' }),
		);
		expect(findAdminPage).toHaveBeenCalledWith(
			{ accountType: 'landlord', status: 'locked', search: undefined },
			0,
			20,
		);
	});

	it('q rỗng hoặc không có thì không lọc chữ (AC-3)', async () => {
		const { service, findAdminPage } = build();
		await service.listForAdmin(query({ q: '' }));
		await service.listForAdmin(query());
		for (const call of findAdminPage.mock.calls as unknown as unknown[][]) {
			expect(call[0]).toMatchObject({ search: undefined });
		}
	});

	it.each([
		['0901 234 567', '0901234567'],
		['+84901234567', '0901234567'],
		['84901234567', '0901234567'],
		['84', '84'],
	])(
		'q=%j: text giữ nguyên, số điện thoại là %j (AC-4)',
		async (q, phone) => {
			const { service, findAdminPage } = build();
			await service.listForAdmin(query({ q }));
			expect(findAdminPage).toHaveBeenCalledWith(
				{
					accountType: undefined,
					status: undefined,
					search: { text: q, phone },
				},
				0,
				20,
			);
		},
	);

	it('q có chữ cái thì không so với cột số điện thoại (AC-4)', async () => {
		const { service, findAdminPage } = build();
		await service.listForAdmin(query({ q: 'nam@example.com' }));
		expect(findAdminPage).toHaveBeenCalledWith(
			{
				accountType: undefined,
				status: undefined,
				search: { text: 'nam@example.com', phone: null },
			},
			0,
			20,
		);
	});

	it('mỗi phần tử qua toAdminUserItem: không chép cột thừa nào', async () => {
		const withSecret = {
			...row(),
			passwordHash: '$argon2id$bi-mat',
		} as AdminUserRow;
		const { service } = build([withSecret], 1);
		const page = await service.listForAdmin(query());
		expect(JSON.stringify(page)).not.toContain('argon2');
		expect(Object.keys(page.items[0])).toHaveLength(8);
	});
});
