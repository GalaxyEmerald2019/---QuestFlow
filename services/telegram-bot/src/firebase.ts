import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { config } from "./config.js";

if (getApps().length === 0) {
  initializeApp({
    credential: cert(config.firebaseServiceAccount),
  });
}

export const db = getFirestore();

export function telegramUid(telegramId: number | string): string {
  return `tg_${telegramId}`;
}
