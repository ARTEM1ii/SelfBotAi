import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ChatHistory } from './entities/chat-history.entity';
import { TelegramConversation } from '../telegram/entities/telegram-conversation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatHistory, TelegramConversation])],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
