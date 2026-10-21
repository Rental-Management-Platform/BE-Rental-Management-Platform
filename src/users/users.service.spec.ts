import { ErrorCode } from '../common/errors/error-code';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type {
	AdminUserRow,
	UsersRepository,
	UserWithoutPassword,
} from './users.repository';
import { UsersService } from './users.service';

const CREATED_AT = new Date('2026-10-05T03:00:00.000Z');

function row(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
	return {
		id: 'u1',
		email: 'nam@example.com',
		name: null,
		phone: null,
		accountType: 'tenant',
		status: 'active',
		lockedReason: null,
		createdAt: CREATED_AT,
		...overrides,
	};
}

function query(fields: Partial<ListUsersQueryDto> = {}): ListUsersQueryDto {
	return { page: 1, pageSize: 20, ...fields };
}

function build(rows: AdminUserRow[] = [], total = 0) {
	const findAdminPage = jest.fn(() => Promise.resolve({ rows, total }));
	const service = new UsersService({
		findAdminPage,
	} as unknown as UsersRepository);
	return { service, findAdminPage };
}

describe('UsersService.listForAdmin (spec 0007)', () => {
	it('không bộ lọc, không q: gọi Repository không có search, bỏ qua (trang - 1) * pageSize dòng', async () => {
		const { service, findAdminPage } = build();
		await service.listForAdmin(query({ page: 3, pageSize: 10 }));
		expect(findAdminPage).toHaveBeenCalledWith(
			{ accountType: undefined, status: undefined, search: undefined },
			20,
			10,
		);
	});

	it('trả { items, total, page, pageSize } với total của Repository', async () => {
		const { service } = build([row({ id: 'u1' }), row({ id: 'u2' })], 57);
		const page = await service.listForAdmin(
			query({ page: 2, pageSize: 20 }),
		);
		expect(page).toMatchObject({ total: 57, page: 2, pageSize: 20 });
		expect(page.items.map((item) => item.id)).toEqual(['u1', 'u2']);
	});

	it('trang quá cuối: items rỗng và total đúng (AC-1)', async () => {
		const { service } = build([], 12);
		await expect(
			service.listForAdmin(query({ page: 99, pageSize: 20 })),
		).resolves.toEqual({ items: [], total: 12, page: 99, pageSize: 20 });
	});

	it('chuyển bộ lọc loại và trạng thái nguyên vẹn xuống Repository (AC-2)', async () => {
		const { service, findAdminPage } = build();
		await service.listForAdmin(
			query({ accountType: 'landlord', status: 'locked' }),
		);
		expect(findAdminPage).toHaveBeenCalledWith(
			{ accountType: 'landlord', status: 'locked', search: undefined },
			0,
			20,
		);
	});

	it('q rỗng hoặc không có thì không lọc chữ (AC-3)', async () => {
		const { service, findAdminPage } = build();
		await service.listForAdmin(query({ q: '' }));
		await service.listForAdmin(query());
		for (const call of findAdminPage.mock.calls as unknown as unknown[][]) {
			expect(call[0]).toMatchObject({ search: undefined });
		}
	});

	it.each([
		['0901 234 567', '0901234567'],
		['+84901234567', '0901234567'],
		['84901234567', '0901234567'],
		['84', '84'],
	])(
		'q=%j: text giữ nguyên, số điện thoại là %j (AC-4)',
		async (q, phone) => {
			const { service, findAdminPage } = build();
			await service.listForAdmin(query({ q }));
			expect(findAdminPage).toHaveBeenCalledWith(
				{
					accountType: undefined,
					status: undefined,
					search: { text: q, phone },
				},
				0,
				20,
			);
		},
	);

	it('q có chữ cái thì không so với cột số điện thoại (AC-4)', async () => {
		const { service, findAdminPage } = build();
		await service.listForAdmin(query({ q: 'nam@example.com' }));
		expect(findAdminPage).toHaveBeenCalledWith(
			{
				accountType: undefined,
				status: undefined,
				search: { text: 'nam@example.com', phone: null },
			},
			0,
			20,
		);
	});

	it('mỗi phần tử qua toAdminUserItem: không chép cột thừa nào', async () => {
		const withSecret = {
			...row(),
			passwordHash: '$argon2id$bi-mat',
		} as AdminUserRow;
		const { service } = build([withSecret], 1);
		const page = await service.listForAdmin(query());
		expect(JSON.stringify(page)).not.toContain('argon2');
		expect(Object.keys(page.items[0])).toHaveLength(8);
	});
});

