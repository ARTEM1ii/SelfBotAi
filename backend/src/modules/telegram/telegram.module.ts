import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramSession } from './entities/telegram-session.entity';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([TelegramSession]), AiModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule implements OnApplicationBootstrap {
  constructor(private readonly telegramService: TelegramService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.telegramService.restoreActiveSessions();
  }
}
