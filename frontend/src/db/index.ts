import Dexie, { type Table } from "dexie";

export interface Jar {
  id: string;
  user_id: string;
  name: string;
  budget: number;
  spent: number;
  month: string; // YYYY-MM
  created_at: string;
  updated_at: string;
  sync_status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
}

export interface Expense {
  id: string;
  user_id: string;
  jar_id: string;
  amount: number;
  photo: string; // base64 or blob url
  thumbnail: string;
  created_at: string;
  updated_at: string;
  category?: string;
  idempotency_key: string;
  sync_status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
}

export interface SyncQueueItem {
  id?: number;
  entity: "jar" | "expense";
  entity_id: string;
  action: "create" | "update" | "delete";
  payload: unknown;
  idempotency_key: string;
  status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  retries: number;
  created_at: string;
}

class SpendShotDB extends Dexie {
  jars!: Table<Jar>;
  expenses!: Table<Expense>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super("SpendShotDB");
    this.version(1).stores({
      jars: "id, user_id, month",
      expenses: "id, user_id, jar_id, created_at",
      syncQueue: "++id, entity, entity_id, status",
    });
  }
}

export const db = new SpendShotDB();
