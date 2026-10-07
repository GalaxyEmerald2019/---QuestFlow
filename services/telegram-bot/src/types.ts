export type QuestFlowGame = {
  id: string;
  title: string;
  image?: string;
  steamPrice?: string;
  epicPrice?: string;
  purchasedAt?: string;
  purchasedPrice?: string;
  purchasedStore?: string;
};

export type QuestFlowUser = {
  telegramId?: number;
  telegramUsername?: string | null;
  telegramFirstName?: string;
  telegramNotificationsEnabled?: boolean;
  wishlist?: QuestFlowGame[];
  library?: QuestFlowGame[];
  userXP?: number;
  userLevel?: number;
  xpToNextLevel?: number;
  telegramLastNotified?: Record<string, string>;
};

export type CheapSharkSearchGame = {
  gameID: string;
  steamAppID: string | null;
  cheapest: string;
  cheapestDealID: string;
  external: string;
  thumb: string;
};

export type CheapSharkDeal = {
  dealID: string;
  storeID: string;
  gameID: string;
  title: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  thumb: string;
};

export type CheapSharkGameDetails = {
  info: {
    title: string;
    steamAppID: string | null;
    thumb: string;
  };
  deals: Array<{
    dealID: string;
    storeID: string;
    price: string;
    retailPrice: string;
    savings: string;
  }>;
};
