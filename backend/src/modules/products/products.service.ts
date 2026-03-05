import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AiService } from '../ai/ai.service';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'products');

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly imageRepo: Repository<ProductImage>,
    private readonly aiService: AiService,
  ) {}

  async create(
    userId: string,
    dto: CreateProductDto,
    imageFiles?: Express.Multer.File[],
  ): Promise<Product> {
    const product = this.productRepo.create({
      ...dto,
      userId,
      imagePath: imageFiles?.length ? imageFiles[0].filename : null,
    });

    const saved = await this.productRepo.save(product);

    if (imageFiles?.length) {
      const images = imageFiles.map((file, i) =>
        this.imageRepo.create({
          productId: saved.id,
          filename: file.filename,
          sortOrder: i,
        }),
      );
      saved.images = await this.imageRepo.save(images);
    }

    // Generate embeddings in background
    this.generateEmbeddings(saved).catch((err) =>
      this.logger.error(`Failed to generate embeddings for product ${saved.id}`, err),
    );

    return saved;
  }

  async findAll(search?: string): Promise<Product[]> {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .orderBy('product.createdAt', 'DESC');

    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.where(
        'LOWER(product.name) LIKE :term OR LOWER(product.description) LIKE :term',
        { term },
      );
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['images'],
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return this.productRepo.find({
      where: { id: In(ids) },
      relations: ['images'],
    });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    imageFiles?: Express.Multer.File[],
  ): Promise<Product> {
    const product = await this.findOne(id);

    Object.assign(product, dto);

    if (imageFiles?.length) {
      // Add new images with sort order continuing from existing
      const maxOrder = product.images?.length
        ? Math.max(...product.images.map((img) => img.sortOrder))
        : -1;

      const newImages = imageFiles.map((file, i) =>
        this.imageRepo.create({
          productId: product.id,
          filename: file.filename,
          sortOrder: maxOrder + 1 + i,
        }),
      );
      const savedImages = await this.imageRepo.save(newImages);
      product.images = [...(product.images ?? []), ...savedImages];

      // Update imagePath to the first image
      if (!product.imagePath) {
        product.imagePath = product.images[0]?.filename ?? null;
      }
    }

    const saved = await this.productRepo.save(product);

    // Re-generate embeddings in background
    this.generateEmbeddings(saved).catch((err) =>
      this.logger.error(`Failed to update embeddings for product ${saved.id}`, err),
    );

    return saved;
  }

  async deleteImage(id: string, imageId?: string): Promise<Product> {
    const product = await this.findOne(id);

    if (imageId) {
      // Delete specific image
      const image = product.images?.find((img) => img.id === imageId);
      if (image) {
        this.removeFile(image.filename);
        await this.imageRepo.remove(image);
        product.images = product.images.filter((img) => img.id !== imageId);
      }
    } else {
      // Delete all images (backward compat)
      if (product.images?.length) {
        for (const img of product.images) {
          this.removeFile(img.filename);
        }
        await this.imageRepo.remove(product.images);
        product.images = [];
      }
      // Also clean old imagePath file if it exists but no image record
      if (product.imagePath) {
        this.removeFile(product.imagePath);
      }
    }

    // Sync imagePath with first remaining image
    product.imagePath = product.images?.[0]?.filename ?? null;
    return this.productRepo.save(product);
  }

  async delete(id: string): Promise<void> {
    const product = await this.findOne(id);

    // Delete all image files
    if (product.images?.length) {
      for (const img of product.images) {
        this.removeFile(img.filename);
      }
    }
    if (product.imagePath) {
      this.removeFile(product.imagePath);
    }

    // Delete embeddings
    this.aiService.deleteProductEmbedding(product.id).catch((err) =>
      this.logger.warn(`Failed to delete embeddings for product ${product.id}`, err),
    );

    await this.productRepo.remove(product);
  }

  private removeFile(filename: string): void {
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private async generateEmbeddings(product: Product): Promise<void> {
    const imagePath = product.imagePath
      ? path.join(UPLOADS_DIR, product.imagePath)
      : undefined;

    await this.aiService.embedProduct(
      product.id,
      product.name,
      product.description ?? '',
      imagePath,
    );
  }
}
