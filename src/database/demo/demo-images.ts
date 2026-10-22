import { crc32, deflateSync } from 'node:zlib';

/** Màu RGB, mỗi kênh 0 đến 255. */
type Rgb = readonly [number, number, number];

export const IMAGE_WIDTH = 960;
export const IMAGE_HEIGHT = 640;

/** Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32): cùng hạt giống thì cùng chuỗi số, nên ảnh và dữ liệu demo lặp lại được. */
export function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Băm một chuỗi thành hạt giống số, để mỗi ảnh có hạt giống riêng theo mã tin và vị trí. */
export function seedOf(text: string): number {
	return crc32(Buffer.from(text, 'utf8'));
}

function pick<T>(rng: () => number, items: readonly T[]): T {
	return items[Math.floor(rng() * items.length)];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t),
	];
}

const WHITE: Rgb = [250, 250, 248];
const BLACK: Rgb = [0, 0, 0];

function shade(color: Rgb, amount: number): Rgb {
	return amount >= 0 ? mix(color, WHITE, amount) : mix(color, BLACK, -amount);
}

/** Bảng pixel RGB và bộ vẽ hình khối phẳng; đủ để minh họa phòng, không cần thư viện ảnh. */
class Canvas {
	private readonly pixels: Uint8Array;

	constructor(
		readonly width: number,
		readonly height: number,
	) {
		this.pixels = new Uint8Array(width * height * 3);
	}

	private put(x: number, y: number, color: Rgb): void {
		if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
		const at = (y * this.width + x) * 3;
		this.pixels[at] = color[0];
		this.pixels[at + 1] = color[1];
		this.pixels[at + 2] = color[2];
	}

	rect(x: number, y: number, w: number, h: number, color: Rgb): void {
		const x0 = Math.max(0, Math.round(x));
		const y0 = Math.max(0, Math.round(y));
		const x1 = Math.min(this.width, Math.round(x + w));
		const y1 = Math.min(this.height, Math.round(y + h));
		for (let py = y0; py < y1; py += 1) {
			for (let px = x0; px < x1; px += 1) this.put(px, py, color);
		}
	}

	/** Chuyển màu theo chiều dọc từ `top` xuống `bottom`. */
	gradient(
		x: number,
		y: number,
		w: number,
		h: number,
		top: Rgb,
		bottom: Rgb,
	): void {
		for (let row = 0; row < h; row += 1) {
			this.rect(
				x,
				y + row,
				w,
				1,
				mix(top, bottom, row / Math.max(1, h - 1)),
			);
		}
	}

	ellipse(cx: number, cy: number, rx: number, ry: number, color: Rgb): void {
		for (let py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py += 1) {
			for (
				let px = Math.floor(cx - rx);
				px <= Math.ceil(cx + rx);
				px += 1
			) {
				const dx = (px - cx) / rx;
				const dy = (py - cy) / ry;
				if (dx * dx + dy * dy <= 1) this.put(px, py, color);
			}
		}
	}

	/** Khung viền dày `t` quanh hình chữ nhật. */
	frame(
		x: number,
		y: number,
		w: number,
		h: number,
		t: number,
		color: Rgb,
	): void {
		this.rect(x, y, w, t, color);
		this.rect(x, y + h - t, w, t, color);
		this.rect(x, y, t, h, color);
		this.rect(x + w - t, y, t, h, color);
	}

	/** PNG 8 bit RGB, mỗi dòng dùng bộ lọc "Up" nên vùng phẳng và dải màu nén rất nhỏ. */
	toPng(): Buffer {
		const stride = this.width * 3;
		const raw = Buffer.alloc((stride + 1) * this.height);
		for (let row = 0; row < this.height; row += 1) {
			const out = row * (stride + 1);
			raw[out] = 2;
			for (let i = 0; i < stride; i += 1) {
				const above =
					row === 0 ? 0 : this.pixels[(row - 1) * stride + i];
				raw[out + 1 + i] =
					(this.pixels[row * stride + i] - above) & 0xff;
			}
		}
		const header = Buffer.alloc(13);
		header.writeUInt32BE(this.width, 0);
		header.writeUInt32BE(this.height, 4);
		header[8] = 8; // độ sâu bit
		header[9] = 2; // RGB
		return Buffer.concat([
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			chunk('IHDR', header),
			chunk('IDAT', deflateSync(raw, { level: 9 })),
			chunk('IEND', Buffer.alloc(0)),
		]);
	}
}

