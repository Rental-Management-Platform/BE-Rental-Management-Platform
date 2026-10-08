import {
	buildPasswordResetEmail,
	buildResetLink,
} from './password-reset.email';

const input = {
	to: 'nguoi.dung@example.com',
	name: 'Nguyễn Văn An',
	token: 'abc_DEF-123',
	appBaseUrl: 'http://localhost:5173',
	ttlMinutes: 30,
};

describe('buildResetLink', () => {
	it('ghép địa chỉ FE, đường dẫn /reset-password và token', () => {
		expect(buildResetLink('http://localhost:5173', 'abc_DEF-123')).toBe(
			'http://localhost:5173/reset-password?token=abc_DEF-123',
		);
	});

	it('mã hóa token để không phá được địa chỉ', () => {
		const link = buildResetLink('http://localhost:5173', 'a&b=c d');
		expect(new URL(link).searchParams.get('token')).toBe('a&b=c d');
		expect(link).not.toContain(' ');
	});
});

describe('buildPasswordResetEmail', () => {
	it('viết bằng tiếng Việt, gửi đúng người, có liên kết và hạn dùng', () => {
		const mail = buildPasswordResetEmail(input);
		const link = 'http://localhost:5173/reset-password?token=abc_DEF-123';
		expect(mail.to).toBe(input.to);
		expect(mail.subject).toBe('Đặt lại mật khẩu của bạn');
		expect(mail.text).toContain('Xin chào Nguyễn Văn An,');
		expect(mail.text).toContain(link);
		expect(mail.text).toContain('30 phút');
		expect(mail.html).toContain(`href="${link}"`);
		expect(mail.html).toContain('30 phút');
	});

	it('hạn dùng lấy theo PASSWORD_RESET_TTL_MINUTES, không viết cứng', () => {
		const mail = buildPasswordResetEmail({ ...input, ttlMinutes: 5 });
		expect(mail.text).toContain('5 phút');
		expect(mail.text).not.toContain('30 phút');
	});

	it('chào chung khi người dùng chưa có tên', () => {
		expect(buildPasswordResetEmail({ ...input, name: null }).text).toMatch(
			/^Xin chào,\n/,
		);
		expect(buildPasswordResetEmail({ ...input, name: '   ' }).text).toMatch(
			/^Xin chào,\n/,
		);
	});

	it('thoát ký tự HTML trong tên do người dùng tự nhập', () => {
		const mail = buildPasswordResetEmail({
			...input,
			name: '<script>alert(1)</script> & "An"',
		});
		expect(mail.html).not.toContain('<script>');
		expect(mail.html).toContain(
			'&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;An&quot;',
		);
	});
});
