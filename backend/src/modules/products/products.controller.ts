import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

const PRODUCTS_UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'products');

const multerStorage = diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(PRODUCTS_UPLOADS_DIR)) {
      fs.mkdirSync(PRODUCTS_UPLOADS_DIR, { recursive: true });
    }
    cb(null, PRODUCTS_UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a product' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Product created' })
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: multerStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: User,
    @UploadedFiles() images?: Express.Multer.File[],
  ): Promise<Product> {
    return this.productsService.create(user.id, dto, images);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all products (optional ?search= filter)' })
  @ApiResponse({ status: 200, description: 'List of products' })
  findAll(@Query('search') search?: string): Promise<Product[]> {
    return this.productsService.findAll(search);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get product by id' })
  @ApiResponse({ status: 200, description: 'Product data' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.findOne(id);
  }

  @Get(':id/image')
  @ApiOperation({ summary: 'Serve product image (public, first image or by imageId query)' })
  @ApiResponse({ status: 200, description: 'Image file' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async getImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('imageId') imageId: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const product = await this.productsService.findOne(id);

    let filename: string | null = null;

    if (imageId) {
      const img = product.images?.find((i) => i.id === imageId);
      filename = img?.filename ?? null;
    } else {
      // First image from images array, fallback to imagePath
      filename = product.images?.[0]?.filename ?? product.imagePath;
    }

    if (!filename) {
      res.status(404).json({ message: 'No image for this product' });
      return;
    }

    const filePath = path.join(PRODUCTS_UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'Image file not found' });
      return;
    }

    res.sendFile(filePath);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a product' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Product updated' })
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: multerStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() images?: Express.Multer.File[],
  ): Promise<Product> {
    return this.productsService.update(id, dto, images);
  }

  @Delete(':id/image')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete product image (all or specific by imageId query param)' })
  @ApiResponse({ status: 200, description: 'Image deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('imageId') imageId?: string,
  ): Promise<Product> {
    return this.productsService.deleteImage(id, imageId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 204, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productsService.delete(id);
  }
}
