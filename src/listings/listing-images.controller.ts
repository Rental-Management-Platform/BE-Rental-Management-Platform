import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Res,
	StreamableFile,
	UploadedFiles,
	UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import type { ListingImageResponse } from './dto/listing.response';
import { ListingImagesService } from './listing-images.service';

/**
 * Tải lên và xóa ảnh của một tin (spec 0002 AC-8). Quyền `listing:update` là quyền của chủ sở hữu: Service
 * kiểm đúng chủ. Dùng `AnyFilesInterceptor` thay vì `FileInterceptor('file')` để sai tên trường hay gửi nhiều
 * tệp không bị multer chặn trước kiểm chủ sở hữu: spec chốt 413, rồi 404 hoặc 403, rồi 400 `IMAGE_INVALID`.
 * Dung lượng tối đa và số tệp tối đa mỗi request cấu hình ở `MulterModule` trong `ListingsModule`.
 */
@Controller('listings/:id/images')
export class ListingImagesController {
	constructor(private readonly images: ListingImagesService) {}

	@Post()
	@RequirePermissions('listing:update')
	@RateLimited('listingImage')
	@UseInterceptors(AnyFilesInterceptor())
	upload(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@UploadedFiles() files: Express.Multer.File[] | undefined,
	): Promise<ListingImageResponse> {
		return this.images.upload(user, id, files);
	}

	@Delete(':imageId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequirePermissions('listing:update')
	remove(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Param('imageId', uuidParam()) imageId: string,
	): Promise<void> {
		return this.images.remove(user, id, imageId);
	}
}

/**
 * Phục vụ ảnh công khai (spec 0002 AC-8). Chỉ ảnh của tin đang hiện công khai; ảnh của tin bị ẩn, xóa mềm hay
 * của chủ trọ hết hạn mức trả 404 `NOT_FOUND`. Không giới hạn tần suất (ảnh tĩnh). `Cache-Control` một ngày
 * (không phải một năm) để ảnh của tin vừa bị admin ẩn biến khỏi bộ nhớ đệm trong vòng một ngày; `nosniff` để
 * trình duyệt không đoán lại loại tệp. Hai header được đặt bằng tay SAU khi đã tìm thấy ảnh, không dùng
 * `@Header`: decorator đó đặt header cả khi handler ném lỗi, khiến trình duyệt nhớ "404" cả ngày và tin được
 * hiện lại vẫn không thấy ảnh (đã gặp khi kiểm thật).
 */
@Controller('media')
export class MediaController {
	constructor(private readonly images: ListingImagesService) {}

	@Public()
	@Get('public/:file')
	async serve(
		@Param('file') file: string,
		@Res({ passthrough: true }) res: Response,
	): Promise<StreamableFile> {
		const found = await this.images.findPublicFile(file, new Date());
		if (found === null) throw new AppException(ErrorCode.NOT_FOUND);
		res.setHeader('Cache-Control', 'public, max-age=86400');
		res.setHeader('X-Content-Type-Options', 'nosniff');
		return new StreamableFile(found.stream, {
			type: found.mime,
			length: found.size,
		});
	}
}
