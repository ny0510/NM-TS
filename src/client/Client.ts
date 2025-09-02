import {ActivityType, Client, Events, GatewayIntentBits, PresenceUpdateStatus} from 'discord.js';

import type {ClientServices, ClientStats, Config} from './types';
import {CommandManager} from '@/managers/CommandManager';
import {CooldownManager} from '@/managers/CooldownManager';
import {EventManager} from '@/managers/EventManager';
import {LavalinkManager} from '@/managers/LavalinkManager';
import {config} from '@/utils/config';
import {type ILogger, Logger} from '@/utils/logger';

export class NMClient extends Client {
  public readonly logger: ILogger;
  public readonly config: Config;
  public readonly services: ClientServices;

  public constructor() {
    super({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      allowedMentions: {parse: [], repliedUser: false},
      presence: {
        activities: [{name: 'NM | 초기화 중..', type: ActivityType.Custom}],
        status: PresenceUpdateStatus.Idle,
      },
    });

    this.config = config;
    this.logger = new Logger(config.LOG_PREFIX, 'info', config.DISCORD_LOG_WEBHOOK_URL);

    this.services = {
      commandManager: new CommandManager(this.logger, this.config),
      eventManager: new EventManager(this, this.logger),
      lavalinkManager: new LavalinkManager(this, this.logger, this.config),
      cooldownManager: new CooldownManager(),
    };

    this.setupEventHandlers();
    this.initialize();
  }

  public get commands() {
    return this.services.commandManager.getCommands();
  }

  public get manager() {
    return this.services.lavalinkManager.getManager();
  }

  public get cooldowns() {
    return this.services.cooldownManager.getCooldowns();
  }

  private setupEventHandlers(): void {
    this.on(Events.Error, error => this.logger.error(`Discord client error: ${error}`));
    this.on(Events.Warn, warning => this.logger.warn(`Discord client warning: ${warning}`));
    this.on(Events.Raw, d => this.manager.updateVoiceState(d));
  }

  private async initialize(): Promise<void> {
    try {
      await this.login(this.config.DISCORD_TOKEN);
      this.logger.info('Successfully logged in to Discord');

      // 로그인 후 logger에 클라이언트 설정
      this.logger.setClient(this);

      await this.loadModules();
    } catch (error) {
      this.logger.error(`Failed to initialize client: ${error}`);
      throw error;
    }
  }

  public async deployCommands(): Promise<void> {
    if (!this.user) {
      throw new Error('Client must be logged in before deploying commands');
    }

    await this.services.commandManager.deployCommands(this.user.id);
  }

  public getStats(): ClientStats {
    const guilds = this.guilds.cache;
    const users = guilds.reduce((acc, guild) => acc + guild.memberCount, 0);
    const activePlayers = this.manager.players.size;
    const uptime = this.uptime || 0;

    const lavalinkStats = Array.from(this.manager.nodes.values())[0]?.stats;
    const memoryUsage = lavalinkStats?.memory ? Math.round(lavalinkStats.memory.used / 1024 / 1024) : 0;
    const cpuUsage = lavalinkStats?.cpu ? Math.round(lavalinkStats.cpu.lavalinkLoad * 100) : 0;

    return {
      guilds: guilds.size,
      users,
      activePlayers,
      uptime,
      memoryUsage,
      cpuUsage,
    };
  }

  private async loadModules(): Promise<void> {
    try {
      await this.services.eventManager.loadEvents();
      await this.services.commandManager.loadCommands();
    } catch (error) {
      this.logger.error(`Failed to load modules: ${error}`);
      throw error;
    }
  }
}
