import { Logger } from '@nestjs/common';
import { ErrorCode } from '../common/errors/error-code';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { AppConfigService } from '../config/app-config.service';
import type { MailMessage, MailService } from '../mail/mail.service';
import type { UsersService } from '../users/users.service';
import type { AuthSessionsRepository } from './auth-sessions.repository';
import type { PasswordHasher } from './password-hasher';
import type { PasswordResetsRepository } from './password-resets.repository';
import { PasswordService } from './password.service';
import type { TokenService } from './token.service';

/**
 * Bản giả tối thiểu của các phụ thuộc, ghi lại lời gọi để kiểm. Việc "một giao dịch, hoặc xong cả
 * ba hoặc không gì cả" và "hai người dùng cùng một liên kết chỉ một người thắng" thuộc về DB thật,
 * được kiểm ở bước chạy thật trên database thử.
 */
const USER = {
	id: 'user-1',
	email: 'nguoi.dung@example.com',
	name: 'An',
	status: 'active',
	passwordHash: 'hashed:mat-khau-cu',
};

interface Calls {
	replaced: { userId: string; tokenHash: string; expiresAt: Date }[];
	updated: { id: string; hash: string }[];
	revoked: { userId: string; reason: string; except: string | undefined }[];
	sent: MailMessage[];
}

interface Options {
	user?: typeof USER | null;
	updateOk?: boolean;
	sendHangs?: boolean;
	sendFails?: boolean;
}

function setup(options: Options = {}) {
	const user = options.user === undefined ? USER : options.user;
	const calls: Calls = { replaced: [], updated: [], revoked: [], sent: [] };
	const validLinks = new Set<string>(['hash-of-raw-token']);

	const users = {
		findByEmail: () => Promise.resolve(user),
		findByIdWithPassword: () => Promise.resolve(user),
		updatePassword: (id: string, hash: string) => {
			calls.updated.push({ id, hash });
			return Promise.resolve(options.updateOk ?? true);
		},
	} as unknown as UsersService;
	const resets = {
		replaceForUser: (input: Calls['replaced'][number]) => {
			calls.replaced.push(input);
			return Promise.resolve();
		},
		consume: (tokenHash: string) => {
			if (!validLinks.delete(tokenHash)) return Promise.resolve(null);
			return Promise.resolve(USER.id);
		},
	} as unknown as PasswordResetsRepository;
	const sessions = {
		revokeAllByUser: (userId: string, reason: string, except?: string) => {
			calls.revoked.push({ userId, reason, except });
			return Promise.resolve();
		},
	} as unknown as AuthSessionsRepository;
	const tokens = {
		generateResetToken: () => ({
			token: 'raw-token',
			hash: 'hash-of-raw-token',
		}),
		hashResetToken: (token: string) => `hash-of-${token}`,
	} as unknown as TokenService;
	const hasher = {
		hash: (password: string) => Promise.resolve(`hashed:${password}`),
		verify: (hash: string, password: string) =>
			Promise.resolve(hash === `hashed:${password}`),
	} as unknown as PasswordHasher;
	const mail: MailService = {
		send: (message: MailMessage): Promise<void> => {
			if (options.sendHangs) return new Promise<void>(() => undefined);
			if (options.sendFails) {
				return Promise.reject(new Error('SMTP từ chối kết nối'));
			}
			calls.sent.push(message);
			return Promise.resolve();
		},
	};
	const config = {
		passwordResetTtlMinutes: 30,
		appBaseUrl: 'http://localhost:5173',
	} as unknown as AppConfigService;
	const transactions = {
		run: <T>(fn: (tx: object) => Promise<T>) => fn({}),
	} as unknown as TransactionRunner;

	const service = new PasswordService(
		users,
		resets,
		sessions,
		tokens,
		hasher,
		mail,
		config,
		transactions,
	);
	return { service, calls };
}

