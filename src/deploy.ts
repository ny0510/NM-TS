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

const logger = new Logger('Deploy', 'info', config.DISCORD_LOG_WEBHOOK_URL);

const routeFor = (scope: DeployScope) => (scope === 'global' ? Routes.applicationCommands(config.DISCORD_CLIENT_ID) : Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID));

const commandName = (command: unknown): string | undefined => {
  if (typeof command !== 'object' || command === null || !('name' in command)) return undefined;
  return typeof command.name === 'string' ? command.name : undefined;
};

const writableRemoteCommand = (command: unknown): unknown | undefined => {
  const name = commandName(command);
  if (!name || typeof command !== 'object' || command === null) return undefined;

  const description = 'description' in command && typeof command.description === 'string' ? command.description : 'No description';
  const options = 'options' in command && Array.isArray(command.options) ? command.options : [];
  const type = 'type' in command && typeof command.type === 'number' ? command.type : 1;
  return {name, description, options, type};
};

export const mergeCommands = (remoteCommands: readonly unknown[], localCommands: readonly unknown[]): unknown[] => {
  const commandsByName = new Map<string, unknown>();

  for (const command of remoteCommands) {
    const writableCommand = writableRemoteCommand(command);
    const name = commandName(writableCommand);
    if (name) commandsByName.set(name, writableCommand);
  }
  for (const command of localCommands) {
    const name = commandName(command);
    if (name) commandsByName.set(name, command);
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
