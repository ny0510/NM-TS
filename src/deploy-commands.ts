import {REST, Routes} from 'discord.js';
import process from 'node:process';

import {CommandManager} from '@/managers/CommandManager';
import {config} from '@/utils/config';
import {Logger} from '@/utils/logger';

const logger = new Logger('DEPLOY');

async function deployCommands() {
  const args = process.argv.slice(2);
  const isGlobal = args.includes('--global');
  const isGuild = args.includes('--guild');
  const isDelete = args.includes('delete');

  if (!isGlobal && !isGuild) {
    logger.error('Usage: bun deploy-commands.ts [delete] (--global | --guild)');
    process.exit(1);
  }

  try {
    const commandManager = new CommandManager(logger, config);
    await commandManager.loadCommands();

    const rest = new REST().setToken(config.DISCORD_TOKEN);
    const commands = Array.from(commandManager.getCommands().values()).map(cmd => cmd.data.toJSON());

    if (isDelete) {
      logger.info('Started deleting application (/) commands.');
      if (isGlobal) {
        await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {body: []});
        logger.info('Successfully deleted all global application (/) commands.');
      } else if (isGuild) {
        await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID), {body: []});
        logger.info('Successfully deleted all guild application (/) commands.');
      }
    } else {
      logger.info('Started refreshing application (/) commands.');
      if (isGlobal) {
        await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {body: commands});
        logger.info('Successfully reloaded global application (/) commands.');
      } else if (isGuild) {
        await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID), {body: commands});
        logger.info('Successfully reloaded guild application (/) commands.');
      }
    }
  } catch (error) {
    logger.error(`Failed to refresh/delete application (/) commands: ${error}`);
    process.exit(1);
  }
}

deployCommands();
