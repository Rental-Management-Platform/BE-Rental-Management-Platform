import type { Request, Response } from 'express';
import type { AuthSettings } from '../config/app-config.service';

/** Phải khớp CHÍNH XÁC tiền tố /api, phiên bản /v1 và controller 'auth' (xem app.factory.ts). */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

const DAY_MS = 24 * 60 * 60 * 1000;

function baseOptions(auth: AuthSettings) {
	return {
		httpOnly: true,
		secure: auth.cookieSecure,
		sameSite: 'strict',
		path: REFRESH_COOKIE_PATH,
	} as const;
}

export function setRefreshCookie(
	res: Response,
	token: string,
	auth: AuthSettings,
): void {
	res.cookie(auth.refreshCookieName, token, {
		...baseOptions(auth),
		maxAge: auth.refreshTtlDays * DAY_MS, // Express tính bằng mili giây
	});
}

/** Phải truyền đúng `path` và các thuộc tính như lúc đặt, nếu không trình duyệt không xóa. */
export function clearRefreshCookie(res: Response, auth: AuthSettings): void {
	res.clearCookie(auth.refreshCookieName, baseOptions(auth));
}

export function readRefreshCookie(
	req: Request,
	auth: AuthSettings,
): string | undefined {
	const cookies: unknown = req.cookies;
	if (typeof cookies !== 'object' || cookies === null) return undefined;
	const value: unknown = Reflect.get(cookies, auth.refreshCookieName);
	return typeof value === 'string' && value !== '' ? value : undefined;
}
