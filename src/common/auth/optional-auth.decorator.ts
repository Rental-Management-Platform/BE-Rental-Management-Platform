import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Public } from './public.decorator';

export const IS_OPTIONAL_AUTH_KEY = 'auth:optional';

/**
 * Route công khai nhưng NHẬN BIẾT người đăng nhập (spec 0002, "Đọc đăng nhập tùy chọn"): là `@Public()` cộng một
 * khóa riêng, nên vẫn tính là đúng một khai báo (spec 0003 AC-4). Có access token hợp lệ thì `req.user` được gắn;
 * không có, sai hay hết hạn thì coi như khách, không bao giờ 401.
 */
export const OptionalAuth = () =>
	applyDecorators(Public(), SetMetadata(IS_OPTIONAL_AUTH_KEY, true));
