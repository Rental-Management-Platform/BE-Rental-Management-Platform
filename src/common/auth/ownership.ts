import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';
import type { RequestUser } from '../http/authenticated-request';

/**
 * Quy tắc chủ sở hữu cố định trong code (spec 0003 AC-5), áp cho mọi loại tài khoản kể cả admin:
 * tài nguyên của người khác bị 403 NOT_RESOURCE_OWNER. Admin tác động lên dữ liệu người khác
 * chỉ qua các quyền riêng (moderate, lock...), không qua update hay delete.
 */
export function assertOwner(
	user: Pick<RequestUser, 'userId'>,
	ownerId: string,
): void {
	if (user.userId !== ownerId) {
		throw new AppException(ErrorCode.NOT_RESOURCE_OWNER);
	}
}
