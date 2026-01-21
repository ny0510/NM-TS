import {beforeEach, describe, expect, it, mock} from 'bun:test';
import {Collection} from 'discord.js';
import path from 'node:path';

import {CommandManager} from '@/managers/CommandManager';

// Mock fs/promises
mock.module('node:fs/promises', () => ({
  readdir: mock(() => Promise.resolve(['testCommand.ts', 'invalidCommand.ts'])),
}));

const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
};

const mockConfig = {
  DISCORD_TOKEN: 'test-token',
  IS_DEV_MODE: false,
};

describe('CommandManager', () => {
  let commandManager: CommandManager;

  beforeEach(() => {
    // @ts-ignore
    commandManager = new CommandManager(mockLogger, mockConfig);
  });

  it('should initialize with empty collection', () => {
    expect(commandManager.getCommands()).toBeInstanceOf(Collection);
    expect(commandManager.getCommands().size).toBe(0);
  });
});
