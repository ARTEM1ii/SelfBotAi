import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('chat_history')
@Index(['userId', 'createdAt'])
export class ChatHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
