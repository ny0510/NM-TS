import {Events} from 'discord.js';
import {request as undiciRequest} from 'undici';

import type {NMClient} from '@/client/Client';
import type {ILogger} from '@/utils/logger';

export class KoreanbotsManager {
  private koreanbotsInterval?: ReturnType<typeof setInterval>;
  private koreanbotsLastServers?: number;
  private koreanbotsLastShards?: number;

  constructor(
    private readonly client: NMClient,
    private readonly logger: ILogger,
  ) {}

  public start(): void {
    if (!this.client.config.KOREANBOTS_TOKEN) {
      this.logger.warn('Koreanbots token not provided; skipping Koreanbots stats updates.');
      return;
    }

    if (!this.client.config.KOREANBOTS_CLIENT_ID) {
      this.logger.warn('Koreanbots client ID not provided; skipping Koreanbots stats updates.');
      return;
    }

    this.client.once(Events.ClientReady, () => {
      void this.updateStats();

      this.koreanbotsInterval = setInterval(() => {
        void this.updateStats();
      }, this.client.config.KOREANBOTS_UPDATE_INTERVAL);
    });
  }

  public stop(): void {
    if (this.koreanbotsInterval) {
      clearInterval(this.koreanbotsInterval);
      this.koreanbotsInterval = undefined;
    }
    this.koreanbotsLastServers = undefined;
    this.koreanbotsLastShards = undefined;
  }

  private async updateStats(): Promise<void> {
    try {
      const servers = this.client.guilds.cache.size;
      const payload: {servers: number; shards?: number} = {servers};
      const shardCount = this.client.shard?.count;

      if (this.koreanbotsLastServers === servers && this.koreanbotsLastShards === shardCount) {
        return;
      }

      if (typeof shardCount === 'number') {
        payload.shards = shardCount;
      }

      const response = await undiciRequest(`https://koreanbots.dev/api/v2/bots/${this.client.config.KOREANBOTS_CLIENT_ID}/stats`, {
        method: 'POST',
        headers: {
          Authorization: this.client.config.KOREANBOTS_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const rawBody = await response.body.text();
        let message = rawBody || `Unexpected status code ${response.statusCode}`;

        try {
          const parsed = JSON.parse(rawBody);
          message = parsed?.message ?? message;
        } catch {}

        throw new Error(message);
      }

      this.koreanbotsLastServers = servers;
      this.koreanbotsLastShards = typeof shardCount === 'number' ? shardCount : undefined;

      const shardInfo = payload.shards ? `, shards: ${payload.shards}` : '';
      this.logger.info(`Updated Koreanbots stats (servers: ${servers}${shardInfo}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;

      if (message.includes('존재하지 않는 봇')) {
        this.logger.warn('Koreanbots reported that the bot does not exist; disabling stats updates. Please verify the client ID and token.');
        this.stop();
        return;
      }

      this.logger.error(`Failed to update Koreanbots stats: ${message}`);
    }
  }
}
