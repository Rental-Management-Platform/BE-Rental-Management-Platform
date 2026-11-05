import { Module } from '@nestjs/common';
import { ListingsDataModule } from '../listings/listings-data.module';
import { SettingsModule } from '../settings/settings.module';
import {
	ConversationsController,
	ListingConversationsController,
	MeConversationsController,
} from './chat.controller';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';

/** Chat giữa người tìm trọ và chủ trọ (spec 0013). */
@Module({
	imports: [ListingsDataModule, SettingsModule],
	controllers: [
		ListingConversationsController,
		ConversationsController,
		MeConversationsController,
	],
	providers: [ChatService, ChatRepository],
})
export class ChatModule {}
