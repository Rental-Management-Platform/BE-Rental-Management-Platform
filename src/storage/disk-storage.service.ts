import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { AppConfigService } from '../config/app-config.service';
import { isStorageKey, StorageService } from './storage.service';
import type { StoredFile } from './storage.service';

function isMissing(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		Reflect.get(error, 'code') === 'ENOENT'
	);
}

/**
 * Lưu tệp vào thư mục `UPLOAD_DIR` (spec 0006, spec 0002 AC-8). Hai lớp chắn đường dẫn: khóa phải khớp
 * `STORAGE_KEY_PATTERN`, và đường dẫn sau khi giải quyết vẫn phải nằm trong thư mục gốc. Thư mục gốc được
 * giải quyết ở lần dùng đầu (không phải lúc khởi động) để bản cấu hình giả của test không bị đọc sớm.
 */
@Injectable()
export class DiskStorageService extends StorageService {
	private root: string | undefined;

	constructor(private readonly config: AppConfigService) {
		super();
	}

	private rootDir(): string {
		this.root ??= resolve(this.config.uploadDir);
		return this.root;
	}

	private pathOf(key: string): string {
		if (!isStorageKey(key)) {
			throw new Error('Khóa lưu trữ không hợp lệ.');
		}
		const root = this.rootDir();
		const full = resolve(root, key);
		if (!full.startsWith(root + sep)) {
			throw new Error('Khóa lưu trữ đi ra ngoài thư mục lưu ảnh.');
		}
		return full;
	}

	async put(key: string, data: Uint8Array): Promise<void> {
		const full = this.pathOf(key);
		await mkdir(dirname(full), { recursive: true });
		await writeFile(full, data);
	}

	async get(key: string): Promise<StoredFile | null> {
		const full = this.pathOf(key);
		try {
			const info = await stat(full);
			if (!info.isFile()) return null;
			return { stream: createReadStream(full), size: info.size };
		} catch (error: unknown) {
			if (isMissing(error)) return null;
			throw error;
		}
	}

	async delete(key: string): Promise<void> {
		try {
			await unlink(this.pathOf(key));
		} catch (error: unknown) {
			if (!isMissing(error)) throw error;
		}
	}
}
