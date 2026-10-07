import { Bot, InlineKeyboard, type Context } from "grammy";

import {
  cheapSharkDealUrl,
  getGameDetails,
  getTopDeals,
  searchGames,
} from "./cheapshark.js";
import { config } from "./config.js";
import { db, telegramUid } from "./firebase.js";
import type { QuestFlowUser } from "./types.js";

export const bot = new Bot(config.telegramBotToken);

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function usd(value: string | number): string {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : "$—";
}

async function ensureTelegramProfile(ctx: Context): Promise<string | null> {
  const from = ctx.from;
  if (!from) return null;

  const uid = telegramUid(from.id);
  const ref = db.collection("users").doc(uid);
  const snapshot = await ref.get();

  const data: Record<string, unknown> = {
    telegramId: from.id,
    telegramUsername: from.username ?? null,
    telegramFirstName: from.first_name,
    telegramLastName: from.last_name ?? null,
    telegramUpdatedAt: new Date().toISOString(),
  };

  if (!snapshot.exists) {
    data.telegramNotificationsEnabled = true;
  }

  await ref.set(data, { merge: true });
  return uid;
}

async function getCurrentUser(ctx: Context): Promise<QuestFlowUser | null> {
  const from = ctx.from;
  if (!from) return null;

  await ensureTelegramProfile(ctx);
  const snapshot = await db.collection("users").doc(telegramUid(from.id)).get();
  return snapshot.exists ? (snapshot.data() as QuestFlowUser) : null;
}

function mainKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url("🎮 Открыть QuestFlow", config.questFlowWebUrl)
    .row()
    .text("🔥 Лучшие скидки", "deals")
    .text("❤️ Wishlist", "wishlist")
    .row()
    .text("🔔 Настройки", "settings");
}

async function replyWishlist(ctx: Context): Promise<void> {
  const user = await getCurrentUser(ctx);
  const wishlist = user?.wishlist ?? [];

  if (wishlist.length === 0) {
    await ctx.reply(
      "❤️ <b>Wishlist пока пуст.</b>\n\nДобавь игры в список желаемого в QuestFlow, и бот сможет отслеживать скидки.",
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().url("Открыть QuestFlow", config.questFlowWebUrl),
      },
    );
    return;
  }

  const visible = wishlist.slice(0, 15);
  const lines = visible.map((game, index) => `${index + 1}. ${escapeHtml(game.title)}`);

  const suffix =
    wishlist.length > visible.length
      ? `\n\n…и ещё ${wishlist.length - visible.length}`
      : "";

  await ctx.reply(
    `❤️ <b>Твой wishlist</b>\n\n${lines.join("\n")}${suffix}\n\nВсего: <b>${wishlist.length}</b>`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().url("Открыть библиотеку QuestFlow", config.questFlowWebUrl),
    },
  );
}

