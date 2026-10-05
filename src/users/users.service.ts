import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../common/enums/role.enum';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.usersRepository.create({
      email: normalizeEmail(dto.email),
      passwordHash,
      name: dto.name?.trim() || null,
      roles: dto.roles?.length ? dto.roles : [Role.TENANT],
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmailWithPassword(normalizeEmail(email));
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }
}
