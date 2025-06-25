import type {Client} from 'discord.js';
import path from 'node:path';

import type {Event} from '@/client/types';
import type {ILogger} from '@/utils/logger';
import {readdir} from 'node:fs/promises';

export class EventManager {
  private readonly client: Client;
  private readonly logger: ILogger;

  constructor(client: Client, logger: ILogger) {
    this.client = client;
    this.logger = logger;
  }

  public async loadEvents(): Promise<void> {
    try {
      const eventsPath = path.join(__dirname, '..', 'events');
      const eventFiles = await readdir(eventsPath).then(files => files.filter(file => file.endsWith('.ts')));

      let loadedEvents = 0;

      for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const eventModule = await import(filePath);
        const event: Event = eventModule.default || eventModule;

        if (event.name && event.execute) {
          if (event.once) {
            this.client.once(event.name, (...args) => event.execute(...args));
          } else {
            this.client.on(event.name, (...args) => event.execute(...args));
          }
          loadedEvents++;
          this.logger.debug(`Loaded event: ${event.name}`);
        } else {
          this.logger.warn(`Event ${file} is missing "name" or "execute" properties.`);
        }
      }

      this.logger.info(`Loaded ${loadedEvents} events`);
    } catch (error) {
      this.logger.error(`Failed to load events: ${error}`);
      throw error;
    }
  }
}
