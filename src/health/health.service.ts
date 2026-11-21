import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { HealthRepository } from './health.repository';

/** Quá hạn này mà database chưa trả lời thì coi như không khả dụng (nhỏ hơn `timeout` của HEALTHCHECK trong Dockerfile). */
export const HEALTH_DB_TIMEOUT_MS = 3_000;

export interface HealthResponse {
	readonly status: 'ok';
}

@Injectable()
export class HealthService {
	private readonly logger = new Logger(HealthService.name);

	constructor(private readonly repository: HealthRepository) {}

	/** Còn trả lời và database còn kết nối được thì `{ status: 'ok' }`, ngược lại 503 `DB_UNAVAILABLE`. Không lộ chi tiết lỗi. */
	async check(): Promise<HealthResponse> {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<never>((_resolve, reject) => {
			timer = setTimeout(
				() => reject(new Error('ping database quá hạn')),
				HEALTH_DB_TIMEOUT_MS,
			);
		});
		try {
			await Promise.race([this.repository.ping(), timeout]);
			return { status: 'ok' };
		} catch (error: unknown) {
			this.logger.error(
				'Kiểm tra sức khỏe: database không trả lời',
				error instanceof Error ? error.message : String(error),
			);
			throw new AppException(ErrorCode.DB_UNAVAILABLE);
		} finally {
			clearTimeout(timer);
		}
	}
}