function chunk(type: string, data: Buffer): Buffer {
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const out = Buffer.alloc(body.length + 8);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body), body.length + 4);
	return out;
}

const WALLS: readonly Rgb[] = [
	[244, 232, 210],
	[208, 226, 238],
	[209, 232, 220],
	[240, 218, 214],
	[228, 228, 232],
	[246, 236, 190],
];
const FLOORS: readonly Rgb[] = [
	[190, 150, 105],
	[214, 180, 140],
	[176, 178, 182],
	[150, 112, 80],
];
const LINEN: readonly Rgb[] = [
	[236, 238, 240],
	[52, 78, 120],
	[60, 150, 150],
	[226, 120, 104],
	[130, 134, 142],
	[170, 120, 170],
];
const SKY_TOP: Rgb = [128, 184, 236];
const SKY_BOTTOM: Rgb = [226, 240, 250];
const WOOD: Rgb = [150, 108, 72];

/** Các cảnh có thể vẽ; mỗi tin lấy lần lượt vài cảnh theo vị trí ảnh. */
export type Scene =
	'room' | 'loft' | 'bathroom' | 'kitchen' | 'view' | 'building';

function window(c: Canvas, x: number, y: number, w: number, h: number): void {
	c.rect(x - 8, y - 8, w + 16, h + 16, WHITE);
	c.gradient(x, y, w, h, SKY_TOP, SKY_BOTTOM);
	c.rect(x + w / 2 - 3, y, 6, h, WHITE);
	c.rect(x, y + h / 2 - 3, w, 6, WHITE);
}

function paintRoom(c: Canvas, rng: () => number, loft: boolean): void {
	const wall = pick(rng, WALLS);
	const floor = pick(rng, FLOORS);
	const linen = pick(rng, LINEN);
	const horizon = 410;
	c.gradient(0, 0, c.width, horizon, shade(wall, 0.12), wall);
	c.gradient(
		0,
		horizon,
		c.width,
		c.height - horizon,
		floor,
		shade(floor, -0.22),
	);
	for (let x = 0; x < c.width; x += 72) {
		c.rect(x, horizon, 3, c.height - horizon, shade(floor, -0.14));
	}
	c.rect(0, horizon - 14, c.width, 14, shade(wall, -0.16));
	c.ellipse(c.width / 2, 30, 34, 14, WHITE);
	window(c, 640, 90, 220, 200);
	c.rect(600, 70, 36, 250, shade(linen, 0.1));
	c.rect(868, 70, 36, 250, shade(linen, 0.1));
	c.rect(150, 90, 130, 96, shade(wall, -0.3));
	c.rect(160, 100, 110, 76, mix(pick(rng, LINEN), WHITE, 0.4));
	if (loft) {
		c.rect(0, 170, 470, 26, WOOD);
		c.rect(0, 120, 470, 52, linen);
		c.ellipse(60, 138, 44, 18, WHITE);
		for (let x = 10; x < 470; x += 44)
			c.rect(x, 196, 6, 80, shade(WOOD, -0.2));
		for (let y = 220; y < 400; y += 34) c.rect(470, y, 70, 8, WOOD);
		c.rect(470, 196, 8, 214, WOOD);
		c.rect(532, 196, 8, 214, WOOD);
		c.rect(40, 300, 260, 18, shade(WOOD, 0.12));
		c.rect(50, 318, 14, 92, WOOD);
		c.rect(276, 318, 14, 92, WOOD);
		c.rect(110, 250, 120, 50, [38, 44, 58]);
		c.rect(160, 300, 20, 10, [38, 44, 58]);
		c.rect(120, 350, 90, 16, linen);
		c.rect(130, 366, 10, 44, WOOD);
		c.rect(190, 366, 10, 44, WOOD);
	} else {
		c.rect(40, 250, 28, 190, WOOD);
		c.rect(60, 330, 430, 120, shade(WOOD, -0.18));
		c.rect(70, 300, 410, 60, shade(linen, 0.2));
		c.rect(70, 340, 410, 70, linen);
		c.ellipse(130, 318, 46, 20, WHITE);
		c.ellipse(220, 318, 46, 20, WHITE);
		c.rect(500, 350, 74, 92, WOOD);
		c.ellipse(536, 330, 20, 26, [250, 224, 150]);
		c.rect(690, 330, 230, 14, WOOD);
		c.rect(700, 344, 12, 100, shade(WOOD, -0.2));
		c.rect(900, 344, 12, 100, shade(WOOD, -0.2));
		c.rect(760, 250, 90, 60, [40, 44, 56]);
		c.rect(798, 310, 14, 20, [40, 44, 56]);
	}
}

