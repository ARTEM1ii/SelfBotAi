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

  /**
   * Find alternative products in the same category (first word of name),
   * excluding given product IDs, sorted by price.
   */
  async findAlternatives(
    referenceProducts: Product[],
    excludeIds: string[],
    options?: { maxPrice?: number; minPrice?: number },
    limit: number = 5,
  ): Promise<Product[]> {
    if (referenceProducts.length === 0) return [];

    // Extract categories (first word of product name, lowercased)
    const categories = [
      ...new Set(
        referenceProducts
          .map((p) => p.name.split(/\s+/)[0]?.toLowerCase())
          .filter((c): c is string => !!c && c.length >= 3),
      ),
    ];

    if (categories.length === 0) return [];

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images');

    // Match any of the categories by first word
    const conditions = categories.map((_, i) => `LOWER(product.name) LIKE :cat${i}`);
    const params: Record<string, string | number> = {};
    categories.forEach((cat, i) => {
      params[`cat${i}`] = `${cat}%`;
    });

    qb.where(`(${conditions.join(' OR ')})`, params);

    if (excludeIds.length > 0) {
      qb.andWhere('product.id NOT IN (:...excludeIds)', { excludeIds });
    }

    if (options?.maxPrice !== undefined) {
      qb.andWhere('product.price < :maxPrice', { maxPrice: options.maxPrice });
    }
    if (options?.minPrice !== undefined) {
      qb.andWhere('product.price > :minPrice', { minPrice: options.minPrice });
    }

    qb.andWhere('product.quantity > 0');
    qb.orderBy('product.price', options?.maxPrice ? 'DESC' : 'ASC');
    qb.take(limit);

    return qb.getMany();
  }

  /**
   * Keyword-based fallback search: finds products whose name contains any
   * of the significant words from the query (case-insensitive, ILIKE).
   */
  async searchByKeyword(query: string, limit: number = 5): Promise<Product[]> {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    if (words.length === 0) return [];

    // Crude Russian stemming: strip common noun/adj endings to match word roots.
    // "тумбу"→"тумб", "тумбочку"→"тумбочк", "диваны"→"диван"
    // Longest suffixes first so regex alternation matches greedily
    const stems = words.map((w) =>
      w.replace(/(очку|очка|очек|очки|ками|ями|ами|ого|его|ому|ему|чку|чка|чки|чек|ов|ев|ей|ах|ях|ом|ем|ой|ию|ью|ие|ые|ую|ых|их|ок|ек|ку|ка|ки|ы|у|а|е|и|о|ь|й)$/, '') || w,
    ).filter((s) => s.length >= 3);
    if (stems.length === 0) return [];

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images');

    const conditions = stems.map((_, i) => `LOWER(product.name) LIKE :kw${i}`);
    const params: Record<string, string> = {};
    stems.forEach((s, i) => {
      params[`kw${i}`] = `%${s}%`;
    });

    qb.where(`(${conditions.join(' OR ')})`, params);
    qb.take(limit);

    return qb.getMany();
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
