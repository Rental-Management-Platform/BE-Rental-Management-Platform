import { IsInt } from 'class-validator';

export class UpdateSettingDto {
	/** Số nguyên mới. Khoảng cho phép tùy khóa nên Service kiểm (lỗi cũng là 400 `VALIDATION_FAILED`). */
	@IsInt()
	value: number;
}
