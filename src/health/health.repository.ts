import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Nơi duy nhất của module chạm database: một câu `SELECT 1` để biết kết nối còn sống. */
@Injectable()
export class HealthRepository {
	constructor(private readonly prisma: PrismaService) {}

	async ping(): Promise<void> {
		await this.prisma.$queryRaw`SELECT 1`;
	}
}
