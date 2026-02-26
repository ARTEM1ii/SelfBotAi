import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { Api } from 'telegram';
import {
  TelegramSession,
  TelegramSessionStatus,
} from './entities/telegram-session.entity';
import { TelegramConversation } from './entities/telegram-conversation.entity';
import { AiService } from '../ai/ai.service';
import {
  SaveCredentialsDto,
  SendCodeDto,
  VerifyCodeDto,
  VerifyPasswordDto,
} from './dto/connect-telegram.dto';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly clients = new Map<string, TelegramClient>();
  private readonly maxHistoryMessages = 40;

  constructor(
    @InjectRepository(TelegramSession)
    private readonly sessionRepository: Repository<TelegramSession>,
    @InjectRepository(TelegramConversation)
    private readonly conversationRepository: Repository<TelegramConversation>,
    private readonly aiService: AiService,
  ) {}

  async saveCredentials(
    userId: string,
    dto: SaveCredentialsDto,
  ): Promise<{ status: string }> {
    const existing = await this.sessionRepository.findOne({ where: { userId } });

    if (existing) {
      // Reset session when credentials change
      const client = this.clients.get(userId);
      if (client) {
        await client.disconnect().catch(() => null);
        this.clients.delete(userId);
      }

      existing.apiId = dto.apiId;
      existing.apiHash = dto.apiHash;
      existing.status = TelegramSessionStatus.PENDING;
      existing.sessionString = null;
      existing.phoneCodeHash = null;
      await this.sessionRepository.save(existing);
    } else {
      await this.sessionRepository.save(
        this.sessionRepository.create({
          userId,
          apiId: dto.apiId,
          apiHash: dto.apiHash,
          status: TelegramSessionStatus.PENDING,
        }),
      );
    }

    return { status: 'credentials_saved' };
  }

  async sendCode(userId: string, dto: SendCodeDto): Promise<{ status: string }> {
    const session = await this.getSessionOrThrow(userId);

    session.phone = dto.phone;
    session.status = TelegramSessionStatus.AWAITING_CODE;
    session.sessionString = null;
    session.phoneCodeHash = null;
    await this.sessionRepository.save(session);

    const client = new TelegramClient(
      new StringSession(''),
      session.apiId,
      session.apiHash,
      { connectionRetries: 3 },
    );

    await client.connect();

    const result = await client.sendCode(
      { apiId: session.apiId, apiHash: session.apiHash },
      dto.phone,
    );

    session.phoneCodeHash = result.phoneCodeHash;
    await this.sessionRepository.save(session);

    this.clients.set(userId, client);

    return { status: 'code_sent' };
  }

  async verifyCode(
    userId: string,
    dto: VerifyCodeDto,
  ): Promise<{ status: string }> {
    const session = await this.getSessionOrThrow(userId);

    if (!session.phoneCodeHash) {
      throw new BadRequestException('Phone code hash not found. Request a new code.');
    }

    const client = this.getClientOrThrow(userId);

    try {
      if (!session.phone) {
        throw new BadRequestException('Phone number not found');
      }
      
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: session.phone,
          phoneCodeHash: session.phoneCodeHash!,
          phoneCode: dto.code,
        }),
      );

      const sessionString = (client.session as StringSession).save();
      session.sessionString = sessionString;
      session.status = TelegramSessionStatus.ACTIVE;
      session.phoneCodeHash = null;
      await this.sessionRepository.save(session);

      await this.startListening(userId, client);

      return { status: 'connected' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);

      if (msg.includes('SESSION_PASSWORD_NEEDED')) {
        session.status = TelegramSessionStatus.AWAITING_PASSWORD;
        await this.sessionRepository.save(session);
        return { status: 'password_required' };
      }

      throw new BadRequestException(`Failed to verify code: ${msg}`);
    }
  }

  async verifyPassword(
    userId: string,
    dto: VerifyPasswordDto,
  ): Promise<{ status: string }> {
    const session = await this.getSessionOrThrow(userId);
    const client = this.getClientOrThrow(userId);

    try {
      await client.signInWithPassword(
        { apiId: session.apiId, apiHash: session.apiHash },
        { password: async () => dto.password, onError: async () => true },
      );

      const sessionString = (client.session as StringSession).save();
      session.sessionString = sessionString;
      session.status = TelegramSessionStatus.ACTIVE;
      await this.sessionRepository.save(session);

      await this.startListening(userId, client);

      return { status: 'connected' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Failed to verify password: ${msg}`);
    }
  }

  async disconnect(userId: string): Promise<{ status: string }> {
    const session = await this.getSessionOrThrow(userId);
    const client = this.clients.get(userId);

    if (client) {
      await client.disconnect().catch(() => null);
      this.clients.delete(userId);
    }

    session.status = TelegramSessionStatus.DISCONNECTED;
    await this.sessionRepository.save(session);

    return { status: 'disconnected' };
  }

  async toggleAutoReply(userId: string, enabled: boolean): Promise<TelegramSession> {
    const session = await this.getSessionOrThrow(userId);
    session.isAutoReplyEnabled = enabled;
    return this.sessionRepository.save(session);
  }

  async getStatus(userId: string): Promise<TelegramSession | null> {
    return this.sessionRepository.findOne({ where: { userId } });
  }

  async restoreActiveSessions(): Promise<void> {
    const activeSessions = await this.sessionRepository.find({
      where: { status: TelegramSessionStatus.ACTIVE },
    });

    for (const session of activeSessions) {
      if (!session.sessionString) continue;

      try {
        const client = new TelegramClient(
          new StringSession(session.sessionString),
          session.apiId,
          session.apiHash,
          { connectionRetries: 3 },
        );

        await client.connect();
        this.clients.set(session.userId, client);
        await this.startListening(session.userId, client);

        this.logger.log(`Restored session for user ${session.userId}`);
      } catch (error) {
        this.logger.error(
          `Failed to restore session for user ${session.userId}`,
          error,
        );
        await this.sessionRepository.update(session.id, {
          status: TelegramSessionStatus.DISCONNECTED,
        });
      }
    }
  }

  private async startListening(
    userId: string,
    client: TelegramClient,
  ): Promise<void> {
    client.addEventHandler(
      (event: NewMessageEvent) => this.handleIncomingMessage(userId, event),
      new NewMessage({ incoming: true }),
    );

    this.logger.log(`Listening for messages for user ${userId}`);
  }

  private async handleIncomingMessage(
    userId: string,
    event: NewMessageEvent,
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { userId } });

    if (!session?.isAutoReplyEnabled) return;

    const message = event.message;
    const text = message.text;

    if (!text || !message.isPrivate) return;

    try {
      const peerId = this.extractPeerId(message);

      // Load history from DB
      const historyRows = await this.conversationRepository.find({
        where: { userId, peerId },
        order: { createdAt: 'ASC' },
        take: this.maxHistoryMessages,
      });

      const history = historyRows.map((r) => ({ role: r.role, content: r.content }));

      const { reply } = await this.aiService.chat(userId, {
        message: text,
        conversationHistory: history,
      });

      // Persist both turns to DB
      await this.conversationRepository.save([
        this.conversationRepository.create({ userId, peerId, role: 'user', content: text }),
        this.conversationRepository.create({ userId, peerId, role: 'assistant', content: reply }),
      ]);

      // Trim old messages to keep at most maxHistoryMessages rows per conversation
      const totalCount = await this.conversationRepository.count({ where: { userId, peerId } });
      if (totalCount > this.maxHistoryMessages) {
        const oldest = await this.conversationRepository.find({
          where: { userId, peerId },
          order: { createdAt: 'ASC' },
          take: totalCount - this.maxHistoryMessages,
        });
        await this.conversationRepository.remove(oldest);
      }

      await message.reply({ message: reply });
      this.logger.log(`Auto-replied for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to auto-reply for user ${userId}`, error);
    }
  }

  private extractPeerId(message: any): string {
    // gramJS exposes senderId as a BigInt — convert to stable string
    const raw =
      message?.senderId ??
      message?.chatId ??
      message?.peerId?.userId ??
      message?.peerId?.channelId ??
      message?.peerId?.chatId ??
      'unknown';

    return String(raw);
  }

  private async getSessionOrThrow(userId: string): Promise<TelegramSession> {
    const session = await this.sessionRepository.findOne({ where: { userId } });

    if (!session) {
      throw new NotFoundException(
        'Telegram credentials not found. Please save your API ID and API Hash first.',
      );
    }

    return session;
  }

  private getClientOrThrow(userId: string): TelegramClient {
    const client = this.clients.get(userId);

    if (!client) {
      throw new BadRequestException(
        'Telegram client not initialized. Start the connection flow again.',
      );
    }

    return client;
  }
}
