import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProductImage } from './product-image.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  width: string | null;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  height: string | null;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  depth: string | null;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  weight: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ nullable: true, type: 'varchar' })
  imagePath: string | null;

  @OneToMany(() => ProductImage, (image) => image.product, { cascade: true, eager: true })
  images: ProductImage[];

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
