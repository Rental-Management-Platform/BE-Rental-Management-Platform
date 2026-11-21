import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/errors/create-validation-pipe';
import { requestIdMiddleware } from './common/errors/request-id.middleware';
import { AppConfigService } from './config/app-config.service';

/** Áp mọi cấu hình lên một app đã tạo; `main.ts` và test e2e cùng dùng. */
export function configureApp(app: NestExpressApplication): void {
	// Header bảo mật mặc định của helmet, và bỏ `X-Powered-By`. `cross-origin` cho Cross-Origin-Resource-Policy: mặc
	// định `same-origin` sẽ chặn thẻ <img> của FE ở origin khác (ví dụ localhost:5173 khi dev) tải ảnh `/media/public`.
	app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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
