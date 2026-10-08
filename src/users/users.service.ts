import { Injectable } from '@nestjs/common';
import type { SelfRegisterType } from '../common/auth/account-type';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Prisma, User } from '../generated/prisma/client';
import { UsersRepository } from './users.repository';
import type { UserWithoutPassword } from './users.repository';

/** Dùng chung cho đăng ký và seed để email luôn ở một dạng (chữ thường, cắt khoảng trắng). */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/** Mật khẩu đã được băm bởi AuthService (PasswordHasher); số điện thoại đã chuẩn hóa ở DTO. */
export interface NewUserInput {
	readonly email: string;
	readonly passwordHash: string;
	readonly name: string | null;
	readonly phone: string | null;
	readonly accountType: SelfRegisterType;
}

/** Luật nghiệp vụ của "người dùng": chuẩn hóa email, tạo, tìm, khóa và mở khóa. */
@Injectable()
export class UsersService {
	constructor(private readonly usersRepository: UsersRepository) {}

	create(
		input: NewUserInput,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword> {
		return this.usersRepository.create(
			{
				email: normalizeEmail(input.email),
				passwordHash: input.passwordHash,
				name: input.name?.trim() || null,
				phone: input.phone,
				accountType: input.accountType,
			},
			tx,
		);
	}

	/** Tên nói rõ nó trả dữ liệu nhạy cảm (`passwordHash`); chỉ đăng nhập cần. */
	findByEmailWithPassword(email: string): Promise<User | null> {
		return this.usersRepository.findByEmailWithPassword(
			normalizeEmail(email),
		);
	}

	emailExists(email: string): Promise<boolean> {
		return this.usersRepository.emailExistsIncludingDeleted(
			normalizeEmail(email),
		);
	}

	landlordPhoneExists(phone: string): Promise<boolean> {
		return this.usersRepository.landlordPhoneExistsIncludingDeleted(phone);
	}

	findById(id: string): Promise<UserWithoutPassword | null> {
		return this.usersRepository.findById(id);
	}

	/**
	 * Khóa một tài khoản đang hoạt động (spec 0003 AC-7). Khóa tài khoản đang khóa thì 409,
	 * không có tài khoản thì 404. Việc hủy phiên và ghi lịch sử do ModerationService làm cùng giao dịch.
	 */
	async lock(
		id: string,
		reason: string,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		if (await this.usersRepository.lockActive(id, reason, tx)) return;
		const user = await this.usersRepository.findById(id, tx);
		if (user === null) throw new AppException(ErrorCode.USER_NOT_FOUND);
		throw new AppException(ErrorCode.ACCOUNT_ALREADY_LOCKED);
	}

	/** Mở khóa một tài khoản đang bị khóa; không bị khóa thì 409, không có tài khoản thì 404. */
	async unlock(id: string, tx: Prisma.TransactionClient): Promise<void> {
		if (await this.usersRepository.unlockLocked(id, tx)) return;
		const user = await this.usersRepository.findById(id, tx);
		if (user === null) throw new AppException(ErrorCode.USER_NOT_FOUND);
		throw new AppException(ErrorCode.ACCOUNT_NOT_LOCKED);
	}
}
