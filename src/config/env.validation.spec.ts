import { validateDatabaseEnv, validateEnv } from './env.validation';

// Giá trị giả chỉ dùng cho test, không phải bí mật thật.
const validConfig = {
	DATABASE_HOST: 'localhost',
	DATABASE_PORT: '5432',
	DATABASE_NAME: 'rental_management',
	DATABASE_USER: 'rental_app',
	DATABASE_PASSWORD: 'fixture-database-password',
	JWT_ACCESS_SECRET: 'fixture-jwt-secret-that-is-long-enough-123',
	ALLOWED_ORIGINS: 'http://localhost:5173',
	APP_BASE_URL: 'http://localhost:5173',
	MAIL_HOST: 'smtp.example.test',
	MAIL_PORT: '465',
	MAIL_USER: 'sender@example.test',
	MAIL_PASSWORD: 'fixture-mail-password',
	MAIL_FROM: 'sender@example.test',
};

function without(config: Record<string, string>, key: string) {
	return Object.fromEntries(
		Object.entries(config).filter(([name]) => name !== key),
	);
}

function messageOf(action: () => unknown): string {
	try {
		action();
	} catch (error: unknown) {
		return error instanceof Error ? error.message : '';
	}
	throw new Error('Lẽ ra phải ném lỗi');
}

