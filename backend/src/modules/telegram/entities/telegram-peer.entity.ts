import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('telegram_peers')
@Index(['userId', 'peerId'], { unique: true })
export class TelegramPeer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  /** Telegram numeric ID of the interlocutor */
  @Column()
  peerId: string;

  /** Display name fetched from Telegram (first + last name or username) */
  @Column({ nullable: true, type: 'varchar', length: 255 })
  peerName: string | null;

  /** Username without @ */
  @Column({ nullable: true, type: 'varchar', length: 255 })
  peerUsername: string | null;

  @Column({ default: false })
  isBlocked: boolean;

  /** Timestamp of the last message in this conversation */
  @Column({ nullable: true, type: 'timestamptz' })
  lastMessageAt: Date | null;

  /** Last message preview (first 100 chars) */
  @Column({ nullable: true, type: 'varchar', length: 100 })
  lastMessagePreview: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
