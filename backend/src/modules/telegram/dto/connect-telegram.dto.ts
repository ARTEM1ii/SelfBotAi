import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsPhoneNumber,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class SaveCredentialsDto {
  @ApiProperty({ example: 12345678, description: 'Telegram API ID from my.telegram.org' })
  @IsInt()
  @Min(1)
  readonly apiId: number;

  @ApiProperty({ example: 'abc123def456...', description: 'Telegram API Hash from my.telegram.org' })
  @IsString()
  @MinLength(10)
  readonly apiHash: string;
}

export class SendCodeDto {
  @ApiProperty({ example: '+79001234567' })
  @IsPhoneNumber()
  readonly phone: string;
}

export class VerifyCodeDto {
  @ApiProperty({ example: '12345' })
  @IsString()
  @MinLength(4)
  readonly code: string;
}

export class VerifyPasswordDto {
  @ApiProperty({ example: 'mypassword' })
  @IsString()
  @MinLength(1)
  readonly password: string;
}

export class ToggleAutoReplyDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  readonly enabled: boolean;
}
