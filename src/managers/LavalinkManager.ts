import type {Client, User} from 'discord.js';
import {Connectors, type LavalinkResponse, LoadType, type Node, type NodeOption, Shoukaku, type Track} from 'shoukaku';

import type {NMClient} from '@/client/Client';
import type {Config} from '@/client/types';
import {Queue, type QueueTrack, type SerializedSession} from '@/structures/Queue';
import type {ILogger} from '@/utils/logger';
import {registerLavalinkEvents, registerPlayerEvents} from '@/utils/music/lavalinkEvents';
import {clearAllPlayerStates, loadAllPlayerStates, savePlayerState, saveSessionIds} from '@/utils/music/sessionStore';

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

  public async persistSessionIds(): Promise<void> {
    const ids: Record<string, string> = {};
    for (const [name, node] of this.shoukaku.nodes) {
      if (node.sessionId) {
        ids[name] = node.sessionId;
      }
    }
    await saveSessionIds(ids);
  }

  public async saveSessions(): Promise<number> {
    let count = 0;

    for (const queue of this.queues.values()) {
      if (queue.getCurrent() || queue.size() > 0) {
        await savePlayerState(queue.guildId, queue.toJSON());
        count++;
      }
    }

    await this.persistSessionIds();

    return count;
  }

  public async restoreSessions(client: NMClient, lavalinkResume: boolean): Promise<SerializedSession[]> {
    const sessions = await loadAllPlayerStates();
    if (sessions.length === 0) return [];

    const node = this.shoukaku.getIdealNode();
    if (!node) {
      this.logger.warn('No available Lavalink nodes for session restore');
      return [];
    }

    const restored: SerializedSession[] = [];

    for (const session of sessions) {
      try {
        const guild = client.guilds.cache.get(session.guildId);
        if (!guild) continue;

        const voiceChannel = guild.channels.cache.get(session.voiceChannelId);
        if (!voiceChannel) continue;

        const resolveUser = (id: string): User | undefined => client.users.cache.get(id);

        if (lavalinkResume) {
          const restoredSession = await this.restoreWithLavalinkResume(node, session, client, resolveUser);
          if (restoredSession) {
            restored.push(restoredSession);
            continue;
          }
          this.logger.debug(`Lavalink resume failed for guild ${session.guildId}, falling back to identifier search`);
        }

        const restoredSession = await this.restoreWithIdentifierSearch(node, session, client, resolveUser);
        if (restoredSession) {
          restored.push(restoredSession);
        }
      } catch (error) {
        this.logger.warn(`Failed to restore session for guild ${session.guildId}: ${error}`);
      }
    }

    await clearAllPlayerStates();
    return restored;
  }

  private async restoreWithLavalinkResume(node: Node, session: SerializedSession, client: NMClient, resolveUser: (id: string) => User | undefined): Promise<SerializedSession | null> {
    try {
      const lavaPlayer = await node.rest.getPlayer(session.guildId);
      if (!lavaPlayer) return null;

      const guild = client.guilds.cache.get(session.guildId);
      if (!guild) return null;

      const queue = await this.createQueue({
        guildId: session.guildId,
        voiceChannelId: session.voiceChannelId,
        textChannelId: session.textChannelId,
        shardId: guild.shardId,
        volume: session.volume,
      });

      queue.restoreState(session, resolveUser);

      if (lavaPlayer.track) {
        const requester = queue.getCurrent()?.requester;
        const freshTrack: QueueTrack = {...lavaPlayer.track, requester};
        queue.setCurrent(freshTrack);
        queue.playing = !lavaPlayer.paused;
      } else if (queue.size() > 0) {
        await queue.play();
      }

      return session;
    } catch (error) {
      this.logger.debug(`Lavalink resume getPlayer failed for ${session.guildId}: ${error}`);
      return null;
    }
  }

  private async restoreWithIdentifierSearch(node: Node, session: SerializedSession, client: NMClient, resolveUser: (id: string) => User | undefined): Promise<SerializedSession | null> {
    try {
      const guild = client.guilds.cache.get(session.guildId);
      if (!guild) return null;

      const queue = await this.createQueue({
        guildId: session.guildId,
        voiceChannelId: session.voiceChannelId,
        textChannelId: session.textChannelId,
        shardId: guild.shardId,
        volume: session.volume,
      });

      queue.restoreState(session, resolveUser);

      if (session.current) {
        const freshCurrent = await this.resolveTrackByIdentifier(node, session.current.info.identifier, session.current.info.title);
        if (freshCurrent) {
          const requester = queue.getCurrent()?.requester;
          const restoredTrack: QueueTrack = {...freshCurrent, requester};
          queue.setCurrent(restoredTrack);
          await queue.player.playTrack({track: {encoded: freshCurrent.encoded}});
          if (session.position > 0) {
            await queue.player.seekTo(session.position);
          }
          await queue.player.setGlobalVolume(session.volume);
        } else {
          this.logger.warn(`Failed to re-resolve current track for guild ${session.guildId}`);
          if (queue.size() > 0) {
            await queue.play();
          } else {
            await this.destroyQueue(session.guildId);
            return null;
          }
        }
      } else if (queue.size() > 0) {
        await queue.play();
      }

      return session;
    } catch (error) {
      this.logger.warn(`Identifier search restore failed for ${session.guildId}: ${error}`);
      return null;
    }
  }

  private async resolveTrackByIdentifier(node: Node, identifier: string, title: string): Promise<Track | null> {
    const directResult = await node.rest.resolve(`https://youtube.com/watch?v=${identifier}`);
    if (directResult?.loadType === LoadType.TRACK) {
      return directResult.data as Track;
    }

    const searchResult = await node.rest.resolve(`ytsearch:${title}`);
    if (searchResult?.loadType === LoadType.SEARCH && searchResult.data.length > 0) {
      const match = searchResult.data[0];
      if (match) return match as Track;
    }

    return null;
  }
}
