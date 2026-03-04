import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { ChatDto, ChatResponseDto } from './dto/chat.dto';
import { ChatHistory } from './entities/chat-history.entity';
import { TelegramConversation } from '../telegram/entities/telegram-conversation.entity';

interface ProcessFilePayload {
  file_id: string;
  user_id: string;
  file_path: string;
  mime_type: string;
}

interface ProcessFileResponse {
  file_id: string;
  chunks_count: number;
  status: string;
}

interface AiChatPayload {
  message: string;
  user_id: string;
  conversation_history?: Array<{ role: string; content: string }>;
  top_k?: number;
  product_context?: string;
}

interface AiChatResponse {
  reply: string;
  sources_count: number;
}

interface ProductSearchResult {
  product_id: string;
  product_name: string;
  product_description: string | null;
  similarity: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ChatHistory)
    private readonly chatHistoryRepo: Repository<ChatHistory>,
    @InjectRepository(TelegramConversation)
    private readonly telegramConversationRepo: Repository<TelegramConversation>,
  ) {
    this.aiServiceUrl =
      this.configService.get<string>('app.aiServiceUrl') ?? 'http://localhost:8000';
  }

  async getHistory(userId: string): Promise<ChatHistory[]> {
    return this.chatHistoryRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async clearHistory(userId: string): Promise<void> {
    await this.chatHistoryRepo.delete({ userId });
    // Also clear Telegram conversation history for this user, so the AI
    // doesn't use past Telegram chats as context after "Clear history" in UI.
    await this.telegramConversationRepo.delete({ userId });
  }

  async processFile(payload: ProcessFilePayload): Promise<ProcessFileResponse> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI service error ${response.status}: ${error}`);
      }

      return response.json() as Promise<ProcessFileResponse>;
    } catch (error) {
      this.logger.error('Failed to process file in AI service', error);
      throw new ServiceUnavailableException('AI service is unavailable');
    }
  }

  async deleteFileChunks(fileId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/process/${fileId}`,
        { method: 'DELETE' },
      );

      if (!response.ok && response.status !== 404) {
        this.logger.warn(`Failed to delete chunks for file ${fileId}: ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Could not delete chunks for file ${fileId}`, error);
    }
  }

  async chat(userId: string, dto: ChatDto): Promise<ChatResponseDto> {
    // If caller already provides history (e.g. Telegram per-peer history) — use it as-is
    // and do NOT touch chat_history table (Telegram service manages its own storage).
    const externalHistory = dto.conversationHistory;

    let conversationHistory: Array<{ role: string; content: string }>;

    if (externalHistory !== undefined) {
      // Telegram call — use exactly what was passed (even if empty array)
      conversationHistory = externalHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    } else {
      // Dashboard chat — load from chat_history table
      const dbHistory = await this.chatHistoryRepo.find({
        where: { userId },
        order: { createdAt: 'ASC' },
        take: 20,
      });
      conversationHistory = dbHistory.map((m) => ({ role: m.role, content: m.content }));
    }

    const payload: AiChatPayload = {
      message: dto.message,
      user_id: userId,
      top_k: dto.topK,
      conversation_history: conversationHistory,
      product_context: dto.productContext,
    };

    try {
      const response = await fetch(`${this.aiServiceUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI service error ${response.status}: ${error}`);
      }

      const data = await response.json() as AiChatResponse;

      // Only save to chat_history when it's a dashboard chat (externalHistory not provided)
      if (externalHistory === undefined) {
        await this.chatHistoryRepo.save([
          this.chatHistoryRepo.create({ userId, role: 'user', content: dto.message }),
          this.chatHistoryRepo.create({ userId, role: 'assistant', content: data.reply }),
        ]);
      }

      return {
        reply: data.reply,
        sourcesCount: data.sources_count,
      };
    } catch (error) {
      this.logger.error('Failed to get chat response from AI service', error);
      throw new ServiceUnavailableException('AI service is unavailable');
    }
  }

  async embedProduct(
    productId: string,
    name: string,
    description: string,
    imagePath?: string,
  ): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('product_id', productId);
      formData.append('name', name);
      formData.append('description', description);

      if (imagePath && fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).slice(1) || 'jpg';
        const blob = new Blob([imageBuffer], { type: `image/${ext}` });
        formData.append('image', blob, path.basename(imagePath));
      }

      const response = await fetch(`${this.aiServiceUrl}/api/products/embed`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to embed product ${productId}: ${error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to embed product ${productId}`, error);
    }
  }

  async updateProductEmbedding(
    productId: string,
    name: string,
    description: string,
    imagePath?: string,
  ): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);

      if (imagePath && fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).slice(1) || 'jpg';
        const blob = new Blob([imageBuffer], { type: `image/${ext}` });
        formData.append('image', blob, path.basename(imagePath));
      }

      const response = await fetch(
        `${this.aiServiceUrl}/api/products/embed/${productId}`,
        { method: 'PUT', body: formData },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to update product embedding ${productId}: ${error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update product embedding ${productId}`, error);
    }
  }

  async deleteProductEmbedding(productId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/products/embed/${productId}`,
        { method: 'DELETE' },
      );

      if (!response.ok && response.status !== 404) {
        this.logger.warn(
          `Failed to delete product embedding ${productId}: ${response.status}`,
        );
      }
    } catch (error) {
      this.logger.warn(`Could not delete product embedding ${productId}`, error);
    }
  }

  async searchProductByImage(
    imageBuffer: Buffer,
    topK: number = 3,
  ): Promise<ProductSearchResult[]> {
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
      formData.append('image', blob, 'photo.jpg');
      formData.append('top_k', String(topK));

      const response = await fetch(
        `${this.aiServiceUrl}/api/products/search-by-image`,
        { method: 'POST', body: formData },
      );

      if (!response.ok) {
        this.logger.error(`Product image search failed: ${response.status}`);
        return [];
      }

      return (await response.json()) as ProductSearchResult[];
    } catch (error) {
      this.logger.error('Failed to search products by image', error);
      return [];
    }
  }

  async searchProductByText(query: string): Promise<ProductSearchResult[]> {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/products/search-by-text`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: 3 }),
        },
      );

      if (!response.ok) {
        this.logger.error(`Product text search failed: ${response.status}`);
        return [];
      }

      return (await response.json()) as ProductSearchResult[];
    } catch (error) {
      this.logger.error('Failed to search products by text', error);
      return [];
    }
  }
}
