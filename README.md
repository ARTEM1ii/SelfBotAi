# TelegramLLM

Платформа для создания AI-ассистента в Telegram. Загружаете документы и каталог товаров — бот отвечает от вашего имени, находит товары по фото и тексту, обрабатывает заказы. Поддерживает RAG-поиск по документам, CLIP-поиск по изображениям, автоответы в Telegram и веб-дашборд для управления.

## Архитектура

```
┌──────────────────────────────────────────────────────────┐
│                Frontend (Next.js @ :3000)                  │
│   /chat  /files  /products  /telegram  /conversations     │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP (axios)
┌──────────────────────▼───────────────────────────────────┐
│                Backend (NestJS @ :4000)                    │
│  Auth (JWT) │ Files │ Products │ Telegram (gram.js) │ AI  │
└───────┬──────────────────────────────────────┬───────────┘
        │ HTTP                                 │ gram.js
┌───────▼─────────────────────┐     ┌──────────▼───────────┐
│  AI Service (FastAPI @ :8000)│     │   Telegram API       │
│  RAG + LLM + CLIP + Product │     │   (live connection)  │
│  embeddings                  │     └──────────────────────┘
└───────┬─────────────────────┘
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
| Эмбеддинги (документы) | HuggingFace Inference API (all-MiniLM-L6-v2) |
| Эмбеддинги (товары) | Локальный CLIP (clip-ViT-B-32) + MiniLM |
| Поиск по изображениям | PyTorch + sentence-transformers (CPU) |
| Telegram | gram.js (прямое подключение к Telegram API) |

## Возможности

- **Каталог товаров** — добавляйте товары с фото, описанием, ценой и количеством через веб-дашборд
- **Поиск по фото** — отправьте фото товара в Telegram, бот найдёт похожие из каталога (CLIP-эмбеддинги)
- **Поиск по тексту** — напишите "хочу арматуру" и бот подберёт товары из каталога
- **Оформление заказа** — бот принимает заказы прямо в Telegram и списывает остаток со склада
- **RAG-поиск** — загружайте документы (TXT, PDF, DOCX, MD), бот использует их как базу знаний
- **Автоответы в Telegram** — подключите аккаунт и включите автоответ для выбранных контактов
- **Защита от prompt injection** — многослойная система предотвращения выхода из роли
- **Веб-дашборд** — управление файлами, товарами, чат с ботом, просмотр переписок, настройка Telegram
- **Управление контактами** — блокировка, удаление, просмотр истории переписки

## Требования

- Docker и Docker Compose (рекомендуется)
- Или для локальной разработки: Node.js 20+, Python 3.11–3.12 (PyTorch не поддерживает 3.13+)

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
| `HF_API_TOKEN` | Токен HuggingFace (для эмбеддингов документов) | — |
| `TELEGRAM_API_ID` | API ID Telegram (https://my.telegram.org) | — |
| `TELEGRAM_API_HASH` | API Hash Telegram | — |

### 2. Запуск через Docker (рекомендуется)

```bash
docker compose up -d
```

Это поднимет все 4 сервиса: PostgreSQL, Backend, AI Service, Frontend.

> **Первый запуск**: AI Service скачивает модели CLIP (~350 MB) и MiniLM (~90 MB) при первом обращении. Это может занять несколько минут.

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
2. **Загрузка документов** — в разделе Files загрузите файлы с описанием бизнеса, прайсы, инструкции
3. **Добавление товаров** — в разделе Products добавьте товары с фото, описанием, ценой и количеством на складе
4. **Проверка в чате** — протестируйте бота в разделе Chat
5. **Подключение Telegram** — в разделе Telegram введите API ID и API Hash (получить на https://my.telegram.org), подтвердите код из SMS
6. **Автоответы** — включите автоответ, бот будет отвечать входящим сообщениям, находить товары и принимать заказы

## Пайплайны

### RAG (документы)
```
Загрузка файла → Извлечение текста → Разбиение на чанки (512 токенов)
    → Генерация эмбеддингов (384d, HuggingFace) → Сохранение в pgvector
    → При запросе: семантический поиск → Контекст + LLM → Ответ
```

### Поиск товаров по фото
```
Фото от клиента → CLIP-эмбеддинг изображения (512d)
    → Cosine similarity с эмбеддингами товаров → Top-3 результата
    → Карточка товара + LLM-ответ менеджера
```

### Поиск товаров по тексту
```
Текст запроса → MiniLM-эмбеддинг (384d)
    → Cosine similarity с текстовыми эмбеддингами товаров → Top-3
    → Контекст товаров + LLM → Ответ с предложением
```

### Оформление заказа (Telegram)
```
Клиент пишет "беру 5 штук" → Распознавание намерения + количества
    → Проверка наличия на складе → Списание остатка
    → Подтверждение через LLM
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

### Products
- `POST /api/products` — создать товар (multipart: image + поля)
- `GET /api/products` — список всех товаров
- `GET /api/products/:id` — получить товар
- `PATCH /api/products/:id` — обновить товар
- `DELETE /api/products/:id` — удалить товар
- `GET /api/products/:id/image` — изображение товара

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
│           ├── products/   # Каталог товаров (CRUD + изображения)
│           ├── telegram/   # gram.js интеграция (фото + покупки)
│           └── ai/         # Прокси к AI Service
├── frontend/               # Next.js веб-дашборд
│   └── src/app/
│       └── dashboard/
│           ├── chat/       # Чат с AI
│           ├── files/      # Управление файлами
│           ├── products/   # Управление каталогом товаров
│           ├── conversations/ # Telegram-переписки
│           └── telegram/   # Мастер подключения
├── ai-service/             # FastAPI RAG-сервис
│   └── app/
│       ├── api/routes/     # HTTP-эндпоинты (chat, process, products)
│       ├── services/       # LLM, embedding, CLIP, product retrieval
│       └── models/         # SQLAlchemy-модели (chunks, product embeddings)
├── docker/postgres/        # Инициализация БД
├── docker-compose.yml
└── .env.example
```