/** Cho các việc không đợi (gửi email) kịp chạy xong. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('forgotPassword (spec 0002 AC-8)', () => {
	it('email không có tài khoản: không tạo liên kết, không gửi email, không ném lỗi', async () => {
		const { service, calls } = setup({ user: null });
		await expect(
			service.forgotPassword('khong-co@example.com'),
		).resolves.toBeUndefined();
		await flush();
		expect(calls.replaced).toEqual([]);
		expect(calls.sent).toEqual([]);
	});

	it('email có tài khoản: lưu bản băm (không lưu token thô) và gửi liên kết', async () => {
		const { service, calls } = setup();
		const before = Date.now();
		await service.forgotPassword(USER.email);
		await flush();

		expect(calls.replaced).toHaveLength(1);
		const saved = calls.replaced[0];
		expect(saved.userId).toBe(USER.id);
		expect(saved.tokenHash).toBe('hash-of-raw-token');
		expect(JSON.stringify(saved)).not.toContain('"raw-token"');
		const minutes = (saved.expiresAt.getTime() - before) / 60000;
		expect(minutes).toBeGreaterThan(29.9);
		expect(minutes).toBeLessThan(30.1);

		expect(calls.sent).toHaveLength(1);
		expect(calls.sent[0].to).toBe(USER.email);
		expect(calls.sent[0].text).toContain(
			'http://localhost:5173/reset-password?token=raw-token',
		);
	});

	it('không đợi SMTP: máy chủ mail treo thì vẫn trả lời ngay', async () => {
		const { service } = setup({ sendHangs: true });
		await expect(
			service.forgotPassword(USER.email),
		).resolves.toBeUndefined();
	});

	it('gửi email lỗi thì không ném lỗi và log không chứa token', async () => {
		const logged: string[] = [];
		const spy = jest
			.spyOn(Logger.prototype, 'error')
			.mockImplementation((message: unknown) => {
				logged.push(String(message));
			});
		try {
			const { service } = setup({ sendFails: true });
			await expect(
				service.forgotPassword(USER.email),
			).resolves.toBeUndefined();
			await flush();
			expect(logged).toHaveLength(1);
			expect(logged[0]).toContain('SMTP từ chối kết nối');
			expect(logged[0]).not.toContain('raw-token');
		} finally {
			spy.mockRestore();
		}
	});
});

describe('resetPassword (spec 0002 AC-8)', () => {
	it('liên kết lạ: RESET_TOKEN_INVALID, không đổi mật khẩu, không hủy phiên', async () => {
		const { service, calls } = setup();
		await expect(
			service.resetPassword('khong-phai-token', 'mat-khau-moi-1'),
		).rejects.toMatchObject({ code: ErrorCode.RESET_TOKEN_INVALID });
		expect(calls.updated).toEqual([]);
		expect(calls.revoked).toEqual([]);
	});

	it('liên kết đúng: đặt mật khẩu mới (đã băm) và hủy mọi phiên', async () => {
		const { service, calls } = setup();
		await service.resetPassword('raw-token', 'mat-khau-moi-1');
		expect(calls.updated).toEqual([
			{ id: USER.id, hash: 'hashed:mat-khau-moi-1' },
		]);
		expect(calls.revoked).toEqual([
			{ userId: USER.id, reason: 'password_changed', except: undefined },
		]);
	});

	it('dùng liên kết lần hai bị từ chối và không hủy thêm phiên nào', async () => {
		const { service, calls } = setup();
		await service.resetPassword('raw-token', 'mat-khau-moi-1');
		await expect(
			service.resetPassword('raw-token', 'mat-khau-khac-2'),
		).rejects.toMatchObject({ code: ErrorCode.RESET_TOKEN_INVALID });
		expect(calls.updated).toHaveLength(1);
		expect(calls.revoked).toHaveLength(1);
	});

	it('người dùng đã bị xóa mềm sau khi xin liên kết: RESET_TOKEN_INVALID, không hủy phiên', async () => {
		const { service, calls } = setup({ updateOk: false });
		await expect(
			service.resetPassword('raw-token', 'mat-khau-moi-1'),
		).rejects.toMatchObject({ code: ErrorCode.RESET_TOKEN_INVALID });
		expect(calls.revoked).toEqual([]);
	});
});

describe('changePassword (spec 0002 AC-9)', () => {
	const input = {
		userId: USER.id,
		sessionId: 'session-hien-tai',
		currentPassword: 'mat-khau-cu',
		newPassword: 'mat-khau-moi-1',
	};

	it('sai mật khẩu hiện tại: CURRENT_PASSWORD_WRONG, không đổi gì', async () => {
		const { service, calls } = setup();
		await expect(
			service.changePassword({ ...input, currentPassword: 'sai-roi' }),
		).rejects.toMatchObject({ code: ErrorCode.CURRENT_PASSWORD_WRONG });
		expect(calls.updated).toEqual([]);
		expect(calls.revoked).toEqual([]);
	});

	it('đúng mật khẩu hiện tại: đặt mật khẩu mới, hủy phiên khác và giữ phiên đang dùng', async () => {
		const { service, calls } = setup();
		await service.changePassword(input);
		expect(calls.updated).toEqual([
			{ id: USER.id, hash: 'hashed:mat-khau-moi-1' },
		]);
		expect(calls.revoked).toEqual([
			{
				userId: USER.id,
				reason: 'password_changed',
				except: 'session-hien-tai',
			},
		]);
	});

	it('cho phép đổi sang chính mật khẩu hiện tại (không thêm luật)', async () => {
		const { service, calls } = setup();
		await expect(
			service.changePassword({ ...input, newPassword: 'mat-khau-cu' }),
		).resolves.toBeUndefined();
		expect(calls.updated).toHaveLength(1);
	});

	it('người dùng đã bị xóa: TOKEN_INVALID; bị khóa: ACCOUNT_LOCKED', async () => {
		await expect(
			setup({ user: null }).service.changePassword(input),
		).rejects.toMatchObject({ code: ErrorCode.TOKEN_INVALID });
		await expect(
			setup({
				user: { ...USER, status: 'locked' },
			}).service.changePassword(input),
		).rejects.toMatchObject({ code: ErrorCode.ACCOUNT_LOCKED });
	});
});
