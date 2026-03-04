import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Арматура А500С' })
  @IsString()
  readonly name: string;

  @ApiPropertyOptional({ example: 'Арматура стальная рифлёная' })
  @IsOptional()
  @IsString()
  readonly description?: string;

  @ApiPropertyOptional({ example: '12мм x 6м' })
  @IsOptional()
  @IsString()
  readonly length?: string;

  @ApiProperty({ example: 450.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly price: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly quantity: number;
}
