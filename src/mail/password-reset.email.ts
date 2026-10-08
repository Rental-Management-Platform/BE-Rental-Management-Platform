import type { MailMessage } from './mail.service';

/** Đường dẫn trang đặt lại mật khẩu của FE. Là hằng số: FE phải có trang này (spec 0002, mục Value sourcing). */
export const RESET_PASSWORD_PATH = '/reset-password';

export interface PasswordResetEmailInput {
	readonly to: string;
	/** Tên người dùng để chào; rỗng thì chào chung. */
	readonly name: string | null;
	/** Token thô, chỉ xuất hiện trong liên kết này. */
	readonly token: string;
	readonly appBaseUrl: string;
	readonly ttlMinutes: number;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

/** Tên do người dùng tự nhập nên phải thoát ký tự HTML trước khi đưa vào thư. */
function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Liên kết FE kèm token; `URL` tự mã hóa tham số nên token không phá được địa chỉ. */
export function buildResetLink(appBaseUrl: string, token: string): string {
	const url = new URL(RESET_PASSWORD_PATH, appBaseUrl);
	url.searchParams.set('token', token);
	return url.toString();
}

/** Mẫu email cố định bằng tiếng Việt (spec 0002), không dùng công cụ tạo mẫu. */
export function buildPasswordResetEmail(
	input: PasswordResetEmailInput,
): MailMessage {
	const link = buildResetLink(input.appBaseUrl, input.token);
	const name = input.name?.trim() ?? '';
	const greeting = name === '' ? 'Xin chào,' : `Xin chào ${name},`;
	const subject = 'Đặt lại mật khẩu của bạn';
	const intro =
		'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Hãy mở liên kết dưới đây để đặt mật khẩu mới:';
	const expiry = `Liên kết có hiệu lực trong ${input.ttlMinutes} phút và chỉ dùng được một lần.`;
	const ignore =
		'Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn vẫn giữ nguyên.';

	const text = [greeting, '', intro, '', link, '', expiry, '', ignore].join(
		'\n',
	);
	const html = [
		`<p>${escapeHtml(greeting)}</p>`,
		`<p>${intro}</p>`,
		`<p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
		`<p>${expiry}</p>`,
		`<p>${ignore}</p>`,
	].join('\n');
	return { to: input.to, subject, text, html };
}
