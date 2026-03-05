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
import { TelegramPeer } from './entities/telegram-peer.entity';
import { AiService } from '../ai/ai.service';
import { ProductsService } from '../products/products.service';
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
  private readonly mediaGroupBuffer = new Map<
    string,
    { messages: NewMessageEvent[]; timer: NodeJS.Timeout }
  >();
  private readonly mediaGroupDelay = 500;

  constructor(
    @InjectRepository(TelegramSession)
    private readonly sessionRepository: Repository<TelegramSession>,
    @InjectRepository(TelegramConversation)
    private readonly conversationRepository: Repository<TelegramConversation>,
    @InjectRepository(TelegramPeer)
    private readonly peerRepository: Repository<TelegramPeer>,
    private readonly aiService: AiService,
    private readonly productsService: ProductsService,
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

    // Disconnect existing in-memory client
    const existingClient = this.clients.get(userId);
    if (existingClient) {
      try {
        await existingClient.invoke(new Api.auth.LogOut());
        this.logger.log(`Logged out in-memory client for user ${userId}`);
      } catch (e) {
        this.logger.warn(`Failed to log out in-memory client: ${e}`);
      }
      await existingClient.disconnect().catch(() => null);
      this.clients.delete(userId);
    }

    // If there's a saved session string, restore it and log out to free the Telegram session
    if (session.sessionString) {
      try {
        const oldClient = new TelegramClient(
          new StringSession(session.sessionString),
          session.apiId,
          session.apiHash,
          { connectionRetries: 3 },
        );
        await oldClient.connect();
        await oldClient.invoke(new Api.auth.LogOut());
        await oldClient.disconnect();
        this.logger.log(`Logged out saved Telegram session for user ${userId}`);
      } catch (e) {
        this.logger.warn(`Failed to log out saved session: ${e}`);
      }
    }

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

    let result;
    try {
      result = await client.sendCode(
        { apiId: session.apiId, apiHash: session.apiHash },
        dto.phone,
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('FloodWaitError') || msg.includes('FLOOD')) {
        const seconds = (error as any).seconds ?? 0;
        const hours = Math.ceil(seconds / 3600);
        throw new BadRequestException(
          `Telegram flood limit: wait ${hours > 0 ? `~${hours} hours` : `${seconds} seconds`} before requesting a new code.`,
        );
      }
      throw new BadRequestException(`Failed to send code: ${msg}`);
    }

    this.logger.log(`sendCode result for ${dto.phone}: type=${result.constructor?.name}, phoneCodeHash=${result.phoneCodeHash}`);
    this.logger.log(`sendCode full result: ${JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);

    session.phoneCodeHash = result.phoneCodeHash;
    await this.sessionRepository.save(session);

    this.clients.set(userId, client);

    return { status: 'code_sent' };
  }

  async resendCode(userId: string): Promise<{ status: string }> {
    const session = await this.getSessionOrThrow(userId);
    const client = this.getClientOrThrow(userId);

    if (!session.phone || !session.phoneCodeHash) {
      throw new BadRequestException('No pending code request. Call send-code first.');
    }

    let result;
    try {
      result = await client.invoke(
        new Api.auth.ResendCode({
          phoneNumber: session.phone,
          phoneCodeHash: session.phoneCodeHash,
        }),
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('FloodWaitError') || msg.includes('FLOOD')) {
        const seconds = (error as any).seconds ?? 0;
        const hours = Math.ceil(seconds / 3600);
        throw new BadRequestException(
          `Telegram flood limit: wait ${hours > 0 ? `~${hours} hours` : `${seconds} seconds`} before resending code.`,
        );
      }
      throw new BadRequestException(`Failed to resend code: ${msg}`);
    }

    this.logger.log(`resendCode result: ${JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);

    // Update phoneCodeHash if it changed
    if ((result as any).phoneCodeHash) {
      session.phoneCodeHash = (result as any).phoneCodeHash;
      await this.sessionRepository.save(session);
    }

    return { status: 'code_resent' };
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
      try {
        await client.invoke(new Api.auth.LogOut());
      } catch (e) {
        this.logger.warn(`Failed to log out from Telegram: ${e}`);
      }
      await client.disconnect().catch(() => null);
      this.clients.delete(userId);
    }

    session.status = TelegramSessionStatus.DISCONNECTED;
    session.sessionString = null;
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
    const text = message.text ?? '';

    if (!message.isPrivate) return;

    // Need either text or photo to proceed
    const hasPhoto = !!(message.photo || message.media);
    if (!text && !hasPhoto) return;

    // If message belongs to a media group (album), buffer it
    const groupedId = (message as any).groupedId;
    if (groupedId) {
      const bufferKey = `${userId}:${String(groupedId)}`;
      const existing = this.mediaGroupBuffer.get(bufferKey);

      if (existing) {
        existing.messages.push(event);
        clearTimeout(existing.timer);
        existing.timer = setTimeout(() => {
          this.mediaGroupBuffer.delete(bufferKey);
          this.handleMediaGroup(userId, existing.messages).catch((err) =>
            this.logger.error(`Failed to handle media group for user ${userId}`, err),
          );
        }, this.mediaGroupDelay);
      } else {
        const timer = setTimeout(() => {
          const entry = this.mediaGroupBuffer.get(bufferKey);
          if (!entry) return;
          this.mediaGroupBuffer.delete(bufferKey);
          this.handleMediaGroup(userId, entry.messages).catch((err) =>
            this.logger.error(`Failed to handle media group for user ${userId}`, err),
          );
        }, this.mediaGroupDelay);
        this.mediaGroupBuffer.set(bufferKey, { messages: [event], timer });
      }
      return;
    }

    // Single message (no grouped ID) — process as before
    await this.handleSingleMessage(userId, event);
  }

  private async handleMediaGroup(
    userId: string,
    events: NewMessageEvent[],
  ): Promise<void> {
    try {
      const firstMessage = events[0].message;
      const lastMessage = events[events.length - 1].message;
      const peerId = this.extractPeerId(firstMessage);
      const peerName = this.extractPeerName(firstMessage);
      const peerUsername = this.extractPeerUsername(firstMessage);

      // Caption comes from the first message that has text
      const caption = events.map((e) => e.message.text).find((t) => !!t) ?? '';

      await this.upsertPeer(userId, peerId, peerName, peerUsername, caption || '[album]');

      // Check if blocked
      const peer = await this.peerRepository.findOne({ where: { userId, peerId } });
      if (peer?.isBlocked) {
        this.logger.log(`Skipped auto-reply: peer ${peerId} is blocked for user ${userId}`);
        return;
      }

      // Load conversation history
      const historyRows = await this.conversationRepository.find({
        where: { userId, peerId },
        order: { createdAt: 'ASC' },
        take: this.maxHistoryMessages,
      });
      const history = historyRows.map((r) => ({ role: r.role, content: r.content }));

      // Download all photos and search products for each
      const client = this.clients.get(userId);
      const allProducts: Array<{ product_id: string; product_name: string; product_description: string | null; similarity: number }> = [];

      if (client) {
        for (const event of events) {
          const msg = event.message;
          if (!msg.media) continue;
          try {
            const buffer = await client.downloadMedia(msg.media, {}) as Buffer;
            if (buffer) {
              const products = await this.aiService.searchProductByImage(buffer, 3);
              allProducts.push(...products);
            }
          } catch (err) {
            this.logger.warn(`Failed to download photo from album for user ${userId}`, err);
          }
        }
      }

      // Deduplicate by product_id, keeping highest similarity
      const bestByProduct = new Map<string, typeof allProducts[number]>();
      for (const p of allProducts) {
        const existing = bestByProduct.get(p.product_id);
        if (!existing || p.similarity > existing.similarity) {
          bestByProduct.set(p.product_id, p);
        }
      }
      const mergedProducts = Array.from(bestByProduct.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      let productContext: string | undefined;
      if (mergedProducts.length > 0) {
        productContext = await this.formatProductContext(mergedProducts, 'photo');
      }

      // If no photo results, try text search from caption
      if (caption && !productContext) {
        const products = await this.aiService.searchProductByText(caption);
        if (products.length > 0 && products[0].similarity > 0.3) {
          productContext = await this.formatProductContext(products, 'text');
        }
      }

      let userMessage: string;
      if (caption) {
        userMessage = caption;
      } else if (productContext) {
        userMessage = `Клиент отправил ${events.length} фотографий товара.`;
      } else {
        userMessage = `Клиент отправил ${events.length} фотографий, но похожих товаров не найдено.`;
      }

      const { reply } = await this.aiService.chat(userId, {
        message: userMessage,
        conversationHistory: history,
        productContext,
      });

      await this.persistAndReply(userId, peerId, userMessage, reply, peerName, peerUsername, lastMessage);
    } catch (error) {
      this.logger.error(`Failed to handle media group for user ${userId}`, error);
    }
  }

  private async handleSingleMessage(
    userId: string,
    event: NewMessageEvent,
  ): Promise<void> {
    const message = event.message;
    const text = message.text ?? '';
    const hasPhoto = !!(message.photo || message.media);

    try {
      const peerId = this.extractPeerId(message);
      const peerName = this.extractPeerName(message);
      const peerUsername = this.extractPeerUsername(message);
      await this.upsertPeer(userId, peerId, peerName, peerUsername, text || '[photo]');

      // Check if blocked
      const peer = await this.peerRepository.findOne({ where: { userId, peerId } });
      if (peer?.isBlocked) {
        this.logger.log(`Skipped auto-reply: peer ${peerId} is blocked for user ${userId}`);
        return;
      }

      // Load conversation history
      const historyRows = await this.conversationRepository.find({
        where: { userId, peerId },
        order: { createdAt: 'ASC' },
        take: this.maxHistoryMessages,
      });
      const history = historyRows.map((r) => ({ role: r.role, content: r.content }));

      let productContext: string | undefined;

      // Handle photo: search products by image
      if (hasPhoto) {
        try {
          const client = this.clients.get(userId);
          if (client && message.media) {
            const buffer = await client.downloadMedia(message.media, {}) as Buffer;
            if (buffer) {
              const products = await this.aiService.searchProductByImage(buffer, 1);
              if (products.length > 0) {
                productContext = await this.formatProductContext(products, 'photo');
              }
            }
          }
        } catch (err) {
          this.logger.warn(`Failed to download/search photo for user ${userId}`, err);
        }
      }

      // Handle text: search products by text if no photo results yet
      if (text && !productContext) {
        const products = await this.aiService.searchProductByText(text);
        if (products.length > 0 && products[0].similarity > 0.3) {
          productContext = await this.formatProductContext(products, 'text');
        }
      }

      // When photo sent: tell LLM what the system found, not "user sent a photo"
      let userMessage: string;
      if (text) {
        userMessage = text;
      } else if (productContext) {
        userMessage = 'Клиент отправил фотографию товара.';
      } else {
        userMessage = 'Клиент отправил фотографию, но похожих товаров не найдено.';
      }

      const { reply } = await this.aiService.chat(userId, {
        message: userMessage,
        conversationHistory: history,
        productContext,
      });

      await this.persistAndReply(userId, peerId, userMessage, reply, peerName, peerUsername, message);
    } catch (error) {
      this.logger.error(`Failed to auto-reply for user ${userId}`, error);
    }
  }

  private async formatProductContext(
    searchResults: Array<{ product_id: string; product_name: string; product_description: string | null; similarity: number }>,
    source: 'photo' | 'text',
  ): Promise<string> {
    // Load full product data from DB to include price, quantity, dimensions
    const productIds = searchResults.map((p) => p.product_id);
    const fullProducts = await this.productsService.findByIds(productIds);
    const productMap = new Map(fullProducts.map((p) => [p.id, p]));

    const lines = searchResults.map((sr, i) => {
      const full = productMap.get(sr.product_id);
      const parts = [`${i + 1}. ${sr.product_name}`];
      if (full?.description) parts.push(`   Описание: ${full.description}`);
      if (full) {
        const dimParts: string[] = [];
        if (full.width) dimParts.push(full.width);
        if (full.height) dimParts.push(full.height);
        if (full.depth) dimParts.push(full.depth);
        if (dimParts.length > 0) {
          parts.push(`   Размеры: ${dimParts.join(' x ')}`);
        }
        if (full.weight) {
          parts.push(`   Вес: ${full.weight}`);
        }
      }
      if (full) parts.push(`   Цена: ${Number(full.price).toFixed(2)} ₽`);
      if (full) parts.push(`   В наличии: ${full.quantity} шт.`);
      parts.push(`   Совпадение: ${(sr.similarity * 100).toFixed(0)}%`);
      return parts.join('\n');
    });

    const header = source === 'photo'
      ? 'Система распознала товар по фотографии клиента. Вот найденные совпадения из каталога:'
      : 'Система нашла товары по запросу клиента:';

    return `${header}\n\n${lines.join('\n\n')}`;
  }

  private async persistAndReply(
    userId: string,
    peerId: string,
    userMessage: string,
    reply: string,
    peerName: string | null,
    peerUsername: string | null,
    message: any,
  ): Promise<void> {
    await this.conversationRepository.save([
      this.conversationRepository.create({ userId, peerId, role: 'user', content: userMessage }),
      this.conversationRepository.create({ userId, peerId, role: 'assistant', content: reply }),
    ]);

    await this.upsertPeer(userId, peerId, peerName, peerUsername, reply);

    // Trim old messages
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
  }

  async getPeers(userId: string): Promise<TelegramPeer[]> {
    return this.peerRepository.find({
      where: { userId },
      order: { lastMessageAt: 'DESC' },
    });
  }

  async getConversation(userId: string, peerId: string): Promise<TelegramConversation[]> {
    return this.conversationRepository.find({
      where: { userId, peerId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  async clearPeerHistory(userId: string, peerId: string): Promise<void> {
    await this.conversationRepository.delete({ userId, peerId });
  }

  async deletePeer(userId: string, peerId: string): Promise<void> {
    await this.conversationRepository.delete({ userId, peerId });
    await this.peerRepository.delete({ userId, peerId });
  }

  async blockPeer(userId: string, peerId: string, isBlocked: boolean): Promise<TelegramPeer> {
    const peer = await this.peerRepository.findOne({ where: { userId, peerId } });
    if (!peer) throw new NotFoundException(`Peer ${peerId} not found`);
    peer.isBlocked = isBlocked;
    return this.peerRepository.save(peer);
  }

  private async upsertPeer(
    userId: string,
    peerId: string,
    peerName: string | null,
    peerUsername: string | null,
    lastMessage: string,
  ): Promise<void> {
    const existing = await this.peerRepository.findOne({ where: { userId, peerId } });
    const preview = lastMessage.slice(0, 100);

    if (existing) {
      existing.lastMessageAt = new Date();
      existing.lastMessagePreview = preview;
      if (peerName && !existing.peerName) existing.peerName = peerName;
      if (peerUsername && !existing.peerUsername) existing.peerUsername = peerUsername;
      await this.peerRepository.save(existing);
    } else {
      await this.peerRepository.save(
        this.peerRepository.create({
          userId,
          peerId,
          peerName,
          peerUsername,
          lastMessageAt: new Date(),
          lastMessagePreview: preview,
        }),
      );
    }
  }

  private extractPeerName(message: any): string | null {
    try {
      const sender = message?.sender;
      if (!sender) return null;
      const parts = [sender.firstName, sender.lastName].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : null;
    } catch {
      return null;
    }
  }

  private extractPeerUsername(message: any): string | null {
    try {
      return message?.sender?.username ?? null;
    } catch {
      return null;
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
