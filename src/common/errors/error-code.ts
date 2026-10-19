import { HttpStatus } from '@nestjs/common';

/** `code` là hằng số tiếng Anh cho FE; `message` trong ERRORS là chữ người dùng thấy, viết bằng tiếng Việt (spec 0004). */
export enum ErrorCode {
	// Common
	VALIDATION_FAILED = 'VALIDATION_FAILED',
	INVALID_ID = 'INVALID_ID',
	PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
	BAD_REQUEST = 'BAD_REQUEST',
	UNAUTHORIZED = 'UNAUTHORIZED',
	FORBIDDEN = 'FORBIDDEN',
	NOT_FOUND = 'NOT_FOUND',
	HTTP_ERROR = 'HTTP_ERROR',
	DB_UNAVAILABLE = 'DB_UNAVAILABLE',
	INTERNAL_ERROR = 'INTERNAL_ERROR',
	RATE_LIMITED = 'RATE_LIMITED',

	// Đăng nhập và token (spec 0002)
	TOKEN_MISSING = 'TOKEN_MISSING',
	TOKEN_INVALID = 'TOKEN_INVALID',
	TOKEN_EXPIRED = 'TOKEN_EXPIRED',
	INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
	REFRESH_TOKEN_MISSING = 'REFRESH_TOKEN_MISSING',
	SESSION_REVOKED = 'SESSION_REVOKED',
	SESSION_EXPIRED = 'SESSION_EXPIRED',
	ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
	ORIGIN_NOT_ALLOWED = 'ORIGIN_NOT_ALLOWED',
	EMAIL_TAKEN = 'EMAIL_TAKEN',
	PHONE_TAKEN = 'PHONE_TAKEN',
	RESET_TOKEN_INVALID = 'RESET_TOKEN_INVALID',
	CURRENT_PASSWORD_WRONG = 'CURRENT_PASSWORD_WRONG',

	// Loại tài khoản và phân quyền (spec 0003)
	PERMISSION_DENIED = 'PERMISSION_DENIED',
	NOT_RESOURCE_OWNER = 'NOT_RESOURCE_OWNER',
	PERMISSION_UNKNOWN = 'PERMISSION_UNKNOWN',
	PERMISSION_ADMIN_ONLY = 'PERMISSION_ADMIN_ONLY',
	SYSTEM_TYPE_PROTECTED = 'SYSTEM_TYPE_PROTECTED',
	ACCOUNT_TYPE_NOT_FOUND = 'ACCOUNT_TYPE_NOT_FOUND',
	USER_NOT_FOUND = 'USER_NOT_FOUND',
	CANNOT_LOCK_SELF = 'CANNOT_LOCK_SELF',
	ACCOUNT_ALREADY_LOCKED = 'ACCOUNT_ALREADY_LOCKED',
	ACCOUNT_NOT_LOCKED = 'ACCOUNT_NOT_LOCKED',

	// Nhà trọ, tin đăng và danh mục phường, tiện ích (spec 0002)
	WARD_UNKNOWN = 'WARD_UNKNOWN',
	AMENITY_UNKNOWN = 'AMENITY_UNKNOWN',
	CATALOG_CODE_TAKEN = 'CATALOG_CODE_TAKEN',
	CATALOG_IN_USE = 'CATALOG_IN_USE',
	PROPERTY_NOT_FOUND = 'PROPERTY_NOT_FOUND',
	PROPERTY_HAS_LISTINGS = 'PROPERTY_HAS_LISTINGS',
	LISTING_NOT_FOUND = 'LISTING_NOT_FOUND',
	LISTING_STATE_INVALID = 'LISTING_STATE_INVALID',
	LISTING_HIDDEN_BY_ADMIN = 'LISTING_HIDDEN_BY_ADMIN',
	LISTING_IMAGE_LIMIT = 'LISTING_IMAGE_LIMIT',
	IMAGE_INVALID = 'IMAGE_INVALID',

	// Dùng thử và hạn mức tin (spec 0003)
	MEMBERSHIP_REQUIRED = 'MEMBERSHIP_REQUIRED',
	LISTING_QUOTA_REACHED = 'LISTING_QUOTA_REACHED',

	// Gói, đơn mua gói và thanh toán thử (spec 0004)
	PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
	PLAN_NAME_TAKEN = 'PLAN_NAME_TAKEN',
	PLAN_IN_USE = 'PLAN_IN_USE',
	PLAN_INACTIVE = 'PLAN_INACTIVE',
	ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
	ORDER_STATE_INVALID = 'ORDER_STATE_INVALID',
}

export interface ErrorDefinition {
	readonly status: HttpStatus;
	readonly message: string;
}

