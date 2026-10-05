import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export type NewUser = Pick<User, 'email' | 'passwordHash' | 'name' | 'roles'>;

/** Nơi duy nhất của module users chạm vào TypeORM (spec 0001 con). */
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  create(input: NewUser): Promise<User> {
    return this.repository.save(this.repository.create(input));
  }

  /** `passwordHash` mặc định không được chọn; chỉ đăng nhập mới cần đọc nó. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }
}
