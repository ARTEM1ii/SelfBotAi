import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.BACKEND_PORT ?? '4000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
  telegramApiId: parseInt(process.env.TELEGRAM_API_ID ?? '0', 10),
  telegramApiHash: process.env.TELEGRAM_API_HASH ?? '',
}));
