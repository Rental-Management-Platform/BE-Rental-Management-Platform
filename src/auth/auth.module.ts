import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountTypesModule } from '../account-types/account-types.module';
import { AppThrottlerGuard } from '../common/rate-limit/app-throttler.guard';
import { RATE_LIMIT_OPTIONS } from '../common/rate-limit/rate-limit.options';
import { AppConfigService } from '../config/app-config.service';
import { MailModule } from '../mail/mail.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { AuthSessionsRepository } from './auth-sessions.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OriginGuard } from './guards/origin.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PasswordHasher } from './password-hasher';
import { PasswordResetsRepository } from './password-resets.repository';
import { PasswordService } from './password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
	imports: [
		UsersModule,
		AccountTypesModule,
		MailModule,
		MembershipsModule,
		PassportModule,
		ThrottlerModule.forRoot(RATE_LIMIT_OPTIONS),
		JwtModule.registerAsync({
			inject: [AppConfigService],
			useFactory: (config: AppConfigService) => ({
				secret: config.auth.accessSecret,
				signOptions: {
					algorithm: 'HS256',
					expiresIn: config.auth.accessTtlSeconds,
					issuer: config.auth.issuer,
					audience: config.auth.audience,
				},
			}),
		}),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		PasswordService,
		AuthSessionsRepository,
		PasswordResetsRepository,
		TokenService,
		PasswordHasher,
		JwtStrategy,
		OriginGuard,
		// Ba cổng toàn cục, đúng thứ tự: xác thực, kiểm quyền (spec 0003 AC-4), rồi giới hạn tần suất
		// (spec 0002 AC-10). Giới hạn đứng cuối để route cần đăng nhập đã có `req.user` cho khóa theo người dùng.
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
		{ provide: APP_GUARD, useClass: PermissionsGuard },
		{ provide: APP_GUARD, useClass: AppThrottlerGuard },
	],
	exports: [AuthSessionsRepository],
})
export class AuthModule {}
