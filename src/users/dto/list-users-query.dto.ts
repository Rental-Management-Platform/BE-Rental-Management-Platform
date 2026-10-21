import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ACCOUNT_TYPES } from '../../common/auth/account-type';
import type { AccountType } from '../../common/auth/account-type';
import { Trim } from '../../common/decorators/trim.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination';
import { USER_SEARCH_MAX_LENGTH, USER_STATUSES } from '../user-status';
import type { UserStatus } from '../user-status';

/**
 * Query của `GET /users` cho admin (spec 0007 AC-2, AC-3): phân trang cộng lọc theo loại tài khoản, trạng thái và
 * từ khóa. Mỗi tham số một giá trị; giá trị ngoài danh sách hay tham số lạ là 400 `VALIDATION_FAILED`.
 */
export class ListUsersQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsIn([...ACCOUNT_TYPES])
	accountType?: AccountType;

	@IsOptional()
	@IsIn([...USER_STATUSES])
	status?: UserStatus;

	@IsOptional()
	@Trim()
	@IsString()
	@MaxLength(USER_SEARCH_MAX_LENGTH)
	q?: string;
}
