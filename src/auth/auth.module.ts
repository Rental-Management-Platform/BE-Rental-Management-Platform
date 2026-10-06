import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '../config/app-config.service';
import { UsersModule } from '../users/users.module';
import { AuthSessionsRepository } from './auth-sessions.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OriginGuard } from './guards/origin.guard';
import { PasswordHasher } from './password-hasher';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
	imports: [
		UsersModule,
		PassportModule,
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
		AuthSessionsRepository,
		TokenService,
		PasswordHasher,
		JwtStrategy,
		OriginGuard,
	],
})
export class AuthModule {}
