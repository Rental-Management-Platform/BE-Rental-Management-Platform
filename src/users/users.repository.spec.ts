import type { PrismaService } from '../database/prisma.service';
import { UsersRepository } from './users.repository';

describe('UsersRepository.findAdminPage (spec 0007 AC-1 đến AC-4, AC-6)', () => {
	function build() {
		const findMany = jest.fn(() => Promise.resolve([]));
		const count = jest.fn(() => Promise.resolve(0));
		const repository = new UsersRepository({
			user: { findMany, count },
		} as unknown as PrismaService);
		return { repository, findMany, count };
	}

	interface FindManyArgs {
		where: Record<string, unknown>;
		select: Record<string, boolean>;
		orderBy: unknown;
		skip: number;
		take: number;
	}

	function firstFindManyArgs(findMany: jest.Mock): FindManyArgs {
		return (
			findMany.mock.calls as unknown as unknown[][]
		)[0][0] as FindManyArgs;
	}

	it('không lọc gì: mọi loại và trạng thái, chỉ bỏ tài khoản đã xóa mềm, mới đăng ký trước với khóa phụ id', async () => {
		const { repository, findMany, count } = build();
		await repository.findAdminPage({}, 40, 20);
		const args = firstFindManyArgs(findMany);
		expect(args.where).toEqual({ deletedAt: null });
		expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
		expect(args.skip).toBe(40);
		expect(args.take).toBe(20);
		// `total` đếm bằng cùng điều kiện, không có skip hay take.
		expect(count).toHaveBeenCalledWith({ where: { deletedAt: null } });
	});

	it('select liệt kê đúng tám cột và không có passwordHash', async () => {
		const { repository, findMany } = build();
		await repository.findAdminPage({}, 0, 20);
		const { select } = firstFindManyArgs(findMany);
		expect(Object.keys(select).sort()).toEqual([
			'accountType',
			'createdAt',
			'email',
			'id',
			'lockedReason',
			'name',
			'phone',
			'status',
		]);
		expect(Object.values(select).every((value) => value === true)).toBe(
			true,
		);
		expect(select).not.toHaveProperty('passwordHash');
	});

	it.each([
		['chỉ loại tài khoản', { accountType: 'landlord' as const }],
		['chỉ trạng thái', { status: 'locked' as const }],
		[
			'cả hai',
			{ accountType: 'tenant' as const, status: 'active' as const },
		],
	])(
		'bộ lọc %s nằm trong where cùng điều kiện xóa mềm',
		async (_label, filter) => {
			const { repository, findMany, count } = build();
			await repository.findAdminPage(filter, 0, 20);
			const expected = { deletedAt: null, ...filter };
			expect(firstFindManyArgs(findMany).where).toEqual(expected);
			expect(count).toHaveBeenCalledWith({ where: expected });
		},
	);

	it('q có số điện thoại: ba vế OR, email và tên không phân biệt hoa thường, số điện thoại là chuỗi chữ số', async () => {
		const { repository, findMany } = build();
		await repository.findAdminPage(
			{ search: { text: '0901 234 567', phone: '0901234567' } },
			0,
			20,
		);
		expect(firstFindManyArgs(findMany).where).toEqual({
			deletedAt: null,
			OR: [
				{ email: { contains: '0901 234 567', mode: 'insensitive' } },
				{ name: { contains: '0901 234 567', mode: 'insensitive' } },
				{ phone: { contains: '0901234567' } },
			],
		});
	});

	it('q không phải số: không có vế số điện thoại', async () => {
		const { repository, findMany } = build();
		await repository.findAdminPage(
			{ search: { text: 'Nguyễn', phone: null } },
			0,
			20,
		);
		expect(firstFindManyArgs(findMany).where).toEqual({
			deletedAt: null,
			OR: [
				{ email: { contains: 'Nguyễn', mode: 'insensitive' } },
				{ name: { contains: 'Nguyễn', mode: 'insensitive' } },
			],
		});
	});

	it('q đã thoát %, _ và gạch chéo ngược để chỉ khớp đúng ký tự đó', async () => {
		const { repository, findMany } = build();
		await repository.findAdminPage(
			{ search: { text: '100%_a\\b', phone: null } },
			0,
			20,
		);
		const { where } = firstFindManyArgs(findMany);
		expect(where.OR).toEqual([
			{ email: { contains: '100\\%\\_a\\\\b', mode: 'insensitive' } },
			{ name: { contains: '100\\%\\_a\\\\b', mode: 'insensitive' } },
		]);
	});

	it('q kết hợp với hai bộ lọc bằng AND (OR của q là một khóa riêng cạnh các bộ lọc)', async () => {
		const { repository, findMany } = build();
		await repository.findAdminPage(
			{
				accountType: 'landlord',
				status: 'locked',
				search: { text: 'nam', phone: null },
			},
			0,
			20,
		);
		expect(firstFindManyArgs(findMany).where).toEqual({
			deletedAt: null,
			accountType: 'landlord',
			status: 'locked',
			OR: [
				{ email: { contains: 'nam', mode: 'insensitive' } },
				{ name: { contains: 'nam', mode: 'insensitive' } },
			],
		});
	});

	it('trả đúng hàng và tổng từ hai truy vấn', async () => {
		const rows = [{ id: 'u1' }];
		const repository = new UsersRepository({
			user: {
				findMany: jest.fn(() => Promise.resolve(rows)),
				count: jest.fn(() => Promise.resolve(57)),
			},
		} as unknown as PrismaService);
		await expect(repository.findAdminPage({}, 0, 20)).resolves.toEqual({
			rows,
			total: 57,
		});
	});
});
