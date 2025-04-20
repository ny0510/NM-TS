import {REST, Routes} from 'discord.js';
import path from 'node:path';
import process from 'node:process';

import {config} from '@/utils/config';
import {readdir} from 'node:fs/promises';

const args = process.argv.slice(2);
const isGlobal = args.includes('--global');
const isGuild = args.includes('--guild');
const isDelete = args.includes('delete');

if (!isGlobal && !isGuild) {
  console.error(`Usage: bun deploy-commands.ts [delete] (--global | --guild)`);
  process.exit(1);
}

const commandsPath = path.join(__dirname, 'commands');
const commands = [];
const commandFiles = await readdir(commandsPath).then(files => files.filter(file => file.endsWith('.ts')));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const commandModule = await import(filePath);
  const command = commandModule.default || commandModule;
  if (command.data && command.execute) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`Command ${file} is missing "data" or "execute" properties.`);
  }
}

const rest = new REST().setToken(config.DISCORD_TOKEN);

try {
  if (isDelete) {
    console.log('Started deleting application (/) commands.');
    if (isGlobal) {
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {body: []});
      console.log('Successfully deleted all global application (/) commands.');
    } else if (isGuild) {
      await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID), {body: []});
      console.log('Successfully deleted all guild application (/) commands.');
    }
  } else {
    console.log('Started refreshing application (/) commands.');
    if (isGlobal) {
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), {body: commands});
      console.log('Successfully reloaded global application (/) commands.');
    } else if (isGuild) {
      await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID), {body: commands});
      console.log('Successfully reloaded guild application (/) commands.');
    }
  }
} catch (e) {
  console.error(`Failed to refresh/delete application (/) commands: ${e}`);
}
