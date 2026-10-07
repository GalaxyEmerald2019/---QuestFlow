import { bot } from "./bot.js";

await bot.api.setMyCommands([
  { command: "start", description: "Запустить QuestFlow Bot" },
  { command: "search", description: "Найти игру" },
  { command: "deals", description: "Лучшие скидки" },
  { command: "wishlist", description: "Мой wishlist" },
  { command: "profile", description: "Профиль QuestFlow" },
  { command: "settings", description: "Настройки уведомлений" },
  { command: "app", description: "Открыть QuestFlow" },
  { command: "help", description: "Помощь" },
]);

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

console.log("QuestFlow Telegram Bot is starting…");

await bot.start({
  onStart: (botInfo) => {
    console.log(`QuestFlow Bot started as @${botInfo.username}`);
  },
});
