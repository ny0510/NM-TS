import type {Client, User} from 'discord.js';
import {Connectors, type LavalinkResponse, LoadType, type Node, type NodeOption, Shoukaku} from 'shoukaku';

import type {NMClient} from '@/client/Client';
import type {Config} from '@/client/types';
import {Queue, type QueueTrack} from '@/structures/Queue';
import type {ILogger} from '@/utils/logger';
import {registerLavalinkEvents, registerPlayerEvents} from '@/utils/music/lavalinkEvents';

export interface CreateQueueOptions {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  shardId: number;
  volume?: number;
  deaf?: boolean;
  mute?: boolean;
}

export interface SearchResult {
  response: LavalinkResponse;
  tracks: QueueTrack[];
}

export class LavalinkManager {
  private readonly shoukaku: Shoukaku;
  private readonly logger: ILogger;
  private readonly queues = new Map<string, Queue>();
  private client: NMClient | null = null;
  constructor(client: Client, logger: ILogger, config: Config) {
    this.logger = logger;

    const nodes: NodeOption[] = [
      {
        name: config.LAVALINK_IDENTIFIER,
        url: `${config.LAVALINK_HOST}:${config.LAVALINK_PORT}`,
        auth: config.LAVALINK_PASSWORD,
        secure: config.LAVALINK_SECURE,
      },
    ];

    this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
      resume: true,
      resumeTimeout: 60 * 5,
      reconnectTries: 5,
      reconnectInterval: 5,
      moveOnDisconnect: false,
    });
  }

  public getShoukaku(): Shoukaku {
    return this.shoukaku;
  }

  public getQueues(): Map<string, Queue> {
    return this.queues;
  }

  public getQueue(guildId: string): Queue | undefined {
    return this.queues.get(guildId);
  }

  public async createQueue(options: CreateQueueOptions): Promise<Queue> {
    const existing = this.queues.get(options.guildId);
    if (existing) return existing;

    const player = await this.shoukaku.joinVoiceChannel({
      guildId: options.guildId,
      channelId: options.voiceChannelId,
      shardId: options.shardId,
      deaf: options.deaf ?? true,
      mute: options.mute ?? false,
    });

    const queue = new Queue({
      shoukaku: this.shoukaku,
      player,
      guildId: options.guildId,
      textChannelId: options.textChannelId,
      voiceChannelId: options.voiceChannelId,
      volume: options.volume,
    });

    this.queues.set(options.guildId, queue);
    if (this.client) {
      registerPlayerEvents(queue, this.client);
    }
    return queue;
  }

  public async destroyQueue(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    await queue.destroy();
    this.queues.delete(guildId);
  }

  public async search(query: string, requester?: User): Promise<LavalinkResponse | undefined> {
    const node = this.shoukaku.getIdealNode();
    if (!node) {
      this.logger.error('No available Lavalink nodes for search');
      return undefined;
    }

    const result = await node.rest.resolve(query);
    if (!result) return undefined;

    if (requester) {
      switch (result.loadType) {
        case LoadType.TRACK: {
          (result.data as QueueTrack).requester = requester;
          break;
        }
        case LoadType.SEARCH: {
          for (const track of result.data) {
            (track as QueueTrack).requester = requester;
          }
          break;
        }
        case LoadType.PLAYLIST: {
          for (const track of result.data.tracks) {
            (track as QueueTrack).requester = requester;
          }
          break;
        }
      }
    }

    return result;
  }

  public getNode(): Node | undefined {
    return this.shoukaku.getIdealNode();
  }

  public registerEvents(client: NMClient): void {
    this.client = client;
    registerLavalinkEvents(client);
    this.logger.debug('Lavalink events registered');
  }
}
