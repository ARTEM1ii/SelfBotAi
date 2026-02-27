import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto, ChatResponseDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ChatHistory } from './entities/chat-history.entity';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get chat history for current user' })
  @ApiResponse({ status: 200, type: [ChatHistory] })
  getHistory(@CurrentUser() user: User): Promise<ChatHistory[]> {
    return this.aiService.getHistory(user.id);
  }

  @Delete('history')
  @ApiOperation({ summary: 'Clear chat history for current user' })
  @ApiResponse({ status: 200 })
  async clearHistory(@CurrentUser() user: User): Promise<{ ok: boolean }> {
    await this.aiService.clearHistory(user.id);
    return { ok: true };
  }

  @Post('chat')
  @ApiOperation({ summary: 'Send a message to AI assistant' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  @ApiResponse({ status: 503, description: 'AI service unavailable' })
  chat(
    @Body() dto: ChatDto,
    @CurrentUser() user: User,
  ): Promise<ChatResponseDto> {
    return this.aiService.chat(user.id, dto);
  }
}
