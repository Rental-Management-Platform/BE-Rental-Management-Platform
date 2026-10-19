/** Số lần sinh mã khác khi gặp trùng, giống mã tin (spec 0004, "Value sourcing"). */
export const ORDER_CODE_ATTEMPTS = 5;

/** Mã vừa sinh đã có đơn khác dùng (chỉ mục duy nhất `orders_code_unique`): sinh mã mới rồi thử lại. */
export class OrderCodeTakenError extends Error {
	constructor(options?: { cause?: unknown }) {
		super('Mã đơn đã tồn tại.', options);
		this.name = 'OrderCodeTakenError';
	}
}
