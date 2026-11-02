import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 50;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** P2034: xung đột ghi hoặc deadlock, thử lại được. */
function isWriteConflict(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === 'P2034'
	);
}

/** Thời hạn giao dịch (ms) mà nơi gọi muốn khác mặc định của Prisma (5000 ms chạy, 2000 ms chờ kết nối). */
export interface TransactionOptions {
	/** Giao dịch chạy tối đa bao lâu trước khi bị hủy. */
	readonly timeout?: number;
	/** Chờ lấy kết nối từ pool tối đa bao lâu. */
	readonly maxWait?: number;
}

/**
 * Chạy `fn` trong một giao dịch ReadCommitted (spec 0005). Gặp P2034 thì thử lại tối đa 3 lần
 * với độ trễ tăng dần; hết lần thử thì ném DB_UNAVAILABLE. Repository nhận `tx` rõ ràng, không
 * truyền giao dịch ngầm qua ngữ cảnh bất đồng bộ. `options` chỉ để nơi gọi nào thật sự giữ giao dịch lâu
 * (spec 0011: ghi tệp ảnh khi đang giữ khóa) nới thời hạn; vắng thì dùng mặc định của Prisma như mọi nơi khác.
 */
@Injectable()
export class TransactionRunner {
	constructor(private readonly prisma: PrismaService) {}

	async run<T>(
		fn: (tx: Prisma.TransactionClient) => Promise<T>,
		options: TransactionOptions = {},
	): Promise<T> {
		for (let attempt = 1; ; attempt += 1) {
			try {
				return await this.prisma.$transaction(fn, {
					isolationLevel:
						Prisma.TransactionIsolationLevel.ReadCommitted,
					...options,
				});
			} catch (error: unknown) {
				if (!isWriteConflict(error)) throw error;
				if (attempt >= MAX_ATTEMPTS) {
					throw new AppException(ErrorCode.DB_UNAVAILABLE, [], {
						cause: error,
					});
				}
				await delay(BASE_DELAY_MS * attempt);
			}
		}
	}
}
