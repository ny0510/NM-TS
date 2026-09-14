import {ActivityType, Client, Collection, Events, GatewayIntentBits, PresenceUpdateStatus} from 'discord.js';
import {config} from '@/env';
import {clearPresenceInterval} from '@/events/clientReady';
import type {Queue} from '@/features/music/queue/Queue';
import {CooldownManager} from '@/managers/CooldownManager';
import {KoreanbotsManager} from '@/managers/KoreanbotsManager';
import {LavalinkManager} from '@/managers/LavalinkManager';
import {PlayerStateManager} from '@/managers/PlayerStateManager';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';
import type {ClientServices, ClientStats, Command, Config} from '@/types/client';
import type {ILogger} from '@/types/logger';

export class NMClient extends Client {
  public readonly logger: ILogger;
  public readonly config: Config;
  public readonly services: ClientServices;
  public readonly commands = new Collection<string, Command>();
  private readonly koreanbotsManager: KoreanbotsManager;

  public constructor() {
    super({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      allowedMentions: {parse: [], repliedUser: false},
      presence: {
        activities: [{name: config.PRESENCE_INITIAL_MESSAGE, type: ActivityType.Custom}],
        status: PresenceUpdateStatus.Idle,
      },
    });

    this.ws.setMaxListeners(25);
    this.config = config;
    this.logger = new Logger(config.LOG_PREFIX, config.LOG_LEVEL, config.DISCORD_LOG_WEBHOOK_URL);
    this.services = {
      lavalinkManager: new LavalinkManager(this, new Logger('Lavalink', config.LOG_LEVEL, config.DISCORD_LOG_WEBHOOK_URL), this.config),
      cooldownManager: new CooldownManager(),
      playerStateManager: new PlayerStateManager(this, new Logger('PlayerState', config.LOG_LEVEL, config.DISCORD_LOG_WEBHOOK_URL)),
    };
    this.koreanbotsManager = new KoreanbotsManager(this, new Logger('Koreanbots', config.LOG_LEVEL, config.DISCORD_LOG_WEBHOOK_URL));

    this.on(Events.Error, error => this.logger.error(toError(error, 'Discord client error')));
    this.on(Events.Warn, warning => this.logger.warn(`Discord client warning: ${warning}`));
  }

  public get queues(): Map<string, Queue> {
    return this.services.lavalinkManager.getQueues();
  }

  public get cooldowns() {
    return this.services.cooldownManager.getCooldowns();
  }

  public async start(): Promise<void> {
    this.logger.info(`Initializing NM Client v${process.env.npm_package_version}`);
    this.logger.setClient(this);
    this.koreanbotsManager.start();

    try {
      await this.login(this.config.DISCORD_TOKEN);
    } catch (error) {
      this.koreanbotsManager.stop();
      throw error;
    }
  }

  public getStats(): ClientStats {
    const guilds = this.guilds.cache;
    const users = guilds.reduce((total, guild) => total + guild.memberCount, 0);
    const node = this.services.lavalinkManager.getShoukaku().nodes.values().next().value;
    const lavalinkStats = node?.stats;

    return {
      guilds: guilds.size,
      users,
      activePlayers: lavalinkStats?.players ?? 0,
      memoryUsage: lavalinkStats?.memory ? Math.round(lavalinkStats.memory.used / 1024 / 1024) : 0,
      cpuUsage: lavalinkStats?.cpu ? Math.round(lavalinkStats.cpu.systemLoad * 100) : 0,
    };
  }

  public override async destroy(): Promise<void> {
    this.koreanbotsManager.stop();
    clearPresenceInterval();
    await super.destroy();
  }
}

export const client = new NMClient();
