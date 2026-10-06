import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfigService } from '../config/app-config.service';
import type { DatabaseSettings } from '../config/app-config.service';
import { PrismaClient } from '../generated/prisma/client';
import { buildDatabaseUrl } from './build-database-url';

const CONNECT_ATTEMPTS = 10;
const CONNECT_RETRY_DELAY_MS = 3_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Adapter `pg` của Prisma: pool có hạn kết nối (mặc định của `pg` không có) và múi giờ UTC. */
function createAdapter(settings: DatabaseSettings): PrismaPg {
  return new PrismaPg({
    connectionString: buildDatabaseUrl(settings),
    max: settings.poolMax,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: 'rental-api',
    options: '-c timezone=UTC',
  });
}

/**
 * Nơi duy nhất tạo kết nối Prisma. Chỉ `*.repository.ts` và `src/common/persistence/**`
 * được inject lớp này (spec 0001 con).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    super({ adapter: createAdapter(config.database) });
  }

  /** Thử kết nối lại khi khởi động, phòng trường hợp DB chưa sẵn sàng (spec 0005). */
  async onModuleInit(): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        return;
      } catch (error: unknown) {
        if (attempt >= CONNECT_ATTEMPTS) throw error;
        this.logger.warn(
          `Chưa kết nối được database (lần ${attempt}/${CONNECT_ATTEMPTS}), thử lại sau ${CONNECT_RETRY_DELAY_MS / 1000} giây.`,
        );
        await delay(CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