function paintBathroom(c: Canvas, rng: () => number): void {
	const tile = pick(rng, [
		[232, 240, 244],
		[236, 238, 226],
		[226, 236, 236],
	] as const);
	const floor: Rgb = pick(rng, [
		[120, 126, 132],
		[170, 160, 150],
	] as const);
	c.rect(0, 0, c.width, 440, tile);
	for (let x = 0; x < c.width; x += 64)
		c.rect(x, 0, 2, 440, shade(tile, -0.12));
	for (let y = 0; y < 440; y += 64)
		c.rect(0, y, c.width, 2, shade(tile, -0.12));
	c.rect(0, 440, c.width, c.height - 440, floor);
	for (let x = 0; x < c.width; x += 80)
		c.rect(x, 440, 2, 200, shade(floor, -0.2));
	for (let y = 440; y < c.height; y += 80)
		c.rect(0, y, c.width, 2, shade(floor, -0.2));
	c.rect(120, 120, 170, 140, [96, 120, 140]);
	c.gradient(128, 128, 154, 124, [190, 214, 230], [226, 238, 246]);
	c.rect(160, 290, 110, 16, WHITE);
	c.rect(196, 306, 38, 150, shade(WHITE, -0.1));
	c.ellipse(215, 300, 76, 24, shade(WHITE, -0.04));
	c.rect(208, 250, 14, 40, [180, 184, 190]);
	c.rect(540, 200, 120, 120, WHITE);
	c.ellipse(600, 380, 78, 54, WHITE);
	c.ellipse(600, 372, 58, 32, shade(WHITE, -0.12));
	c.gradient(700, 90, 170, 350, [226, 242, 248], [196, 220, 232]);
	c.frame(700, 90, 170, 350, 6, [190, 196, 204]);
	c.rect(836, 90, 8, 80, [178, 182, 188]);
	c.rect(780, 164, 64, 8, [178, 182, 188]);
	c.ellipse(780, 176, 24, 8, [150, 156, 164]);
}

function paintKitchen(c: Canvas, rng: () => number): void {
	const wall = pick(rng, WALLS);
	const cabinet = pick(rng, [
		[196, 154, 108],
		[236, 236, 232],
		[104, 140, 150],
	] as const);
	c.rect(0, 0, c.width, 410, wall);
	c.rect(0, 410, c.width, c.height - 410, [196, 196, 200]);
	for (let x = 0; x < c.width; x += 96)
		c.rect(x, 410, 2, 230, [170, 170, 176]);
	c.rect(0, 250, c.width, 160, [236, 240, 242]);
	for (let x = 0; x < c.width; x += 48)
		c.rect(x, 250, 2, 160, [214, 220, 224]);
	window(c, 380, 60, 200, 150);
	for (const x of [30, 200, 610, 780]) {
		c.rect(x, 40, 150, 150, cabinet);
		c.rect(x + 68, 150, 14, 24, shade(cabinet, -0.35));
	}
	c.rect(0, 410, c.width, 24, [214, 214, 218]);
	c.rect(0, 434, c.width, 206, cabinet);
	for (const x of [0, 240, 480, 720]) {
		c.rect(x, 440, 4, 200, shade(cabinet, -0.25));
		c.rect(x + 100, 470, 30, 12, shade(cabinet, -0.35));
	}
	c.rect(430, 396, 160, 20, [168, 172, 178]);
	c.rect(506, 360, 10, 40, [150, 154, 160]);
	c.rect(120, 380, 130, 28, [40, 40, 44]);
	c.ellipse(160, 394, 20, 8, [90, 90, 96]);
	c.ellipse(212, 394, 20, 8, [90, 90, 96]);
}

