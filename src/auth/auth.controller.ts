import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	Res,
	UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticatedOnly } from '../common/auth/authenticated-only.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import type { RequestUser } from '../common/http/authenticated-request';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { AppConfigService } from '../config/app-config.service';
import { AuthService } from './auth.service';
import type { ClientInfo } from './auth.service';
import type {
	MeResponse,
	MessageResponse,
	RegisterResponse,
	TokenResponse,
} from './dto/auth.response';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OriginGuard } from './guards/origin.guard';
import { PasswordService } from './password.service';
import {
	clearRefreshCookie,
	readRefreshCookie,
	setRefreshCookie,
} from './refresh-cookie';

/** Cùng một câu cho mọi email, kể cả email không có tài khoản (spec 0002 AC-8). */
const FORGOT_PASSWORD_MESSAGE =
	'Nếu email này có tài khoản, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.';

function clientInfo(req: Request): ClientInfo {
	return { userAgent: req.header('user-agent') ?? null, ip: req.ip ?? null };
}

/**
 * Phần HTTP của đăng nhập: nhận request, gọi đúng một phương thức service, đặt hoặc xóa
 * cookie, trả JSON. `refresh` và `logout` là `@Public()` vì xác thực bằng cookie (lúc refresh thì
 * access token đã hết hạn), thay vào đó có OriginGuard chống CSRF.
 */
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly passwordService: PasswordService,
		private readonly config: AppConfigService,
	) {}

	@Public()
	@RateLimited('register')
	@Post('register')
	async register(
		@Body() dto: RegisterDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<RegisterResponse> {
		const { refreshToken, accessToken, expiresIn, user } =
			await this.authService.register(dto, clientInfo(req), new Date());
		this.writeRefreshCookie(res, refreshToken);
		return { accessToken, expiresIn, user };
	}

	@Public()
	@RateLimited('login')
	@HttpCode(HttpStatus.OK)
	@Post('login')
	async login(
		@Body() dto: LoginDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<TokenResponse> {
		const { refreshToken, accessToken, expiresIn } =
			await this.authService.login(dto, clientInfo(req));
		this.writeRefreshCookie(res, refreshToken);
		return { accessToken, expiresIn };
	}

	@Public()
	@RateLimited('refresh')
	@UseGuards(OriginGuard)
	@HttpCode(HttpStatus.OK)
	@Post('refresh')
	async refresh(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<TokenResponse> {
		const { refreshToken, accessToken, expiresIn } =
			await this.authService.refresh(
				readRefreshCookie(req, this.config.auth),
			);
		this.writeRefreshCookie(res, refreshToken); // undefined (ân hạn) thì không đụng tới cookie
		return { accessToken, expiresIn };
	}

	@Public()
	@UseGuards(OriginGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('logout')
	async logout(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<void> {
		await this.authService.logout(readRefreshCookie(req, this.config.auth));
		clearRefreshCookie(res, this.config.auth);
	}

	@AuthenticatedOnly()
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('logout-all')
	async logoutAll(
		@CurrentUser() user: RequestUser,
		@Res({ passthrough: true }) res: Response,
	): Promise<void> {
		await this.authService.logoutAll(user.userId);
		clearRefreshCookie(res, this.config.auth);
	}

	@Public()
	@RateLimited('forgotPassword')
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('forgot-password')
	async forgotPassword(
		@Body() dto: ForgotPasswordDto,
	): Promise<MessageResponse> {
		await this.passwordService.forgotPassword(dto.email);
		return { message: FORGOT_PASSWORD_MESSAGE };
	}

	@Public()
	@RateLimited('resetPassword')
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('reset-password')
	async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
		await this.passwordService.resetPassword(dto.token, dto.newPassword);
	}

	/** Giữ phiên và cookie hiện tại; chỉ các phiên khác bị hủy. */
	@AuthenticatedOnly()
	@RateLimited('changePassword')
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('change-password')
	async changePassword(
		@Body() dto: ChangePasswordDto,
		@CurrentUser() user: RequestUser,
	): Promise<void> {
		await this.passwordService.changePassword({
			userId: user.userId,
			sessionId: user.sessionId,
			currentPassword: dto.currentPassword,
			newPassword: dto.newPassword,
		});
	}

	@AuthenticatedOnly()
	@Get('me')
	getMe(@CurrentUser() user: RequestUser): Promise<MeResponse> {
		return this.authService.getMe(user.userId);
	}

	private writeRefreshCookie(res: Response, token: string | undefined): void {
		if (token !== undefined) setRefreshCookie(res, token, this.config.auth);
	}
}
