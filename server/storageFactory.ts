import type { IStorage } from "./storage";
import { FileStorage } from "./storage";
import { SqliteStorage } from "./sqlite-storage";

function createStorage(): IStorage {
  const useSqlite = process.env.STORAGE_BACKEND === "sqlite";

  if (useSqlite) {
    console.log("Using SQLite storage backend");

    return new SqliteStorage();
  }

  console.log("Using JSON file storage backend");

  return new FileStorage();
}

export const storage = createStorage();