export const ERRORS: Record<ErrorCode, ErrorDefinition> = {
	[ErrorCode.VALIDATION_FAILED]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Dữ liệu gửi lên không hợp lệ.',
	},
	[ErrorCode.INVALID_ID]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Mã định danh không hợp lệ.',
	},
	[ErrorCode.PAYLOAD_TOO_LARGE]: {
		status: HttpStatus.PAYLOAD_TOO_LARGE,
		message: 'Dữ liệu gửi lên quá lớn.',
	},
	[ErrorCode.BAD_REQUEST]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Yêu cầu không hợp lệ.',
	},
	[ErrorCode.UNAUTHORIZED]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Bạn chưa đăng nhập.',
	},
	[ErrorCode.FORBIDDEN]: {
		status: HttpStatus.FORBIDDEN,
		message: 'Bạn không có quyền thực hiện thao tác này.',
	},
	[ErrorCode.NOT_FOUND]: {
		status: HttpStatus.NOT_FOUND,
		message: 'Không tìm thấy nội dung bạn yêu cầu.',
	},
	// Status thật lấy từ lỗi gốc; đây chỉ là giá trị dự phòng.
	[ErrorCode.HTTP_ERROR]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Không thể xử lý yêu cầu.',
	},
	[ErrorCode.DB_UNAVAILABLE]: {
		status: HttpStatus.SERVICE_UNAVAILABLE,
		message: 'Hệ thống đang tạm thời không khả dụng. Vui lòng thử lại sau.',
	},
	[ErrorCode.INTERNAL_ERROR]: {
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		message: 'Đã xảy ra lỗi hệ thống.',
	},
	// Kèm header `Retry-After` (giây) do AppThrottlerGuard đặt (spec 0002 AC-10).
	[ErrorCode.RATE_LIMITED]: {
		status: HttpStatus.TOO_MANY_REQUESTS,
		message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
	},
	[ErrorCode.TOKEN_MISSING]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Thiếu mã xác thực. Vui lòng đăng nhập.',
	},
	[ErrorCode.TOKEN_INVALID]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Mã xác thực không hợp lệ.',
	},
	[ErrorCode.TOKEN_EXPIRED]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Mã xác thực đã hết hạn.',
	},
	[ErrorCode.INVALID_CREDENTIALS]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Email hoặc mật khẩu không đúng.',
	},
	[ErrorCode.REFRESH_TOKEN_MISSING]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Thiếu mã làm mới phiên đăng nhập.',
	},
	[ErrorCode.SESSION_REVOKED]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.',
	},
	[ErrorCode.SESSION_EXPIRED]: {
		status: HttpStatus.UNAUTHORIZED,
		message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
	},
	[ErrorCode.ACCOUNT_LOCKED]: {
		status: HttpStatus.FORBIDDEN,
		message: 'Tài khoản của bạn đã bị khóa.',
	},
	[ErrorCode.ORIGIN_NOT_ALLOWED]: {
		status: HttpStatus.FORBIDDEN,
		message: 'Nguồn gửi yêu cầu không được phép.',
	},
	[ErrorCode.EMAIL_TAKEN]: {
		status: HttpStatus.CONFLICT,
		message: 'Địa chỉ email này đã được sử dụng.',
	},
	[ErrorCode.PHONE_TAKEN]: {
		status: HttpStatus.CONFLICT,
		message:
			'Số điện thoại này đã được dùng cho một tài khoản đăng bài khác.',
	},
	[ErrorCode.RESET_TOKEN_INVALID]: {
		status: HttpStatus.BAD_REQUEST,
		message:
			'Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được dùng.',
	},
	[ErrorCode.CURRENT_PASSWORD_WRONG]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Mật khẩu hiện tại không đúng.',
	},
	[ErrorCode.PERMISSION_DENIED]: {
		status: HttpStatus.FORBIDDEN,
		message: 'Bạn không có quyền thực hiện thao tác này.',
	},
	[ErrorCode.NOT_RESOURCE_OWNER]: {
		status: HttpStatus.FORBIDDEN,
		message: 'Bạn chỉ được thao tác trên dữ liệu của chính mình.',
	},
	[ErrorCode.PERMISSION_UNKNOWN]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Danh sách quyền có khóa không tồn tại.',
	},
	[ErrorCode.PERMISSION_ADMIN_ONLY]: {
		status: HttpStatus.BAD_REQUEST,
		message:
			'Không thể cấp quyền chỉ dành cho quản trị viên cho loại tài khoản này.',
	},
	[ErrorCode.SYSTEM_TYPE_PROTECTED]: {
		status: HttpStatus.CONFLICT,
		message: 'Không thể sửa quyền của quản trị viên.',
	},
	[ErrorCode.ACCOUNT_TYPE_NOT_FOUND]: {
		status: HttpStatus.NOT_FOUND,
		message: 'Không tìm thấy loại tài khoản.',
	},
	[ErrorCode.USER_NOT_FOUND]: {
		status: HttpStatus.NOT_FOUND,
		message: 'Không tìm thấy người dùng.',
	},
	[ErrorCode.CANNOT_LOCK_SELF]: {
		status: HttpStatus.CONFLICT,
		message: 'Bạn không thể tự khóa tài khoản của chính mình.',
	},
	[ErrorCode.ACCOUNT_ALREADY_LOCKED]: {
		status: HttpStatus.CONFLICT,
		message: 'Tài khoản này đã bị khóa từ trước.',
	},
	[ErrorCode.ACCOUNT_NOT_LOCKED]: {
		status: HttpStatus.CONFLICT,
		message: 'Tài khoản này hiện không bị khóa.',
	},
	[ErrorCode.WARD_UNKNOWN]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Phường hoặc xã này không có trong danh mục.',
	},
	[ErrorCode.AMENITY_UNKNOWN]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Có tiện ích không nằm trong danh mục.',
	},
	[ErrorCode.CATALOG_CODE_TAKEN]: {
		status: HttpStatus.CONFLICT,
		message: 'Mã này đã có trong danh mục.',
	},
	[ErrorCode.CATALOG_IN_USE]: {
		status: HttpStatus.CONFLICT,
		message: 'Mục này đang được nhà trọ sử dụng nên chưa thể xóa.',
	},
	[ErrorCode.PROPERTY_NOT_FOUND]: {
		status: HttpStatus.NOT_FOUND,
		message: 'Không tìm thấy nhà trọ.',
	},
	[ErrorCode.PROPERTY_HAS_LISTINGS]: {
		status: HttpStatus.CONFLICT,
		message: 'Nhà trọ còn tin đăng. Hãy xóa các tin trước khi xóa nhà trọ.',
	},
	[ErrorCode.LISTING_NOT_FOUND]: {
		status: HttpStatus.NOT_FOUND,
		message: 'Không tìm thấy tin đăng.',
	},
	[ErrorCode.LISTING_STATE_INVALID]: {
		status: HttpStatus.CONFLICT,
		message:
			'Không thể chuyển tin sang trạng thái này từ trạng thái hiện tại.',
	},
	[ErrorCode.LISTING_HIDDEN_BY_ADMIN]: {
		status: HttpStatus.FORBIDDEN,
		message:
			'Tin này đã bị quản trị viên ẩn nên bạn không thể tự hiện lại.',
	},
	[ErrorCode.LISTING_IMAGE_LIMIT]: {
		status: HttpStatus.CONFLICT,
		message: 'Mỗi tin chỉ có tối đa 5 ảnh.',
	},
	[ErrorCode.IMAGE_INVALID]: {
		status: HttpStatus.BAD_REQUEST,
		message: 'Ảnh không hợp lệ. Chỉ nhận tệp JPEG, PNG hoặc WebP.',
	},
	// Cả hai đều 403 vì nguyên nhân là quyền của tài khoản, không phải trạng thái của tin (spec 0003).
	[ErrorCode.MEMBERSHIP_REQUIRED]: {
		status: HttpStatus.FORBIDDEN,
		message:
			'Kỳ dùng thử của bạn đã hết và chưa có gói đang hiệu lực. Hãy mua gói để đăng hoặc hiện tin.',
	},
	[ErrorCode.LISTING_QUOTA_REACHED]: {
		status: HttpStatus.FORBIDDEN,
		message:
			'Bạn đã dùng hết số tin được hiện theo hạn mức hiện tại. Hãy ẩn hoặc xóa bớt một tin, hoặc nâng gói, để đăng thêm.',
	},
	[ErrorCode.PLAN_NOT_FOUND]: {
		status: HttpStatus.NOT_FOUND,
		message: 'Không tìm thấy gói.',
	},
	[ErrorCode.PLAN_NAME_TAKEN]: {
		status: HttpStatus.CONFLICT,
		message: 'Tên gói này đã có. Hãy chọn tên khác.',
	},
	[ErrorCode.PLAN_IN_USE]: {
		status: HttpStatus.CONFLICT,
		message:
			'Gói này đã có đơn đặt nên không xóa được. Hãy tắt gói thay vì xóa.',
	},
	[ErrorCode.PLAN_INACTIVE]: {
		status: HttpStatus.CONFLICT,
		message: 'Gói này đã ngừng bán. Hãy chọn gói khác.',
	},
	[ErrorCode.ORDER_NOT_FOUND]: {
		status: HttpStatus.NOT_FOUND,
		message: 'Không tìm thấy đơn.',
	},
	[ErrorCode.ORDER_STATE_INVALID]: {
		status: HttpStatus.CONFLICT,
		message: 'Đơn không còn ở trạng thái phù hợp cho thao tác này.',
	},
};

export interface FieldError {
	readonly field: string;
	readonly code: string;
	readonly message: string;
}