describe('validateEnv', () => {
	it('chấp nhận cấu hình đủ, đổi kiểu số và điền giá trị mặc định', () => {
		const env = validateEnv(validConfig);
		expect(env.DATABASE_PORT).toBe(5432);
		expect(env.DATABASE_POOL_MAX).toBe(10);
		expect(env.ACCESS_TTL_SECONDS).toBe(900);
		expect(env.COOKIE_SECURE).toBe(false);
	});

	it('báo tên biến bị thiếu', () => {
		const rest = without(validConfig, 'DATABASE_PASSWORD');
		expect(messageOf(() => validateEnv(rest))).toContain(
			'DATABASE_PASSWORD',
		);
	});

	it('từ chối giá trị mẫu CHANGE_ME', () => {
		const message = messageOf(() =>
			validateEnv({ ...validConfig, DATABASE_PASSWORD: 'CHANGE_ME' }),
		);
		expect(message).toContain('DATABASE_PASSWORD');
		expect(message).toContain('CHANGE_ME');
	});

	it('từ chối JWT_ACCESS_SECRET ngắn hơn 32 ký tự', () => {
		expect(
			messageOf(() =>
				validateEnv({ ...validConfig, JWT_ACCESS_SECRET: 'too-short' }),
			),
		).toContain('JWT_ACCESS_SECRET');
	});

	it('đổi COOKIE_SECURE từ chuỗi: "false" là false, không phải true', () => {
		expect(
			validateEnv({ ...validConfig, COOKIE_SECURE: 'false' })
				.COOKIE_SECURE,
		).toBe(false);
		expect(
			validateEnv({ ...validConfig, COOKIE_SECURE: 'true' })
				.COOKIE_SECURE,
		).toBe(true);
	});

	it.each(['http://localhost:5173/', 'localhost:5173', 'ftp://x.com'])(
		'từ chối ALLOWED_ORIGINS sai dạng: %j',
		(origins) => {
			expect(
				messageOf(() =>
					validateEnv({ ...validConfig, ALLOWED_ORIGINS: origins }),
				),
			).toContain('ALLOWED_ORIGINS');
		},
	);

	it.each([
		'Rental',
		'rental-app',
		'rental"; DROP DATABASE x; --',
		'1abc',
		'',
	])('từ chối tên database không an toàn: %j', (name) => {
		expect(
			messageOf(() =>
				validateEnv({ ...validConfig, DATABASE_NAME: name }),
			),
		).toContain('DATABASE_NAME');
	});

	it('ảnh tin: UPLOAD_DIR mặc định "uploads" và MAX_UPLOAD_BYTES mặc định 5 MiB; đặt thì lấy giá trị đặt (spec 0002 AC-8)', () => {
		const env = validateEnv(validConfig);
		expect(env.UPLOAD_DIR).toBe('uploads');
		expect(env.MAX_UPLOAD_BYTES).toBe(5242880);

		const custom = validateEnv({
			...validConfig,
			UPLOAD_DIR: '/data/uploads',
			MAX_UPLOAD_BYTES: '1048576',
		});
		expect(custom.UPLOAD_DIR).toBe('/data/uploads');
		expect(custom.MAX_UPLOAD_BYTES).toBe(1048576);
	});

	it.each([['1'], ['10485760']])(
		'chấp nhận MAX_UPLOAD_BYTES ở hai biên: %s',
		(bytes) => {
			expect(
				validateEnv({ ...validConfig, MAX_UPLOAD_BYTES: bytes })
					.MAX_UPLOAD_BYTES,
			).toBe(Number(bytes));
		},
	);

	it.each([['0'], ['-5'], ['10485761'], ['5.5'], ['năm triệu'], ['']])(
		'từ chối MAX_UPLOAD_BYTES = %j và chỉ nêu tên biến',
		(bytes) => {
			const message = messageOf(() =>
				validateEnv({ ...validConfig, MAX_UPLOAD_BYTES: bytes }),
			);
			expect(message).toContain('MAX_UPLOAD_BYTES');
			expect(message).not.toContain(bytes === '' ? 'khong-co' : bytes);
		},
	);

	it('từ chối UPLOAD_DIR để trống', () => {
		expect(
			messageOf(() => validateEnv({ ...validConfig, UPLOAD_DIR: '' })),
		).toContain('UPLOAD_DIR');
	});

	it('điền mặc định 30 phút cho hạn liên kết đặt lại mật khẩu', () => {
		expect(validateEnv(validConfig).PASSWORD_RESET_TTL_MINUTES).toBe(30);
		expect(
			validateEnv({ ...validConfig, PASSWORD_RESET_TTL_MINUTES: '15' })
				.PASSWORD_RESET_TTL_MINUTES,
		).toBe(15);
	});

	it.each([
		'APP_BASE_URL',
		'MAIL_HOST',
		'MAIL_PORT',
		'MAIL_USER',
		'MAIL_PASSWORD',
		'MAIL_FROM',
	])('thiếu %s thì không khởi động được (spec 0002, 0006)', (name) => {
		expect(
			messageOf(() => validateEnv(without(validConfig, name))),
		).toContain(name);
	});

	it.each(['MAIL_USER', 'MAIL_PASSWORD'])(
		'từ chối %s còn là giá trị mẫu CHANGE_ME',
		(name) => {
			expect(
				messageOf(() =>
					validateEnv({ ...validConfig, [name]: 'CHANGE_ME' }),
				),
			).toContain(name);
		},
	);

	it.each(['http://localhost:5173/', 'localhost:5173', 'http://a.com/x'])(
		'từ chối APP_BASE_URL sai dạng: %j',
		(url) => {
			expect(
				messageOf(() =>
					validateEnv({ ...validConfig, APP_BASE_URL: url }),
				),
			).toContain('APP_BASE_URL');
		},
	);

	it.each(['sender@example.test', 'Nhà trọ Việt <sender@example.test>'])(
		'chấp nhận MAIL_FROM hợp lệ: %j',
		(from) => {
			expect(
				validateEnv({ ...validConfig, MAIL_FROM: from }).MAIL_FROM,
			).toBe(from);
		},
	);

	it.each([
		'CHANGE_ME',
		'sender@example.test\r\nBcc: x@y.z',
		'Tên <sender@example.test> thừa',
	])('từ chối MAIL_FROM sai dạng hoặc có xuống dòng: %j', (from) => {
		expect(
			messageOf(() => validateEnv({ ...validConfig, MAIL_FROM: from })),
		).toContain('MAIL_FROM');
	});

	it('không bao giờ đưa giá trị biến vào thông báo lỗi', () => {
		const message = messageOf(() =>
			validateEnv({
				...validConfig,
				DATABASE_PASSWORD: 'leaky-marker-password',
				JWT_ACCESS_SECRET: 'leaky-marker-jwt',
				DATABASE_PORT: 'leaky-marker-port',
			}),
		);
		expect(message).not.toContain('leaky-marker');
	});
});

describe('validateDatabaseEnv', () => {
	it('không đòi các biến không liên quan tới database', () => {
		const rest = without(
			without(validConfig, 'JWT_ACCESS_SECRET'),
			'ALLOWED_ORIGINS',
		);
		expect(() => validateDatabaseEnv(rest)).not.toThrow();
	});
});
