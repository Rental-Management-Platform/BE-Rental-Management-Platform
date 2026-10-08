import { Injectable, Logger } from '@nestjs/common';
import { isAccountType } from '../common/auth/account-type';
import type { AccountType } from '../common/auth/account-type';
import {
	ADMIN_PERMISSIONS,
	compressPermissions,
	expandPermissions,
	isAdminOnly,
	isManageKey,
	isPermissionKey,
} from '../common/auth/permission-catalog';
import type { PermissionKey } from '../common/auth/permission-catalog';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { FieldError } from '../common/errors/error-code';
import type { AccountType as AccountTypeRow } from '../generated/prisma/client';
import { AccountTypesRepository } from './account-types.repository';

export interface AccountTypeView {
	readonly key: AccountType;
	readonly name: string;
	readonly description: string | null;
	/** Quyền hiệu lực, mở rộng thành từng hành động (của admin: toàn bộ). */
	readonly permissions: readonly PermissionKey[];
}

function fieldErrors(code: ErrorCode, message: string): FieldError[] {
	return [{ field: 'permissions', code, message }];
}

/**
 * Loại tài khoản và quyền của từng loại (spec 0003). Quyền của admin tính trong code; quyền của
 * landlord và tenant đọc từ DB và admin chỉnh được, trừ các quyền chỉ admin giữ.
 */
@Injectable()
export class AccountTypesService {
	private readonly logger = new Logger(AccountTypesService.name);

	constructor(private readonly repository: AccountTypesRepository) {}

	/** Quyền hiệu lực từng hành động của một loại. Khóa lạ trong DB bị bỏ qua và ghi log. */
	async getEffectivePermissions(type: AccountType): Promise<PermissionKey[]> {
		if (type === 'admin') return [...ADMIN_PERMISSIONS];
		const row = await this.repository.findByKey(type);
		return row === null ? [] : this.readStored(row);
	}

	/** Dạng gọn cho token: module có đủ mọi hành động chỉ ghi `module:manage`. */
	async getTokenPermissions(type: AccountType): Promise<PermissionKey[]> {
		return compressPermissions(await this.getEffectivePermissions(type));
	}

	async list(): Promise<AccountTypeView[]> {
		const rows = await this.repository.findAll();
		return rows.flatMap((row) => {
			const view = this.toView(row);
			return view === null ? [] : [view];
		});
	}

	/**
	 * Thay toàn bộ danh sách quyền của landlord hoặc tenant (spec 0003 AC-6). Bỏ trùng; từ chối
	 * khóa không có trong danh mục, mọi khóa `*:manage` và mọi quyền chỉ admin giữ.
	 */
	async updatePermissions(
		key: string,
		requested: readonly string[],
	): Promise<AccountTypeView> {
		if (!isAccountType(key)) {
			throw new AppException(ErrorCode.ACCOUNT_TYPE_NOT_FOUND);
		}
		if (key === 'admin') {
			throw new AppException(ErrorCode.SYSTEM_TYPE_PROTECTED);
		}

		const unique = [...new Set(requested)];
		const unknown = unique.filter((entry) => !isPermissionKey(entry));
		if (unknown.length > 0) {
			throw new AppException(
				ErrorCode.PERMISSION_UNKNOWN,
				fieldErrors(
					ErrorCode.PERMISSION_UNKNOWN,
					`Khóa quyền không tồn tại: ${unknown.join(', ')}`,
				),
			);
		}
		const keys = unique.filter(isPermissionKey);
		const forbidden = keys.filter(
			(entry) => isManageKey(entry) || isAdminOnly(entry),
		);
		if (forbidden.length > 0) {
			throw new AppException(
				ErrorCode.PERMISSION_ADMIN_ONLY,
				fieldErrors(
					ErrorCode.PERMISSION_ADMIN_ONLY,
					`Không thể cấp cho loại này: ${forbidden.join(', ')}`,
				),
			);
		}

		const row = await this.repository.updatePermissions(key, keys.sort());
		const view = row === null ? null : this.toView(row);
		if (view === null) {
			throw new AppException(ErrorCode.ACCOUNT_TYPE_NOT_FOUND);
		}
		return view;
	}

	private toView(row: AccountTypeRow): AccountTypeView | null {
		if (!isAccountType(row.key)) return null;
		return {
			key: row.key,
			name: row.name,
			description: row.description,
			permissions:
				row.key === 'admin'
					? [...ADMIN_PERMISSIONS]
					: this.readStored(row),
		};
	}

	private readStored(row: AccountTypeRow): PermissionKey[] {
		const valid = row.permissions.filter(isPermissionKey);
		if (valid.length !== row.permissions.length) {
			this.logger.warn(
				`Loại ${row.key} có khóa quyền không còn trong danh mục, đã bỏ qua.`,
			);
		}
		return expandPermissions(valid);
	}
}
