import { detectImageType } from './detect-image-type';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('detectImageType', () => {
	it('nhận JPEG', () => {
		expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toEqual(
			{
				extension: 'jpg',
				mime: 'image/jpeg',
			},
		);
	});

	it('nhận PNG', () => {
		expect(
			detectImageType(
				bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0),
			),
		).toEqual({ extension: 'png', mime: 'image/png' });
	});

	it('nhận WebP: RIFF, bốn byte kích thước, rồi WEBP', () => {
		const webp = Uint8Array.from([
			...text('RIFF'),
			0x24,
			0x00,
			0x00,
			0x00,
			...text('WEBPVP8 '),
		]);
		expect(detectImageType(webp)).toEqual({
			extension: 'webp',
			mime: 'image/webp',
		});
	});

	it('từ chối RIFF không phải WebP (ví dụ WAV)', () => {
		const wav = Uint8Array.from([
			...text('RIFF'),
			0x24,
			0x00,
			0x00,
			0x00,
			...text('WAVEfmt '),
		]);
		expect(detectImageType(wav)).toBeNull();
	});

	it('từ chối tệp văn bản đặt tên .png', () => {
		expect(
			detectImageType(text('đây chỉ là văn bản, không phải ảnh')),
		).toBeNull();
	});

	it('từ chối GIF, PDF và HTML', () => {
		expect(detectImageType(text('GIF89a'))).toBeNull();
		expect(detectImageType(text('%PDF-1.7'))).toBeNull();
		expect(detectImageType(text('<html><script>'))).toBeNull();
	});

	it('từ chối tệp rỗng và tệp quá ngắn so với chữ ký', () => {
		expect(detectImageType(new Uint8Array())).toBeNull();
		expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
		expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
		expect(detectImageType(text('RIFF'))).toBeNull();
	});
});
