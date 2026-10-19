import type { AccountTypesService } from '../account-types/account-types.service';
import { ErrorCode } from '../common/errors/error-code';
import type { AppConfigService } from '../config/app-config.service';
import type { MembershipsService } from '../memberships/memberships.service';
import type { UsersService } from '../users/users.service';
import type { UserWithoutPassword } from '../users/users.repository';
import type { AuthSessionsRepository } from './auth-sessions.repository';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';
import type { PasswordHasher } from './password-hasher';
import type { TokenService } from './token.service';

const NOW = new Date('2026-10-19T03:04:05.678Z');
const TRIAL_ENDS_AT = new Date('2026-11-18T03:04:05.678Z');
const CLIENT = { userAgent: 'jest', ip: '127.0.0.1' };

function registerDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
	return {
		email: 'chu.tro@example.com',
		password: 'MatKhau#2026',
		name: 'Chủ Trọ',
		phone: '0912345678',
		accountType: 'landlord',
		...overrides,
	};
}

function build(options: { emailTaken?: boolean; phoneTaken?: boolean } = {}) {
	const usersService = {
		emailExists: jest.fn(() =>
			Promise.resolve(options.emailTaken ?? false),
		),
		landlordPhoneExists: jest.fn(() =>
			Promise.resolve(options.phoneTaken ?? false),
		),
		create: jest.fn((input: { accountType: string }) =>
			Promise.resolve({
				id: 'user-id',
				email: 'chu.tro@example.com',
				name: 'Chủ Trọ',
				phone: '0912345678',
				accountType: input.accountType,
				status: 'active',
			} as UserWithoutPassword),
		),
	};
	const memberships = {
		trialEndsAtForNewLandlord: jest.fn(() =>
			Promise.resolve(TRIAL_ENDS_AT),
		),
	};
	const sessions = {
		deleteExpiredByUser: jest.fn(() => Promise.resolve()),
		revokeOldestToFit: jest.fn(() => Promise.resolve()),
		create: jest.fn(() => Promise.resolve({ id: 'session-id' })),
	};
	const accountTypes = {
		getTokenPermissions: jest.fn(() => Promise.resolve([])),
	};
	const tokens = {
		generateRefreshToken: jest.fn(() => ({ token: 'raw', hash: 'hash' })),
		signAccessToken: jest.fn(() => ({
			accessToken: 'jwt',
			expiresIn: 900,
		})),
	};
	const hasher = { hash: jest.fn(() => Promise.resolve('hashed')) };
	const config = {
		auth: { maxSessionsPerUser: 5, refreshTtlDays: 30 },
	};
	return {
		service: new AuthService(
			usersService as unknown as UsersService,
			accountTypes as unknown as AccountTypesService,
			sessions as unknown as AuthSessionsRepository,
			tokens as unknown as TokenService,
			hasher as unknown as PasswordHasher,
			config as unknown as AppConfigService,
			memberships as unknown as MembershipsService,
		),
		usersService,
		memberships,
	};
}

describe('AuthService.register: kỳ dùng thử (spec 0003 AC-1)', () => {
	it('chủ trọ nhận trialEndsAt tính từ đúng `now` của request', async () => {
		const { service, usersService, memberships } = build();
		await service.register(registerDto(), CLIENT, NOW);
		expect(memberships.trialEndsAtForNewLandlord).toHaveBeenCalledWith(NOW);
		expect(usersService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				accountType: 'landlord',
				trialEndsAt: TRIAL_ENDS_AT,
			}),
		);
	});

	it('người tìm trọ không có kỳ dùng thử: trialEndsAt rỗng và không đọc trial_days', async () => {
		const { service, usersService, memberships } = build();
		await service.register(
			registerDto({ accountType: 'tenant', phone: undefined }),
			CLIENT,
			NOW,
		);
		expect(memberships.trialEndsAtForNewLandlord).not.toHaveBeenCalled();
		expect(usersService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				accountType: 'tenant',
				trialEndsAt: null,
			}),
		);
	});

	it('trùng số điện thoại: 409 PHONE_TAKEN, không tạo tài khoản và không tạo thêm kỳ dùng thử', async () => {
		const { service, usersService, memberships } = build({
			phoneTaken: true,
		});
		await expect(
			service.register(registerDto(), CLIENT, NOW),
		).rejects.toMatchObject({ code: ErrorCode.PHONE_TAKEN });
		expect(memberships.trialEndsAtForNewLandlord).not.toHaveBeenCalled();
		expect(usersService.create).not.toHaveBeenCalled();
	});

	it('trùng email: 409 EMAIL_TAKEN, không tạo tài khoản và không tạo kỳ dùng thử', async () => {
		const { service, usersService, memberships } = build({
			emailTaken: true,
		});
		await expect(
			service.register(registerDto(), CLIENT, NOW),
		).rejects.toMatchObject({ code: ErrorCode.EMAIL_TAKEN });
		expect(memberships.trialEndsAtForNewLandlord).not.toHaveBeenCalled();
		expect(usersService.create).not.toHaveBeenCalled();
	});

	it('phản hồi vẫn chỉ có 6 trường người dùng, không lộ trialEndsAt', async () => {
		const { service } = build();
		const { user } = await service.register(registerDto(), CLIENT, NOW);
		expect(Object.keys(user).sort()).toEqual(
			['accountType', 'email', 'id', 'name', 'phone', 'status'].sort(),
		);
	});
});
