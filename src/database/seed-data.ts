import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GeoBox } from '../properties/coordinate-area';

/** Một dòng của `ward-bounds.json`: mã phường và hộp bao của nó (spec 0012). */
export interface WardBoundsSeed extends GeoBox {
	readonly code: string;
}

export interface WardSeed {
	readonly code: string;
	readonly name: string;
	readonly provinceCode: string;
	readonly provinceName: string;
}

export interface AmenitySeed {
	readonly key: string;
	readonly name: string;
}

/** `prisma/seed-data` tính từ cả `src/database` lẫn `dist/database` (cùng sâu hai cấp so với gốc dự án). */
export const SEED_DATA_DIR = join(__dirname, '..', '..', 'prisma', 'seed-data');

const WARD_CODE = /^[0-9]{5}$/;
const AMENITY_KEY = /^[a-z][a-z0-9_]{1,29}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(
	item: Record<string, unknown>,
	field: string,
	where: string,
): string {
	const value = item[field];
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(
			`${where}: trường "${field}" phải là chuỗi không rỗng.`,
		);
	}
	return value;
}

function readList(file: string, dir: string): readonly unknown[] {
	const raw: unknown = JSON.parse(readFileSync(join(dir, file), 'utf8'));
	if (!Array.isArray(raw)) {
		throw new Error(`${file}: phải là một mảng.`);
	}
	return raw as unknown[];
}

function assertUnique(file: string, field: string, values: string[]): void {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) {
			throw new Error(`${file}: "${field}" bị trùng: ${value}`);
		}
		seen.add(value);
	}
}

/**
 * Đọc và kiểm `wards.json`: phường, xã, đặc khu theo địa chỉ hai cấp sau sáp nhập (xem README cùng thư mục).
 * Dữ liệu hỏng thì ném lỗi rõ ràng chứ không seed nửa chừng.
 */
export function loadWardSeed(dir: string = SEED_DATA_DIR): WardSeed[] {
	const file = 'wards.json';
	const wards = readList(file, dir).map((item, index) => {
		const where = `${file}[${index}]`;
		if (!isRecord(item)) throw new Error(`${where}: phải là một object.`);
		const code = readText(item, 'code', where);
		if (!WARD_CODE.test(code)) {
			throw new Error(
				`${where}: mã phường phải gồm đúng 5 chữ số, gặp "${code}".`,
			);
		}
		return {
			code,
			name: readText(item, 'name', where),
			provinceCode: readText(item, 'provinceCode', where),
			provinceName: readText(item, 'provinceName', where),
		};
	});
	assertUnique(
		file,
		'code',
		wards.map((ward) => ward.code),
	);
	return wards;
}

function readNumber(
	item: Record<string, unknown>,
	field: string,
	where: string,
	min: number,
	max: number,
): number {
	const value = item[field];
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`${where}: trường "${field}" phải là số.`);
	}
	if (value < min || value > max) {
		throw new Error(
			`${where}: trường "${field}" phải trong khoảng ${min} đến ${max}, gặp ${value}.`,
		);
	}
	return value;
}

/**
 * Đọc và kiểm `ward-bounds.json` (spec 0012 AC-6): hộp bao của từng phường để kiểm tọa độ nhà trọ. Kiểm đúng
 * những gì `CHECK wards_bounds_check` đòi (bốn số, min không lớn hơn max, trong miền ±90 và ±180) để dữ liệu
 * hỏng dừng ở đây, không dừng giữa chừng khi ghi vào DB. Dữ liệu hỏng thì ném lỗi rõ ràng chứ không seed nửa chừng.
 */
export function loadWardBoundsSeed(
	dir: string = SEED_DATA_DIR,
): WardBoundsSeed[] {
	const file = 'ward-bounds.json';
	const bounds = readList(file, dir).map((item, index) => {
		const where = `${file}[${index}]`;
		if (!isRecord(item)) throw new Error(`${where}: phải là một object.`);
		const code = readText(item, 'code', where);
		if (!WARD_CODE.test(code)) {
			throw new Error(
				`${where}: mã phường phải gồm đúng 5 chữ số, gặp "${code}".`,
			);
		}
		const minLatitude = readNumber(item, 'minLatitude', where, -90, 90);
		const maxLatitude = readNumber(item, 'maxLatitude', where, -90, 90);
		const minLongitude = readNumber(item, 'minLongitude', where, -180, 180);
		const maxLongitude = readNumber(item, 'maxLongitude', where, -180, 180);
		if (minLatitude > maxLatitude || minLongitude > maxLongitude) {
			throw new Error(`${where}: giá trị min lớn hơn max.`);
		}
		return { code, minLatitude, maxLatitude, minLongitude, maxLongitude };
	});
	assertUnique(
		file,
		'code',
		bounds.map((item) => item.code),
	);
	return bounds;
}

/** Đọc và kiểm `amenities.json`; khóa phải khớp `CHECK` của bảng `amenities`. */
export function loadAmenitySeed(dir: string = SEED_DATA_DIR): AmenitySeed[] {
	const file = 'amenities.json';
	const amenities = readList(file, dir).map((item, index) => {
		const where = `${file}[${index}]`;
		if (!isRecord(item)) throw new Error(`${where}: phải là một object.`);
		const key = readText(item, 'key', where);
		if (!AMENITY_KEY.test(key)) {
			throw new Error(`${where}: khóa tiện ích sai dạng, gặp "${key}".`);
		}
		return { key, name: readText(item, 'name', where) };
	});
	assertUnique(
		file,
		'key',
		amenities.map((amenity) => amenity.key),
	);
	return amenities;
}
