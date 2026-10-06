import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '../enums/role.enum';

/** Người gọi, rút ra từ access token (JwtStrategy.validate). */
export interface RequestUser {
  userId: string;
  sessionId: string;
  roles: Role[];
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: RequestUser }>();
    return request.user;
  },
);
