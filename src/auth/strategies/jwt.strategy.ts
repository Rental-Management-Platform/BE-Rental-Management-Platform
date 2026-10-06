import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { AppConfigService } from '../../config/app-config.service';
import { isAccessTokenClaims } from '../auth.types';

/**
 * Xác minh access token mỗi request, không đọc DB. Chỉ nhận đúng HS256 (chống tấn công đổi
 * thuật toán), đúng issuer và audience, và không bao giờ bỏ qua hạn.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.auth.accessSecret,
      algorithms: ['HS256'],
      issuer: config.auth.issuer,
      audience: config.auth.audience,
    });
  }

  /** Chạy SAU khi chữ ký, hạn, iss, aud đã đúng. Giá trị trả về trở thành request.user. */
  validate(payload: unknown): RequestUser {
    if (!isAccessTokenClaims(payload)) {
      throw new AppException(ErrorCode.TOKEN_INVALID);
    }
    return {
      userId: payload.sub,
      sessionId: payload.sid,
      roles: [...payload.roles],
    };
  }
}
