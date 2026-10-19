import { Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Setting } from '../generated/prisma/client';
import { SETTING_DEFINITIONS, SETTING_KEYS } from './setting-definitions';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

const earlier = new Date('2026-10-10T00:00:00.000Z');
const now = new Date('2026-10-16T03:00:00.000Z');
const admin = '0199aaaa-0000-7000-8000-000000000001';

function row(
	key: string,
	value: string,
	updatedBy: string | null = null,
): Setting {
	return { key, value, updatedAt: earlier, updatedBy };
}

interface Fake {
	service: SettingsService;
	upsert: jest.Mock;
}

function serviceWith(rows: Setting[]): Fake {
	const upsert = jest.fn(
		(
			key: string,
			value: string,
			updatedBy: string,
			at: Date,
		): Promise<Setting> =>
			Promise.resolve({ key, value, updatedAt: at, updatedBy }),
	);
	const repository = {
		findAll: () => Promise.resolve(rows),
		findByKey: (key: string) =>
			Promise.resolve(rows.find((item) => item.key === key) ?? null),
		upsert,
	} as unknown as SettingsRepository;
	return { service: new SettingsService(repository), upsert };
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

describe('SettingsService', () => {
	let warn: jest.SpyInstance;

	beforeEach(() => {
		warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
	});

	afterEach(() => {
		warn.mockRestore();
	});

	describe('list', () => {
		it('chưa có dòng nào thì trả hai khóa với giá trị mặc định 30 và 2 (AC-2)', async () => {
			const { service } = serviceWith([]);
			expect(await service.list()).toEqual([
				{
					key: 'trial_days',
					value: 30,
					min: 0,
					max: 365,
					updatedAt: null,
					updatedBy: null,
				},
				{
					key: 'trial_listing_limit',
					value: 2,
					min: 0,
					max: 100,
					updatedAt: null,
					updatedBy: null,
				},
			]);
		});

		it('trả giá trị trong DB cùng updatedAt và updatedBy', async () => {
			const { service } = serviceWith([
				row('trial_days', '14', admin),
				row('trial_listing_limit', '5'),
			]);
			const [days, limit] = await service.list();
			expect(days).toMatchObject({
				key: 'trial_days',
				value: 14,
				updatedAt: earlier.toISOString(),
				updatedBy: admin,
			});
			expect(limit).toMatchObject({
				key: 'trial_listing_limit',
				value: 5,
				updatedBy: null,
			});
		});

		it('bỏ qua dòng có khóa lạ', async () => {
			const { service } = serviceWith([row('khoa_la', '1')]);
			expect((await service.list()).map((item) => item.key)).toEqual([
				'trial_days',
				'trial_listing_limit',
			]);
		});

		it.each(['abc', '1.5', '-1', '366', '', ' 7', '1e2', '99999999999'])(
			'giá trị hỏng %j thì dùng mặc định, không ném lỗi (AC-12)',
			async (broken) => {
				const { service } = serviceWith([row('trial_days', broken)]);
				const [days] = await service.list();
				expect(days?.value).toBe(30);
			},
		);

		it('biên của khoảng vẫn nhận: 0 và 365', async () => {
			const zero = serviceWith([row('trial_days', '0')]);
			expect(await zero.service.getValue('trial_days')).toBe(0);
			const max = serviceWith([row('trial_days', '365')]);
			expect(await max.service.getValue('trial_days')).toBe(365);
		});
	});

	describe('getValue', () => {
		it('thiếu dòng thì trả mặc định cho từng khóa', async () => {
			const { service } = serviceWith([]);
			for (const key of SETTING_KEYS) {
				expect(await service.getValue(key)).toBe(
					SETTING_DEFINITIONS[key].defaultValue,
				);
			}
		});

		it('đọc giá trị admin đã đặt', async () => {
			const { service } = serviceWith([row('trial_listing_limit', '7')]);
			expect(await service.getValue('trial_listing_limit')).toBe(7);
		});
	});

	describe('log cảnh báo (AC-12)', () => {
		it('thiếu dòng hoặc giá trị hỏng thì ghi cảnh báo', async () => {
			await serviceWith([]).service.getValue('trial_days');
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn).toHaveBeenCalledWith(
				expect.stringContaining('trial_days'),
			);

			warn.mockClear();
			await serviceWith([row('trial_days', 'chữ')]).service.getValue(
				'trial_days',
			);
			expect(warn).toHaveBeenCalledTimes(1);
		});

		it('mỗi khóa chỉ cảnh báo một lần mỗi tiến trình', async () => {
			const { service } = serviceWith([
				row('trial_days', 'chữ'),
				row('trial_listing_limit', '2'),
			]);
			await service.getValue('trial_days');
			await service.getValue('trial_days');
			await service.list();
			expect(warn).toHaveBeenCalledTimes(1);
		});

		it('khóa khác hỏng thì cảnh báo riêng', async () => {
			const { service } = serviceWith([row('trial_days', 'chữ')]);
			await service.list();
			expect(warn).toHaveBeenCalledTimes(2); // trial_days hỏng, trial_listing_limit thiếu
		});

		it('giá trị tốt thì không cảnh báo', async () => {
			const { service } = serviceWith([
				row('trial_days', '30'),
				row('trial_listing_limit', '2'),
			]);
			await service.list();
			expect(warn).not.toHaveBeenCalled();
		});

		it('hỏng, rồi tốt, rồi hỏng lại thì cảnh báo lại', async () => {
			const rows = [row('trial_days', 'chữ')];
			const { service } = serviceWith(rows);
			await service.getValue('trial_days');
			rows[0] = row('trial_days', '10');
			await service.getValue('trial_days');
			rows[0] = row('trial_days', 'lại hỏng');
			await service.getValue('trial_days');
			expect(warn).toHaveBeenCalledTimes(2);
		});
	});

	describe('update', () => {
		it('ghi chữ số, người sửa và đồng hồ ứng dụng, rồi trả phần tử như GET (AC-2)', async () => {
			const { service, upsert } = serviceWith([]);
			const result = await service.update('trial_days', 14, admin, now);

			expect(upsert).toHaveBeenCalledWith('trial_days', '14', admin, now);
			expect(result).toEqual({
				key: 'trial_days',
				value: 14,
				min: 0,
				max: 365,
				updatedAt: now.toISOString(),
				updatedBy: admin,
			});
		});

		it.each([
			['trial_days', 0],
			['trial_days', 365],
			['trial_listing_limit', 0],
			['trial_listing_limit', 100],
		] as const)('nhận biên của khoảng: %s = %d', async (key, value) => {
			const { service, upsert } = serviceWith([]);
			await service.update(key, value, admin, now);
			expect(upsert).toHaveBeenCalledTimes(1);
		});

		it.each([
			['trial_days', -1],
			['trial_days', 366],
			['trial_listing_limit', -1],
			['trial_listing_limit', 101],
			['trial_days', 1.5],
			['trial_days', Number.NaN],
			['trial_days', Number.POSITIVE_INFINITY],
			['trial_days', Number.MAX_SAFE_INTEGER],
		] as const)(
			'từ chối %s = %s bằng 400 VALIDATION_FAILED và không ghi gì',
			async (key, value) => {
				const { service, upsert } = serviceWith([]);
				const error = await failure(
					service.update(key, value, admin, now),
				);
				expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
				expect(error.fieldErrors[0]?.field).toBe('value');
				expect(error.fieldErrors[0]?.message).toMatch(/\P{ASCII}/u);
				expect(upsert).not.toHaveBeenCalled();
			},
		);

		it('thông báo khoảng nêu đúng min và max của khóa', async () => {
			const { service } = serviceWith([]);
			const error = await failure(
				service.update('trial_listing_limit', 101, admin, now),
			);
			expect(error.fieldErrors[0]?.message).toBe(
				'Giá trị phải là số nguyên từ 0 đến 100.',
			);
		});

		it.each(['khoa_la', '', 'TRIAL_DAYS', '__proto__', 'constructor'])(
			'khóa lạ %j thì 404 NOT_FOUND và không ghi gì',
			async (key) => {
				const { service, upsert } = serviceWith([]);
				const error = await failure(service.update(key, 5, admin, now));
				expect(error.code).toBe(ErrorCode.NOT_FOUND);
				expect(upsert).not.toHaveBeenCalled();
			},
		);
	});
});
