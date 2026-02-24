import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, MinLength } from 'class-validator';

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
  readonly enabled: boolean;
}
