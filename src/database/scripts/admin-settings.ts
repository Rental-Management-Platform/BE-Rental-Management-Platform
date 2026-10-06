import { PLACEHOLDER_PREFIX } from '../../config/env.validation';

/** Quyền quản trị Postgres, chỉ dùng cho `npm run db:create`. Không bao giờ có trong ứng dụng. */
export interface AdminSettings {
	readonly user: string;
	readonly password: string;
}

/**
 * Đọc tài khoản quản trị từ biến môi trường. Thiếu mật khẩu thì dừng kèm hướng dẫn;
 * không hỏi mật khẩu trên màn hình và không bao giờ in giá trị ra.
 */
export function readAdminSettings(
	config: Record<string, string | undefined>,
): AdminSettings {
	const user = config.DATABASE_ADMIN_USER?.trim() || 'postgres';
	const password = config.DATABASE_ADMIN_PASSWORD ?? '';
	if (password.length === 0 || password.startsWith(PLACEHOLDER_PREFIX)) {
		throw new Error(
			'Chưa có DATABASE_ADMIN_PASSWORD. Mở file .env, điền mật khẩu của tài khoản quản trị ' +
				'PostgreSQL trên máy (mật khẩu đã đặt lúc cài), rồi chạy lại. ' +
				'Biến này chỉ dùng cho npm run db:create, ứng dụng không cần.',
		);
	}
	return { user, password };
}
