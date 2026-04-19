import type {Guild} from 'discord.js';

import type {NMClient} from '@/client/Client';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  info(message: string): void;
  warn(message: string): void;
  error(error: unknown): void;
  debug(message: string): void;
  setLevel(level: LogLevel): void;
  setClient(client: NMClient): void;
  guildJoined(guild: Guild, client?: NMClient): void;
  guildLeft(guild: Guild, client?: NMClient): void;
}
