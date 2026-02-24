import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5433', 10),
    username: process.env.POSTGRES_USER ?? 'telegramllm',
    password: process.env.POSTGRES_PASSWORD ?? 'telegramllm_secret',
    database: process.env.POSTGRES_DB ?? 'telegramllm',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
    ssl: false,
  }),
);
