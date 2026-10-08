import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppConfigService } from '../config/app-config.service';
import { MailService } from './mail.service';
import type { MailMessage } from './mail.service';

/** Cổng SMTP dùng TLS ngay từ đầu kết nối (Gmail: 465). Các cổng khác (587, 25) nâng cấp lên TLS giữa chừng nếu máy chủ hỗ trợ. */
const IMPLICIT_TLS_PORT = 465;

const CONNECTION_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

/**
 * Gửi email bằng Nodemailer qua SMTP (mặc định là Gmail với App Password). Không kết nối lúc khởi
 * động: thiếu mạng hay sai mật khẩu chỉ lộ ra ở lần gửi đầu tiên, nên API vẫn chạy được khi offline.
 */
@Injectable()
export class NodemailerMailService extends MailService {
	private readonly transporter: Transporter;
	private readonly from: string;

	constructor(config: AppConfigService) {
		super();
		const mail = config.mail;
		this.from = mail.from;
		this.transporter = createTransport({
			host: mail.host,
			port: mail.port,
			secure: mail.port === IMPLICIT_TLS_PORT,
			auth: { user: mail.user, pass: mail.password },
			// Hết giờ chờ để một máy chủ SMTP treo không giữ kết nối mãi.
			connectionTimeout: CONNECTION_TIMEOUT_MS,
			greetingTimeout: CONNECTION_TIMEOUT_MS,
			socketTimeout: SOCKET_TIMEOUT_MS,
		});
	}

	async send(message: MailMessage): Promise<void> {
		await this.transporter.sendMail({
			from: this.from,
			to: message.to,
			subject: message.subject,
			text: message.text,
			html: message.html,
		});
	}
}
