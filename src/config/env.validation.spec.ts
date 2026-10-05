import { validateDatabaseEnv, validateEnv } from './env.validation';

// Giá trị giả chỉ dùng cho test, không phải bí mật thật.
const validConfig = {
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'rental_management',
  DATABASE_USER: 'rental_app',
  DATABASE_PASSWORD: 'fixture-database-password',
  JWT_SECRET: 'fixture-jwt-secret-that-is-long-enough-123',
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
    expect(env.JWT_EXPIRES_IN).toBe('1d');
  });

  it('báo tên biến bị thiếu', () => {
    const rest = without(validConfig, 'DATABASE_PASSWORD');
    expect(messageOf(() => validateEnv(rest))).toContain('DATABASE_PASSWORD');
  });

  it('từ chối giá trị mẫu CHANGE_ME', () => {
    const message = messageOf(() =>
      validateEnv({ ...validConfig, DATABASE_PASSWORD: 'CHANGE_ME' }),
    );
    expect(message).toContain('DATABASE_PASSWORD');
    expect(message).toContain('CHANGE_ME');
  });

  it('từ chối JWT_SECRET ngắn hơn 32 ký tự', () => {
    expect(
      messageOf(() => validateEnv({ ...validConfig, JWT_SECRET: 'too-short' })),
    ).toContain('JWT_SECRET');
  });

  it.each(['Rental', 'rental-app', 'rental"; DROP DATABASE x; --', '1abc', ''])(
    'từ chối tên database không an toàn: %j',
    (name) => {
      expect(
        messageOf(() => validateEnv({ ...validConfig, DATABASE_NAME: name })),
      ).toContain('DATABASE_NAME');
    },
  );

  it('không bao giờ đưa giá trị biến vào thông báo lỗi', () => {
    const message = messageOf(() =>
      validateEnv({
        ...validConfig,
        DATABASE_PASSWORD: 'leaky-marker-password',
        JWT_SECRET: 'leaky-marker-jwt',
        DATABASE_PORT: 'leaky-marker-port',
      }),
    );
    expect(message).not.toContain('leaky-marker');
  });
});

describe('validateDatabaseEnv', () => {
  it('không đòi các biến không liên quan tới database', () => {
    const rest = without(validConfig, 'JWT_SECRET');
    expect(() => validateDatabaseEnv(rest)).not.toThrow();
  });
});
