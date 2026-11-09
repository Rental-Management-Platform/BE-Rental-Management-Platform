import { HttpStatus } from '@nestjs/common';
import { ERRORS, ErrorCode } from './error-code';

describe('mã lỗi chặn xóa ảnh cuối của tin (spec 0011 AC-7)', () => {
	it('LISTING_IMAGE_REQUIRED là 409 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.LISTING_IMAGE_REQUIRED]).toEqual({
			status: HttpStatus.CONFLICT,
			message:
				'Tin phải còn ít nhất một ảnh. Hãy tải ảnh mới lên trước rồi mới xóa ảnh này.',
		});
	});

	it('giá trị của mã trùng tên mã: FE dựa vào chuỗi này', () => {
		expect(ErrorCode.LISTING_IMAGE_REQUIRED).toBe('LISTING_IMAGE_REQUIRED');
	});
});

describe('mã lỗi giới hạn tọa độ nhà trọ (spec 0012)', () => {
	it('COORDINATE_OUT_OF_AREA là 400 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.COORDINATE_OUT_OF_AREA]).toEqual({
			status: HttpStatus.BAD_REQUEST,
			message: 'Tọa độ nằm ngoài khu vực Thành phố Hồ Chí Minh.',
		});
	});

	it('COORDINATE_FAR_FROM_WARD là 400 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.COORDINATE_FAR_FROM_WARD]).toEqual({
			status: HttpStatus.BAD_REQUEST,
			message: 'Tọa độ quá xa phường hoặc xã đã chọn.',
		});
	});

	it('giá trị của mã trùng tên mã: FE dựa vào chuỗi này', () => {
		expect(ErrorCode.COORDINATE_OUT_OF_AREA).toBe('COORDINATE_OUT_OF_AREA');
		expect(ErrorCode.COORDINATE_FAR_FROM_WARD).toBe(
			'COORDINATE_FAR_FROM_WARD',
		);
	});
});

describe('mã lỗi của hồ sơ chủ trọ (spec 0005)', () => {
	it('LANDLORD_NOT_FOUND là 404 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.LANDLORD_NOT_FOUND]).toEqual({
			status: HttpStatus.NOT_FOUND,
			message: 'Không tìm thấy chủ trọ.',
		});
	});

	it('CANNOT_FOLLOW_SELF là 409 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.CANNOT_FOLLOW_SELF]).toEqual({
			status: HttpStatus.CONFLICT,
			message: 'Bạn không thể theo dõi chính mình.',
		});
	});

	it('giá trị của mã trùng tên mã: FE dựa vào chuỗi này', () => {
		expect(ErrorCode.LANDLORD_NOT_FOUND).toBe('LANDLORD_NOT_FOUND');
		expect(ErrorCode.CANNOT_FOLLOW_SELF).toBe('CANNOT_FOLLOW_SELF');
	});
});

describe('mã lỗi của chat (spec 0013)', () => {
	it('CONVERSATION_NOT_FOUND là 404 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.CONVERSATION_NOT_FOUND]).toEqual({
			status: HttpStatus.NOT_FOUND,
			message: 'Không tìm thấy cuộc trò chuyện.',
		});
	});

	it('CANNOT_CHAT_WITH_SELF là 409 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.CANNOT_CHAT_WITH_SELF]).toEqual({
			status: HttpStatus.CONFLICT,
			message: 'Bạn không thể nhắn tin cho chính mình.',
		});
	});

	it('CHAT_PEER_UNAVAILABLE là 409 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.CHAT_PEER_UNAVAILABLE]).toEqual({
			status: HttpStatus.CONFLICT,
			message: 'Người kia hiện không nhận được tin nhắn.',
		});
	});

	it('giá trị của mã trùng tên mã: FE dựa vào chuỗi này', () => {
		expect(ErrorCode.CONVERSATION_NOT_FOUND).toBe('CONVERSATION_NOT_FOUND');
		expect(ErrorCode.CANNOT_CHAT_WITH_SELF).toBe('CANNOT_CHAT_WITH_SELF');
		expect(ErrorCode.CHAT_PEER_UNAVAILABLE).toBe('CHAT_PEER_UNAVAILABLE');
	});
});

describe('mã lỗi đánh giá từng phòng (spec 0015)', () => {
	it.each([
		[
			ErrorCode.LISTING_REVIEW_NOT_FOUND,
			HttpStatus.NOT_FOUND,
			'Không tìm thấy đánh giá phòng.',
		],
		[
			ErrorCode.LISTING_REVIEW_NOT_ELIGIBLE,
			HttpStatus.FORBIDDEN,
			'Bạn chỉ đánh giá được phòng mà chủ trọ đã trả lời tin nhắn của bạn về chính tin này.',
		],
		[
			ErrorCode.LISTING_REVIEW_ALREADY_EXISTS,
			HttpStatus.CONFLICT,
			'Bạn đã đánh giá phòng này rồi.',
		],
		[
			ErrorCode.LISTING_REVIEW_HIDDEN,
			HttpStatus.CONFLICT,
			'Đánh giá phòng đang bị ẩn nên không sửa được.',
		],
		[
			ErrorCode.LISTING_REVIEW_STATE_INVALID,
			HttpStatus.CONFLICT,
			'Đánh giá phòng không ở trạng thái phù hợp cho thao tác này.',
		],
	])('%s là %i kèm câu tiếng Việt', (code, status, message) => {
		expect(ERRORS[code]).toEqual({ status, message });
	});

	it('giá trị của mỗi mã trùng tên mã: FE dựa vào chuỗi này', () => {
		for (const name of [
			'LISTING_REVIEW_NOT_FOUND',
			'LISTING_REVIEW_NOT_ELIGIBLE',
			'LISTING_REVIEW_ALREADY_EXISTS',
			'LISTING_REVIEW_HIDDEN',
			'LISTING_REVIEW_STATE_INVALID',
		] as const) {
			expect(ErrorCode[name]).toBe(name);
		}
	});

	it('dùng lại mã có sẵn, không thêm mã trùng nghĩa: LISTING_NOT_FOUND và CANNOT_REVIEW_SELF', () => {
		expect(ERRORS[ErrorCode.LISTING_NOT_FOUND].status).toBe(
			HttpStatus.NOT_FOUND,
		);
		expect(ERRORS[ErrorCode.CANNOT_REVIEW_SELF].status).toBe(
			HttpStatus.CONFLICT,
		);
	});
});
