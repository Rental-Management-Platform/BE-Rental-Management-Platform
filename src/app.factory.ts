import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/errors/create-validation-pipe';
import { requestIdMiddleware } from './common/errors/request-id.middleware';
import { AppConfigService } from './config/app-config.service';

/** Áp mọi cấu hình lên một app đã tạo; `main.ts` và test e2e cùng dùng. */
export function configureApp(app: NestExpressApplication): void {
	app.use(requestIdMiddleware); // phải trước bộ đọc JSON để lỗi JSON hỏng cũng có requestId
	app.useBodyParser('json', { limit: '100kb' });
	app.use(cookieParser()); // đọc refresh token trong cookie
	app.setGlobalPrefix('api');
	app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
	app.useGlobalPipes(createValidationPipe());

	const config = app.get(AppConfigService);
	app.set('trust proxy', config.trustProxyHops); // req.ip là IP thật của client khi sau proxy
	app.enableCors({ origin: [...config.allowedOrigins], credentials: true }); // credentials: để cookie refresh đi kèm
}

export async function createApp(): Promise<NestExpressApplication> {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	configureApp(app);
	return app;
}
