import {ActivityType, AllowedMentionsTypes, Client, Collection, Events, GatewayIntentBits, PresenceUpdateStatus, REST, Routes, type Snowflake} from 'discord.js';
import {Manager, type Payload, SearchPlatform} from 'magmastream';
import path from 'node:path';

import type {Command} from '@/interfaces/Command';
import type {Config} from '@/interfaces/Config';
import {config} from '@/utils/config';
import {registerLavalinkEvents} from '@/utils/lavalinkEvents';
import {type ILogger, Logger} from '@/utils/logger';
import {readdir} from 'node:fs/promises';

export class NMClient extends Client {
  public readonly commands: Collection<string, Command>;
  public readonly logger: ILogger;
  public readonly cooldowns: Collection<string, Collection<Snowflake, number>>;
  public readonly manager: Manager;
  public readonly registerLavalinkEvents: (client: NMClient) => void;
  public readonly config: Config;

  public constructor() {
    super({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      allowedMentions: {parse: [], repliedUser: false},
      presence: {activities: [{name: 'NM | 초기화 중..', type: ActivityType.Custom}], status: PresenceUpdateStatus.Idle},
    });

    this.commands = new Collection();
    this.logger = new Logger(config.LOG_PREFIX);
    this.cooldowns = new Collection<string, Collection<Snowflake, number>>();
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
      lastFmApiKey: 'a',
      send: (id: string, payload: Payload) => {
        const guild = this.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
      },
    });
    this.registerLavalinkEvents = registerLavalinkEvents;
    this.config = config;

    this.login(config.DISCORD_TOKEN).catch(e => this.logger.error(`Failed to login: ${e}`));
    this.loadModules().catch(e => this.logger.error(`Failed to load modules: ${e}`));
    this.on(Events.Error, error => this.logger.error(`Discord client error: ${error}`));
    this.on(Events.Warn, warning => this.logger.warn(`Discord client warning: ${warning}`));
    this.on(Events.Raw, d => this.manager.updateVoiceState(d));
  }

  public async deployCommands() {
    const rest = new REST().setToken(config.DISCORD_TOKEN);

    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = await readdir(commandsPath).then(files => files.filter(file => file.endsWith('.ts')));
    const commands = [];
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const commandModule = await import(filePath);
      const command = commandModule.default || commandModule;
      if (command.data && command.execute) commands.push(command.data.toJSON());
      else this.logger.warn(`Command ${file} is missing "data" or "execute" properties.`);
    }
    try {
      if (config.IS_DEV_MODE) return await rest.put(Routes.applicationGuildCommands(this.user!.id, config.DISCORD_GUILD_ID), {body: commands});
      await rest.put(Routes.applicationCommands(this.user!.id), {body: commands});
    } catch (error) {
      throw new Error(`Failed to deploy commands: ${error}`);
    }
  }

  private async loadModules() {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = await readdir(commandsPath).then(files => files.filter(file => file.endsWith('.ts')));

    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = await readdir(eventsPath).then(files => files.filter(file => file.endsWith('.ts')));

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const eventModule = await import(filePath);
      const event = eventModule.default || eventModule;
      if (event.name && event.execute) {
        if (event.once) this.once(event.name, (...args) => event.execute(...args));
        else this.on(event.name, (...args) => event.execute(...args));
      } else this.logger.warn(`Event ${file} is missing "name" or "execute" properties.`);
    }

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const commandModule = await import(filePath);
      const command = commandModule.default || commandModule;
      if (command.data && command.execute) this.commands.set(command.data.name, command);
      else this.logger.warn(`Command ${file} is missing "data" or "execute" properties.`);
    }
  }
}
