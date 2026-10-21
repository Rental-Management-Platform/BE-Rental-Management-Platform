import { Injectable } from '@nestjs/common';
import type { SelfRegisterType } from '../common/auth/account-type';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Page } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { toPhoneNeedle } from '../common/phone';
import type { Prisma, User } from '../generated/prisma/client';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { toAdminUserItem, toProfileResponse } from './users.mapper';
import type { AdminUserListItem, ProfileResponse } from './users.mapper';
import { UsersRepository } from './users.repository';
import type { ProfileChanges, UserWithoutPassword } from './users.repository';

/** Dùng chung cho đăng ký và seed để email luôn ở một dạng (chữ thường, cắt khoảng trắng). */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Mật khẩu đã được băm bởi AuthService (PasswordHasher); số điện thoại đã chuẩn hóa ở DTO. `trialEndsAt` do
 * MembershipsService tính: có giá trị với chủ trọ (CHECK ở DB bắt buộc), `null` với người tìm trọ.
 */
export interface NewUserInput {
	readonly email: string;
	readonly passwordHash: string;
	readonly name: string | null;
	readonly phone: string | null;
	readonly accountType: SelfRegisterType;
	readonly trialEndsAt: Date | null;
}

/** Cùng câu với `RegisterDto`: chủ trọ không bao giờ có số điện thoại rỗng (spec 0008 AC-4). */
const LANDLORD_PHONE_REQUIRED = 'Người đăng bài phải có số điện thoại.';

/** Luật nghiệp vụ của "người dùng": chuẩn hóa email, tạo, tìm, sửa hồ sơ, khóa và mở khóa. */
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
				trialEndsAt: input.trialEndsAt,
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

	findByEmail(email: string): Promise<UserWithoutPassword | null> {
		return this.usersRepository.findByEmail(normalizeEmail(email));
	}

	/** Như `findByEmailWithPassword`: tên nói rõ nó trả `passwordHash`; chỉ đổi mật khẩu cần. */
	findByIdWithPassword(id: string): Promise<User | null> {
		return this.usersRepository.findByIdWithPassword(id);
	}

	/** `passwordHash` đã băm bởi PasswordHasher. Trả `false` nếu không còn người dùng. */
	updatePassword(
		id: string,
		passwordHash: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		return this.usersRepository.updatePassword(id, passwordHash, tx);
	}

	emailExists(email: string): Promise<boolean> {
		return this.usersRepository.emailExistsIncludingDeleted(
			normalizeEmail(email),
		);
	}

	/** `exceptUserId`: bỏ qua hàng của chính người đang đổi số (spec 0008); đăng ký không truyền. */
	landlordPhoneExists(
		phone: string,
		exceptUserId?: string,
	): Promise<boolean> {
		return this.usersRepository.landlordPhoneExistsIncludingDeleted(
			phone,
			exceptUserId,
		);
	}

	findById(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword | null> {
		return this.usersRepository.findById(id, tx);
	}

	/** Hồ sơ của chính người gọi (spec 0008 AC-1). Bị khóa thì 403, đã xóa mềm hoặc không còn thì 401 (như `getMe`). */
	async getProfile(userId: string): Promise<ProfileResponse> {
		return toProfileResponse(await this.requireActiveUser(userId));
	}

	/**
	 * Sửa tên và số điện thoại của chính người gọi (spec 0008 AC-2 đến AC-4). Thứ tự: đọc người gọi (khóa hoặc
	 * xóa mềm bị chặn ngay) → không có trường nào thì trả hồ sơ hiện tại, không ghi → luật số điện thoại → một
	 * câu ghi. Mọi kiểm tra chạy trước câu ghi nên `name` gửi kèm một số bị từ chối không bao giờ được lưu một nửa.
	 * Loại tài khoản lấy từ hàng vừa đọc, không từ token.
	 */
	async updateProfile(
		userId: string,
		dto: UpdateProfileDto,
	): Promise<ProfileResponse> {
		const user = await this.requireActiveUser(userId);
		if (dto.name === undefined && dto.phone === undefined) {
			return toProfileResponse(user);
		}
		if (dto.phone !== undefined) {
			await this.assertPhoneAllowed(user, dto.phone);
		}
		const changes: ProfileChanges = {
			...(dto.name === undefined
				? {}
				: { name: dto.name?.trim() || null }),
			...(dto.phone === undefined ? {} : { phone: dto.phone }),
		};
		const updated = await this.usersRepository.updateProfile(
			userId,
			changes,
		);
		if (updated === null) throw new AppException(ErrorCode.TOKEN_INVALID);
		return toProfileResponse(updated);
	}

	/**
	 * Danh sách tài khoản cho admin (spec 0007). `q` đã được DTO cắt khoảng trắng; rỗng thì không lọc chữ. Chuỗi số
	 * điện thoại suy ra từ `q` (`toPhoneNeedle`), không phải từ cột nào khác.
	 */
	async listForAdmin(
		query: ListUsersQueryDto,
	): Promise<Page<AdminUserListItem>> {
		const text = query.q ?? '';
		const { rows, total } = await this.usersRepository.findAdminPage(
			{
				accountType: query.accountType,
				status: query.status,
				search:
					text === ''
						? undefined
						: { text, phone: toPhoneNeedle(text) },
			},
			skipOf(query),
			query.pageSize,
		);
		return toPage(rows.map(toAdminUserItem), total, query);
	}

	/** Khóa dòng của một người dùng đến hết giao dịch `tx` (đăng và hiện tin, spec 0003). */
	lockById(id: string, tx: Prisma.TransactionClient): Promise<void> {
		return this.usersRepository.lockById(id, tx);
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

	/** Người gọi hồ sơ còn dùng được không: đã xóa mềm hoặc không còn thì 401 `TOKEN_INVALID`, bị khóa thì 403 (spec 0008 AC-7). */
	private async requireActiveUser(
		userId: string,
	): Promise<UserWithoutPassword> {
		const user = await this.usersRepository.findById(userId);
		if (user === null) throw new AppException(ErrorCode.TOKEN_INVALID);
		if (user.status === 'locked') {
			throw new AppException(ErrorCode.ACCOUNT_LOCKED);
		}
		return user;
	}

	/**
	 * Luật số điện thoại khi sửa hồ sơ (spec 0008 AC-3, AC-4). Chỉ chủ trọ bị ràng buộc: không được xóa số (400
	 * như đăng ký) và số mới không được thuộc chủ trọ khác, kể cả tài khoản đã xóa mềm (409). Hàng của chính
	 * người gọi bị bỏ qua khi kiểm trùng, nên gửi lại số của mình vẫn qua. Chỉ mục duy nhất ở database là chốt
	 * chặn cuối; hai chủ trọ đặt cùng số cùng lúc thì người chậm hơn nhận 500, như đăng ký (spec 0004 không dịch lỗi DB).
	 */
	private async assertPhoneAllowed(
		user: UserWithoutPassword,
		phone: string | null,
	): Promise<void> {
		if (user.accountType !== 'landlord') return;
		if (phone === null) {
			throw new AppException(ErrorCode.VALIDATION_FAILED, [
				{
					field: 'phone',
					code: 'isDefined',
					message: LANDLORD_PHONE_REQUIRED,
				},
			]);
		}
		if (await this.landlordPhoneExists(phone, user.id)) {
			throw new AppException(ErrorCode.PHONE_TAKEN);
		}
	}
}
