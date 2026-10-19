import type { SettingKey } from '../setting-definitions';

export interface SettingResponse {
	readonly key: SettingKey;
	/** Giá trị hiện hành; khi dòng thiếu hoặc hỏng là giá trị mặc định. */
	readonly value: number;
	readonly min: number;
	readonly max: number;
	/** `null` khi chưa có dòng trong DB. */
	readonly updatedAt: string | null;
	/** Admin sửa lần cuối; `null` khi chưa có dòng, dòng do seed tạo, hoặc admin đó đã bị xóa. */
	readonly updatedBy: string | null;
}
