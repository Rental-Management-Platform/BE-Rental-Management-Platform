import { IsOptional } from 'class-validator';
import { IsCalendarDate } from '../../common/time/calendar-date';

/**
 * Query của `GET /me/statistics` (spec 0017 AC-2). Chỉ kiểm từng trường: `from` và `to` tùy chọn, `YYYY-MM-DD`, ngày
 * có thật, năm 2000 đến 2100 (cùng validator của spec 0010). Việc điền mặc định cần đồng hồ `now`, còn kiểm `from`
 * không sau `to` và khoảng không quá 366 ngày dựa trên cả hai ngày đã chốt, nên cả ba nằm ở `resolveStatPeriod`. Tham
 * số lạ (`groupBy`, `sort`) là 400 `VALIDATION_FAILED` nhờ pipe toàn cục `forbidNonWhitelisted`.
 */
export class StatisticsQueryDto {
	@IsOptional()
	@IsCalendarDate()
	from?: string;

	@IsOptional()
	@IsCalendarDate()
	to?: string;
}
