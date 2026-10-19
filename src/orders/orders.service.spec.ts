import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { Plan, Prisma } from '../generated/prisma/client';
import type { PlansRepository } from '../plans/plans.repository';
import type { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import type { UsersService } from '../users/users.service';
import { OrderCodeTakenError, ORDER_CODE_ATTEMPTS } from './order-code';
import { DAY_MS } from './order-status';
import { LANDLORD_ID, ORDER_ID, orderRow, PLAN_ID } from './orders.fixtures';
import type { LockedOrder, OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

const mockGenerate = jest.fn<string, []>();
jest.mock('../listings/listing-code', () => ({
	...jest.requireActual<typeof import('../listings/listing-code')>(
		'../listings/listing-code',
	),
	generateListingCode: (): string => mockGenerate(),
}));

const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;

/** Đồng hồ cố định: Service nhận `now` từ controller, không tự lấy giờ. */
const NOW = new Date('2026-10-19T03:00:00.000Z');

const landlord = {
	userId: LANDLORD_ID,
	accountType: 'landlord',
} as RequestUser;
const stranger = {
	userId: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d99',
	accountType: 'landlord',
} as RequestUser;
const admin = {
	userId: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d98',
	accountType: 'admin',
} as RequestUser;
const tenant = {
	userId: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d97',
	accountType: 'tenant',
} as RequestUser;

function plan(overrides: Partial<Plan> = {}): Plan {
	return {
		id: PLAN_ID,
		name: 'Nâng cao',
		price: 199_000,
		maxListings: 15,
		durationDays: 30,
		isActive: true,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function locked(overrides: Partial<LockedOrder> = {}): LockedOrder {
	return {
		id: ORDER_ID,
		userId: LANDLORD_ID,
		planId: PLAN_ID,
		durationDays: 30,
		status: 'pending',
		...overrides,
	};
}

async function failure(promise: Promise<unknown>): Promise<AppException> {
	try {
		await promise;
	} catch (error: unknown) {
		if (error instanceof AppException) return error;
		throw error;
	}
	throw new Error('Đáng lẽ phải ném AppException');
}

/** Các lần gọi của một mock dưới dạng mảng đối số có kiểu `unknown` (tránh `any` của jest). */
function argsOf(mock: jest.Mock): unknown[][] {
	return mock.mock.calls as unknown[][];
}

type Mocks<T extends string> = Record<T, jest.Mock>;

interface Harness {
	service: OrdersService;
	repository: Mocks<
		| 'create'
		| 'cancelPendingOfUser'
		| 'lockById'
		| 'markPaid'
		| 'markCancelled'
		| 'findById'
		| 'findOwnPage'
	>;
	plans: Mocks<'findById'>;
	subscriptions: Mocks<'findLatestEndsAt' | 'create'>;
	users: Mocks<'lockById'>;
	transactions: { run: jest.Mock };
}

function build(
	options: {
		plan?: Plan | null;
		lockedOrder?: LockedOrder | null;
		latestEnd?: Date | null;
		marked?: boolean;
	} = {},
): Harness {
	const repository = {
		create: jest.fn(() => Promise.resolve(ORDER_ID)),
		cancelPendingOfUser: jest.fn(() => Promise.resolve()),
		lockById: jest.fn(() =>
			Promise.resolve(
				options.lockedOrder === undefined
					? locked()
					: options.lockedOrder,
			),
		),
		markPaid: jest.fn(() => Promise.resolve(options.marked ?? true)),
		markCancelled: jest.fn(() => Promise.resolve(options.marked ?? true)),
		findById: jest.fn(() => Promise.resolve<unknown>(orderRow())),
		findOwnPage: jest.fn(() =>
			Promise.resolve({ rows: [orderRow()], total: 41 }),
		),
	};
	const plans = {
		findById: jest.fn(() =>
			Promise.resolve(options.plan === undefined ? plan() : options.plan),
		),
	};
	const subscriptions = {
		findLatestEndsAt: jest.fn(() =>
			Promise.resolve(options.latestEnd ?? null),
		),
		create: jest.fn(() => Promise.resolve()),
	};
	const users = { lockById: jest.fn(() => Promise.resolve()) };
	const transactions = {
		run: jest.fn(
			<T>(fn: (client: Prisma.TransactionClient) => Promise<T>) => fn(tx),
		),
	};
	return {
		service: new OrdersService(
			repository as unknown as OrdersRepository,
			plans as unknown as PlansRepository,
			subscriptions as unknown as SubscriptionsRepository,
			transactions as unknown as TransactionRunner,
			users as unknown as UsersService,
		),
		repository,
		plans,
		subscriptions,
		users,
		transactions,
	};
}

beforeEach(() => {
	mockGenerate.mockReset();
	mockGenerate.mockReturnValue('k7m2xq9p');
});

describe('OrdersService.create (AC-3)', () => {
	it('chốt giá, số tin, số ngày và tên của gói vào đơn, mã lấy từ bộ sinh mã', async () => {
		const h = build({
			plan: plan({
				name: 'Chuyên nghiệp',
				price: 399_000,
				maxListings: 50,
				durationDays: 45,
			}),
		});
		const response = await h.service.create(
			landlord,
			{ planId: PLAN_ID },
			NOW,
		);
		expect(h.repository.create).toHaveBeenCalledWith(
			{
				code: 'k7m2xq9p',
				userId: LANDLORD_ID,
				planId: PLAN_ID,
				planName: 'Chuyên nghiệp',
				price: 399_000,
				maxListings: 50,
				durationDays: 45,
			},
			tx,
		);
		expect(response.status).toBe('pending');
	});

	it('khóa dòng users trước, đọc gói trong giao dịch, hủy đơn chờ cũ rồi mới chèn đơn mới', async () => {
		const h = build();
		await h.service.create(landlord, { planId: PLAN_ID }, NOW);
		expect(h.users.lockById).toHaveBeenCalledWith(LANDLORD_ID, tx);
		expect(h.plans.findById).toHaveBeenCalledWith(PLAN_ID, tx);
		expect(h.repository.cancelPendingOfUser).toHaveBeenCalledWith(
			LANDLORD_ID,
			NOW,
			tx,
		);
		const order = [
			h.users.lockById,
			h.plans.findById,
			h.repository.cancelPendingOfUser,
			h.repository.create,
		].map((mock) => mock.mock.invocationCallOrder[0]);
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});

	it.each([
		['admin', admin],
		['người tìm trọ', tenant],
	])(
		'%s không tạo được đơn: 403 PERMISSION_DENIED, không khóa hay ghi gì',
		async (_name, user) => {
			const h = build();
			const error = await failure(
				h.service.create(user, { planId: PLAN_ID }, NOW),
			);
			expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
			expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
			expect(h.transactions.run).not.toHaveBeenCalled();
			expect(h.repository.create).not.toHaveBeenCalled();
		},
	);

	it('gói không có: 404 PLAN_NOT_FOUND và đơn chờ cũ không bị hủy', async () => {
		const h = build({ plan: null });
		const error = await failure(
			h.service.create(landlord, { planId: PLAN_ID }, NOW),
		);
		expect(error.code).toBe(ErrorCode.PLAN_NOT_FOUND);
		expect(h.repository.cancelPendingOfUser).not.toHaveBeenCalled();
		expect(h.repository.create).not.toHaveBeenCalled();
	});

	it('gói đã tắt: 409 PLAN_INACTIVE và đơn chờ cũ không bị hủy', async () => {
		const h = build({ plan: plan({ isActive: false }) });
		const error = await failure(
			h.service.create(landlord, { planId: PLAN_ID }, NOW),
		);
		expect(error.code).toBe(ErrorCode.PLAN_INACTIVE);
		expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
		expect(h.repository.cancelPendingOfUser).not.toHaveBeenCalled();
		expect(h.repository.create).not.toHaveBeenCalled();
	});

	it('trùng mã: sinh mã khác và thử lại bằng một giao dịch mới', async () => {
		mockGenerate
			.mockReturnValueOnce('aaaaaaaa')
			.mockReturnValueOnce('bbbbbbbb');
		const h = build();
		h.repository.create
			.mockRejectedValueOnce(new OrderCodeTakenError())
			.mockResolvedValueOnce(ORDER_ID);
		await h.service.create(landlord, { planId: PLAN_ID }, NOW);
		expect(h.transactions.run).toHaveBeenCalledTimes(2);
		const codes = argsOf(h.repository.create).map(
			(call) => (call[0] as { code: string }).code,
		);
		expect(codes).toEqual(['aaaaaaaa', 'bbbbbbbb']);
	});

	it('trùng mã mọi lần thử: 500 INTERNAL_ERROR sau đúng 5 lần', async () => {
		const h = build();
		h.repository.create.mockRejectedValue(new OrderCodeTakenError());
		const error = await failure(
			h.service.create(landlord, { planId: PLAN_ID }, NOW),
		);
		expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
		expect(h.transactions.run).toHaveBeenCalledTimes(ORDER_CODE_ATTEMPTS);
	});

	it('lỗi khác trùng mã: ném ngay, không thử lại', async () => {
		const h = build();
		h.repository.create.mockRejectedValue(new Error('hỏng'));
		await expect(
			h.service.create(landlord, { planId: PLAN_ID }, NOW),
		).rejects.toThrow('hỏng');
		expect(h.transactions.run).toHaveBeenCalledTimes(1);
	});
});

describe('OrdersService.listOwn và getOwn (AC-4, AC-11)', () => {
	it('liệt kê đơn của chính người gọi, đổi trang thành skip và take, chuyển lọc status', async () => {
		const h = build();
		const page = await h.service.listOwn(landlord, {
			page: 3,
			pageSize: 20,
			status: 'paid',
		});
		expect(h.repository.findOwnPage).toHaveBeenCalledWith(
			LANDLORD_ID,
			'paid',
			40,
			20,
		);
		expect(page).toMatchObject({ total: 41, page: 3, pageSize: 20 });
		expect(page.items).toHaveLength(1);
	});

	it('admin chỉ thấy đơn của chính admin (id của admin, không lọc theo người khác)', async () => {
		const h = build();
		await h.service.listOwn(admin, { page: 1, pageSize: 20 });
		expect(argsOf(h.repository.findOwnPage)[0]?.[0]).toBe(admin.userId);
	});

	it('xem một đơn của mình', async () => {
		const h = build();
		const order = await h.service.getOwn(landlord, ORDER_ID);
		expect(order.id).toBe(ORDER_ID);
	});

	it('đơn không có: 404 ORDER_NOT_FOUND', async () => {
		const h = build();
		h.repository.findById.mockResolvedValue(null);
		const error = await failure(h.service.getOwn(landlord, ORDER_ID));
		expect(error.code).toBe(ErrorCode.ORDER_NOT_FOUND);
		expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
	});

	it.each([
		['chủ trọ khác', stranger],
		['admin', admin],
	])(
		'đơn của người khác (%s xem): 403 NOT_RESOURCE_OWNER',
		async (_name, viewer) => {
			const h = build();
			const error = await failure(h.service.getOwn(viewer, ORDER_ID));
			expect(error.code).toBe(ErrorCode.NOT_RESOURCE_OWNER);
		},
	);
});

describe('OrdersService.pay (AC-5, AC-6)', () => {
	it('khóa dòng users trước rồi mới khóa dòng đơn, cùng giao dịch', async () => {
		const h = build();
		await h.service.pay(landlord, ORDER_ID, NOW);
		expect(h.users.lockById).toHaveBeenCalledWith(LANDLORD_ID, tx);
		expect(h.repository.lockById).toHaveBeenCalledWith(ORDER_ID, tx);
		expect(h.users.lockById.mock.invocationCallOrder[0]).toBeLessThan(
			h.repository.lockById.mock.invocationCallOrder[0] ?? 0,
		);
		expect(h.transactions.run).toHaveBeenCalledTimes(1);
	});

	it('chưa có kỳ nào: kỳ bắt đầu đúng now và dài đúng durationDays đã chốt trên đơn', async () => {
		const h = build({ latestEnd: null });
		await h.service.pay(landlord, ORDER_ID, NOW);
		expect(h.subscriptions.create).toHaveBeenCalledWith(
			{
				userId: LANDLORD_ID,
				orderId: ORDER_ID,
				startsAt: NOW,
				endsAt: new Date(NOW.getTime() + 30 * DAY_MS),
			},
			tx,
		);
		expect(h.repository.markPaid).toHaveBeenCalledWith(ORDER_ID, NOW, tx);
	});

	it('số ngày lấy từ đơn đã chốt, không lấy từ gói hiện tại (admin đã sửa gói)', async () => {
		const h = build({
			plan: plan({ durationDays: 90 }),
			lockedOrder: locked({ durationDays: 7 }),
		});
		await h.service.pay(landlord, ORDER_ID, NOW);
		const created = argsOf(h.subscriptions.create)[0]?.[0] as {
			endsAt: Date;
		};
		expect(created.endsAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
	});

	it('đang có gói: kỳ mới nối vào cuối kỳ cũ, chính xác đến mili giây', async () => {
		const latestEnd = new Date('2026-11-05T10:20:30.123Z');
		const h = build({ latestEnd });
		await h.service.pay(landlord, ORDER_ID, NOW);
		const created = argsOf(h.subscriptions.create)[0]?.[0] as {
			startsAt: Date;
			endsAt: Date;
		};
		expect(created.startsAt).toEqual(latestEnd);
		expect(created.endsAt.toISOString()).toBe('2026-12-05T10:20:30.123Z');
	});

	it('kỳ cũ đã hết từ trước: kỳ mới bắt đầu đúng now, không lùi về quá khứ', async () => {
		const h = build({ latestEnd: new Date('2026-10-01T00:00:00.000Z') });
		await h.service.pay(landlord, ORDER_ID, NOW);
		const created = argsOf(h.subscriptions.create)[0]?.[0] as {
			startsAt: Date;
		};
		expect(created.startsAt).toEqual(NOW);
	});

	it('kỳ cũ kết thúc đúng lúc now: kỳ mới bắt đầu đúng now', async () => {
		const h = build({ latestEnd: new Date(NOW.getTime()) });
		await h.service.pay(landlord, ORDER_ID, NOW);
		const created = argsOf(h.subscriptions.create)[0]?.[0] as {
			startsAt: Date;
		};
		expect(created.startsAt.getTime()).toBe(NOW.getTime());
	});

	it('đọc ends_at lớn nhất của chính người gọi trong giao dịch đã khóa', async () => {
		const h = build();
		await h.service.pay(landlord, ORDER_ID, NOW);
		expect(h.subscriptions.findLatestEndsAt).toHaveBeenCalledWith(
			LANDLORD_ID,
			tx,
		);
	});

	it('đơn đã paid: 200 trả kết quả cũ, không tạo kỳ mới và không đổi đơn (bấm đúp)', async () => {
		const h = build({ lockedOrder: locked({ status: 'paid' }) });
		const response = await h.service.pay(landlord, ORDER_ID, NOW);
		expect(response.id).toBe(ORDER_ID);
		expect(h.subscriptions.create).not.toHaveBeenCalled();
		expect(h.repository.markPaid).not.toHaveBeenCalled();
		expect(h.plans.findById).not.toHaveBeenCalled();
	});

	it('đơn đã paid vẫn trả được dù gói đã bị tắt sau khi trả', async () => {
		const h = build({
			lockedOrder: locked({ status: 'paid' }),
			plan: plan({ isActive: false }),
		});
		await expect(
			h.service.pay(landlord, ORDER_ID, NOW),
		).resolves.toBeDefined();
	});

	it('đơn đã cancelled: 409 ORDER_STATE_INVALID, không tạo kỳ', async () => {
		const h = build({ lockedOrder: locked({ status: 'cancelled' }) });
		const error = await failure(h.service.pay(landlord, ORDER_ID, NOW));
		expect(error.code).toBe(ErrorCode.ORDER_STATE_INVALID);
		expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
		expect(h.subscriptions.create).not.toHaveBeenCalled();
	});

	it('gói của đơn đã tắt: 409 PLAN_INACTIVE, không tạo kỳ và không đổi đơn', async () => {
		const h = build({ plan: plan({ isActive: false }) });
		const error = await failure(h.service.pay(landlord, ORDER_ID, NOW));
		expect(error.code).toBe(ErrorCode.PLAN_INACTIVE);
		expect(h.subscriptions.create).not.toHaveBeenCalled();
		expect(h.repository.markPaid).not.toHaveBeenCalled();
	});

	it('đơn không có: 404 ORDER_NOT_FOUND', async () => {
		const h = build({ lockedOrder: null });
		const error = await failure(h.service.pay(landlord, ORDER_ID, NOW));
		expect(error.code).toBe(ErrorCode.ORDER_NOT_FOUND);
		expect(h.subscriptions.create).not.toHaveBeenCalled();
	});

	it('đơn của người khác: 403 NOT_RESOURCE_OWNER, kể cả admin, và báo trước lỗi trạng thái', async () => {
		const cancelledOfOther = locked({
			userId: LANDLORD_ID,
			status: 'cancelled',
		});
		for (const caller of [stranger, admin]) {
			const h = build({ lockedOrder: cancelledOfOther });
			const error = await failure(h.service.pay(caller, ORDER_ID, NOW));
			expect(error.code).toBe(ErrorCode.NOT_RESOURCE_OWNER);
			expect(h.subscriptions.create).not.toHaveBeenCalled();
		}
	});

	it('trạng thái đơn được báo trước lỗi gói: đơn cancelled của gói đã tắt là ORDER_STATE_INVALID', async () => {
		const h = build({
			lockedOrder: locked({ status: 'cancelled' }),
			plan: plan({ isActive: false }),
		});
		const error = await failure(h.service.pay(landlord, ORDER_ID, NOW));
		expect(error.code).toBe(ErrorCode.ORDER_STATE_INVALID);
	});

	it('đơn mất trạng thái pending giữa chừng (markPaid false): 409 và lỗi làm giao dịch hủy kỳ vừa tạo', async () => {
		const h = build({ marked: false });
		const error = await failure(h.service.pay(landlord, ORDER_ID, NOW));
		expect(error.code).toBe(ErrorCode.ORDER_STATE_INVALID);
	});

	it('lỗi khi tạo kỳ thì không đánh dấu đơn paid (cả hai nằm trong một giao dịch)', async () => {
		const h = build();
		h.subscriptions.create.mockRejectedValue(new Error('chồng kỳ'));
		await expect(h.service.pay(landlord, ORDER_ID, NOW)).rejects.toThrow(
			'chồng kỳ',
		);
		expect(h.repository.markPaid).not.toHaveBeenCalled();
		expect(h.transactions.run).toHaveBeenCalledTimes(1);
	});
});

describe('OrdersService.cancel (AC-7)', () => {
	it('đơn pending của mình thành cancelled với cancelled_at là now', async () => {
		const h = build();
		await h.service.cancel(landlord, ORDER_ID, NOW);
		expect(h.repository.markCancelled).toHaveBeenCalledWith(
			ORDER_ID,
			NOW,
			tx,
		);
		expect(h.subscriptions.create).not.toHaveBeenCalled();
	});

	it('khóa dòng users trước rồi mới khóa dòng đơn', async () => {
		const h = build();
		await h.service.cancel(landlord, ORDER_ID, NOW);
		expect(h.users.lockById.mock.invocationCallOrder[0]).toBeLessThan(
			h.repository.lockById.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it('đơn đã cancelled: 200 trả kết quả cũ, không ghi gì', async () => {
		const h = build({ lockedOrder: locked({ status: 'cancelled' }) });
		await expect(
			h.service.cancel(landlord, ORDER_ID, NOW),
		).resolves.toBeDefined();
		expect(h.repository.markCancelled).not.toHaveBeenCalled();
	});

	it('đơn đã paid: 409 ORDER_STATE_INVALID (hoàn tiền đã hoãn khỏi MVP)', async () => {
		const h = build({ lockedOrder: locked({ status: 'paid' }) });
		const error = await failure(h.service.cancel(landlord, ORDER_ID, NOW));
		expect(error.code).toBe(ErrorCode.ORDER_STATE_INVALID);
		expect(h.repository.markCancelled).not.toHaveBeenCalled();
	});

	it('đơn không có: 404; đơn của người khác: 403 NOT_RESOURCE_OWNER, kể cả admin', async () => {
		const missing = build({ lockedOrder: null });
		expect(
			(await failure(missing.service.cancel(landlord, ORDER_ID, NOW)))
				.code,
		).toBe(ErrorCode.ORDER_NOT_FOUND);
		for (const caller of [stranger, admin]) {
			const h = build();
			const error = await failure(
				h.service.cancel(caller, ORDER_ID, NOW),
			);
			expect(error.code).toBe(ErrorCode.NOT_RESOURCE_OWNER);
			expect(h.repository.markCancelled).not.toHaveBeenCalled();
		}
	});

	it('đơn mất trạng thái pending giữa chừng (markCancelled false): 409', async () => {
		const h = build({ marked: false });
		const error = await failure(h.service.cancel(landlord, ORDER_ID, NOW));
		expect(error.code).toBe(ErrorCode.ORDER_STATE_INVALID);
	});
});