describe('UsersService hồ sơ cá nhân (spec 0008)', () => {
	function user(
		overrides: Partial<UserWithoutPassword> = {},
	): UserWithoutPassword {
		return {
			id: 'u1',
			email: 'nam@example.com',
			name: 'Nam',
			phone: '0901234567',
			accountType: 'tenant',
			status: 'active',
			lockedReason: null,
			passwordChangedAt: null,
			trialEndsAt: null,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			deletedAt: null,
			...overrides,
		};
	}

	/** `current`: hàng `findById` trả; `taken`: kết quả kiểm trùng số; `updated`: hàng `updateProfile` trả (mặc định gộp thay đổi vào hàng hiện tại). */
	function build(
		options: {
			current?: UserWithoutPassword | null;
			taken?: boolean;
			updated?: UserWithoutPassword | null;
		} = {},
	) {
		const current =
			options.current === undefined ? user() : options.current;
		const findById = jest.fn(() => Promise.resolve(current));
		const updateProfile = jest.fn(
			(_id: string, changes: Record<string, unknown>) =>
				Promise.resolve(
					options.updated === undefined
						? current === null
							? null
							: { ...current, ...changes }
						: options.updated,
				),
		);
		const landlordPhoneExistsIncludingDeleted = jest.fn(() =>
			Promise.resolve(options.taken ?? false),
		);
		const service = new UsersService({
			findById,
			updateProfile,
			landlordPhoneExistsIncludingDeleted,
		} as unknown as UsersRepository);
		return {
			service,
			findById,
			updateProfile,
			landlordPhoneExistsIncludingDeleted,
		};
	}

	// Mọi trường của DTO đều tùy chọn, nên một literal là đủ; hàm này chỉ cho kiểu rõ ràng ở chỗ gọi.
	const patch = (fields: UpdateProfileDto): UpdateProfileDto => fields;

	describe('getProfile (AC-1, AC-7)', () => {
		it('trả hồ sơ bảy trường của đúng người trong token, không chép cột thừa', async () => {
			const withSecret = {
				...user(),
				passwordHash: '$argon2id$bi-mat',
			} as UserWithoutPassword;
			const { service, findById } = build({ current: withSecret });
			const profile = await service.getProfile('u1');
			expect(findById).toHaveBeenCalledWith('u1');
			expect(Object.keys(profile)).toHaveLength(7);
			expect(JSON.stringify(profile)).not.toContain('argon2');
		});

		it('tài khoản bị khóa: 403 ACCOUNT_LOCKED', async () => {
			const { service } = build({ current: user({ status: 'locked' }) });
			await expect(service.getProfile('u1')).rejects.toMatchObject({
				code: ErrorCode.ACCOUNT_LOCKED,
			});
		});

		it('tài khoản đã xóa mềm hoặc không còn: 401 TOKEN_INVALID', async () => {
			const { service } = build({ current: null });
			await expect(service.getProfile('u1')).rejects.toMatchObject({
				code: ErrorCode.TOKEN_INVALID,
			});
		});
	});

	describe('updateProfile: chung cho mọi loại tài khoản (AC-2, AC-7)', () => {
		it('body không có trường nào: trả hồ sơ hiện tại, không kiểm số, không ghi', async () => {
			const {
				service,
				updateProfile,
				landlordPhoneExistsIncludingDeleted,
			} = build({ current: user({ accountType: 'landlord' }) });
			const profile = await service.updateProfile('u1', patch({}));
			expect(profile.name).toBe('Nam');
			expect(updateProfile).not.toHaveBeenCalled();
			expect(landlordPhoneExistsIncludingDeleted).not.toHaveBeenCalled();
		});

		it('chỉ tên: ghi đúng một trường name, không đụng số', async () => {
			const { service, updateProfile } = build();
			const profile = await service.updateProfile(
				'u1',
				patch({ name: 'Lan' }),
			);
			expect(updateProfile).toHaveBeenCalledTimes(1);
			expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Lan' });
			expect(profile.name).toBe('Lan');
			expect(profile.phone).toBe('0901234567');
		});

		it.each([
			['null', null],
			['chuỗi rỗng', ''],
			['chuỗi toàn khoảng trắng', '   '],
		])('tên là %s thì lưu null', async (_label, name) => {
			const { service, updateProfile } = build();
			const profile = await service.updateProfile('u1', patch({ name }));
			expect(updateProfile).toHaveBeenCalledWith('u1', { name: null });
			expect(profile.name).toBeNull();
		});

		it('tài khoản bị khóa: 403 ACCOUNT_LOCKED và không ghi, kể cả khi body hợp lệ', async () => {
			const { service, updateProfile } = build({
				current: user({ status: 'locked' }),
			});
			await expect(
				service.updateProfile('u1', patch({ name: 'Lan' })),
			).rejects.toMatchObject({ code: ErrorCode.ACCOUNT_LOCKED });
			expect(updateProfile).not.toHaveBeenCalled();
		});

		it('tài khoản không còn: 401 TOKEN_INVALID và không ghi', async () => {
			const { service, updateProfile } = build({ current: null });
			await expect(
				service.updateProfile('u1', patch({ name: 'Lan' })),
			).rejects.toMatchObject({ code: ErrorCode.TOKEN_INVALID });
			expect(updateProfile).not.toHaveBeenCalled();
		});

		it('hàng biến mất giữa lúc đọc và lúc ghi (Repository trả null): 401 TOKEN_INVALID', async () => {
			const { service } = build({ updated: null });
			await expect(
				service.updateProfile('u1', patch({ name: 'Lan' })),
			).rejects.toMatchObject({ code: ErrorCode.TOKEN_INVALID });
		});
	});

	describe.each(['tenant', 'admin'])(
		'updateProfile: số điện thoại của %s (AC-3)',
		(accountType) => {
			it('đặt số: ghi số, không so với số của chủ trọ', async () => {
				const {
					service,
					updateProfile,
					landlordPhoneExistsIncludingDeleted,
				} = build({ current: user({ accountType, phone: null }) });
				const profile = await service.updateProfile(
					'u1',
					patch({ phone: '0912345678' }),
				);
				expect(updateProfile).toHaveBeenCalledWith('u1', {
					phone: '0912345678',
				});
				expect(profile.phone).toBe('0912345678');
				expect(
					landlordPhoneExistsIncludingDeleted,
				).not.toHaveBeenCalled();
			});

			it('phone null: xóa số', async () => {
				const { service, updateProfile } = build({
					current: user({ accountType }),
				});
				const profile = await service.updateProfile(
					'u1',
					patch({ phone: null }),
				);
				expect(updateProfile).toHaveBeenCalledWith('u1', {
					phone: null,
				});
				expect(profile.phone).toBeNull();
			});
		},
	);

	describe('updateProfile: số điện thoại của landlord (AC-4)', () => {
		const landlord = () => user({ accountType: 'landlord' });

		it('số tự do: kiểm trùng bỏ qua hàng của chính người gọi, rồi ghi', async () => {
			const {
				service,
				updateProfile,
				landlordPhoneExistsIncludingDeleted,
			} = build({ current: landlord(), taken: false });
			const profile = await service.updateProfile(
				'u1',
				patch({ phone: '0912345678' }),
			);
			expect(landlordPhoneExistsIncludingDeleted).toHaveBeenCalledWith(
				'0912345678',
				'u1',
			);
			expect(updateProfile).toHaveBeenCalledWith('u1', {
				phone: '0912345678',
			});
			expect(profile.phone).toBe('0912345678');
		});

		it('gửi lại đúng số hiện tại của mình: vẫn đi qua kiểm trùng có bỏ qua chính mình, và được ghi (không phải PHONE_TAKEN)', async () => {
			const { service, landlordPhoneExistsIncludingDeleted } = build({
				current: landlord(),
				taken: false,
			});
			await expect(
				service.updateProfile('u1', patch({ phone: '0901234567' })),
			).resolves.toMatchObject({ phone: '0901234567' });
			expect(landlordPhoneExistsIncludingDeleted).toHaveBeenCalledWith(
				'0901234567',
				'u1',
			);
		});

		it('số của chủ trọ khác: 409 PHONE_TAKEN, không ghi gì, kể cả tên gửi kèm', async () => {
			const { service, updateProfile } = build({
				current: landlord(),
				taken: true,
			});
			await expect(
				service.updateProfile(
					'u1',
					patch({ name: 'Tên mới', phone: '0912345678' }),
				),
			).rejects.toMatchObject({ code: ErrorCode.PHONE_TAKEN });
			expect(updateProfile).not.toHaveBeenCalled();
		});

		it('phone null: 400 VALIDATION_FAILED, trường phone, cùng câu với đăng ký; không kiểm trùng, không ghi', async () => {
			const {
				service,
				updateProfile,
				landlordPhoneExistsIncludingDeleted,
			} = build({ current: landlord() });
			await expect(
				service.updateProfile(
					'u1',
					patch({ name: 'Tên mới', phone: null }),
				),
			).rejects.toMatchObject({
				code: ErrorCode.VALIDATION_FAILED,
				fieldErrors: [
					{
						field: 'phone',
						code: 'isDefined',
						message: 'Người đăng bài phải có số điện thoại.',
					},
				],
			});
			expect(landlordPhoneExistsIncludingDeleted).not.toHaveBeenCalled();
			expect(updateProfile).not.toHaveBeenCalled();
		});

		it('chỉ đổi tên: không kiểm số', async () => {
			const {
				service,
				updateProfile,
				landlordPhoneExistsIncludingDeleted,
			} = build({ current: landlord() });
			await service.updateProfile('u1', patch({ name: 'Lan' }));
			expect(landlordPhoneExistsIncludingDeleted).not.toHaveBeenCalled();
			expect(updateProfile).toHaveBeenCalledWith('u1', { name: 'Lan' });
		});

		it('tên và số cùng lúc: một lần ghi duy nhất mang cả hai', async () => {
			const { service, updateProfile } = build({ current: landlord() });
			await service.updateProfile(
				'u1',
				patch({ name: 'Lan', phone: '0912345678' }),
			);
			expect(updateProfile).toHaveBeenCalledTimes(1);
			expect(updateProfile).toHaveBeenCalledWith('u1', {
				name: 'Lan',
				phone: '0912345678',
			});
		});
	});

	describe('landlordPhoneExists (đăng ký giữ hành vi cũ)', () => {
		it('đăng ký không truyền id: Repository nhận id là undefined', async () => {
			const { service, landlordPhoneExistsIncludingDeleted } = build();
			await service.landlordPhoneExists('0912345678');
			expect(landlordPhoneExistsIncludingDeleted).toHaveBeenCalledWith(
				'0912345678',
				undefined,
			);
		});
	});
});
