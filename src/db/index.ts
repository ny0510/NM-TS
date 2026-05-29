import postgres from 'postgres';
import {drizzle, type PostgresJsDatabase} from 'drizzle-orm/postgres-js';
import {migrate} from 'drizzle-orm/postgres-js/migrator';

import * as schema from './schema';
import {Logger} from '@/utils/logger';

const logger = new Logger('DB');

type Database = PostgresJsDatabase<typeof schema>;

let db: Database | null = null;
let migrationPromise: Promise<void> | null = null;

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

export async function runDbMigrations(): Promise<void> {
  migrationPromise ??= (async () => {
    const migrationClient = postgres(getDatabaseUrl(), {max: 1});

    try {
      await migrate(drizzle(migrationClient), {migrationsFolder: './src/db/migrations'});
      logger.info('Database migrations applied.');
    } catch (error) {
      migrationPromise = null;
      logger.error(error instanceof Error ? error : new Error(`Failed to run database migrations: ${error}`));
      throw error;
    } finally {
      await migrationClient.end();
    }
  })();

  await migrationPromise;
}
