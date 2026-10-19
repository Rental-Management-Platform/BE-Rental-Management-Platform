import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Prisma, Setting } from '../generated/prisma/client';
import type { SettingResponse } from './dto/setting.response';
import {
	SETTING_DEFINITIONS,
	SETTING_KEYS,
	isSettingKey,
} from './setting-definitions';
import type { SettingKey } from './setting-definitions';
import { toSettingResponse } from './settings.mapper';
import { SettingsRepository } from './settings.repository';

/** Số nguyên có dấu tối đa 9 chữ số; chặn chữ, số thập phân và chuỗi dài trước khi đổi sang số. */
const INTEGER_TEXT = /^-?\d{1,9}$/;
const LOGGED_VALUE_LENGTH = 40;

/**
 * Tham số hệ thống do admin chỉnh (spec 0003 dùng thử, AC-2 và AC-12). Giá trị trong DB là chữ nên luôn được
 * ép số nguyên và kiểm khoảng khi đọc; thiếu dòng hoặc giá trị hỏng thì dùng mặc định và ghi log cảnh báo, không
 * bao giờ ném lỗi ở đường đọc (đăng ký và danh sách công khai không được 500 chỉ vì một dòng tham số).
 */
@Injectable()
export class SettingsService {
	private readonly logger = new Logger(SettingsService.name);
	/** Khóa đã cảnh báo: mỗi khóa tối đa một lần mỗi tiến trình để đường đọc công khai không tràn log. */
	private readonly warned = new Set<SettingKey>();

	constructor(private readonly repository: SettingsRepository) {}

	/**
	 * Giá trị hiện hành của một tham số, cho các module khác dùng (hạn mức, số ngày dùng thử). Nơi đang giữ một
	 * giao dịch phải truyền `tx` để đọc bằng chính kết nối đó: đọc bằng kết nối thứ hai của pool trong lúc giữ
	 * giao dịch có thể làm cạn pool khi nhiều yêu cầu cùng lúc.
	 */
	async getValue(
		key: SettingKey,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		return this.resolve(key, await this.repository.findByKey(key, tx));
	}

	/** Mọi tham số theo thứ tự khai báo, kể cả tham số chưa có dòng (khi đó là giá trị mặc định). */
	async list(): Promise<SettingResponse[]> {
		const rows = await this.repository.findAll();
		return SETTING_KEYS.map((key) => {
			const row = rows.find((item) => item.key === key) ?? null;
			return toSettingResponse(key, this.resolve(key, row), row);
		});
	}

	/**
	 * Đổi một tham số. Khóa lạ thì 404; giá trị không phải số nguyên hoặc ngoài khoảng của khóa thì 400.
	 * `now` là đồng hồ ứng dụng do nơi gọi truyền xuống.
	 */
	async update(
		key: string,
		value: number,
		actorId: string,
		now: Date,
	): Promise<SettingResponse> {
		if (!isSettingKey(key)) throw new AppException(ErrorCode.NOT_FOUND);

		const { min, max } = SETTING_DEFINITIONS[key];
		if (!Number.isInteger(value) || value < min || value > max) {
			throw new AppException(ErrorCode.VALIDATION_FAILED, [
				{
					field: 'value',
					code: 'outOfRange',
					message: `Giá trị phải là số nguyên từ ${min} đến ${max}.`,
				},
			]);
		}

		const row = await this.repository.upsert(
			key,
			String(value),
			actorId,
			now,
		);
		return toSettingResponse(key, value, row);
	}

	private resolve(key: SettingKey, row: Setting | null): number {
		const { min, max, defaultValue } = SETTING_DEFINITIONS[key];

		if (row === null) {
			this.warnOnce(
				key,
				`chưa có dòng trong bảng settings`,
				defaultValue,
			);
			return defaultValue;
		}
		const parsed = INTEGER_TEXT.test(row.value)
			? Number(row.value)
			: Number.NaN;
		if (parsed >= min && parsed <= max) {
			// Đọc được giá trị tốt thì xóa dấu: lần hỏng sau lại được cảnh báo.
			this.warned.delete(key);
			return parsed;
		}
		this.warnOnce(
			key,
			`giá trị ${JSON.stringify(row.value.slice(0, LOGGED_VALUE_LENGTH))} không phải số nguyên từ ${min} đến ${max}`,
			defaultValue,
		);
		return defaultValue;
	}

	private warnOnce(
		key: SettingKey,
		reason: string,
		defaultValue: number,
	): void {
		if (this.warned.has(key)) return;
		this.warned.add(key);
		this.logger.warn(
			`Tham số ${key}: ${reason}, dùng giá trị mặc định ${defaultValue}.`,
		);
	}
}
