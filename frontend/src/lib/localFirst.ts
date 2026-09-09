import { db, type Jar, type Expense, type SyncQueueItem } from "../db";

export async function saveJarLocal(jar: Jar) {
  await db.jars.put(jar);
  await db.syncQueue.add({
    entity: "jar", entity_id: jar.id, action: "create",
    payload: jar, idempotency_key: jar.id, status: "PENDING", retries: 0, created_at: new Date().toISOString()
  });
}

export async function saveExpenseLocal(exp: Expense) {
  await db.expenses.put(exp);
  await db.syncQueue.add({
    entity: "expense", entity_id: exp.id, action: "create",
    payload: exp, idempotency_key: exp.idempotency_key, status: "PENDING", retries: 0, created_at: new Date().toISOString()
  });
  // update jar spent locally
  const jar = await db.jars.get(exp.jar_id);
  if (jar) { jar.spent += exp.amount; await db.jars.put(jar); }
}

export async function getLocalJars(userId: string) {
  return db.jars.where("user_id").equals(userId).toArray();
}

export async function getLocalExpenses(jarId?: string) {
  if (jarId) return db.expenses.where("jar_id").equals(jarId).toArray();
  return db.expenses.toArray();
}

export async function getSyncQueue() { return db.syncQueue.toArray(); }

export async function markSyncStatus(id: number, status: SyncQueueItem["status"]) {
  await db.syncQueue.update(id, { status });
}
