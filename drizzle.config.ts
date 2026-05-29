import {defineConfig} from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://nm:nm@localhost:5432/nm';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
