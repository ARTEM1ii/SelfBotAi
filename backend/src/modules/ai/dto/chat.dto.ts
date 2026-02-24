import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Max,
  Min,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConversationMessageDto {
  @ApiProperty({ example: 'user', enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  readonly role: 'user' | 'assistant';

  @ApiProperty({ example: 'Hello!' })
  @IsString()
  readonly content: string;
}

export class ChatDto {
  @ApiProperty({ example: 'What do you know about me?' })
  @IsString()
  readonly message: string;

  @ApiPropertyOptional({ type: [ConversationMessageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  readonly conversationHistory?: ConversationMessageDto[];

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  readonly topK?: number;
}

export class ChatResponseDto {
  @ApiProperty({ example: 'Here is what I know...' })
  readonly reply: string;

  @ApiProperty({ example: 3 })
  readonly sourcesCount: number;
}
