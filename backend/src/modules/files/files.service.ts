import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { File, FileStatus, FileType } from './entities/file.entity';

const ALLOWED_MIME_TYPES: Record<string, FileType> = {
  'text/plain': FileType.TXT,
  'application/pdf': FileType.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType.DOCX,
  'text/markdown': FileType.MD,
  'text/x-markdown': FileType.MD,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
  ) {}

  async upload(
    userId: string,
    multerFile: Express.Multer.File,
  ): Promise<File> {
    this.validateFile(multerFile);

    const fileType = ALLOWED_MIME_TYPES[multerFile.mimetype];

    const file = this.fileRepository.create({
      originalName: multerFile.originalname,
      storagePath: multerFile.path,
      mimeType: multerFile.mimetype,
      size: multerFile.size,
      fileType,
      status: FileStatus.PENDING,
      userId,
    });

    return this.fileRepository.save(file);
  }

  async findAllByUser(userId: string): Promise<File[]> {
    return this.fileRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneByUser(id: string, userId: string): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id, userId },
    });

    if (!file) {
      throw new NotFoundException(`File with id ${id} not found`);
    }

    return file;
  }

  async delete(id: string, userId: string): Promise<void> {
    const file = await this.findOneByUser(id, userId);

    if (fs.existsSync(file.storagePath)) {
      fs.unlinkSync(file.storagePath);
    }

    await this.fileRepository.remove(file);
  }

  async updateStatus(
    id: string,
    status: FileStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.fileRepository.update(id, {
      status,
      errorMessage: errorMessage ?? null,
    });
  }

  private validateFile(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: txt, pdf, docx, md`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }
}

export { FileType };
