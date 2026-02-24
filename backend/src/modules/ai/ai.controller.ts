import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
