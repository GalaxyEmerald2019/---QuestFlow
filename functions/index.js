import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { Bot, InlineKeyboard } from "grammy";

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_WEBHOOK_SECRET = defineSecret("TELEGRAM_WEBHOOK_SECRET");

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const QUESTFLOW_WEB_URL = "https://velo-app.web.app";
const CHEAPSHARK_BASE = "https://www.cheapshark.com/api/1.0";

let cachedBot = null;
let cachedToken = null;

function telegramUid(id) {
  return `tg_${id}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function usd(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : "$—";
}

async function cheapShark(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${CHEAPSHARK_BASE}${path}`, {
      signal: controller.signal,
      headers: { "User-Agent": "QuestFlow-Telegram-Bot/1.0" },
    });

    if (!response.ok) {
      throw new Error(`CheapShark HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureProfile(ctx) {
  if (!ctx.from) return null;

  const uid = telegramUid(ctx.from.id);
  const ref = db.collection("users").doc(uid);
  const snapshot = await ref.get();

  const data = {
    telegramId: ctx.from.id,
    telegramUsername: ctx.from.username ?? null,
    telegramFirstName: ctx.from.first_name,
    telegramLastName: ctx.from.last_name ?? null,
    telegramUpdatedAt: new Date().toISOString(),
  };

  if (!snapshot.exists) {
    data.telegramNotificationsEnabled = true;
  }

  await ref.set(data, { merge: true });
  return uid;
}

async function getUser(ctx) {
  if (!ctx.from) return null;
  await ensureProfile(ctx);
  const snapshot = await db.collection("users").doc(telegramUid(ctx.from.id)).get();
  return snapshot.exists ? snapshot.data() : null;
}

function mainKeyboard() {
  return new InlineKeyboard()
    .url("🎮 Открыть QuestFlow", QUESTFLOW_WEB_URL)
    .row()
    .text("🔥 Лучшие скидки", "deals")
    .text("❤️ Wishlist", "wishlist")
    .row()
    .text("🔔 Настройки", "settings");
}

async function replyWishlist(ctx) {
  const user = await getUser(ctx);
  const wishlist = user?.wishlist ?? [];

  if (wishlist.length === 0) {
    await ctx.reply(
      "❤️ <b>Wishlist пока пуст.</b>\n\nДобавь игры в список желаемого в QuestFlow, и бот сможет отслеживать скидки.",
      {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().url("Открыть QuestFlow", QUESTFLOW_WEB_URL),
      },
    );
    return;
  }

  const visible = wishlist.slice(0, 15);
  const lines = visible.map(
    (game, index) => `${index + 1}. ${escapeHtml(game.title)}`,
  );
  const more =
    wishlist.length > visible.length
      ? `\n\n…и ещё ${wishlist.length - visible.length}`
      : "";

  await ctx.reply(
    `❤️ <b>Твой wishlist</b>\n\n${lines.join("\n")}${more}\n\nВсего: <b>${wishlist.length}</b>`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().url("Открыть QuestFlow", QUESTFLOW_WEB_URL),
    },
  );
}

async function replyDeals(ctx) {
  await ctx.reply("🔎 Ищу лучшие скидки…");

  const deals = await cheapShark("/deals?pageSize=6&sortBy=Savings");
  if (!Array.isArray(deals) || deals.length === 0) {
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
        `🛒 ${String(deal.title).slice(0, 24)}`,
        `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.dealID)}`,
      )
      .row();
  }

  await ctx.reply(`🔥 <b>Лучшие скидки сейчас</b>\n\n${lines.join("\n\n")}`, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

async function replySettings(ctx) {
  const user = await getUser(ctx);
  const enabled = user?.telegramNotificationsEnabled !== false;

  await ctx.reply(
    `🔔 <b>Уведомления QuestFlow</b>\n\nСкидки из wishlist: <b>${enabled ? "включены ✅" : "выключены ❌"}</b>`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("✅ Включить", "notify:on")
        .text("❌ Выключить", "notify:off"),
    },
  );
}

async function setNotifications(ctx, enabled) {
  if (!ctx.from) return;

  await ensureProfile(ctx);
  await db.collection("users").doc(telegramUid(ctx.from.id)).set(
    { telegramNotificationsEnabled: enabled },
    { merge: true },
  );

  await ctx.reply(
    enabled
      ? "🔔 Уведомления о скидках включены."
      : "🔕 Уведомления о скидках выключены.",
  );
}

function buildBot(token) {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    await ensureProfile(ctx);
    await ctx.reply(
      `👋 Привет, <b>${escapeHtml(ctx.from?.first_name ?? "Игрок")}</b>!\n\nЯ бот <b>QuestFlow</b>. Ищу игры и скидки, показываю твой wishlist и профиль, а также могу уведомлять о снижении цен.`,
      { parse_mode: "HTML", reply_markup: mainKeyboard() },
    );
  });

  bot.command("help", async (ctx) => {
    await ensureProfile(ctx);
    await ctx.reply(
      [
        "🤖 <b>QuestFlow Bot</b>",
        "",
        "/search название - найти игру",
        "/deals - лучшие скидки",
        "/wishlist - список желаемого",
        "/profile - уровень, XP и библиотека",
        "/settings - настройки уведомлений",
        "/notify_on - включить уведомления",
        "/notify_off - выключить уведомления",
        "/app - открыть QuestFlow",
      ].join("\n"),
      { parse_mode: "HTML", reply_markup: mainKeyboard() },
    );
  });

  bot.command("app", async (ctx) => {
    await ensureProfile(ctx);
    await ctx.reply("🎮 Открыть QuestFlow:", {
      reply_markup: new InlineKeyboard().url("Запустить QuestFlow", QUESTFLOW_WEB_URL),
    });
  });

  bot.command("search", async (ctx) => {
    await ensureProfile(ctx);
    const query = ctx.match?.trim();

    if (!query) {
      await ctx.reply("Использование: <code>/search Cyberpunk 2077</code>", {
        parse_mode: "HTML",
      });
      return;
    }

    await ctx.reply(`🔎 Ищу: <b>${escapeHtml(query)}</b>…`, { parse_mode: "HTML" });

    const games = await cheapShark(
      `/games?title=${encodeURIComponent(query)}&limit=8`,
    );

    if (!Array.isArray(games) || games.length === 0) {
      await ctx.reply("Ничего не нашёл. Попробуй другое название.");
      return;
    }

    const keyboard = new InlineKeyboard();
    for (const game of games.slice(0, 8)) {
      keyboard
        .text(
          `🎮 ${String(game.external).slice(0, 35)} · от ${usd(game.cheapest)}`,
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
    const user = await getUser(ctx);

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
      const game = await cheapShark(`/games?id=${encodeURIComponent(gameId)}`);
      const best = [...(game.deals ?? [])].sort(
        (a, b) => Number(a.price) - Number(b.price),
      )[0];

      if (!best) {
        await ctx.reply("Для этой игры сейчас нет доступных предложений.");
        return;
      }

      const savings = Math.round(Number(best.savings) || 0);
      const keyboard = new InlineKeyboard()
        .url(
          "🛒 Открыть предложение",
          `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(best.dealID)}`,
        )
        .row()
        .url("🎮 QuestFlow", QUESTFLOW_WEB_URL);

      await ctx.reply(
        [
          `🎮 <b>${escapeHtml(game.info?.title ?? "Игра")}</b>`,
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
    console.error("QuestFlow Telegram update failed:", error.error);
  });

  return bot;
}

function getBot(token) {
  if (!cachedBot || cachedToken !== token) {
    cachedBot = buildBot(token);
    cachedToken = token;
  }
  return cachedBot;
}

export const telegramWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method === "GET") {
      res.status(200).send("QuestFlow Telegram Bot is online");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const expectedSecret = TELEGRAM_WEBHOOK_SECRET.value();
    const receivedSecret = req.get("x-telegram-bot-api-secret-token");

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      res.status(403).send("Forbidden");
      return;
    }

    try {
      const token = TELEGRAM_BOT_TOKEN.value();
      const bot = getBot(token);
      await bot.handleUpdate(req.body);
      res.status(200).send("OK");
    } catch (error) {
      console.error("Telegram webhook request failed:", error);
      res.status(500).send("Internal Server Error");
    }
  },
);
