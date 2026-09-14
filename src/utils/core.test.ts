import {describe, expect, test} from 'bun:test';
import type {ClientEvents} from 'discord.js';

import {getCommands, getEvents} from '@/utils/core';

describe('dynamic module loading', () => {
  test('loads every migrated command by name', async () => {
    // Given: the template-style command modules in src/commands
    const expectedNames = ['autoplay', 'autoshuffle', 'broadcast', 'chart', 'clear', 'favorites', 'info', 'now', 'pause', 'ping', 'play', 'queue', 'remove', 'repeat', 'resume', 'search', 'seek', 'shuffle', 'skip', 'speed', 'stop', 'volume'];

    // When: the central loader discovers command modules
    const commands = await getCommands();

    // Then: every NM command is available exactly once
    expect(commands.map(command => command.data.name)).toEqual(expectedNames);
  });

  test('loads every migrated event by name', async () => {
    // Given: the template-style event modules in src/events
    const expectedNames: (keyof ClientEvents)[] = ['clientReady', 'guildCreate', 'guildDelete', 'guildMemberUpdate', 'interactionCreate', 'voiceStateUpdate'];

    // When: the central loader discovers event modules
    const events = await getEvents();

    // Then: every NM event is available exactly once
    expect(events.map(event => event.name)).toEqual(expectedNames);
  });
});
