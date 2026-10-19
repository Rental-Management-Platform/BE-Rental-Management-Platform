import type { Setting } from '../generated/prisma/client';
import type { SettingResponse } from './dto/setting.response';
import { SETTING_DEFINITIONS } from './setting-definitions';
import type { SettingKey } from './setting-definitions';

/** `value` là giá trị đã ép số và kiểm khoảng (không phải chữ thô trong DB); `row` là `null` khi chưa có dòng. */
export function toSettingResponse(
	key: SettingKey,
	value: number,
	row: Setting | null,
): SettingResponse {
	const { min, max } = SETTING_DEFINITIONS[key];
	return {
		key,
		value,
		min,
		max,
		updatedAt: row === null ? null : row.updatedAt.toISOString(),
		updatedBy: row === null ? null : row.updatedBy,
	};
}