async function replyDeals(ctx: Context): Promise<void> {
  await ctx.reply("🔎 Ищу лучшие скидки…");

  const deals = await getTopDeals(6);
  if (deals.length === 0) {
    await ctx.reply("Сейчас не удалось получить список скидок. Попробуй позже.");
    return;
  }

  const lines = deals.map((deal, index) => {
    const savings = Math.round(Number(deal.savings) || 0);
    return (
      `${index + 1}. <b>${escapeHtml(deal.title)}</b>\n` +
      `   ${usd(deal.salePrice)} вместо ${usd(deal.normalPrice)} · -${savings}%`
    );
  });

  const keyboard = new InlineKeyboard();
  for (const deal of deals.slice(0, 4)) {
    keyboard
      .url(
        `🛒 ${deal.title.slice(0, 24)}`,
        cheapSharkDealUrl(deal.dealID),
      )
      .row();
  }

  await ctx.reply(`🔥 <b>Лучшие скидки сейчас</b>\n\n${lines.join("\n\n")}`, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

async function replySettings(ctx: Context): Promise<void> {
  const user = await getCurrentUser(ctx);
  const enabled = user?.telegramNotificationsEnabled !== false;

  await ctx.reply(
    `🔔 <b>Уведомления QuestFlow</b>\n\nСкидки из wishlist: <b>${enabled ? "включены ✅" : "выключены ❌"}</b>\nМинимальная скидка сервиса: <b>${config.minDiscountPercent}%</b>`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("✅ Включить", "notify:on")
        .text("❌ Выключить", "notify:off"),
    },
  );
}

bot.command("start", async (ctx) => {
  await ensureTelegramProfile(ctx);

  const firstName = escapeHtml(ctx.from?.first_name ?? "Игрок");
  await ctx.reply(
    `👋 Привет, <b>${firstName}</b>!\n\nЯ бот <b>QuestFlow</b>. Могу искать игры, показывать скидки, читать твой wishlist и уведомлять о снижении цен.\n\nЕсли ты открываешь QuestFlow через Telegram Mini App, бот и приложение используют один профиль.`,
    {
      parse_mode: "HTML",
      reply_markup: mainKeyboard(),
    },
  );
});

bot.command("help", async (ctx) => {
  await ensureTelegramProfile(ctx);
  await ctx.reply(
    [
      "🤖 <b>Команды QuestFlow Bot</b>",
      "",
      "/search название - найти игру",
      "/deals - лучшие скидки",
      "/wishlist - список желаемого",
      "/profile - уровень, XP и библиотека",
      "/settings - уведомления",
      "/notify_on - включить уведомления",
      "/notify_off - выключить уведомления",
      "/app - открыть QuestFlow",
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: mainKeyboard() },
  );
});

bot.command("app", async (ctx) => {
  await ensureTelegramProfile(ctx);
  await ctx.reply("🎮 Открыть QuestFlow:", {
    reply_markup: new InlineKeyboard().url("Запустить QuestFlow", config.questFlowWebUrl),
  });
});

bot.command("search", async (ctx) => {
  await ensureTelegramProfile(ctx);

  const query = ctx.match?.trim();
  if (!query) {
    await ctx.reply("Использование: <code>/search Cyberpunk 2077</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  await ctx.reply(`🔎 Ищу: <b>${escapeHtml(query)}</b>…`, { parse_mode: "HTML" });

  const games = (await searchGames(query)).slice(0, 8);
  if (games.length === 0) {
    await ctx.reply("Ничего не нашёл. Попробуй другое название.");
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const game of games) {
    keyboard
      .text(
        `🎮 ${game.external.slice(0, 35)} · от ${usd(game.cheapest)}`,
        `game:${game.gameID}`,
      )
      .row();
  }

  await ctx.reply("Выбери игру:", { reply_markup: keyboard });
});

bot.command("deals", replyDeals);
bot.command("wishlist", replyWishlist);
bot.command("settings", replySettings);

bot.command("profile", async (ctx) => {
  const user = await getCurrentUser(ctx);
  if (!user) {
    await ctx.reply("Не удалось загрузить профиль.");
    return;
  }

  await ctx.reply(
    [
      "👤 <b>Профиль QuestFlow</b>",
      "",
      `⭐ Уровень: <b>${user.userLevel ?? 1}</b>`,
      `⚡ XP: <b>${user.userXP ?? 0}</b> / ${user.xpToNextLevel ?? 100}`,
      `🎮 В библиотеке: <b>${user.library?.length ?? 0}</b>`,
      `❤️ В wishlist: <b>${user.wishlist?.length ?? 0}</b>`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

async function setNotifications(ctx: Context, enabled: boolean): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  await ensureTelegramProfile(ctx);
  await db.collection("users").doc(telegramUid(from.id)).set(
    { telegramNotificationsEnabled: enabled },
    { merge: true },
  );

  await ctx.reply(
    enabled
      ? "🔔 Уведомления о скидках включены."
      : "🔕 Уведомления о скидках выключены.",
  );
}

bot.command("notify_on", (ctx) => setNotifications(ctx, true));
bot.command("notify_off", (ctx) => setNotifications(ctx, false));

bot.callbackQuery("deals", async (ctx) => {
  await ctx.answerCallbackQuery();
  await replyDeals(ctx);
});

bot.callbackQuery("wishlist", async (ctx) => {
  await ctx.answerCallbackQuery();
  await replyWishlist(ctx);
});

bot.callbackQuery("settings", async (ctx) => {
  await ctx.answerCallbackQuery();
  await replySettings(ctx);
});

bot.callbackQuery("notify:on", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Уведомления включены" });
  await setNotifications(ctx, true);
});

bot.callbackQuery("notify:off", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Уведомления выключены" });
  await setNotifications(ctx, false);
});

bot.callbackQuery(/^game:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Загружаю игру…" });

  const gameId = ctx.match[1];
  if (!gameId) return;

  try {
    const game = await getGameDetails(gameId);
    const best = [...game.deals].sort((a, b) => Number(a.price) - Number(b.price))[0];

    if (!best) {
      await ctx.reply("Для этой игры сейчас нет доступных предложений.");
      return;
    }

    const savings = Math.round(Number(best.savings) || 0);
    const keyboard = new InlineKeyboard()
      .url("🛒 Открыть предложение", cheapSharkDealUrl(best.dealID))
      .row()
      .url("🎮 QuestFlow", config.questFlowWebUrl);

    await ctx.reply(
      [
        `🎮 <b>${escapeHtml(game.info.title)}</b>`,
        "",
        `💰 Лучшая цена: <b>${usd(best.price)}</b>`,
        `🏷 Обычная цена: ${usd(best.retailPrice)}`,
        `🔥 Скидка: <b>${savings}%</b>`,
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  } catch (error) {
    console.error("Game callback failed:", error);
    await ctx.reply("Не удалось загрузить данные игры. Попробуй позже.");
  }
});

bot.catch((error) => {
  console.error("QuestFlow bot error:", error.error);
});
