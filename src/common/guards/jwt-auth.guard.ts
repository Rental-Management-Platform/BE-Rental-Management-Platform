import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';

function toAuthException(info: unknown): AppException {
  if (info instanceof Error) {
    if (info.name === 'TokenExpiredError') {
      return new AppException(ErrorCode.TOKEN_EXPIRED);
    }
    if (info.message === 'No auth token') {
      return new AppException(ErrorCode.TOKEN_MISSING);
    }
  }
  return new AppException(ErrorCode.TOKEN_INVALID); // sai chữ ký, token hỏng, JsonWebTokenError...
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser>(
    err: unknown,
    user: TUser | false | null | undefined,
    info: unknown,
  ): TUser {
    if (err !== null && err !== undefined) {
      // lỗi ném từ JwtStrategy.validate
      throw err instanceof Error
        ? err
        : new AppException(ErrorCode.TOKEN_INVALID);
    }
    if (user === false || user === null || user === undefined) {
      throw toAuthException(info);
    }
    return user;
  }
}
