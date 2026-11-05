/** Con số của chat (spec 0013). Một chỗ để DTO, test và tài liệu cùng đọc. */
export const CHAT_LIMITS = {
	/**
	 * Độ dài tối đa của tin nhắn, đếm ký tự Unicode sau khi bỏ khoảng trắng hai đầu. `MaxLength` của class-validator tính
	 * một cặp thay thế (emoji) là một ký tự, đúng như `char_length` của PostgreSQL, nên CHECK ở DB không bao giờ bị vi phạm.
	 */
	bodyMax: 1000,
	/** Số tin mỗi lần đọc khi không nói `limit`. */
	messagesDefault: 30,
	/** Số tin tối đa mỗi lần đọc. */
	messagesMax: 100,
	/** Số lớn nhất của một cột int trong PostgreSQL; `seq` và `upToSeq` không vượt quá. */
	seqMax: 2_147_483_647,
} as const;
