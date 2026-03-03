# TelegramLLM

Платформа для создания AI-клона в Telegram. Загружаете документы с описанием личности — бот отвечает от вашего имени в вашем стиле общения. Поддерживает RAG-поиск по документам, автоответы в Telegram и веб-дашборд для управления.

## Архитектура

```
┌──────────────────────────────────────────────────────┐
│              Frontend (Next.js @ :3000)               │
│        /chat  /files  /telegram  /conversations       │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP (axios)
┌──────────────────────▼───────────────────────────────┐
│               Backend (NestJS @ :4000)                │
│  Auth (JWT) │ Files │ Telegram (gram.js) │ AI proxy   │
└───────┬──────────────────────────────────┬───────────┘
        │ HTTP                             │ gram.js
┌───────▼───────────────┐       ┌──────────▼───────────┐
│  AI Service (FastAPI)  │       │   Telegram API       │
│  @ :8000               │       │   (live connection)  │
│  RAG + LLM generation  │       └──────────────────────┘
└───────┬───────────────┘
        │
┌───────▼───────────────┐
│  PostgreSQL 16        │
│  + pgvector           │
└───────────────────────┘
```

## Стек технологий

| Компонент | Технологии |
|---|---|
| Frontend | Next.js 16, React 19, Ant Design 6, TypeScript |
| Backend | NestJS 11, TypeORM, TypeScript |
| AI Service | FastAPI, SQLAlchemy, Python 3.11+ |
| База данных | PostgreSQL 16 + pgvector |
| LLM | OpenRouter / OpenAI-совместимые API |
| Эмбеддинги | HuggingFace Inference API (all-MiniLM-L6-v2) |
| Telegram | gram.js (прямое подключение к Telegram API) |

## Возможности

- **AI-клон личности** — бот общается в Telegram от вашего имени, копируя стиль речи
- **RAG-поиск** — загружайте документы (TXT, PDF, DOCX, MD), бот использует их как базу знаний
- **Автоответы в Telegram** — подключите аккаунт и включите автоответ для выбранных контактов
- **Защита от prompt injection** — многослойная система предотвращения выхода из роли
- **Веб-дашборд** — управление файлами, чат с ботом, просмотр переписок, настройка Telegram
- **Управление контактами** — блокировка, удаление, просмотр истории переписки

## Требования

- Node.js 20+
- Python 3.11+
- Docker (для PostgreSQL)

## Быстрый старт

### 1. Клонировать и настроить окружение

```bash
git clone <repo-url>
cd TelegramLLM
cp .env.example .env
```

Отредактируйте `.env` — основные переменные:

| Переменная | Описание | По умолчанию |
|---|---|---|
| `POSTGRES_USER` | Пользователь БД | `telegramllm` |
| `POSTGRES_PASSWORD` | Пароль БД | `telegramllm_secret` |
| `POSTGRES_DB` | Имя БД | `telegramllm` |
| `POSTGRES_PORT` | Порт БД (хост) | `5433` |
| `LLM_PROVIDER` | `openai` или `openrouter` | `openrouter` |
| `OPENROUTER_API_KEY` | API-ключ OpenRouter | — |
| `OPENAI_API_KEY` | API-ключ OpenAI | — |
| `OPENAI_CHAT_MODEL` | Модель для генерации | `gpt-4o-mini` |
| `JWT_SECRET` | Секрет для JWT-токенов | — |

### 2. Запуск через Docker (рекомендуется)

```bash
docker compose up -d
```

Это поднимет все 4 сервиса: PostgreSQL, Backend, AI Service, Frontend.

### 3. Запуск для разработки

Запустить PostgreSQL:

```bash
docker compose up -d postgres
```

Установить зависимости и запустить каждый сервис в отдельном терминале:

```bash
# Backend
cd backend && npm install && npm run start:dev
```

```bash
# Frontend
cd frontend && npm install && npm run dev
```

```bash
# AI Service
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Открыть

| Сервис | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| AI Service | http://localhost:8000 |

## Как использовать

1. **Регистрация** — создайте аккаунт на http://localhost:3000
2. **Загрузка документов** — в разделе Files загрузите файлы с описанием личности (стиль общения, интересы, биография)
3. **Проверка в чате** — протестируйте бота в разделе Chat
4. **Подключение Telegram** — в разделе Telegram введите API ID и API Hash (получить на https://my.telegram.org), подтвердите код из SMS
5. **Автоответы** — включите автоответ, бот будет отвечать входящим сообщениям от вашего имени

## RAG-пайплайн

```
Загрузка файла → Извлечение текста → Разбиение на чанки (512 токенов)
    → Генерация эмбеддингов (384d) → Сохранение в pgvector
    → При запросе: семантический поиск → Контекст + LLM → Ответ
```

## API-эндпоинты

### Auth
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — авторизация (JWT)

### Files
- `POST /api/files/upload` — загрузка файла
- `GET /api/files` — список файлов
- `DELETE /api/files/:id` — удаление

### Chat
- `POST /api/ai/chat` — отправить сообщение
- `GET /api/ai/history` — история чата
- `DELETE /api/ai/history` — очистить историю

### Telegram
- `POST /api/telegram/credentials` — сохранить API-ключи
- `POST /api/telegram/send-code` — отправить код
- `POST /api/telegram/verify-code` — подтвердить код
- `PATCH /api/telegram/auto-reply` — вкл/выкл автоответ
- `GET /api/telegram/peers` — список контактов
- `GET /api/telegram/peers/:peerId/messages` — история с контактом

## Структура проекта

```
TelegramLLM/
├── backend/                # NestJS API-сервер
│   └── src/
│       └── modules/
│           ├── auth/       # JWT-аутентификация
│           ├── users/      # Управление пользователями
│           ├── files/      # Загрузка и обработка файлов
│           ├── telegram/   # gram.js интеграция
│           └── ai/         # Прокси к AI Service
├── frontend/               # Next.js веб-дашборд
│   └── src/app/
│       └── dashboard/
│           ├── chat/       # Чат с AI
│           ├── files/      # Управление файлами
│           ├── conversations/ # Telegram-переписки
│           └── telegram/   # Мастер подключения
├── ai-service/             # FastAPI RAG-сервис
│   └── app/
│       ├── api/routes/     # HTTP-эндпоинты
│       ├── services/       # LLM, embedding, chunking, retrieval
│       └── models/         # SQLAlchemy-модели
├── docker/postgres/        # Инициализация БД
├── docker-compose.yml
└── .env.example
```
