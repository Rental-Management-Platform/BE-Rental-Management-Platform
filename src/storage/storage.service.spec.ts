import { isStorageKey } from './storage.service';

const UUID = '0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d01';

describe('isStorageKey (spec 0006, spec 0002 AC-8)', () => {
	it.each(['jpg', 'png', 'webp'])('nhận khóa public/<uuid>.%s', (ext) => {
		expect(isStorageKey(`public/${UUID}.${ext}`)).toBe(true);
	});

	it.each([
		['rỗng', ''],
		['đuôi ngoài danh sách', `public/${UUID}.gif`],
		['đuôi chữ hoa', `public/${UUID}.PNG`],
		['không có đuôi', `public/${UUID}`],
		['uuid chữ hoa', `public/${UUID.toUpperCase()}.png`],
		['uuid thiếu ký tự', 'public/0192f1c2-7a4b-4c3e-9d1a-3b5f6a7c8d0.png'],
		['thư mục khác', `private/${UUID}.png`],
		['thiếu thư mục', `${UUID}.png`],
		['đi lên thư mục cha', `public/../${UUID}.png`],
		['đi lên hai cấp', `public/../../etc/passwd`],
		['thêm thư mục con', `public/x/${UUID}.png`],
		['dấu gạch chéo ngược', `public\\${UUID}.png`],
		['đường dẫn tuyệt đối', `/public/${UUID}.png`],
		['thừa ký tự phía sau', `public/${UUID}.png/extra`],
		['xuống dòng ở cuối', `public/${UUID}.png\n`],
		['byte rỗng', `public/${UUID}.png\0.jpg`],
	])('từ chối khóa %s', (_label, key) => {
		expect(isStorageKey(key)).toBe(false);
	});
});
