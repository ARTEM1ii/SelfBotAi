import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TelegramSessionStatus {
  PENDING = 'pending',
  AWAITING_CODE = 'awaiting_code',
  AWAITING_PASSWORD = 'awaiting_password',
  ACTIVE = 'active',
  DISCONNECTED = 'disconnected',
}

@Entity('telegram_sessions')
export class TelegramSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  apiId: number;

  @Column({ type: 'varchar' })
  apiHash: string;

  @Column({ nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({
    type: 'enum',
    enum: TelegramSessionStatus,
    default: TelegramSessionStatus.PENDING,
  })
  status: TelegramSessionStatus;

  @Column({ nullable: true, type: 'text' })
  sessionString: string | null;

  @Column({ nullable: true, type: 'varchar' })
  phoneCodeHash: string | null;

  @Column({ default: false })
  isAutoReplyEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
