import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import {
  SendCodeDto,
  ToggleAutoReplyDto,
  VerifyCodeDto,
  VerifyPasswordDto,
} from './dto/connect-telegram.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('send-code')
  @ApiOperation({ summary: 'Start Telegram auth — send SMS code' })
  @ApiResponse({ status: 201, description: 'Code sent' })
  sendCode(
    @Body() dto: SendCodeDto,
    @CurrentUser() user: User,
  ): Promise<{ status: string }> {
    return this.telegramService.sendCode(user.id, dto);
  }

  @Post('verify-code')
  @ApiOperation({ summary: 'Verify SMS code' })
  @ApiResponse({ status: 200 })
  @HttpCode(HttpStatus.OK)
  verifyCode(
    @Body() dto: VerifyCodeDto,
    @CurrentUser() user: User,
  ): Promise<{ status: string }> {
    return this.telegramService.verifyCode(user.id, dto);
  }

  @Post('verify-password')
  @ApiOperation({ summary: 'Verify 2FA password' })
  @ApiResponse({ status: 200 })
  @HttpCode(HttpStatus.OK)
  verifyPassword(
    @Body() dto: VerifyPasswordDto,
    @CurrentUser() user: User,
  ): Promise<{ status: string }> {
    return this.telegramService.verifyPassword(user.id, dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get Telegram connection status' })
  getStatus(@CurrentUser() user: User) {
    return this.telegramService.getStatus(user.id);
  }

  @Patch('auto-reply')
  @ApiOperation({ summary: 'Toggle auto-reply on/off' })
  toggleAutoReply(
    @Body() dto: ToggleAutoReplyDto,
    @CurrentUser() user: User,
  ) {
    return this.telegramService.toggleAutoReply(user.id, dto.enabled);
  }

  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect Telegram session' })
  disconnect(@CurrentUser() user: User): Promise<{ status: string }> {
    return this.telegramService.disconnect(user.id);
  }
}
