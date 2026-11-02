import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { ErrorCode } from '../errors/error-code';
import { TransactionRunner } from './transaction-runner';

function build(transaction: jest.Mock) {
	return new TransactionRunner({
		$transaction: transaction,
	} as unknown as PrismaService);
}

const writeConflict = () =>
	new Prisma.PrismaClientKnownRequestError('conflict', {
		code: 'P2034',
		clientVersion: 'test',
	});

describe('TransactionRunner.run', () => {
	it('không truyền options thì chỉ đặt mức cô lập ReadCommitted, giữ mặc định timeout của Prisma (nơi gọi khác không đổi)', async () => {
		const transaction = jest.fn().mockResolvedValue('ok');
		const fn = jest.fn();
		await expect(build(transaction).run(fn)).resolves.toBe('ok');
		expect(transaction).toHaveBeenCalledWith(fn, {
			isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
		});
		const [, options] = (transaction.mock.calls as unknown[][])[0] ?? [];
		expect(options).not.toHaveProperty('timeout');
		expect(options).not.toHaveProperty('maxWait');
	});

	it('truyền timeout và maxWait xuống Prisma, vẫn giữ ReadCommitted (spec 0011)', async () => {
		const transaction = jest.fn().mockResolvedValue('ok');
		const fn = jest.fn();
		await build(transaction).run(fn, { timeout: 15_000, maxWait: 5_000 });
		expect(transaction).toHaveBeenCalledWith(fn, {
			isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
			timeout: 15_000,
			maxWait: 5_000,
		});
	});

	it('options chỉ có timeout thì không đặt maxWait', async () => {
		const transaction = jest.fn().mockResolvedValue('ok');
		await build(transaction).run(jest.fn(), { timeout: 10_000 });
		const [, options] = (transaction.mock.calls as unknown[][])[0] ?? [];
		expect(options).toMatchObject({ timeout: 10_000 });
		expect(options).not.toHaveProperty('maxWait');
	});

	it('thử lại P2034 với cùng options ở mỗi lần', async () => {
		const transaction = jest
			.fn()
			.mockRejectedValueOnce(writeConflict())
			.mockResolvedValueOnce('ok');
		await expect(
			build(transaction).run(jest.fn(), { timeout: 15_000 }),
		).resolves.toBe('ok');
		expect(transaction).toHaveBeenCalledTimes(2);
		for (const call of transaction.mock.calls as unknown[][]) {
			expect(call[1]).toMatchObject({ timeout: 15_000 });
		}
	});

	it('hết 3 lần thử P2034 thì 503 DB_UNAVAILABLE', async () => {
		const transaction = jest.fn().mockRejectedValue(writeConflict());
		await expect(build(transaction).run(jest.fn())).rejects.toMatchObject({
			code: ErrorCode.DB_UNAVAILABLE,
		});
		expect(transaction).toHaveBeenCalledTimes(3);
	});

	it('lỗi khác P2034 ném ngay, không thử lại', async () => {
		const transaction = jest.fn().mockRejectedValue(new Error('hỏng'));
		await expect(build(transaction).run(jest.fn())).rejects.toThrow('hỏng');
		expect(transaction).toHaveBeenCalledTimes(1);
	});
});
