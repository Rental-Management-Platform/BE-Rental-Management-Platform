import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import type { AppConfigService } from '../config/app-config.service';
import { DiskStorageService } from './disk-storage.service';

const KEY = 'public/0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d01.png';
const OTHER_KEY = 'public/0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d02.webp';

async function readAll(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(
			Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
		);
	}
	return Buffer.concat(chunks);
}

describe('DiskStorageService (spec 0006, spec 0002 AC-8)', () => {
	let root: string;
	let storage: DiskStorageService;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), 'rental-storage-'));
		storage = new DiskStorageService({
			uploadDir: root,
		} as unknown as AppConfigService);
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it('put rồi get trả đúng nội dung và dung lượng; tạo thư mục public nếu chưa có', async () => {
		const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
		await storage.put(KEY, data);

		const found = await storage.get(KEY);
		expect(found).not.toBeNull();
		expect(found?.size).toBe(data.length);
		expect(await readAll(found!.stream)).toEqual(data);
		expect(await readFile(join(root, KEY))).toEqual(data);
	});

	it('get khóa chưa có thì null (không ném lỗi)', async () => {
		await expect(storage.get(KEY)).resolves.toBeNull();
	});

	it('put lên khóa đã có thì ghi đè', async () => {
		await storage.put(KEY, Buffer.from('cu'));
		await storage.put(KEY, Buffer.from('moi'));
		expect((await readFile(join(root, KEY))).toString()).toBe('moi');
	});

	it('delete xóa đúng tệp đó, không đụng tệp khác', async () => {
		await storage.put(KEY, Buffer.from('a'));
		await storage.put(OTHER_KEY, Buffer.from('b'));
		await storage.delete(KEY);

		await expect(storage.get(KEY)).resolves.toBeNull();
		expect((await readdir(join(root, 'public'))).sort()).toEqual([
			OTHER_KEY.replace('public/', ''),
		]);
	});

	it('delete khóa chưa có thì không ném lỗi', async () => {
		await expect(storage.delete(KEY)).resolves.toBeUndefined();
	});

	it.each([
		'public/../escape.png',
		'../public/0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d01.png',
		'public/0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d01.exe',
		'/etc/passwd',
		'',
	])(
		'khóa sai %j bị từ chối ở cả put, get và delete, không chạm ổ đĩa',
		async (key) => {
			await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow();
			await expect(storage.get(key)).rejects.toThrow();
			await expect(storage.delete(key)).rejects.toThrow();
			await expect(readdir(root)).resolves.toEqual([]);
		},
	);

	it('thư mục gốc tương đối được giải quyết theo thư mục chạy và tệp nằm trong đó', async () => {
		const relative = new DiskStorageService({
			uploadDir: 'uploads-test-relative',
		} as unknown as AppConfigService);
		await relative.put(KEY, Buffer.from('r'));
		try {
			const info = await stat(
				join(process.cwd(), 'uploads-test-relative', KEY),
			);
			expect(info.isFile()).toBe(true);
		} finally {
			await rm(join(process.cwd(), 'uploads-test-relative'), {
				recursive: true,
				force: true,
			});
		}
	});

	it('không đọc cấu hình cho tới lần dùng đầu (bản cấu hình giả của test không bị chạm sớm)', () => {
		const config = {
			get uploadDir(): string {
				throw new Error('đọc sớm');
			},
		} as unknown as AppConfigService;
		expect(() => new DiskStorageService(config)).not.toThrow();
	});
});
