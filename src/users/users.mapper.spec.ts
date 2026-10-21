import { toAdminUserItem, toProfileResponse } from './users.mapper';
import type { AdminUserRow, UserWithoutPassword } from './users.repository';

const CREATED_AT = new Date('2026-10-05T03:00:00.000Z');

function row(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
	return {
		id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01',
		email: 'nam@example.com',
		name: 'Nguyễn Văn Nam',
		phone: '0901234567',
		accountType: 'landlord',
		status: 'locked',
		lockedReason: 'Đăng tin giả mạo',
		createdAt: CREATED_AT,
		...overrides,
	};
}

describe('toAdminUserItem (spec 0007 AC-1, AC-6)', () => {
	it('trả đúng tám trường theo tên của hợp đồng', () => {
		expect(toAdminUserItem(row())).toEqual({
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01',
			email: 'nam@example.com',
			name: 'Nguyễn Văn Nam',
			phone: '0901234567',
			accountType: 'landlord',
			status: 'locked',
			lockedReason: 'Đăng tin giả mạo',
			createdAt: CREATED_AT,
		});
	});

	it('giữ null của tên, số điện thoại và lý do khóa', () => {
		const item = toAdminUserItem(
			row({
				name: null,
				phone: null,
				status: 'active',
				lockedReason: null,
			}),
		);
		expect(item.name).toBeNull();
		expect(item.phone).toBeNull();
		expect(item.lockedReason).toBeNull();
	});

	it('không chép trường thừa dù dòng đầu vào có thêm cột (passwordHash, trialEndsAt, mốc đổi mật khẩu)', () => {
		const withSecrets = {
			...row(),
			passwordHash: '$argon2id$bi-mat',
			passwordChangedAt: CREATED_AT,
			trialEndsAt: CREATED_AT,
			updatedAt: CREATED_AT,
			deletedAt: null,
		} as AdminUserRow;
		const item = toAdminUserItem(withSecrets);
		expect(Object.keys(item).sort()).toEqual([
			'accountType',
			'createdAt',
			'email',
			'id',
			'lockedReason',
			'name',
			'phone',
			'status',
		]);
		expect(JSON.stringify(item)).not.toContain('argon2');
	});
});

describe('toProfileResponse (spec 0008 AC-1)', () => {
	function user(
		overrides: Partial<UserWithoutPassword> = {},
	): UserWithoutPassword {
		return {
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01',
			email: 'nam@example.com',
			name: 'Nguyễn Văn Nam',
			phone: '0901234567',
			accountType: 'landlord',
			status: 'active',
			lockedReason: null,
			passwordChangedAt: null,
			trialEndsAt: CREATED_AT,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			deletedAt: null,
			...overrides,
		};
	}

	it('trả đúng bảy trường theo tên của hợp đồng', () => {
		expect(toProfileResponse(user())).toEqual({
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01',
			email: 'nam@example.com',
			name: 'Nguyễn Văn Nam',
			phone: '0901234567',
			accountType: 'landlord',
			status: 'active',
			createdAt: CREATED_AT,
		});
	});

	it('giữ null của tên và số điện thoại', () => {
		const profile = toProfileResponse(
			user({ name: null, phone: null, accountType: 'tenant' }),
		);
		expect(profile.name).toBeNull();
		expect(profile.phone).toBeNull();
	});

	it('không chép cột thừa dù hàng đầu vào có (passwordHash, mốc đổi mật khẩu, kỳ dùng thử, lý do khóa, xóa mềm)', () => {
		const withSecrets = {
			...user({
				passwordChangedAt: CREATED_AT,
				lockedReason: 'lý do',
				deletedAt: CREATED_AT,
			}),
			passwordHash: '$argon2id$bi-mat',
		} as UserWithoutPassword;
		const profile = toProfileResponse(withSecrets);
		expect(Object.keys(profile).sort()).toEqual([
			'accountType',
			'createdAt',
			'email',
			'id',
			'name',
			'phone',
			'status',
		]);
		expect(JSON.stringify(profile)).not.toContain('argon2');
	});
});
