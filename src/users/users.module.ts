import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
	controllers: [UsersController, ProfileController],
	providers: [UsersService, UsersRepository],
	exports: [UsersService],
})
export class UsersModule {}
