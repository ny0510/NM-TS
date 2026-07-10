import type {Client, User} from 'discord.js';
import {Connectors, type LavalinkResponse, LoadType, type Node, type NodeOption, Shoukaku} from 'shoukaku';

import type {NMClient} from '@/client/Client';
import {Queue} from '@/features/music/queue/Queue';
import type {Config} from '@/types/client';
import type {QueueTrack} from '@/types/music';
import type {CreateQueueOptions} from '@/types/music';
import {isURL} from '@/shared/formatting/patterns';
import type {ILogger} from '@/shared/logger';
import {registerLavalinkEvents, registerPlayerEvents} from '@/managers/lavalink';

/** 재시도 기본 지연 시간 (1초) */
const RETRY_DELAY_MS = 1000;

export class LavalinkManager {
  private readonly shoukaku: Shoukaku;
  private readonly logger: ILogger;
  private readonly config: Config;
  private readonly queues = new Map<string, Queue>();
  private client: NMClient | null = null;
  constructor(client: Client, logger: ILogger, config: Config) {
    this.logger = logger;
    this.config = config;

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

    if (this.shoukaku.players.has(options.guildId) || this.shoukaku.connections.has(options.guildId)) {
      try {
        await this.shoukaku.leaveVoiceChannel(options.guildId);
      } catch {}
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }

    const MAX_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
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
      } catch (e) {
        lastError = e;
        const isTimeout = e instanceof Error && e.message.includes('voice connection is not established');
        if (!isTimeout || attempt === MAX_RETRIES) break;

        this.logger.warn(`Voice connection attempt ${attempt + 1} failed, retrying...`);
        /* 재시도 전 남은 연결 정리 */
        try {
          await this.shoukaku.leaveVoiceChannel(options.guildId);
        } catch {}
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }

    throw lastError;
  }

  public async destroyQueue(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    try {
      await queue.destroy();
    } finally {
      this.queues.delete(guildId);
    }
  }

  public async search(query: string, requester?: User): Promise<LavalinkResponse | undefined> {
    const node = this.shoukaku.getIdealNode();
    if (!node) {
      this.logger.error('No available Lavalink nodes for search');
      return undefined;
    }

    const normalizedQuery = query.trim();
    const hasSearchPrefix = /^(ytsearch|spsearch|scsearch):/i.test(normalizedQuery);
    const resolveQuery = isURL.test(normalizedQuery) || hasSearchPrefix ? normalizedQuery : `${this.config.LAVALINK_SEARCH_PREFIX}${normalizedQuery}`;
    const result = await node.rest.resolve(resolveQuery);
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
