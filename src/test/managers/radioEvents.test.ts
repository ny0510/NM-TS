import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import type {NMClient} from '@/client';
import {RadioSession} from '@/features/radio/RadioSession';
import {registerRadioEvents} from '@/managers/lavalink/radioEvents';
import {Logger} from '@/shared/logger';
import type {QueueTrack} from '@/types/music';

test.each([false, true])('radio logs creation, station starts, replacement and stop once (end event: %s)', async endEvent => {
  const messages: string[] = [];
  const logger = new Logger('Lavalink');
  logger.info = message => messages.push(message);
  const player = Object.assign(new EventEmitter(), {});
  const session: RadioSession = Object.create(RadioSession.prototype);
  let cleanup: (() => void) | undefined;
  let current: QueueTrack | null = null;
  let active = true;
  Object.assign(session, {
    guildId: 'guild',
    player,
    getCurrent: () => current,
    onCleanup: (callback: () => void) => {
      cleanup = callback;
    },
  });
  const client: NMClient = Object.create(null);
  Object.assign(client, {guilds: {cache: new Map([['guild', {name: 'Test guild'}]])}, services: {lavalinkManager: {getSession: () => (active ? session : undefined)}}});
  const track = (encoded: string, title: string): QueueTrack => ({encoded, info: {identifier: encoded, title, author: 'Radio', length: 0, isStream: true, isSeekable: false, position: 0, sourceName: 'http'}, pluginInfo: undefined});
  registerRadioEvents(session, client, logger);
  current = track('first', 'First station');
  player.emit('start', {track: track('first', 'Generic stream')});
  current = track('second', 'Second station');
  player.emit('end', {track: {...track('reencoded-first', 'Unknown title'), info: {...track('first', 'Unknown title').info}}, reason: 'replaced'});
  player.emit('start', {track: track('second', 'Generic stream')});
  if (endEvent) player.emit('end', {track: {...track('reencoded-second', 'Generic stream'), info: track('second', 'Generic stream').info}, reason: 'stopped'});
  current = null;
  cleanup?.();
  cleanup?.();
  active = false;
  player.emit('start', {track: track('stale', 'Stale station')});
  player.emit('end', {track: track('stale', 'Stale station'), reason: 'stopped'});
  expect(messages).toEqual([
    'Player Test guild (guild) created',
    'Player Test guild (guild) track start. Track: First station',
    'Player Test guild (guild) track end. Track: First station (reason: replaced)',
    'Player Test guild (guild) track start. Track: Second station',
    'Player Test guild (guild) track end. Track: Second station (reason: stopped)',
  ]);
});
