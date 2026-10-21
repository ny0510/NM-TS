import type {Client, User} from 'discord.js';
import {GatewayOpcodes} from 'discord-api-types/v10';
import {Connectors, type LavalinkResponse, LoadType, type Node, type NodeOption, Shoukaku} from 'shoukaku';

import type {NMClient} from '@/client';
import {Queue} from '@/features/music/queue/Queue';
import {getMusicResolveQuery} from '@/features/music/track/queryPolicy';
import {RadioSession} from '@/features/radio/RadioSession';
import {radioRegions} from '@/features/radio/radioStations';
import {registerLavalinkEvents, registerPlayerEvents} from '@/managers/lavalink';
import type {ILogger} from '@/shared/logger';
import type {Config} from '@/types/client';
import type {CreateQueueOptions, QueueTrack} from '@/types/music';
import type {PlaybackSession, SessionMutation} from '@/types/playback';
import {registerRadioEvents} from './lavalink/radioEvents';

/** 재시도 기본 지연 시간 (1초) */
const RETRY_DELAY_MS = 1000;

export class LavalinkManager {
  private readonly shoukaku: Shoukaku;
  private readonly nodeOption: NodeOption;
  private readonly logger: ILogger;
  private readonly config: Config;
  private readonly queues = new Map<string, Queue>();
  private readonly radios = new Map<string, RadioSession>();
  private readonly musicVolumes = new Map<string, number>();
  private readonly locks = new Map<string, Promise<void>>();
  private client: NMClient | null = null;
  constructor(client: Client, logger: ILogger, config: Config) {
    this.logger = logger;
    this.config = config;

    this.nodeOption = {
      name: config.LAVALINK_IDENTIFIER,
      url: `${config.LAVALINK_HOST}:${config.LAVALINK_PORT}`,
      auth: config.LAVALINK_PASSWORD,
      secure: config.LAVALINK_SECURE,
    };

    this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [this.nodeOption], {
      resume: true,
      resumeTimeout: 60 * 5,
      resumeByLibrary: true,
      // Shoukaku 4.3.0 retains a failed retry error even if a later attempt connects.
      reconnectTries: 1,
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
    return this.runWithSessionLock(options.guildId, scope => scope.createQueue(options));
  }

  public getSession(guildId: string): PlaybackSession | undefined {
    return this.queues.get(guildId) ?? this.radios.get(guildId);
  }
  public getSessions(): ReadonlyMap<string, PlaybackSession> {
    return new Map<string, PlaybackSession>([...this.queues, ...this.radios]);
  }
  public getRadioSession(guildId: string): RadioSession | undefined {
    return this.radios.get(guildId);
  }
  public async runWithSessionLock<T>(guildId: string, action: (scope: SessionMutation) => Promise<T>): Promise<T> {
    const previous = this.locks.get(guildId) ?? Promise.resolve();
    let release: () => void = () => {};
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });
    const tail = previous.then(() => pending);
    this.locks.set(guildId, tail);
    await previous;
    const checkGuild = (options: CreateQueueOptions): void => {
      if (options.guildId !== guildId) throw new Error('Session lock guild mismatch');
    };
    try {
      return await action({
        getSession: () => this.getSession(guildId),
        getQueue: () => this.getQueue(guildId),
        getRadioSession: () => this.getRadioSession(guildId),
        createQueue: options => {
          checkGuild(options);
          return this.createQueueUnlocked(options);
        },
        createRadioSession: options => {
          checkGuild(options);
          return this.createRadioUnlocked(options);
        },
        destroySession: expected => this.destroySessionUnlocked(guildId, expected),
      });
    } finally {
      release();
      if (this.locks.get(guildId) === tail) this.locks.delete(guildId);
    }
  }

  private async createQueueUnlocked(options: CreateQueueOptions): Promise<Queue> {
    const existing = this.queues.get(options.guildId);
    if (existing) return existing;
    if (this.radios.has(options.guildId)) throw new Error('Radio session is active');
    const player = await this.joinVoice(options);
    const queue = new Queue({...options, volume: this.musicVolumes.get(options.guildId) ?? options.volume, player, shoukaku: this.shoukaku});
    this.queues.set(options.guildId, queue);
    if (this.client) registerPlayerEvents(queue, this.client);
    return queue;
  }

  public async createRadioSession(options: CreateQueueOptions): Promise<RadioSession> {
    return this.runWithSessionLock(options.guildId, scope => scope.createRadioSession(options));
  }

  private async createRadioUnlocked(options: CreateQueueOptions): Promise<RadioSession> {
    const existing = this.radios.get(options.guildId);
    if (existing) return existing;
    if (this.queues.has(options.guildId)) throw new Error('Music session is active');
    const player = await this.joinVoice(options);
    const session = new RadioSession({...options, volume: 100, player, shoukaku: this.shoukaku});
    this.radios.set(options.guildId, session);
    if (this.client) registerRadioEvents(session, this.client);
    return session;
  }

  private async joinVoice(options: CreateQueueOptions) {
    if (this.shoukaku.players.has(options.guildId) || this.shoukaku.connections.has(options.guildId)) {
      await this.shoukaku.leaveVoiceChannel(options.guildId);
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

        return player;
      } catch (e) {
        lastError = e;
        const isTimeout = e instanceof Error && e.message.includes('voice connection is not established');
        if (!isTimeout) break;

        this.disconnectTimedOutVoiceSession(options);

        if (attempt === MAX_RETRIES) break;

        this.logger.warn(`Voice connection attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }

    throw lastError;
  }

  private disconnectTimedOutVoiceSession(options: CreateQueueOptions): void {
    this.shoukaku.connector.sendPacket(
      options.shardId,
      {
        op: GatewayOpcodes.VoiceStateUpdate,
        d: {
          guild_id: options.guildId,
          channel_id: null,
          self_deaf: false,
          self_mute: false,
        },
      },
      false,
    );
  }

  public async destroyQueue(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue) return;
    await this.destroySession(guildId, queue.sessionId);
  }
  public async destroySession(guildId: string, expectedSessionId: string): Promise<boolean> {
    return this.runWithSessionLock(guildId, scope => scope.destroySession(expectedSessionId));
  }
  private async destroySessionUnlocked(guildId: string, expectedSessionId: string): Promise<boolean> {
    const session = this.getSession(guildId);
    if (!session || session.sessionId !== expectedSessionId) return false;
    if (session.mode === 'music') this.musicVolumes.set(guildId, session.volume);
    try {
      await session.destroy();
    } finally {
      this.queues.delete(guildId);
      this.radios.delete(guildId);
    }
    return true;
  }

  public async search(query: string, requester?: User): Promise<LavalinkResponse | undefined> {
    const resolveQuery = getMusicResolveQuery(query, this.config.LAVALINK_SEARCH_PREFIX);
    if (!resolveQuery) return undefined;
    return this.resolve(resolveQuery, requester);
  }

  public async loadRadio(url: string, requester?: User): Promise<LavalinkResponse | undefined> {
    if (!radioRegions.some(region => region.stations.some(station => station.url === url))) return undefined;
    return this.resolve(url, requester);
  }

  private async resolve(query: string, requester?: User): Promise<LavalinkResponse | undefined> {
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

  public async waitForReadyNode(timeoutMs = 15_000): Promise<Node | undefined> {
    const available = this.getNode();
    if (available) return available;
    return new Promise(resolve => {
      const finish = (node: Node | undefined): void => {
        clearTimeout(timeout);
        this.shoukaku.off('ready', check);
        resolve(node);
      };
      const check = (): void => {
        const node = this.getNode();
        if (node) finish(node);
      };
      const timeout = setTimeout(() => finish(undefined), timeoutMs);
      this.shoukaku.on('ready', check);
      check();
    });
  }

  public restoreNode(name: string): void {
    if (name !== this.nodeOption.name || this.shoukaku.nodes.has(name)) return;

    this.logger.warn(`Node ${name} unavailable; creating a new connection`);
    this.shoukaku.addNode(this.nodeOption);

    const node = this.shoukaku.nodes.get(name);
    if (!node) return;

    for (const player of this.shoukaku.players.values()) {
      if (player.node.name === name) player.node = node;
    }
  }

  public registerEvents(client: NMClient): void {
    this.client = client;
    registerLavalinkEvents(client);
    this.logger.debug('Lavalink events registered');
  }
}
