import { readAdminSettings } from './admin-settings';

describe('readAdminSettings', () => {
  it('dùng postgres làm tài khoản quản trị mặc định', () => {
    const settings = readAdminSettings({
      DATABASE_ADMIN_PASSWORD: 'fixture-admin-password',
    });
    expect(settings.user).toBe('postgres');
    expect(settings.password).toBe('fixture-admin-password');
  });

  it('lấy tài khoản quản trị từ biến môi trường', () => {
    expect(
      readAdminSettings({
        DATABASE_ADMIN_USER: 'dba',
        DATABASE_ADMIN_PASSWORD: 'fixture-admin-password',
      }).user,
    ).toBe('dba');
  });

  it.each([undefined, '', 'CHANGE_ME'])(
    'dừng kèm hướng dẫn khi thiếu mật khẩu quản trị: %j',
    (password) => {
      expect(() =>
        readAdminSettings({ DATABASE_ADMIN_PASSWORD: password }),
      ).toThrow('DATABASE_ADMIN_PASSWORD');
    },
  );
});
