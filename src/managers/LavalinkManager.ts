import type {Client} from 'discord.js';
import {AutoPlayPlatform, Manager, SearchPlatform, TrackPartial} from 'magmastream';

import type {Config} from '@/client/types';
import type {ILogger} from '@/utils/logger';
import {registerLavalinkEvents} from '@/utils/music';

export class LavalinkManager {
  private readonly manager: Manager;
  private readonly logger: ILogger;

  constructor(client: Client, logger: ILogger, config: Config) {
    this.logger = logger;

    this.manager = new Manager({
      nodes: [
        {
          identifier: config.LAVALINK_IDENTIFIER,
          host: config.LAVALINK_HOST,
          port: config.LAVALINK_PORT,
          password: config.LAVALINK_PASSWORD,
          useSSL: config.LAVALINK_SECURE,
          enableSessionResumeOption: true,
          sessionTimeoutSeconds: 60 * 5,
        },
      ],
      playNextOnEnd: true,
      defaultSearchPlatform: SearchPlatform.YouTube,
      autoPlaySearchPlatforms: [AutoPlayPlatform.YouTube, AutoPlayPlatform.Spotify, AutoPlayPlatform.SoundCloud],
      trackPartial: [TrackPartial.Author, TrackPartial.ArtworkUrl, TrackPartial.Duration, TrackPartial.Identifier, TrackPartial.PluginInfo, TrackPartial.Requester, TrackPartial.SourceName, TrackPartial.Title, TrackPartial.Track, TrackPartial.Uri],
      send: packet => {
        const guild = client.guilds.cache.get(packet.d.guild_id);
        if (guild) guild.shard.send(packet);
      },
    });
  }

  public getManager(): Manager {
    return this.manager;
  }

  public initialize(clientId: string): void {
    try {
      this.manager.init({clientId});
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