function paintView(c: Canvas, rng: () => number): void {
	c.gradient(0, 0, c.width, 400, SKY_TOP, SKY_BOTTOM);
	c.ellipse(780, 110, 46, 46, [255, 238, 170]);
	for (let x = 0; x < c.width;) {
		const w = 60 + Math.floor(rng() * 90);
		const h = 90 + Math.floor(rng() * 200);
		c.rect(x, 400 - h, w, h, mix([150, 168, 190], [110, 128, 152], rng()));
		x += w + Math.floor(rng() * 14);
	}
	for (const x of [90, 420, 800]) {
		c.rect(x - 6, 330, 12, 80, [102, 78, 54]);
		c.ellipse(x, 310, 52, 44, [78, 150, 92]);
	}
	c.rect(0, 400, c.width, 240, shade(pick(rng, FLOORS), -0.05));
	c.rect(0, 380, c.width, 14, WHITE);
	for (let x = 20; x < c.width; x += 52) c.rect(x, 394, 8, 150, WHITE);
	c.rect(0, 540, c.width, 14, WHITE);
}

function paintBuilding(c: Canvas, rng: () => number): void {
	const body = pick(rng, [
		[236, 224, 200],
		[214, 228, 238],
		[232, 206, 196],
		[220, 232, 214],
	] as const);
	c.gradient(0, 0, c.width, 520, SKY_TOP, SKY_BOTTOM);
	c.rect(0, 520, c.width, 120, [96, 98, 104]);
	c.rect(0, 520, c.width, 22, [186, 184, 178]);
	const left = 190;
	const width = 580;
	const floors = 4;
	c.rect(left, 70, width, 460, body);
	c.rect(left - 14, 56, width + 28, 20, shade(body, -0.25));
	for (let f = 0; f < floors; f += 1) {
		const y = 100 + f * 100;
		for (let w = 0; w < 4; w += 1) {
			const x = left + 40 + w * 135;
			if (f === floors - 1 && w === 1) {
				c.rect(x - 10, 400, 100, 130, [90, 70, 56]);
				continue;
			}
			c.rect(x, y, 84, 64, [96, 120, 144]);
			c.gradient(x + 4, y + 4, 76, 56, [180, 212, 236], [220, 236, 246]);
			c.rect(x - 8, y + 66, 100, 8, WHITE);
		}
	}
	c.rect(
		left + 150,
		22,
		280,
		38,
		pick(rng, [
			[200, 60, 52],
			[48, 110, 168],
		] as const),
	);
	for (const x of [120, 840]) {
		c.ellipse(x, 500, 18, 18, [40, 40, 44]);
		c.ellipse(x + 60, 500, 18, 18, [40, 40, 44]);
		c.rect(
			x + 14,
			462,
			40,
			30,
			pick(rng, [
				[196, 52, 52],
				[52, 70, 150],
				[60, 60, 66],
			] as const),
		);
	}
}

/** Vẽ một cảnh theo hạt giống, trả về tệp PNG. Cùng cảnh và hạt giống thì cùng ảnh. */
export function renderScene(scene: Scene, seed: number): Buffer {
	const rng = createRng(seed);
	const canvas = new Canvas(IMAGE_WIDTH, IMAGE_HEIGHT);
	switch (scene) {
		case 'room':
			paintRoom(canvas, rng, false);
			break;
		case 'loft':
			paintRoom(canvas, rng, true);
			break;
		case 'bathroom':
			paintBathroom(canvas, rng);
			break;
		case 'kitchen':
			paintKitchen(canvas, rng);
			break;
		case 'view':
			paintView(canvas, rng);
			break;
		case 'building':
			paintBuilding(canvas, rng);
			break;
	}
	return canvas.toPng();
}
