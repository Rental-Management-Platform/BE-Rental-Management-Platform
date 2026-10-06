import { Injectable } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { Prisma, User } from '../generated/prisma/client';
import { UsersRepository } from './users.repository';
import type { UserWithoutPassword } from './users.repository';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Mật khẩu đã được băm bởi AuthService (PasswordHasher); service này không băm. */
export interface NewUserInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string | null;
}

/** Luật nghiệp vụ của "người dùng": chuẩn hóa email, tạo, tìm. */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  create(
    input: NewUserInput,
    tx?: Prisma.TransactionClient,
  ): Promise<UserWithoutPassword> {
    return this.usersRepository.create(
      {
        email: normalizeEmail(input.email),
        passwordHash: input.passwordHash,
        name: input.name?.trim() || null,
        roles: [Role.TENANT], // tự đăng ký chỉ được vai trò thấp nhất; spec 0003 thay bằng bảng vai trò
      },
      tx,
    );
  }

  /** Tên nói rõ nó trả dữ liệu nhạy cảm (`passwordHash`); chỉ đăng nhập và đăng ký cần. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailWithPassword(normalizeEmail(email));
  }

  findById(id: string): Promise<UserWithoutPassword | null> {
    return this.usersRepository.findById(id);
  }
}
