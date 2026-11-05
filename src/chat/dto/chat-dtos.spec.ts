import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { CHAT_LIMITS } from '../chat-limits';
import { ConversationsQueryDto, MessagesQueryDto } from './chat-queries.dto';
import { ReadConversationDto } from './read-conversation.dto';
import { SendMessageDto } from './send-message.dto';

type DtoClass = new () => object;
type Source = 'body' | 'query';

async function validate(
	metatype: DtoClass,
	payload: object,
	type: Source = 'body',
): Promise<{ errors: readonly FieldError[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(payload, {
			type,
			metatype,
		});
		return { errors: [], value };
	} catch (error: unknown) {
		if (error instanceof AppException) {
			return { errors: error.fieldErrors, value: undefined };
		}
		throw error;
	}
}

const fields = (errors: readonly FieldError[]): string[] => [
	...new Set(errors.map((error) => error.field)),
];

describe('SendMessageDto (spec 0013 AC-4)', () => {
	it('chuỗi hợp lệ qua và bỏ khoảng trắng hai đầu', async () => {
		const { errors, value } = await validate(SendMessageDto, {
			body: '   Phòng còn trống không ạ?  ',
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ body: 'Phòng còn trống không ạ?' });
	});

	it('xuống dòng ở giữa được giữ nguyên', async () => {
		const { errors, value } = await validate(SendMessageDto, {
			body: 'Dòng một\nDòng hai\r\nDòng ba',
		});
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ body: 'Dòng một\nDòng hai\r\nDòng ba' });
	});

	it('đúng 1 ký tự và đúng 1000 ký tự đều qua', async () => {
		expect((await validate(SendMessageDto, { body: 'a' })).errors).toEqual(
			[],
		);
		expect(
			(await validate(SendMessageDto, { body: 'a'.repeat(1000) })).errors,
		).toEqual([]);
	});

	it('1000 ký tự cộng khoảng trắng hai đầu vẫn qua vì đếm sau khi bỏ', async () => {
		const { errors } = await validate(SendMessageDto, {
			body: `  ${'a'.repeat(1000)}\n `,
		});
		expect(errors).toEqual([]);
	});

	it.each([
		['thiếu', {}],
		['rỗng', { body: '' }],
		['toàn khoảng trắng', { body: '   \n\t  ' }],
		['1001 ký tự', { body: 'a'.repeat(1001) }],
		['là số', { body: 42 }],
		['là mảng', { body: ['xin chào'] }],
		['là object', { body: { text: 'xin chào' } }],
		['là null', { body: null }],
		['có NUL ở giữa', { body: 'xin\u0000chào' }],
		['chỉ có NUL', { body: '\u0000' }],
		['có NUL ở đầu sau khi bỏ khoảng trắng', { body: ' \u0000chào' }],
	])('body %s: 400 kèm trường body', async (_name, payload) => {
		const { errors } = await validate(SendMessageDto, payload);
		expect(fields(errors)).toEqual(['body']);
	});

	it('đếm ký tự Unicode như char_length của DB: 1000 emoji qua, 1001 emoji bị từ chối', async () => {
		expect(
			(await validate(SendMessageDto, { body: '😀'.repeat(1000) }))
				.errors,
		).toEqual([]);
		expect(
			fields(
				(await validate(SendMessageDto, { body: '😀'.repeat(1001) }))
					.errors,
			),
		).toEqual(['body']);
	});

	it('giới hạn lấy từ CHAT_LIMITS: 1000 ký tự', () => {
		expect(CHAT_LIMITS.bodyMax).toBe(1000);
	});

	it('trường lạ bị từ chối, nên người gọi không nhét được tenantId hay senderId vào body', async () => {
		const { errors } = await validate(SendMessageDto, {
			body: 'Chào',
			senderId: 'khac',
			tenantId: 'khac',
		});
		expect(fields(errors).sort()).toEqual(['senderId', 'tenantId']);
	});
});

