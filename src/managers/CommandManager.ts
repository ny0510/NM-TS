import {Collection, REST, Routes} from 'discord.js';
import path from 'node:path';

import type {Command, Config} from '@/types/client';
import type {ILogger} from '@/utils/logger';
import {readdir} from 'node:fs/promises';

export class CommandManager {
  private readonly commands: Collection<string, Command>;
  private readonly logger: ILogger;
  private readonly config: Config;

  constructor(logger: ILogger, config: Config) {
    this.commands = new Collection();
    this.logger = logger;
    this.config = config;
  }

  public getCommands(): Collection<string, Command> {
    return this.commands;
  }

  public getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  public async loadCommands(): Promise<void> {
    try {
      const commandsPath = path.join(__dirname, '..', 'commands');
      const commandFiles = await readdir(commandsPath).then(files => files.filter(file => file.endsWith('.ts')));

      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const commandModule = await import(filePath);
        const command = commandModule.default || commandModule;

        if (command.data && command.execute) {
          this.commands.set(command.data.name, command);
          this.logger.debug(`Loaded command: ${command.data.name}`);
        } else {
          this.logger.warn(`Command ${file} is missing "data" or "execute" properties.`);
        }
      }

      this.logger.info(`Loaded ${this.commands.size} commands`);
    } catch (error) {
      this.logger.error(error instanceof Error ? error : new Error(`Failed to load commands: ${error}`));
      throw error;
    }
  }

  public async deployCommands(clientId: string): Promise<void> {
    try {
      const rest = new REST().setToken(this.config.DISCORD_TOKEN);
      const localCommands = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());

      // Fetch existing commands and merge to avoid removing special Entry Point commands
      if (this.config.IS_DEV_MODE) {
        const existing = (await rest.get(Routes.applicationGuildCommands(clientId, this.config.DISCORD_GUILD_ID))) as unknown[];
        const merged = this.mergeCommands(existing, localCommands);
        await rest.put(Routes.applicationGuildCommands(clientId, this.config.DISCORD_GUILD_ID), {body: merged});
        this.logger.info('Successfully deployed guild commands (dev mode)');
      } else {
        const existing = (await rest.get(Routes.applicationCommands(clientId))) as unknown[];
        const merged = this.mergeCommands(existing, localCommands);
        await rest.put(Routes.applicationCommands(clientId), {body: merged});
        this.logger.info('Successfully deployed global commands');
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error : new Error(`Failed to deploy commands: ${error}`));
      throw error;
    }
  }

  /**
   * Merge existing remote command definitions with local commands.
   * Keeps any existing commands that aren't defined locally (e.g. Entry Point commands) while
   * allowing local commands to override by name.
   */
  private mergeCommands(existing: unknown[], local: unknown[]): unknown[] {
    const map = new Map<string, unknown>();

    for (const cmd of existing ?? []) {
      const record = cmd as Record<string, unknown> | null;
      if (!record || typeof record.name !== 'string') continue;
      map.set(record.name, {
        name: record.name,
        description: record.description ?? 'No description',
        options: record.options ?? [],
        type: record.type ?? 1,
      });
    }

    for (const cmd of local ?? []) {
      const record = cmd as Record<string, unknown> | null;
      if (!record || typeof record.name !== 'string') continue;
      map.set(record.name, cmd);
    }

    return Array.from(map.values());
  }
}
