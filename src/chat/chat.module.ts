import { Module } from '@nestjs/common';
import { ListingsDataModule } from '../listings/listings-data.module';
import { SettingsModule } from '../settings/settings.module';
import {
	ConversationsController,
	ListingConversationsController,
	MeConversationsController,
} from './chat.controller';
import { ChatDataModule } from './chat-data.module';
import { ChatService } from './chat.service';

/** Chat giữa người tìm trọ và chủ trọ (spec 0013). `ChatRepository` đến từ `ChatDataModule` (spec 0014 dùng chung). */
@Module({
	imports: [ChatDataModule, ListingsDataModule, SettingsModule],
	controllers: [
		ListingConversationsController,
		ConversationsController,
		MeConversationsController,
	],
	providers: [ChatService],
})
export class ChatModule {}
