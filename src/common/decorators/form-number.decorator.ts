import { Transform } from 'class-transformer';

/** Chuỗi số thập phân thường: chữ số, có thể một dấu chấm và phần lẻ. Không dấu, không khoảng trắng, không số mũ. */
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * Trong `multipart/form-data` mọi trường chữ đến dưới dạng chuỗi. Chỉ chuỗi số thập phân thường được đổi thành số;
 * mọi chuỗi khác (rỗng, `1e5`, `0x10`, có khoảng trắng) thành `NaN` để validator từ chối, vì `Number('')` là 0 và
 * `Number('0x10')` là 16 sẽ lọt qua nếu để trình đổi mặc định. Giá trị không phải chuỗi (số JSON, `null`, mảng khi một
 * trường bị lặp, đối tượng khi trường có dạng `price[x]`) giữ nguyên cho validator xét.
 */
export function FormNumber(): PropertyDecorator {
	return Transform(({ value }: { value: unknown }) => {
		if (typeof value !== 'string') return value;
		return PLAIN_DECIMAL.test(value) ? Number(value) : Number.NaN;
	});
}
