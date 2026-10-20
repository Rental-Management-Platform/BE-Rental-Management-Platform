import { Module } from '@nestjs/common';
import { DiskStorageService } from './disk-storage.service';
import { StorageService } from './storage.service';

/** Kho tệp của ứng dụng (spec 0006). Đổi nơi lưu thì chỉ đổi `useClass` ở đây. */
@Module({
	providers: [{ provide: StorageService, useClass: DiskStorageService }],
	exports: [StorageService],
})
export class StorageModule {}
