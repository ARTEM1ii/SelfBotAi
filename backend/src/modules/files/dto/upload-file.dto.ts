import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'File to upload (txt, pdf, docx, md)' })
  readonly file: Express.Multer.File;
}