describe('MessagesQueryDto (spec 0013 AC-6)', () => {
	it('không tham số: limit mặc định 30, không afterSeq hay beforeSeq', async () => {
		const { errors, value } = await validate(MessagesQueryDto, {}, 'query');
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ limit: 30 });
		expect(value).not.toHaveProperty('afterSeq', expect.anything());
		expect(value).not.toHaveProperty('beforeSeq', expect.anything());
	});

	it('chuỗi trong query đổi thành số', async () => {
		const { errors, value } = await validate(
			MessagesQueryDto,
			{ limit: '2', afterSeq: '0' },
			'query',
		);
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ limit: 2, afterSeq: 0 });
	});

	it.each([['1'], ['100']])('limit %s ở biên qua', async (limit) => {
		expect(
			(await validate(MessagesQueryDto, { limit }, 'query')).errors,
		).toEqual([]);
	});

	it.each([
		['limit', '0'],
		['limit', '101'],
		['limit', '1.5'],
		['limit', 'abc'],
		['afterSeq', '-1'],
		['afterSeq', '2.5'],
		['afterSeq', 'x'],
		['afterSeq', '2147483648'],
		['beforeSeq', '0'],
		['beforeSeq', '-3'],
		['beforeSeq', 'x'],
		['beforeSeq', '2147483648'],
	])('%s=%s: 400 kèm đúng trường đó', async (field, text) => {
		const { errors } = await validate(
			MessagesQueryDto,
			{ [field]: text },
			'query',
		);
		expect(fields(errors)).toEqual([field]);
	});

	it('afterSeq=0 và beforeSeq=1 là biên hợp lệ', async () => {
		expect(
			(await validate(MessagesQueryDto, { afterSeq: '0' }, 'query'))
				.errors,
		).toEqual([]);
		expect(
			(await validate(MessagesQueryDto, { beforeSeq: '1' }, 'query'))
				.errors,
		).toEqual([]);
	});
});

describe('ConversationsQueryDto (spec 0013 AC-7)', () => {
	it('mặc định trang 1, 20 dòng, không lọc tin', async () => {
		const { errors, value } = await validate(
			ConversationsQueryDto,
			{},
			'query',
		);
		expect(errors).toEqual([]);
		expect(value).toMatchObject({ page: 1, pageSize: 20 });
	});

	it('listingId là UUID thì qua', async () => {
		const { errors, value } = await validate(
			ConversationsQueryDto,
			{ listingId: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11' },
			'query',
		);
		expect(errors).toEqual([]);
		expect(value).toMatchObject({
			listingId: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11',
		});
	});

	it('listingId không phải UUID: 400 kèm trường listingId', async () => {
		const { errors } = await validate(
			ConversationsQueryDto,
			{ listingId: 'abc' },
			'query',
		);
		expect(fields(errors)).toEqual(['listingId']);
	});

	it('pageSize 51 vượt trần chung: 400', async () => {
		const { errors } = await validate(
			ConversationsQueryDto,
			{ pageSize: '51' },
			'query',
		);
		expect(fields(errors)).toEqual(['pageSize']);
	});
});

describe('ReadConversationDto (spec 0013 AC-11)', () => {
	it.each([[0], [1], [4], [2147483647]])(
		'upToSeq %p ở trong khoảng thì qua',
		async (upToSeq) => {
			const { errors, value } = await validate(ReadConversationDto, {
				upToSeq,
			});
			expect(errors).toEqual([]);
			expect(value).toMatchObject({ upToSeq });
		},
	);

	it.each([
		['thiếu', {}],
		['âm', { upToSeq: -1 }],
		['quá cột int', { upToSeq: 2147483648 }],
		['số thập phân', { upToSeq: 1.5 }],
		['chuỗi số, body không tự đổi kiểu', { upToSeq: '3' }],
		['chữ', { upToSeq: 'abc' }],
		['là null', { upToSeq: null }],
		['là mảng', { upToSeq: [3] }],
		['là object', { upToSeq: { seq: 3 } }],
		['là boolean', { upToSeq: true }],
	])('upToSeq %s: 400 kèm trường upToSeq', async (_name, payload) => {
		const { errors } = await validate(ReadConversationDto, payload);
		expect(fields(errors)).toEqual(['upToSeq']);
	});

	it('trường lạ bị từ chối, nên người gọi không nhét được mốc đọc của chủ trọ hay last_seq vào body', async () => {
		const { errors } = await validate(ReadConversationDto, {
			upToSeq: 2,
			tenantReadSeq: 9,
			landlordReadSeq: 9,
			lastSeq: 9,
		});
		expect(fields(errors).sort()).toEqual([
			'landlordReadSeq',
			'lastSeq',
			'tenantReadSeq',
		]);
	});

	it('giới hạn trên lấy từ CHAT_LIMITS.seqMax, đúng số lớn nhất của cột int', () => {
		expect(CHAT_LIMITS.seqMax).toBe(2_147_483_647);
	});
});
