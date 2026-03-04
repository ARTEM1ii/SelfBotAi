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

  @ApiPropertyOptional({ example: '12мм' })
  @IsOptional()
  @IsString()
  readonly width?: string;

  @ApiPropertyOptional({ example: '6мм' })
  @IsOptional()
  @IsString()
  readonly height?: string;

  @ApiPropertyOptional({ example: '6м' })
  @IsOptional()
  @IsString()
  readonly depth?: string;

  @ApiPropertyOptional({ example: '5кг' })
  @IsOptional()
  @IsString()
  readonly weight?: string;

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
