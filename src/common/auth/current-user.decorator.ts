import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type {
	AuthenticatedRequest,
	RequestUser,
} from '../http/authenticated-request';

/** Lấy người đang gọi; không ai đọc `req.user` trực tiếp (spec 0001 con). */
export const CurrentUser = createParamDecorator(
	(_: unknown, context: ExecutionContext): RequestUser =>
		context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
