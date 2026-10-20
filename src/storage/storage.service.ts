import type { Readable } from 'node:stream';

/**
 * Khóa lưu trữ do server sinh, dạng `public/<uuid>.<jpg|png|webp>` (spec 0006, spec 0002 AC-8). Kiểm bằng
 * biểu thức này TRƯỚC khi chạm ổ đĩa, nên một khóa hợp lệ không thể chứa `..`, dấu `/` thừa hay đường dẫn
 * tuyệt đối. Giao diện chừa chỗ cho khóa `private/...` về sau; MVP chưa dùng.
 */
export const STORAGE_KEY_PATTERN =
	/^public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isStorageKey(key: string): boolean {
	return STORAGE_KEY_PATTERN.test(key);
}

/** Một tệp đã lưu: dòng đọc và dung lượng (byte). */
export interface StoredFile {
	readonly stream: Readable;
	readonly size: number;
}

/**
 * Nơi duy nhất ghi và đọc tệp (spec 0006). Bản hiện thực ổ đĩa là `DiskStorageService`; đổi sang kho đám
 * mây về sau chỉ cần thay lớp này, không đụng code gọi.
 */
export abstract class StorageService {
	/** Ghi `data` vào `key`; ghi đè nếu đã có (khóa là uuid ngẫu nhiên nên không tranh nhau). */
	abstract put(key: string, data: Uint8Array): Promise<void>;

	/** Mở tệp để đọc, hoặc `null` nếu không có. */
	abstract get(key: string): Promise<StoredFile | null>;

	/** Xóa tệp; không có sẵn thì coi như đã xóa (không ném lỗi). */
	abstract delete(key: string): Promise<void>;
}
