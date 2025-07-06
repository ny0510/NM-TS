import type {Client} from 'discord.js';
import {Manager, type Payload, SearchPlatform} from 'magmastream';

import type {Config} from '@/client/types';
import type {ILogger} from '@/utils/logger';
import {registerLavalinkEvents} from '@/utils/music';

export class LavalinkManager {
  private readonly manager: Manager;
  private readonly logger: ILogger;
  private readonly config: Config;

  constructor(client: Client, logger: ILogger, config: Config) {
    this.logger = logger;
    this.config = config;

    this.manager = new Manager({
      nodes: [
        {
          identifier: config.LAVALINK_IDENTIFIER,
          host: config.LAVALINK_HOST,
          port: config.LAVALINK_PORT,
          password: config.LAVALINK_PASSWORD,
          secure: config.LAVALINK_SECURE,
        },
      ],
      autoPlay: true,
      defaultSearchPlatform: SearchPlatform.YouTube,
      autoPlaySearchPlatform: SearchPlatform.YouTube,
      send: (id: string, payload: Payload) => {
        const guild = client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
      },
    });
  }

  public getManager(): Manager {
    return this.manager;
  }

  public initialize(clientId: string): void {
    try {
      this.manager.init(clientId);
      this.logger.debug('Lavalink manager initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize Lavalink manager: ${error}`);
      throw error;
    }
  }

  public registerEvents(client: any): void {
    registerLavalinkEvents(client);
    this.logger.debug('Lavalink events registered');
  }
}
