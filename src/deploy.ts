import {REST, Routes} from 'discord.js';

import {config} from '@/env';
import {toError} from '@/shared/errors';
import {Logger} from '@/shared/logger';
import {getCommands} from '@/utils/core';

type DeployScope = 'global' | 'guild';

type DeployOptions = {
  readonly scope: DeployScope;
  readonly deleteCommands?: boolean;
  readonly preserveRemoteCommands?: boolean;
};

const routeFor = (scope: DeployScope) => (scope === 'global' ? Routes.applicationCommands(config.DISCORD_CLIENT_ID) : Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID));

const commandName = (command: unknown): string | undefined => {
  if (typeof command !== 'object' || command === null || !('name' in command)) return undefined;
  return typeof command.name === 'string' ? command.name : undefined;
};

const logger = new Logger('Deploy', config.LOG_LEVEL, config.DISCORD_LOG_WEBHOOK_URL);

const commandType = (command: unknown): number => {
  if (typeof command !== 'object' || command === null || !('type' in command)) return 1;
  return typeof command.type === 'number' ? command.type : 1;
};

const commandKey = (command: unknown): string | undefined => {
  const name = commandName(command);
  if (!name) return undefined;
  return `${commandType(command)}:${name}`;
};

const writableRemoteCommand = (command: unknown): unknown | undefined => {
  if (typeof command !== 'object' || command === null) return undefined;
  const name = commandName(command);
  if (!name) return undefined;

  const {id: _id, application_id: _applicationId, guild_id: _guildId, version: _version, ...writableCommand} = command as Record<string, unknown>;
  return writableCommand;
};

export const mergeCommands = (remoteCommands: readonly unknown[], localCommands: readonly unknown[]): unknown[] => {
  const commandsByName = new Map<string, unknown>();

  for (const command of remoteCommands) {
    const writableCommand = writableRemoteCommand(command);
    const key = commandKey(writableCommand);
    if (key) commandsByName.set(key, writableCommand);
  }
  for (const command of localCommands) {
    const key = commandKey(command);
    if (key) commandsByName.set(key, command);
  }

  return [...commandsByName.values()];
};

export const deployCommands = async (options: DeployOptions): Promise<number> => {
  const rest = new REST({version: '10'}).setToken(config.DISCORD_TOKEN);
  const route = routeFor(options.scope);
  const localCommands = options.deleteCommands ? [] : (await getCommands()).map(command => command.data.toJSON());
  const remoteResponse: unknown = options.preserveRemoteCommands ? await rest.get(route) : [];
  const remoteCommands = Array.isArray(remoteResponse) ? remoteResponse : [];
  const body = options.preserveRemoteCommands ? mergeCommands(remoteCommands, localCommands) : localCommands;

  await rest.put(route, {body});
  logger.info(`${options.scope === 'global' ? 'Global' : 'Guild'} commands synchronized (${body.length})`);
  return body.length;
};

if (import.meta.main) {
  const scope: DeployScope | undefined = process.argv.includes('--global') ? 'global' : process.argv.includes('--guild') ? 'guild' : undefined;
  if (!scope) {
    logger.error('Usage: bun run deploy-commands [delete] (--global | --guild)');
    process.exitCode = 1;
  } else {
    try {
      await deployCommands({scope, deleteCommands: process.argv.includes('delete')});
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      logger.error(toError(error, 'Failed to synchronize application commands'));
      process.exitCode = 1;
    }
  }
}
