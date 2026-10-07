# QuestFlow Telegram Bot

Отдельный Telegram-сервис для QuestFlow.

## Возможности

- `/start` - регистрация Telegram-профиля и главное меню
- `/search <игра>` - поиск игр через CheapShark
- `/deals` - лучшие текущие скидки
- `/wishlist` - wishlist пользователя QuestFlow
- `/profile` - уровень, XP, библиотека и wishlist
- `/settings` - управление уведомлениями
- `/notify_on` и `/notify_off` - включение/отключение скидочных уведомлений
- `/app` - переход в QuestFlow
- автоматические уведомления о новых скидках из wishlist
- защита от повторной отправки одной и той же цены/скидки

## Как бот связан с QuestFlow

Telegram Mini App в текущем QuestFlow использует идентификатор пользователя:

```text
tg_<TELEGRAM_USER_ID>
```

Бот использует точно такой же ID документа Firestore. Поэтому Telegram-пользователь видит в боте тот же wishlist, библиотеку, XP и уровень, что и в веб-приложении.

Основная коллекция:

```text
users/tg_<telegramId>
```

Бот дополняет документ полями:

- `telegramId`
- `telegramUsername`
- `telegramFirstName`
- `telegramNotificationsEnabled`
- `telegramLastNotified`
- `telegramLastCheckAt`

## Локальный запуск

Требуется Node.js 20+.

```bash
cd services/telegram-bot
npm install
cp .env.example .env
npm run dev
```

Для production:

```bash
npm run build
npm start
```

## Переменные окружения

```env
TELEGRAM_BOT_TOKEN=...
FIREBASE_SERVICE_ACCOUNT=...
QUESTFLOW_WEB_URL=https://...
MIN_DISCOUNT_PERCENT=5
```

`FIREBASE_SERVICE_ACCOUNT` принимает либо JSON service account в одну строку, либо тот же JSON в Base64.

Секреты нельзя коммитить в GitHub.

## Проверка скидок

Одноразовый запуск задачи:

```bash
npm run check:discounts
```

Её можно запускать по расписанию через GitHub Actions или любой внешний scheduler. Задача читает wishlist пользователей, сравнивает цены через CheapShark и отправляет уведомление только если комбинация цены и скидки изменилась с предыдущего уведомления.

## Развертывание

Сам бот работает через long polling, поэтому ему нужен постоянно работающий Node.js-процесс. Подойдут Railway, Render, Fly.io, VPS или другой сервис для long-running приложений.

Планируемая следующая стадия: вынести эту папку в отдельный репозиторий `QuestFlow-Bot` без изменения внутренней архитектуры.
