import { Injectable } from '@nestjs/common';
import type { AccountType } from '../common/auth/account-type';
import { escapeLike } from '../common/text/escape-like';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, User } from '../generated/prisma/client';
import type { UserStatus } from './user-status';

export type NewUser = Pick<
	User,
	'email' | 'passwordHash' | 'name' | 'phone' | 'accountType' | 'trialEndsAt'
>;
export type UserWithoutPassword = Omit<User, 'passwordHash'>;

/** Một dòng của danh sách cho admin: đúng tám cột, không `passwordHash` (spec 0007 AC-1, AC-6). */
export type AdminUserRow = Pick<
	User,
	| 'id'
	| 'email'
	| 'name'
	| 'phone'
	| 'accountType'
	| 'status'
	| 'lockedReason'
	| 'createdAt'
>;

/**
 * Điều kiện của danh sách cho admin. `search` có mặt khi `q` không rỗng: `text` đưa vào email và tên, `phone` là
 * chuỗi chữ số cho cột số điện thoại hoặc `null` khi `q` không phải số (spec 0007 AC-3, AC-4).
 */
export interface AdminUserFilter {
	readonly accountType?: AccountType;
	readonly status?: UserStatus;
	readonly search?: { readonly text: string; readonly phone: string | null };
}

/** Xóa mềm (spec 0005): mọi phương thức đọc `users` đều thêm điều kiện này, trừ tên có `IncludingDeleted`. */
const notDeleted = { deletedAt: null } satisfies Prisma.UserWhereInput;

/** `passwordHash` mặc định không được trả; chỉ đăng nhập mới cần đọc nó. */
const withoutPassword = { passwordHash: true } satisfies Prisma.UserOmit;

/** Danh sách trắng cho danh sách của admin: thêm cột vào `users` sau này cũng không tự lộ ra (spec 0007 AC-6). */
const adminListSelect = {
	id: true,
	email: true,
	name: true,
	phone: true,
	accountType: true,
	status: true,
	lockedReason: true,
	createdAt: true,
} satisfies Prisma.UserSelect;

/** Nơi duy nhất của module users chạm vào Prisma (spec 0001 con). */
@Injectable()
export class UsersRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Có `tx` thì chạy trong giao dịch đó, không thì dùng kết nối thường. */
	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	create(
		input: NewUser,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword> {
		return this.client(tx).user.create({
			data: input,
			omit: withoutPassword,
		});
	}

	findByEmailWithPassword(
		email: string,
		tx?: Prisma.TransactionClient,
	): Promise<User | null> {
		return this.client(tx).user.findFirst({
			where: { email, ...notDeleted },
		});
	}

	/** Tìm theo email, không lấy `passwordHash`: dùng khi chỉ cần biết người đó là ai (quên mật khẩu). */
	findByEmail(
		email: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword | null> {
		return this.client(tx).user.findFirst({
			where: { email, ...notDeleted },
			omit: withoutPassword,
		});
	}

	findByIdWithPassword(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<User | null> {
		return this.client(tx).user.findFirst({
			where: { id, ...notDeleted },
		});
	}

	/** Đặt mật khẩu mới và ghi lại thời điểm đổi. Trả `false` nếu không còn người dùng (đã xóa mềm). */
	async updatePassword(
		id: string,
		passwordHash: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).user.updateMany({
			where: { id, ...notDeleted },
			data: { passwordHash, passwordChangedAt: new Date() },
		});
		return result.count === 1;
	}

	/** Kiểm email trùng lúc đăng ký: tính cả tài khoản đã xóa mềm vì chỉ mục duy nhất tính cả chúng. */
	async emailExistsIncludingDeleted(
		email: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const found = await this.client(tx).user.findFirst({
			where: { email },
			select: { id: true },
		});
		return found !== null;
	}

	/** Kiểm số điện thoại trùng giữa các tài khoản landlord, tính cả tài khoản đã xóa mềm (spec 0002 AC-13). */
	async landlordPhoneExistsIncludingDeleted(
		phone: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const found = await this.client(tx).user.findFirst({
			where: { phone, accountType: 'landlord' },
			select: { id: true },
		});
		return found !== null;
	}

	findById(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword | null> {
		return this.client(tx).user.findFirst({
			where: { id, ...notDeleted },
			omit: withoutPassword,
		});
	}

	/**
	 * Khóa dòng người dùng bằng `SELECT ... FOR UPDATE` cho đến hết giao dịch (spec 0003, "Thứ tự khóa": `users`
	 * trước, rồi `properties`, rồi `listings`). Đăng và hiện tin khóa dòng của chủ trọ để việc đếm tin đang hiện
	 * rồi ghi không bị hai yêu cầu cùng lúc vượt qua hạn mức. Không đọc cột nào, và không lọc `deleted_at`.
	 */
	async lockById(id: string, tx: Prisma.TransactionClient): Promise<void> {
		await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
	}

	/**
	 * Một trang tài khoản cho admin (spec 0007 AC-1 đến AC-4): mọi loại và trạng thái, bỏ tài khoản đã xóa mềm,
	 * mới đăng ký trước. Mỗi vế của `q` là `contains` không phân biệt hoa thường (`ILIKE`), chuỗi đã qua `escapeLike`
	 * vì Prisma không tự thoát `%`, `_`, `\`. Số điện thoại là chữ số nên không cần `mode`. `total` đếm bằng cùng `where`.
	 */
	async findAdminPage(
		filter: AdminUserFilter,
		skip: number,
		take: number,
	): Promise<{ rows: AdminUserRow[]; total: number }> {
		const { search } = filter;
		const where: Prisma.UserWhereInput = {
			...notDeleted,
			...(filter.accountType === undefined
				? {}
				: { accountType: filter.accountType }),
			...(filter.status === undefined ? {} : { status: filter.status }),
			...(search === undefined
				? {}
				: {
						OR: [
							{
								email: {
									contains: escapeLike(search.text),
									mode: 'insensitive',
								},
							},
							{
								name: {
									contains: escapeLike(search.text),
									mode: 'insensitive',
								},
							},
							...(search.phone === null
								? []
								: [{ phone: { contains: search.phone } }]),
						],
					}),
		};
		const [rows, total] = await Promise.all([
			this.prisma.user.findMany({
				where,
				select: adminListSelect,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
			}),
			this.prisma.user.count({ where }),
		]);
		return { rows, total };
	}

	/** Khóa bằng một câu cập nhật có điều kiện: hai người khóa cùng lúc thì chỉ một người thắng. */
	async lockActive(
		id: string,
		reason: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).user.updateMany({
			where: { id, status: 'active', ...notDeleted },
			data: { status: 'locked', lockedReason: reason },
		});
		return result.count === 1;
	}

	/** Mở khóa đặt `lockedReason` về rỗng; lý do mở chỉ nằm ở moderation_logs. */
	async unlockLocked(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).user.updateMany({
			where: { id, status: 'locked', ...notDeleted },
			data: { status: 'active', lockedReason: null },
		});
		return result.count === 1;
	}
}
