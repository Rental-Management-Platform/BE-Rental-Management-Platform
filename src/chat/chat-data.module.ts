import { Module } from '@nestjs/common';
import { ChatRepository } from './chat.repository';

/**
 * Chỉ giữ `ChatRepository`. Tách khỏi `ChatModule` để `ReviewsModule` kiểm điều kiện "chủ trọ đã trả lời" (spec 0014
 * AC-4) mà không import cả module chat, theo tiền lệ `FavoritesDataModule` và `ListingsDataModule`. `ChatRepository`
 * vẫn là nơi duy nhất chạm hai bảng `conversations` và `messages`.
 */
@Module({
	providers: [ChatRepository],
	exports: [ChatRepository],
})
export class ChatDataModule {}
