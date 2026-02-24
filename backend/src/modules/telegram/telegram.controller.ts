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
  SaveCredentialsDto,
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

  @Post('credentials')
  @ApiOperation({
    summary: 'Save Telegram API credentials (step 1)',
    description: 'User provides their own API ID and API Hash from my.telegram.org',
  })
  @ApiResponse({ status: 201, description: 'Credentials saved' })
  saveCredentials(
    @Body() dto: SaveCredentialsDto,
    @CurrentUser() user: User,
  ): Promise<{ status: string }> {
    return this.telegramService.saveCredentials(user.id, dto);
  }

  @Post('send-code')
  @ApiOperation({
    summary: 'Send SMS verification code (step 2)',
    description: 'Requires credentials to be saved first',
  })
  @ApiResponse({ status: 201, description: 'Code sent to phone' })
  sendCode(
    @Body() dto: SendCodeDto,
    @CurrentUser() user: User,
  ): Promise<{ status: string }> {
    return this.telegramService.sendCode(user.id, dto);
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify SMS code (step 3)' })
  @ApiResponse({ status: 200, description: 'Connected or password required' })
  verifyCode(
    @Body() dto: VerifyCodeDto,
    @CurrentUser() user: User,
  ): Promise<{ status: string }> {
    return this.telegramService.verifyCode(user.id, dto);
  }

  @Post('verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA password (step 4, if required)' })
  @ApiResponse({ status: 200, description: 'Connected' })
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
  @ApiOperation({ summary: 'Toggle AI auto-reply on/off' })
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
