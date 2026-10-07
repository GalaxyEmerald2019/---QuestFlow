import type {
  CheapSharkDeal,
  CheapSharkGameDetails,
  CheapSharkSearchGame,
} from "./types.js";

const BASE_URL = "https://www.cheapshark.com/api/1.0";
const TIMEOUT_MS = 8_000;

async function request<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "QuestFlow-Telegram-Bot/0.1",
      },
    });

    if (!response.ok) {
      throw new Error(`CheapShark request failed with HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchGames(query: string): Promise<CheapSharkSearchGame[]> {
  if (!query.trim()) return [];
  return request<CheapSharkSearchGame[]>(
    `/games?title=${encodeURIComponent(query.trim())}&limit=8`,
  );
}

export async function getTopDeals(limit = 5): Promise<CheapSharkDeal[]> {
  return request<CheapSharkDeal[]>(
    `/deals?pageSize=${Math.max(1, Math.min(20, limit))}&sortBy=Savings`,
  );
}

export async function getGameDetails(id: string): Promise<CheapSharkGameDetails> {
  return request<CheapSharkGameDetails>(`/games?id=${encodeURIComponent(id)}`);
}

export async function getMultipleGames(
  ids: string[],
): Promise<Record<string, CheapSharkGameDetails>> {
  if (ids.length === 0) return {};
  return request<Record<string, CheapSharkGameDetails>>(
    `/games?ids=${ids.map(encodeURIComponent).join(",")}`,
  );
}

export function cheapSharkDealUrl(dealId: string): string {
  return `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(dealId)}`;
}
