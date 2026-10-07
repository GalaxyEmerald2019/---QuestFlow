import { Bot } from "grammy";

import { cheapSharkDealUrl, getMultipleGames } from "../cheapshark.js";
import { config } from "../config.js";
import { db } from "../firebase.js";
import type { QuestFlowGame, QuestFlowUser } from "../types.js";

const bot = new Bot(config.telegramBotToken);

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function loadGameData(wishlist: QuestFlowGame[]) {
  const ids = [...new Set(wishlist.map((game) => game.id).filter(Boolean))];
  const merged: Awaited<ReturnType<typeof getMultipleGames>> = {};

  for (const group of chunks(ids, 25)) {
    Object.assign(merged, await getMultipleGames(group));
  }

  return merged;
}

async function processUser(
  docId: string,
  user: QuestFlowUser,
): Promise<{ checked: number; sent: number }> {
  if (!user.telegramId || user.telegramNotificationsEnabled === false) {
    return { checked: 0, sent: 0 };
  }

  const wishlist = user.wishlist ?? [];
  if (wishlist.length === 0) {
    return { checked: 0, sent: 0 };
  }

  const gameData = await loadGameData(wishlist);
  const previous = user.telegramLastNotified ?? {};
  const next = { ...previous };

  let sent = 0;

  for (const game of wishlist) {
    const details = gameData[game.id];
    if (!details?.deals?.length) continue;

    const best = [...details.deals].sort(
      (a, b) => Number(a.price) - Number(b.price),
    )[0];

    if (!best) continue;

    const savings = Math.round(Number(best.savings) || 0);
    if (savings < config.minDiscountPercent) continue;

    const signature = `${best.price}:${savings}`;
    if (previous[game.id] === signature) continue;

    const title = details.info?.title || game.title;
    const message = [
      "🔥 <b>Скидка на игру из wishlist!</b>",
      "",
      `🎮 <b>${escapeHtml(title)}</b>`,
      `💰 Цена: <b>$${Number(best.price).toFixed(2)}</b>`,
      `🏷 Скидка: <b>${savings}%</b>`,
      "",
      `<a href="${cheapSharkDealUrl(best.dealID)}">Открыть предложение</a>`,
    ].join("\n");

    await bot.api.sendMessage(user.telegramId, message, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });

    next[game.id] = signature;
    sent += 1;
  }

  if (sent > 0) {
    await db.collection("users").doc(docId).set(
      {
        telegramLastNotified: next,
        telegramLastCheckAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  return { checked: wishlist.length, sent };
}

async function main(): Promise<void> {
  console.log("QuestFlow wishlist discount check started");

  const snapshot = await db
    .collection("users")
    .where("telegramId", "!=", null)
    .get();

  let checked = 0;
  let sent = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    try {
      const result = await processUser(doc.id, doc.data() as QuestFlowUser);
      checked += result.checked;
      sent += result.sent;
    } catch (error) {
      failed += 1;
      console.error(`Failed to process user ${doc.id}:`, error);
    }
  }

  console.log(
    `QuestFlow discount check complete: ${checked} wishlist items checked, ${sent} notifications sent, ${failed} users failed`,
  );
}

await main();
