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
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly aiService: AiService,
  ) {}

  async create(
    userId: string,
    dto: CreateProductDto,
    imageFile?: Express.Multer.File,
  ): Promise<Product> {
    const product = this.productRepo.create({
      ...dto,
      userId,
      imagePath: imageFile ? imageFile.filename : null,
    });

    const saved = await this.productRepo.save(product);

    // Generate embeddings in background
    this.generateEmbeddings(saved).catch((err) =>
      this.logger.error(`Failed to generate embeddings for product ${saved.id}`, err),
    );

    return saved;
  }

  async findAll(): Promise<Product[]> {
    return this.productRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    return this.productRepo.find({ where: { id: In(ids) } });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    imageFile?: Express.Multer.File,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Delete old image if new one is uploaded
    if (imageFile && product.imagePath) {
      const oldPath = path.join(process.cwd(), 'uploads', 'products', product.imagePath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    Object.assign(product, dto);
    if (imageFile) {
      product.imagePath = imageFile.filename;
    }

    const saved = await this.productRepo.save(product);

    // Re-generate embeddings in background
    this.generateEmbeddings(saved).catch((err) =>
      this.logger.error(`Failed to update embeddings for product ${saved.id}`, err),
    );

    return saved;
  }

  async delete(id: string): Promise<void> {
    const product = await this.findOne(id);

    // Delete image file
    if (product.imagePath) {
      const imgPath = path.join(process.cwd(), 'uploads', 'products', product.imagePath);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    // Delete embeddings
    this.aiService.deleteProductEmbedding(product.id).catch((err) =>
      this.logger.warn(`Failed to delete embeddings for product ${product.id}`, err),
    );

    await this.productRepo.remove(product);
  }

  private async generateEmbeddings(product: Product): Promise<void> {
    const imagePath = product.imagePath
      ? path.join(process.cwd(), 'uploads', 'products', product.imagePath)
      : undefined;

    await this.aiService.embedProduct(
      product.id,
      product.name,
      product.description ?? '',
      imagePath,
    );
  }
}
