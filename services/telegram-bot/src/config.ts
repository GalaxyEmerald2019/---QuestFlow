import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseServiceAccount(raw: string): Record<string, unknown> {
  const normalized = raw.trim();

  try {
    return JSON.parse(normalized) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT must be raw JSON or base64-encoded JSON");
    }
  }
}

const minDiscount = Number(process.env.MIN_DISCOUNT_PERCENT ?? "5");

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  firebaseServiceAccount: parseServiceAccount(required("FIREBASE_SERVICE_ACCOUNT")),
  questFlowWebUrl: process.env.QUESTFLOW_WEB_URL?.trim() || "https://velo-app.web.app",
  minDiscountPercent: Number.isFinite(minDiscount) ? Math.max(0, minDiscount) : 5,
};
