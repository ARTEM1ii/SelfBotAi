import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('telegram_conversations')
@Index(['userId', 'peerId'])
export class TelegramConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  /** Telegram peer ID (the other person's user id as string) */
  @Column()
  peerId: string;

  /** 'user' = message from the interlocutor, 'assistant' = AI reply */
  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
