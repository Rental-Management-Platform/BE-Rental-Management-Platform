/** Một email đã soạn xong, sẵn sàng gửi. Có cả bản chữ thuần và bản HTML cho các ứng dụng đọc thư. */
export interface MailMessage {
	readonly to: string;
	readonly subject: string;
	readonly text: string;
	readonly html: string;
}

/**
 * Giao diện gửi email (spec 0006). Nơi dùng chỉ biết `send`; đổi nhà cung cấp chỉ sửa hiện thực.
 * Là lớp trừu tượng để làm token cho Nest: đăng ký `{ provide: MailService, useClass: ... }`.
 */
export abstract class MailService {
	/** Ném lỗi nếu máy chủ SMTP từ chối hoặc không kết nối được. */
	abstract send(message: MailMessage): Promise<void>;
}
