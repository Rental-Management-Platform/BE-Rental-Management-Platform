import { toSearchWords } from './search-words';

describe('toSearchWords', () => {
	it('bỏ dấu, đổi chữ thường và tách theo khoảng trắng', () => {
		expect(toSearchWords('Phòng  ĐẸP gần Tân Định')).toEqual([
			'phong',
			'dep',
			'gan',
			'tan',
			'dinh',
		]);
	});

	it('vắng, rỗng hoặc chỉ khoảng trắng thì không có từ nào (bỏ lọc)', () => {
		expect(toSearchWords(undefined)).toEqual([]);
		expect(toSearchWords('')).toEqual([]);
		expect(toSearchWords('    ')).toEqual([]);
	});

	it('quá 6 từ thì chỉ lấy 6 từ đầu', () => {
		expect(toSearchWords('a1 b2 c3 d4 e5 f6 g7 h8')).toEqual([
			'a1',
			'b2',
			'c3',
			'd4',
			'e5',
			'f6',
		]);
	});

	it('từ dài hơn 50 ký tự thì cắt còn 50', () => {
		const [word] = toSearchWords('x'.repeat(80));
		expect(word).toHaveLength(50);
	});

	it('giữ nguyên ký tự đặc biệt của LIKE để Repository thoát (không tự thoát ở đây)', () => {
		expect(toSearchWords('50%_off')).toEqual(['50%_off']);
	});
});
