import { HttpStatus } from '@nestjs/common';
import { ERRORS, ErrorCode } from './error-code';

describe('mã lỗi của hồ sơ chủ trọ (spec 0005)', () => {
	it('LANDLORD_NOT_FOUND là 404 kèm câu tiếng Việt', () => {
		expect(ERRORS[ErrorCode.LANDLORD_NOT_FOUND]).toEqual({
			status: HttpStatus.NOT_FOUND,
			message: 'Không tìm thấy chủ trọ.',
		});
	});

	it('giá trị của mã trùng tên mã: FE dựa vào chuỗi này', () => {
		expect(ErrorCode.LANDLORD_NOT_FOUND).toBe('LANDLORD_NOT_FOUND');
	});
});
