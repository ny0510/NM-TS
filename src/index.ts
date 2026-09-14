import {client} from '@/client';
import {getCommands, getEvents} from '@/utils/core';
import {setupDevShortcuts} from '@/utils/dev-shortcuts';
import {setupErrorHandlers} from '@/utils/error-handler';

setupErrorHandlers(client);

const commands = await getCommands();
for (const command of commands) {
  client.commands.set(command.data.name, command);
}
client.logger.info(`Loaded ${commands.length} commands`);

const events = await getEvents();
for (const event of events) {
  if (event.runOnce) {
    client.once(event.name, event.execute);
  } else {
    client.on(event.name, event.execute);
  }
}
client.logger.info(`Loaded ${events.length} events`);

const login = client.start();
setupDevShortcuts(client);
await login;
