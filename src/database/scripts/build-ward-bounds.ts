import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWardSeed, SEED_DATA_DIR } from '../seed-data';
import { assembleWardBounds, wardBoundsOfGeoJson } from './ward-bounds';

/**
 * Dựng `prisma/seed-data/ward-bounds.json` (spec 0012 AC-6): hộp bao của 168 phường, xã, đặc khu của TP. Hồ Chí
 * Minh. Chạy một lần khi dữ liệu phường đổi, không phải lúc cài đặt hay chạy ứng dụng:
 *
 *   npx ts-node src/database/scripts/build-ward-bounds.ts <thư mục chứa các tệp .geojson>
 *
 * Thư mục là `json/geojson/79_ho_chi_minh/wards/` của kho `thanglequoc/vietnamese-provinces-database`, cùng tag
 * với `wards.json` (xem prisma/seed-data/README.md). Mỗi tệp được đọc để lấy hộp bao của mọi đỉnh, làm tròn ra
 * ngoài đến 5 chữ số thập phân; hình dạng không được giữ lại. Từ chối ghi nếu mã phường không trùng đúng tập mã
 * của `wards.json`.
 */
function main(): void {
	const directory = process.argv[2];
	if (directory === undefined) {
		throw new Error(
			'Thiếu đường dẫn thư mục. Dùng: npx ts-node src/database/scripts/build-ward-bounds.ts <thư mục .geojson>',
		);
	}
	const files = readdirSync(directory)
		.filter((file) => file.endsWith('.geojson'))
		.sort();
	const parts = files.map((file) =>
		wardBoundsOfGeoJson(
			JSON.parse(readFileSync(join(directory, file), 'utf8')) as unknown,
			file,
		),
	);
	const wardCodes = loadWardSeed().map((ward) => ward.code);
	const bounds = assembleWardBounds(parts, wardCodes);

	const target = join(SEED_DATA_DIR, 'ward-bounds.json');
	writeFileSync(target, `${JSON.stringify(bounds, null, 2)}\n`, 'utf8');
	console.log(`Đã ghi ${bounds.length} hộp phường vào ${target}`);
}

try {
	main();
} catch (error: unknown) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
