import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AppConfigService } from '../config/app-config.service';
import { MembershipsModule } from '../memberships/memberships.module';
import { ModerationModule } from '../moderation/moderation.module';
import { PropertiesModule } from '../properties/properties.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';
import {
	ListingImagesController,
	MediaController,
} from './listing-images.controller';
import { ListingImagesRepository } from './listing-images.repository';
import { ListingImagesService } from './listing-images.service';
import { ListingsDataModule } from './listings-data.module';
import {
	ListingsController,
	MyListingsController,
	PropertyListingsController,
} from './listings.controller';
import { ListingsService } from './listings.service';
import { ViewDeduplicator } from './view-deduplicator';

/**
 * Số tệp tối đa multer nhận trong một request tải ảnh. Bằng số ảnh tối đa của một tin: quá số này là yêu cầu
 * bất thường, bị chặn sớm (400) để không đọc cả chục tệp vào bộ nhớ. Từ 2 đến mức này thì Service trả
 * 400 `IMAGE_INVALID` sau khi kiểm chủ sở hữu.
 */
const MAX_FILES_PER_REQUEST = 5;

/** Tin đăng của chủ trọ và đọc công khai (spec 0002 mốc 3), ảnh tin và route phục vụ ảnh (mốc 4). */
@Module({
	imports: [
		ListingsDataModule,
		PropertiesModule,
		ModerationModule,
		MembershipsModule,
		SettingsModule,
		UsersModule,
		StorageModule,
		// Bộ nhớ tạm (mặc định của multer khi không đặt `dest` hay `storage`); dung lượng tối đa mỗi ảnh lấy từ
		// `MAX_UPLOAD_BYTES`. Vượt dung lượng thì Nest đổi lỗi multer thành 413 `PAYLOAD_TOO_LARGE`.
		MulterModule.registerAsync({
			inject: [AppConfigService],
			useFactory: (config: AppConfigService) => ({
				limits: {
					fileSize: config.maxUploadBytes,
					files: MAX_FILES_PER_REQUEST,
				},
			}),
		}),
	],
	controllers: [
		PropertyListingsController,
		ListingsController,
		MyListingsController,
		ListingImagesController,
		MediaController,
	],
	providers: [
		ListingsService,
		ViewDeduplicator,
		ListingImagesService,
		ListingImagesRepository,
	],
})
export class ListingsModule {}
