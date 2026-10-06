import { Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/** Mức tối thiểu OWASP cho argon2id. Thuật toán mặc định của thư viện là argon2id. */
const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	parallelism: 1,
} as const;

/**
 * Băm và kiểm mật khẩu sau một giao diện nhỏ; đổi thư viện chỉ sửa file này (spec 0002: nếu
 * argon2 không chạy được trên một môi trường thì quay về bcrypt cost 12).
 */
@Injectable()
export class PasswordHasher implements OnModuleInit {
	/** Bản băm giả để đăng nhập email không tồn tại cũng tốn thời gian như email có thật. */
	private dummyHash = '';

	async onModuleInit(): Promise<void> {
		this.dummyHash = await this.hash(
			'mat-khau-gia-chi-de-can-bang-thoi-gian',
		);
	}

	hash(password: string): Promise<string> {
		return hash(password, ARGON2_OPTIONS);
	}

	async verify(passwordHash: string, password: string): Promise<boolean> {
		try {
			return await verify(passwordHash, password);
		} catch {
			return false; // bản băm hỏng hoặc không đúng định dạng: coi như sai mật khẩu
		}
	}

	/** Luôn chạy một lần băm đầy đủ rồi trả `false`. Dùng khi không tìm thấy người dùng. */
	async verifyDummy(password: string): Promise<false> {
		await this.verify(this.dummyHash, password);
		return false;
	}
}
