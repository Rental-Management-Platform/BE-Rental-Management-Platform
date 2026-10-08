import { Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AccountTypesService } from '../../account-types/account-types.service';
import { parseAccountType } from '../../common/auth/account-type';
import { hasPermissions } from '../../common/auth/permission-catalog';
import type { PermissionKey } from '../../common/auth/permission-catalog';
import { readRouteAccess } from '../../common/auth/route-access';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import type { RequestUser } from '../../common/http/authenticated-request';
import { UsersService } from '../../users/users.service';

/**
 * Cổng thứ hai: "bạn được làm việc này không?" Chạy toàn cục sau JwtAuthGuard. Route chưa khai báo
 * (hoặc khai báo nhiều hơn một kiểu) bị từ chối: mặc định an toàn. Quyền đọc từ token, trừ route
 * `@FreshAuth()` đọc lại từ DB. Guard này KHÔNG kiểm chủ sở hữu; đó là việc của service từng module
 * (`assertOwner`).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
	private readonly logger = new Logger(PermissionsGuard.name);

	constructor(
		private readonly reflector: Reflector,
		private readonly usersService: UsersService,
		private readonly accountTypes: AccountTypesService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const { declaration, declarationCount, freshAuth } = readRouteAccess(
			this.reflector,
			context,
		);

		if (declaration === null) {
			const route = `${context.getClass().name}.${context.getHandler().name}`;
			this.logger.error(
				declarationCount === 0
					? `Route ${route} chưa khai báo @Public, @AuthenticatedOnly hay @RequirePermissions`
					: `Route ${route} khai báo nhiều hơn một trong @Public, @AuthenticatedOnly, @RequirePermissions`,
			);
			throw new AppException(ErrorCode.PERMISSION_DENIED);
		}
		if (declaration.kind === 'public') return true;

		const request = context
			.switchToHttp()
			.getRequest<Request & { user?: RequestUser }>();
		const user = request.user;
		if (user === undefined) {
			throw new AppException(ErrorCode.TOKEN_MISSING); // JwtAuthGuard chưa chạy: sai cấu hình
		}

		let permissions: readonly PermissionKey[] = user.permissions;
		if (freshAuth) {
			permissions = await this.loadFreshPermissions(user.userId);
			request.user = { ...user, permissions }; // handler cũng thấy quyền mới
		}

		if (declaration.kind === 'authenticated') return true;
		if (hasPermissions(permissions, declaration.required)) return true;
		throw new AppException(ErrorCode.PERMISSION_DENIED);
	}

	/** Đọc lại người dùng và quyền từ DB: khóa hoặc xóa có hiệu lực ngay (spec 0003 AC-8). */
	private async loadFreshPermissions(
		userId: string,
	): Promise<readonly PermissionKey[]> {
		const user = await this.usersService.findById(userId);
		if (user === null) throw new AppException(ErrorCode.TOKEN_INVALID);
		if (user.status === 'locked') {
			throw new AppException(ErrorCode.ACCOUNT_LOCKED);
		}
		return this.accountTypes.getEffectivePermissions(
			parseAccountType(user.accountType),
		);
	}
}
