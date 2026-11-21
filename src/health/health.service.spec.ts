import { Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { HealthRepository } from './health.repository';
import { HEALTH_DB_TIMEOUT_MS, HealthService } from './health.service';

function serviceWith(ping: () => Promise<void>): HealthService {
	const repository = { ping } as unknown as HealthRepository;
	return new HealthService(repository);
}

describe('HealthService', () => {
	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}); // không in lỗi giả ra màn hình test
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('database trả lời thì báo ok', async () => {
		const ping = jest.fn().mockResolvedValue(undefined);
		await expect(serviceWith(ping).check()).resolves.toEqual({
			status: 'ok',
		});
		expect(ping).toHaveBeenCalledTimes(1);
	});

	it('database báo lỗi thì 503 DB_UNAVAILABLE và không lộ nội dung lỗi', async () => {
		const ping = jest
			.fn()
			.mockRejectedValue(new Error('password authentication failed'));
		const result = serviceWith(ping).check();
		await expect(result).rejects.toBeInstanceOf(AppException);
		await expect(result).rejects.toMatchObject({
			code: ErrorCode.DB_UNAVAILABLE,
		});
	});

	it('database treo quá hạn thì 503 DB_UNAVAILABLE, không treo theo', async () => {
		jest.useFakeTimers();
		const ping = jest.fn().mockReturnValue(new Promise<void>(() => {}));
		const result = serviceWith(ping).check();
		const assertion = expect(result).rejects.toMatchObject({
			code: ErrorCode.DB_UNAVAILABLE,
		});
		await jest.advanceTimersByTimeAsync(HEALTH_DB_TIMEOUT_MS + 1);
		await assertion;
	});
});
