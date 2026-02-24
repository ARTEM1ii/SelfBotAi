export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

export enum FileType {
  TXT = 'txt',
  PDF = 'pdf',
  DOCX = 'docx',
  MD = 'md',
}

export interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileType: FileType;
  status: FileStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum TelegramSessionStatus {
  PENDING = 'pending',
  AWAITING_CODE = 'awaiting_code',
  AWAITING_PASSWORD = 'awaiting_password',
  ACTIVE = 'active',
  DISCONNECTED = 'disconnected',
}

export interface TelegramSession {
  id: string;
  phone: string | null;
  status: TelegramSessionStatus;
  isAutoReplyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  sourcesCount: number;
}
