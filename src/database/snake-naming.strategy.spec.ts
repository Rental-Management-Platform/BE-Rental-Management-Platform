import { SnakeNamingStrategy } from './snake-naming.strategy';

describe('SnakeNamingStrategy', () => {
  const strategy = new SnakeNamingStrategy();

  it('đổi tên cột camelCase thành snake_case', () => {
    expect(strategy.columnName('passwordHash', undefined, [])).toBe(
      'password_hash',
    );
    expect(strategy.columnName('createdAt', undefined, [])).toBe('created_at');
  });

  it('giữ tên cột do người dùng chỉ định', () => {
    expect(strategy.columnName('anything', 'custom_name', [])).toBe(
      'custom_name',
    );
  });

  it('giữ tên bảng chỉ định tường minh', () => {
    expect(strategy.tableName('User', 'users')).toBe('users');
    expect(strategy.tableName('PropertyFee', undefined)).toBe('property_fee');
  });

  it('đặt tên ràng buộc theo quy ước <bảng>_<cột>_<loại>', () => {
    expect(strategy.primaryKeyName('users')).toBe('users_pkey');
    expect(strategy.uniqueConstraintName('users', ['email'])).toBe(
      'users_email_unique',
    );
    expect(strategy.foreignKeyName('listings', ['property_id'])).toBe(
      'listings_property_id_fk',
    );
    expect(strategy.indexName('listings', ['property_id'])).toBe(
      'listings_property_id_idx',
    );
  });

  it('bỏ tiền tố schema khỏi tên bảng', () => {
    expect(strategy.uniqueConstraintName('public.users', ['email'])).toBe(
      'users_email_unique',
    );
  });

  it('rút gọn tên quá 63 ký tự và giữ tên ổn định', () => {
    const columns = [
      'a_very_long_column_name',
      'another_very_long_column_name',
    ];
    const first = strategy.indexName('some_table_with_a_long_name', columns);
    const second = strategy.indexName('some_table_with_a_long_name', columns);
    expect(first.length).toBeLessThanOrEqual(63);
    expect(first).toBe(second);
  });
});
