import {readdir} from 'node:fs/promises';
import path from 'node:path';
import type {ClientEvents} from 'discord.js';

import type {Command, Event} from '@/types/client';

const collectModuleFiles = async (baseDirectory: string): Promise<string[]> => {
  const entries = await readdir(baseDirectory, {withFileTypes: true});
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(path.join(baseDirectory, entry.name));
      continue;
    }

    if (entry.isDirectory()) {
      const nestedEntries = await readdir(path.join(baseDirectory, entry.name));
      if (nestedEntries.includes('index.ts')) {
        files.push(path.join(baseDirectory, entry.name, 'index.ts'));
      }
    }
  }

  return files.sort();
};

export const getCommands = async (): Promise<Command[]> => {
  const files = await collectModuleFiles(path.join(import.meta.dir, '..', 'commands'));
  return Promise.all(
    files.map(async file => {
      const module: {command: Command} = await import(file);
      return module.command;
    }),
  );
};

export const getEvents = async (): Promise<Event<keyof ClientEvents>[]> => {
  const files = await collectModuleFiles(path.join(import.meta.dir, '..', 'events'));
  return Promise.all(
    files.map(async file => {
      const module: {event: Event<keyof ClientEvents>} = await import(file);
      return module.event;
    }),
  );
};
