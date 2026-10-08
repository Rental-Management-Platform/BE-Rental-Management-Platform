import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';
import { assertOwner } from './ownership';

describe('assertOwner (spec 0003 AC-5)', () => {
	it('cho qua khi người gọi là chủ sở hữu', () => {
		expect(() => assertOwner({ userId: 'u1' }, 'u1')).not.toThrow();
	});

	it('ném 403 NOT_RESOURCE_OWNER khi là dữ liệu của người khác', () => {
		try {
			assertOwner({ userId: 'u1' }, 'u2');
			throw new Error('lẽ ra phải ném lỗi');
		} catch (error: unknown) {
			expect(error).toBeInstanceOf(AppException);
			expect(error instanceof AppException && error.code).toBe(
				ErrorCode.NOT_RESOURCE_OWNER,
			);
		}
	});
});
