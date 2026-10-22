import { crc32, inflateSync } from 'node:zlib';
import { detectImageType } from '../../common/files/detect-image-type';
import {
	createRng,
	IMAGE_HEIGHT,
	IMAGE_WIDTH,
	renderScene,
	seedOf,
} from './demo-images';
import type { Scene } from './demo-images';

const SCENES: readonly Scene[] = [
	'room',
	'loft',
	'bathroom',
	'kitchen',
	'view',
	'building',
];

interface PngChunk {
	readonly type: string;
	readonly data: Buffer;
	readonly crcOk: boolean;
}

function readChunks(png: Buffer): PngChunk[] {
	const chunks: PngChunk[] = [];
	let at = 8;
	while (at < png.length) {
		const length = png.readUInt32BE(at);
		const type = png.subarray(at + 4, at + 8).toString('ascii');
		const data = png.subarray(at + 8, at + 8 + length);
		const stored = png.readUInt32BE(at + 8 + length);
		chunks.push({
			type,
			data,
			crcOk: crc32(png.subarray(at + 4, at + 8 + length)) === stored,
		});
		at += 12 + length;
	}
	return chunks;
}

describe('demo-images: ảnh minh họa dựng bằng mã', () => {
	it.each(SCENES)(
		'cảnh %s là PNG hợp lệ: chữ ký, kích thước, CRC từng khối, dữ liệu giải nén đúng cỡ',
		(scene) => {
			const png = renderScene(scene, 7);
			expect(detectImageType(png)?.extension).toBe('png');
			const chunks = readChunks(png);
			expect(chunks.map((chunk) => chunk.type)).toEqual([
				'IHDR',
				'IDAT',
				'IEND',
			]);
			expect(chunks.every((chunk) => chunk.crcOk)).toBe(true);
			const header = chunks[0]?.data;
			expect(header.readUInt32BE(0)).toBe(IMAGE_WIDTH);
			expect(header.readUInt32BE(4)).toBe(IMAGE_HEIGHT);
			expect(header[8]).toBe(8);
			expect(header[9]).toBe(2);
			const raw = inflateSync(chunks[1]?.data);
			expect(raw.length).toBe((IMAGE_WIDTH * 3 + 1) * IMAGE_HEIGHT);
		},
	);

	it('ảnh nhỏ (dưới 100 KB) để 170 ảnh không làm phình thư mục uploads', () => {
		for (const scene of SCENES) {
			expect(renderScene(scene, 11).length).toBeLessThan(100 * 1024);
		}
	});

	it('cùng cảnh và hạt giống thì cùng ảnh; hạt giống khác thì ảnh khác', () => {
		expect(renderScene('room', 5).equals(renderScene('room', 5))).toBe(
			true,
		);
		const different = new Set<string>();
		for (let seed = 1; seed <= 6; seed += 1) {
			different.add(renderScene('room', seed).toString('base64'));
		}
		expect(different.size).toBeGreaterThan(1);
	});

	it('bộ sinh số có hạt giống lặp lại được và nằm trong [0, 1)', () => {
		const a = createRng(42);
		const b = createRng(42);
		for (let i = 0; i < 50; i += 1) {
			const value = a();
			expect(value).toBe(b());
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
		expect(seedOf('abc:0')).toBe(seedOf('abc:0'));
		expect(seedOf('abc:0')).not.toBe(seedOf('abc:1'));
	});
});
