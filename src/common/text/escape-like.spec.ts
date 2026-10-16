import { escapeLike } from './escape-like';

describe('escapeLike', () => {
	it.each([
		['%', '\\%'],
		['_', '\\_'],
		['\\', '\\\\'],
		['50%_off\\', '50\\%\\_off\\\\'],
	])('thoát %s', (input, expected) => {
		expect(escapeLike(input)).toBe(expected);
	});

	it('giữ nguyên chữ, số và khoảng trắng', () => {
		expect(escapeLike('phong dep 24h')).toBe('phong dep 24h');
	});

	it('chuỗi rỗng vẫn rỗng', () => {
		expect(escapeLike('')).toBe('');
	});
});
