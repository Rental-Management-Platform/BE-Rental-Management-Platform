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
