import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {type ChatInputCommandInteraction, Client} from 'discord.js';
import {LoadType, type Player, type Shoukaku} from 'shoukaku';
import type {NMClient} from '@/client';
import {command as pauseCommand} from '@/commands/pause';
import {command as stopCommand} from '@/commands/stop';
import {Queue} from '@/features/music/queue/Queue';
import {addTrackToQueue} from '@/features/music/track/trackAdder';
import * as interactions from '@/shared/discord/interactions';
import * as guard from '@/shared/playback/sessionGuard';
import * as broker from '@/shared/playback/switchHandler';
import type {QueueTrack} from '@/types/music';
import type {PlaybackSession, SessionMutation} from '@/types/playback';

afterEach(() => mock.restore());

const options = {guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text', shardId: 0, volume: 20};
function queue() {
  const player: Player = Object.create(null);
  const shoukaku: Shoukaku = Object.create(null);
  const value = new Queue({...options, player, shoukaku});
  value.playing = true;
  return value;
}
function interaction(client: object): ChatInputCommandInteraction {
  const value: ChatInputCommandInteraction = Object.create(null);
  Object.assign(value, {client, guildId: 'guild', channelId: 'text', user: {id: 'user'}});
  return value;
}
const track: QueueTrack = {encoded: 'song', info: {identifier: 'song', title: 'Song', author: 'Artist', length: 1000, uri: 'https://www.youtube.com/watch?v=song', isStream: false, isSeekable: true, position: 0, sourceName: 'youtube'}, pluginInfo: undefined};

test('resolved /play request adds to the current queue, never a queue captured before lookup', async () => {
  const old = queue();
  const fresh = queue();
  const client: NMClient = Object.assign(Object.create(Client.prototype), {
    queues: new Map([['guild', old]]),
    services: {
      lavalinkManager: {
        search: async () => {
          client.queues.set('guild', fresh);
          return {loadType: LoadType.TRACK, data: {...track}};
        },
      },
    },
  });
  const reply = spyOn(interactions, 'safeReply').mockResolvedValue();
  const context: SessionMutation = Object.assign(Object.create(null), {getQueue: () => fresh});
  spyOn(broker, 'requestPlaybackAction').mockImplementation(async (current, mode, execute) => {
    expect(mode).toBe('music');
    await execute(current, context, options);
    return true;
  });
  await addTrackToQueue(client, interaction(client), {query: 'song', addFirst: true});
  expect(old.size()).toBe(0);
  expect(fresh.getTracks()[0]?.encoded).toBe('song');
  expect(reply).toHaveBeenCalledTimes(1);
});

test('a blocked request preserves prepared tracks and responds through the confirmation interaction', async () => {
  const fresh = queue();
  const client: NMClient = Object.assign(Object.create(Client.prototype), {queues: new Map(), services: {lavalinkManager: {search: async () => ({loadType: LoadType.TRACK, data: {...track}})}}});
  const original = interaction(client);
  const confirmation = interaction(client);
  const reply = spyOn(interactions, 'safeReply').mockResolvedValue();
  let saved: Parameters<typeof broker.requestPlaybackAction>[2] | undefined;
  spyOn(broker, 'requestPlaybackAction').mockImplementation(async (_current, _mode, execute) => {
    saved = execute;
    return false;
  });
  await addTrackToQueue(client, original, {query: 'song'});
  expect(fresh.size()).toBe(0);
  expect(saved).toBeDefined();
  const context: SessionMutation = Object.assign(Object.create(null), {getQueue: () => fresh});
  await saved?.(confirmation, context, options);
  expect(fresh.size()).toBe(1);
  expect(reply.mock.calls[0]?.[0]).toBe(confirmation);
});

test('an empty playlist cannot stop radio through a mode switch', async () => {
  const client: NMClient = Object.assign(Object.create(Client.prototype), {queues: new Map(), services: {lavalinkManager: {search: async () => ({loadType: LoadType.PLAYLIST, data: {tracks: [], info: {name: 'Empty', selectedTrack: -1}}})}}});
  const request = spyOn(broker, 'requestPlaybackAction').mockResolvedValue(false);
  spyOn(interactions, 'safeReply').mockResolvedValue();
  await addTrackToQueue(client, interaction(client), {query: 'playlist'});
  expect(request).not.toHaveBeenCalled();
});

test('common control does not mutate a session when the member leaves voice while waiting for its lock', async () => {
  const mutate = mock(async () => {});
  const context: SessionMutation = Object.assign(Object.create(null), {getSession: () => ({voiceChannelId: 'voice', pause: mutate})});
  const client = {services: {lavalinkManager: {runWithSessionLock: async (_guild: string, execute: (value: SessionMutation) => Promise<void>) => execute(context)}}};
  spyOn(guard, 'getPlaybackOptions').mockResolvedValueOnce(options).mockResolvedValueOnce(undefined);
  await pauseCommand.execute(interaction(client));
  expect(mutate).not.toHaveBeenCalled();
});

test.each(['pause', 'stop'])('common %s command operates on the radio session under the guild lock', async command => {
  const pause = mock(async () => {});
  const destroy = mock(async () => true);
  const session: PlaybackSession = Object.assign(Object.create(null), {mode: 'radio', sessionId: 'radio-session', voiceChannelId: 'voice', paused: false, pause, set: () => {}});
  const context: SessionMutation = Object.assign(Object.create(null), {getSession: () => session, destroySession: destroy});
  const lock = mock(async (_guild: string, execute: (value: SessionMutation) => Promise<void>) => execute(context));
  const client = {services: {lavalinkManager: {runWithSessionLock: lock}}};
  spyOn(guard, 'getPlaybackOptions').mockResolvedValue(options);
  spyOn(interactions, 'safeReply').mockResolvedValue();
  await (command === 'pause' ? pauseCommand : stopCommand).execute(interaction(client));
  expect(lock).toHaveBeenCalledTimes(1);
  if (command === 'pause') expect(pause).toHaveBeenCalledWith(true);
  else expect(destroy).toHaveBeenCalledWith('radio-session');
});
