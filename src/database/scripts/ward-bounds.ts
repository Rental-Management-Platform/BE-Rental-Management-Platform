import type { GeoBox } from '../../properties/coordinate-area';
import type { WardBoundsSeed } from '../seed-data';

/** Số chữ số thập phân giữ lại: 5 chữ số cho độ chính xác khoảng 1 m. */
const DECIMALS = 5;
const SCALE = 10 ** DECIMALS;

/** Làm tròn xuống đến 5 chữ số thập phân; kết quả không bao giờ lớn hơn giá trị gốc (hộp không được co lại). */
export function roundDown(value: number): number {
	const nearest = Math.round(value * SCALE) / SCALE;
	return nearest <= value ? nearest : (Math.round(value * SCALE) - 1) / SCALE;
}

/** Làm tròn lên đến 5 chữ số thập phân; kết quả không bao giờ nhỏ hơn giá trị gốc (hộp không được co lại). */
export function roundUp(value: number): number {
	const nearest = Math.round(value * SCALE) / SCALE;
	return nearest >= value ? nearest : (Math.round(value * SCALE) + 1) / SCALE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Đi qua mọi đỉnh của một hình (Polygon, MultiPolygon, hay bất kỳ mảng lồng nhau nào của cặp [kinh độ, vĩ độ])
 * và trả hộp bao thô, chưa làm tròn. Gặp thứ không phải số thì ném lỗi chứ không bỏ qua.
 */
export function boxOfCoordinates(coordinates: unknown, where: string): GeoBox {
	let minLatitude = Infinity;
	let maxLatitude = -Infinity;
	let minLongitude = Infinity;
	let maxLongitude = -Infinity;

	const visit = (node: unknown): void => {
		if (!Array.isArray(node)) {
			throw new Error(`${where}: tọa độ phải là mảng lồng nhau.`);
		}
		const first: unknown = node[0];
		if (typeof first === 'number') {
			const longitude = first;
			const latitude: unknown = node[1];
			if (typeof latitude !== 'number') {
				throw new Error(`${where}: một đỉnh thiếu vĩ độ.`);
			}
			if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
				throw new Error(`${where}: một đỉnh không phải số hữu hạn.`);
			}
			minLongitude = Math.min(minLongitude, longitude);
			maxLongitude = Math.max(maxLongitude, longitude);
			minLatitude = Math.min(minLatitude, latitude);
			maxLatitude = Math.max(maxLatitude, latitude);
			return;
		}
		for (const child of node as unknown[]) visit(child);
	};
	visit(coordinates);

	if (!Number.isFinite(minLatitude)) {
		throw new Error(`${where}: hình không có đỉnh nào.`);
	}
	return { minLatitude, maxLatitude, minLongitude, maxLongitude };
}

/** Làm tròn ra ngoài đến 5 chữ số thập phân: min xuống, max lên, nên hộp đã làm tròn luôn bao hộp gốc. */
export function roundBoxOutward(box: GeoBox): GeoBox {
	return {
		minLatitude: roundDown(box.minLatitude),
		maxLatitude: roundUp(box.maxLatitude),
		minLongitude: roundDown(box.minLongitude),
		maxLongitude: roundUp(box.maxLongitude),
	};
}

/**
 * Hộp bao của một tệp GeoJSON phường (mỗi tệp một `FeatureCollection` đúng một `Feature`, kiểu bộ dữ liệu của
 * `thanglequoc/vietnamese-provinces-database`). Mã phường lấy từ `properties.code`, phải trùng `id` của Feature.
 */
export function wardBoundsOfGeoJson(
	geoJson: unknown,
	where: string,
): WardBoundsSeed {
	if (!isRecord(geoJson) || !Array.isArray(geoJson.features)) {
		throw new Error(
			`${where}: phải là FeatureCollection có mảng features.`,
		);
	}
	if (geoJson.features.length !== 1) {
		throw new Error(
			`${where}: cần đúng 1 feature, gặp ${geoJson.features.length}.`,
		);
	}
	const feature: unknown = geoJson.features[0];
	if (!isRecord(feature) || !isRecord(feature.properties)) {
		throw new Error(`${where}: feature thiếu properties.`);
	}
	const code = feature.properties.code;
	if (typeof code !== 'string' || !/^[0-9]{5}$/.test(code)) {
		throw new Error(`${where}: properties.code phải gồm đúng 5 chữ số.`);
	}
	const id = typeof feature.id === 'number' ? String(feature.id) : feature.id;
	if (id !== undefined && id !== code) {
		throw new Error(
			`${where}: id của feature (${typeof id === 'string' ? id : 'không phải chuỗi'}) khác properties.code (${code}).`,
		);
	}
	if (!isRecord(feature.geometry)) {
		throw new Error(`${where}: feature thiếu geometry.`);
	}
	const box = roundBoxOutward(
		boxOfCoordinates(feature.geometry.coordinates, where),
	);
	return { code, ...box };
}

/**
 * Ghép các tệp phường thành danh sách hộp xếp theo mã. Từ chối khi tập mã không trùng đúng tập mã của
 * `wards.json` (thiếu hay thừa dù một mã): một hộp gắn nhầm phường còn tệ hơn không có hộp.
 */
export function assembleWardBounds(
	parts: readonly WardBoundsSeed[],
	wardCodes: readonly string[],
): WardBoundsSeed[] {
	const byCode = new Map<string, WardBoundsSeed>();
	for (const part of parts) {
		if (byCode.has(part.code)) {
			throw new Error(`Mã phường bị trùng giữa các tệp: ${part.code}`);
		}
		byCode.set(part.code, part);
	}
	const expected = new Set(wardCodes);
	const missing = [...expected].filter((code) => !byCode.has(code));
	const extra = [...byCode.keys()].filter((code) => !expected.has(code));
	if (missing.length > 0 || extra.length > 0) {
		throw new Error(
			`Mã phường không khớp wards.json: thiếu ${missing.length} (${missing.slice(0, 5).join(', ')}), thừa ${extra.length} (${extra.slice(0, 5).join(', ')}).`,
		);
	}
	return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}
