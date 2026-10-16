import type { Reflector } from '@nestjs/core';
import { FRESH_AUTH_KEY } from './fresh-auth.decorator';
import { IS_AUTHENTICATED_ONLY_KEY } from './authenticated-only.decorator';
import { IS_OPTIONAL_AUTH_KEY } from './optional-auth.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { PermissionKey } from './permission-catalog';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator';

export type RouteDeclaration =
	| { readonly kind: 'public' }
	| { readonly kind: 'authenticated' }
	| {
			readonly kind: 'permissions';
			readonly required: readonly PermissionKey[];
	  };

export interface RouteAccess {
	/** Khai báo duy nhất của route; `null` khi chưa khai báo hoặc khai báo nhiều hơn một (cả hai đều bị từ chối). */
	readonly declaration: RouteDeclaration | null;
	/** Số khai báo tìm thấy: phải đúng 1 (spec 0003 AC-4). */
	readonly declarationCount: number;
	readonly freshAuth: boolean;
	/** `@OptionalAuth()`: route công khai vẫn thử đọc người đăng nhập (spec 0002). */
	readonly optionalAuth: boolean;
}

type Target = Parameters<Reflector['getAllAndOverride']>[1][number];

/** Phần của `ExecutionContext` mà việc đọc khai báo cần; test duyệt route chỉ cần dựng hai hàm này. */
export interface RouteTargets {
	getHandler(): Target;
	getClass(): Target;
}

/** Đọc khai báo quyền của route: decorator ở method ghi đè decorator ở controller. */
export function readRouteAccess(
	reflector: Reflector,
	context: RouteTargets,
): RouteAccess {
	const targets = [context.getHandler(), context.getClass()];
	const isPublic = reflector.getAllAndOverride<boolean | undefined>(
		IS_PUBLIC_KEY,
		targets,
	);
	const authenticatedOnly = reflector.getAllAndOverride<boolean | undefined>(
		IS_AUTHENTICATED_ONLY_KEY,
		targets,
	);
	const required = reflector.getAllAndOverride<
		readonly PermissionKey[] | undefined
	>(REQUIRED_PERMISSIONS_KEY, targets);
	const freshAuth =
		reflector.getAllAndOverride<boolean | undefined>(
			FRESH_AUTH_KEY,
			targets,
		) === true;
	const optionalAuth =
		reflector.getAllAndOverride<boolean | undefined>(
			IS_OPTIONAL_AUTH_KEY,
			targets,
		) === true;

	const found: RouteDeclaration[] = [];
	if (isPublic === true) found.push({ kind: 'public' });
	if (authenticatedOnly === true) found.push({ kind: 'authenticated' });
	if (required !== undefined) found.push({ kind: 'permissions', required });

	return {
		declaration: found.length === 1 ? (found[0] ?? null) : null,
		declarationCount: found.length,
		freshAuth,
		optionalAuth,
	};
}
