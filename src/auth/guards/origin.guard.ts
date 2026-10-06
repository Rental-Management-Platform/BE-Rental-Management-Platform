import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Chống CSRF cho hai endpoint chạy bằng cookie (`/auth/refresh`, `/auth/logout`): có header
 * `Origin` mà không nằm trong ALLOWED_ORIGINS thì bị chặn. Không có `Origin` nghĩa là không
 * phải trình duyệt (curl, server) nên không có nguy cơ CSRF. Gắn bằng `@UseGuards` trên đúng
 * hai route, không đăng ký toàn cục.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const origin = context
      .switchToHttp()
      .getRequest<Request>()
      .header('origin');
    if (origin === undefined) return true;
    if (this.config.allowedOrigins.includes(origin)) return true;
    throw new AppException(ErrorCode.ORIGIN_NOT_ALLOWED);
  }
}
