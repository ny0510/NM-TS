import postgres from 'postgres';

import * as schema from './schema';
import {type PostgresJsDatabase, drizzle} from 'drizzle-orm/postgres-js';

type Database = PostgresJsDatabase<typeof schema>;

let db: Database | null = null;

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  return databaseUrl;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDb(): Database {
  const databaseUrl = getDatabaseUrl();

  if (!db) {
    const client = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
    });
    db = drizzle(client, {schema});
  }

  return db;
}
