# 🎮 QuestFlow

> A unified gaming platform for discovering games, comparing deals, managing a personal library, and gradually bringing multiple digital game services into one interface.

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

[🇷🇺 Русская версия](README.ru.md) · [Previous README](README.old.md)

## About

**QuestFlow** is a portfolio and educational project focused on creating one convenient gaming environment instead of several disconnected storefronts and launchers.

The current web application already combines game discovery, deal browsing, a personal library, wishlist logic, user progress, authentication, notifications, localization, regional currencies, PWA support and cloud synchronization.

The long-term goal is broader: turn QuestFlow into a unified game client that can connect external libraries and stores, help the user choose what to buy or play next, and later provide desktop launcher functionality.

## Current features

- Game catalog and deal browsing
- Game pages and search
- Personal library and wishlist
- XP, levels and user progression
- Firebase authentication and cloud data synchronization
- Guest mode
- Regional currencies and exchange-rate updates
- Russian, English and Kazakh localization
- Notifications and wishlist checks
- PWA installation
- Telegram-related integration and automated deal checks
- Responsive glassmorphism-style interface
- Settings for motion, region and language
- Error handling, loading states and route protection

## Project direction

QuestFlow is planned as more than a price aggregator. The target platform includes:

- Unified library for Steam, Epic Games, GOG and local games
- Automatic detection of installed games and library manifests
- Launching local games and applications from QuestFlow
- Install, uninstall, download and file-verification workflows
- Playtime and launch history
- Achievements and extended profile statistics
- Price history and stronger multi-store comparison
- Duplicate detection across different stores
- Personalized recommendations with explainable reasons
- Filters based on genres, preferences and technical compatibility
- Optional cloud synchronization across devices
- Desktop application based on Electron
- Local desktop database and offline library mode
- Further development of Liquid Glass visuals, dynamic backgrounds and richer interactions

These items are a roadmap. They should not be treated as already implemented unless they are present in the current codebase.

## Main screens

| Home | Library |
| :---: | :---: |
| ![Home](./assets/home.png) | ![Library](./assets/library.png) |

| Search | Settings |
| :---: | :---: |
| ![Search](./assets/search.png) | ![Settings](./assets/settings.png) |

| Notifications | PWA / Downloads |
| :---: | :---: |
| ![Notifications](./assets/alerts.png) | ![Download](./assets/download.png) |

### Search demo

![Search Demo](./assets/searching_gif.gif)

## Tech stack

- React 19
- TypeScript
- Vite
- React Router
- Zustand
- TanStack Query
- Firebase Authentication and Firestore
- Tailwind CSS 4 / custom UI styles
- i18next
- React Hook Form + Zod
- Vitest
- PWA
- GitHub Actions

## Architecture direction

The current application is a React-based web client with Firebase services and external APIs. Future versions may separate responsibilities into dedicated services so that game aggregation, recommendations, price processing and desktop launcher functions can evolve independently.

## Getting started

```bash
git clone https://github.com/GalaxyEmerald2019/---QuestFlow.git
cd ---QuestFlow
npm install
cp .env.example .env
npm run dev
```

Production build:

```bash
npm run build
```

Tests:

```bash
npm run test:run
```

## Telegram Bot service

QuestFlow now includes an isolated Telegram service in [`services/telegram-bot`](services/telegram-bot).

It supports game search, current deals, QuestFlow wishlist access, profile statistics, notification settings and automatic wishlist discount alerts. Telegram Mini App users share the same Firestore document with the bot via the `tg_<telegramId>` user ID convention.

The service is intentionally separated from the React frontend so it can later be moved into its own `QuestFlow-Bot` repository or deployed independently.

## Project status

QuestFlow is under active development. The current repository represents the working web version and the foundation for a larger gaming platform.

## Archive

The previous VELO-oriented README has been preserved for history:

- [README.old.md](README.old.md)
- [README.ru.old.md](README.ru.old.md)
