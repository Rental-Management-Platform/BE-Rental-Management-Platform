import { IsUUID } from 'class-validator';

/** Body tạo đơn (spec 0004 AC-3): chỉ chọn gói. Giá, số tin và số ngày lấy từ gói tại lúc tạo, không nhận từ client. */
export class CreateOrderDto {
	@IsUUID(undefined, { message: 'Phải là mã gói hợp lệ.' })
	planId: string;
}
