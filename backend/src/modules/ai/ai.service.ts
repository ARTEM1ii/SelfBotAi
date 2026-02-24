import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatDto, ChatResponseDto, ConversationMessageDto } from './dto/chat.dto';

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
}

interface AiChatResponse {
  reply: string;
  sources_count: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.aiServiceUrl =
      this.configService.get<string>('app.aiServiceUrl') ?? 'http://localhost:8000';
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
    const payload: AiChatPayload = {
      message: dto.message,
      user_id: userId,
      top_k: dto.topK,
      conversation_history: dto.conversationHistory?.map(
        (m: ConversationMessageDto) => ({ role: m.role, content: m.content }),
      ),
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

      return {
        reply: data.reply,
        sourcesCount: data.sources_count,
      };
    } catch (error) {
      this.logger.error('Failed to get chat response from AI service', error);
      throw new ServiceUnavailableException('AI service is unavailable');
    }
  }
}
