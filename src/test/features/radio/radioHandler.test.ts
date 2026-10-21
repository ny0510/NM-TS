import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {type ButtonInteraction, type ChatInputCommandInteraction, Client, InteractionCollector, type MappedInteractionTypes, Message, type MessageComponentType, type StringSelectMenuInteraction, type TextChannel} from 'discord.js';
import {type LavalinkResponse, LoadType, type Player, type Shoukaku} from 'shoukaku';
import {RadioSession} from '@/features/radio/RadioSession';
import {handleRadio} from '@/features/radio/radioHandler';
import {radioRegions} from '@/features/radio/radioStations';
import * as interactions from '@/shared/discord/interactions';
import * as guards from '@/shared/playback/sessionGuard';
import * as switches from '@/shared/playback/switchHandler';
import type {PlaybackSession, SessionMutation} from '@/types/playback';

afterEach(() => mock.restore());
const options = {guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text', shardId: 0, volume: 20};
function response(encoded: string): LavalinkResponse {
  return {loadType: LoadType.TRACK, data: {encoded, info: {identifier: encoded, title: 'Unknown title', author: 'Unknown', uri: 'https://example.invalid', isStream: true, isSeekable: false, length: 0, position: 0, sourceName: 'http'}, pluginInfo: undefined}};
}
async function fixture(load: (url: string) => Promise<LavalinkResponse>, musicAtStart = false) {
  const player: Player = Object.assign(Object.create(null), {playTrack: mock(async () => undefined), setGlobalVolume: mock(async () => undefined), setPaused: mock(async () => undefined), paused: false, removeAllListeners: () => undefined});
  const shoukaku: Shoukaku = Object.assign(Object.create(null), {leaveVoiceChannel: mock(async () => undefined)});
  let radio: RadioSession | undefined;
  let music: PlaybackSession | undefined = musicAtStart ? Object.assign(Object.create(null), {mode: 'music', sessionId: 'music-original', voiceChannelId: 'voice'}) : undefined;
  const queues = new Map();
  const context: SessionMutation = {
    getSession: () => radio ?? music,
    getRadioSession: () => radio,
    getQueue: () => undefined,
    createQueue: async () => {
      throw new Error('Radio must not create a music queue');
    },
    createRadioSession: async () => {
      radio = new RadioSession({...options, player, shoukaku});
      return radio;
    },
    destroySession: async () => {
      await radio?.destroy();
      radio = undefined;
      music = undefined;
      return true;
    },
  };
  const manager = {getSession: () => radio ?? music, getRadioSession: () => radio, loadRadio: mock(load), runWithSessionLock: async <T>(_guild: string, action: (context: SessionMutation) => Promise<T>) => action(context)};
  const client = Object.assign(new Client<true>({intents: []}), {
    queues,
    services: {lavalinkManager: manager},
    logger: {error: mock(() => undefined)},
    config: {EMBED_COLOR_NORMAL: '#5865f2', PROGRESS_CIRCLE_START: 'S', PROGRESS_CIRCLE_MIDDLE: 'C', PROGRESS_FILLED_START: 'F', PROGRESS_FILLED_MIDDLE: 'f', PROGRESS_UNFILLED_MIDDLE: '-', PROGRESS_UNFILLED_END: 'E'},
  });
  const collector = new InteractionCollector<MappedInteractionTypes[MessageComponentType]>(client);
  const message: Message & {channel: TextChannel} = Object.create(Message.prototype);
  const registration = spyOn(message, 'createMessageComponentCollector').mockReturnValue(collector);
  const messageEdits = spyOn(message, 'edit').mockResolvedValue(message);
  const followUps = spyOn(interactions, 'safeFollowUp').mockResolvedValue(message);
  const replies = spyOn(interactions, 'safeReply').mockResolvedValue();
  const edits = spyOn(interactions, 'safeEditReply').mockResolvedValue(true);
  spyOn(interactions, 'safeDeferUpdate').mockResolvedValue(true);
  spyOn(guards, 'getPlaybackOptions').mockResolvedValue(options);
  if (!musicAtStart)
    spyOn(switches, 'requestPlaybackAction').mockImplementation(async (i, _target, execute, isCurrent) => {
      if (isCurrent && !isCurrent()) return false;
      await execute(i, context, options);
      return true;
    });
  const interaction: ChatInputCommandInteraction = Object.assign(Object.create(null), {client, guildId: 'guild', channelId: 'text', user: {id: 'user'}, fetchReply: async () => message});
  await handleRadio(interaction);
  const collect = (selection: StringSelectMenuInteraction | ButtonInteraction) => {
    const listener = collector.listeners('collect').at(-1);
    if (!listener) throw new Error('Missing collector');
    return listener(selection);
  };
  const select = (stationIndex: number, userId = 'user') => {
    const station = radioRegions[0]?.stations[stationIndex];
    if (!station) throw new Error('Missing station');
    const selection: StringSelectMenuInteraction = Object.assign(Object.create(null), {client, guildId: 'guild', channelId: 'text', user: {id: userId}, customId: 'radio:station:seoul:fm', values: [station.id], isStringSelectMenu: () => true});
    return collect(selection);
  };
  const press = (action: string) => {
    const button: ButtonInteraction = Object.assign(Object.create(null), {client, guildId: 'guild', channelId: 'text', user: {id: 'user'}, customId: `radio:${action}`, isStringSelectMenu: () => false});
    return collect(button);
  };
  return {select, press, radio: () => radio, player, shoukaku, queues, collector, edits, replies, manager, context, registration, interaction, messageEdits, followUps};
}

test('/radio during music asks before opening controls; confirmation opens a separate working tuner', async () => {
  const f = await fixture(async () => response('working'), true);
  try {
    expect(f.registration).not.toHaveBeenCalled();
    expect(f.manager.getSession()?.mode).toBe('music');
    expect(f.manager.loadRadio).not.toHaveBeenCalled();
    const customId = JSON.stringify(f.replies.mock.calls).match(/playback:switch:[a-z0-9-]+/)?.[0];
    if (!customId) throw new Error('Missing mode confirmation');
    const confirmation: ButtonInteraction = Object.assign(Object.create(null), {client: f.interaction.client, guildId: 'guild', channelId: 'text', user: f.interaction.user, customId});
    await switches.handlePlaybackSwitch(confirmation);
    expect(f.manager.getSession()).toBeUndefined();
    expect(f.registration).toHaveBeenCalledTimes(1);
    expect(f.followUps).toHaveBeenCalledTimes(1);
    expect(f.manager.loadRadio).not.toHaveBeenCalled();
    await f.select(0);
    expect(f.player.playTrack).toHaveBeenCalledTimes(1);
    expect(f.messageEdits).toHaveBeenCalledTimes(1);
    expect(f.radio()?.station).toBeDefined();
  } finally {
    f.collector.stop();
  }
});

test('tuning plays directly without music queue and retains the tuner; expiry leaves playback running', async () => {
  const f = await fixture(async () => response('first'));
  try {
    await f.select(0);
    expect(f.player.playTrack).toHaveBeenCalledTimes(1);
    expect(f.queues.size).toBe(0);
    expect(f.collector.ended).toBe(false);
    expect(f.radio()?.station?.name).toBe(radioRegions[0]?.stations[0]?.name);
    f.collector.stop('time');
    await Promise.resolve();
    expect(f.radio()?.playing).toBe(true);
    expect(f.shoukaku.leaveVoiceChannel).not.toHaveBeenCalled();
    expect(f.edits.mock.calls.at(-1)?.[1]).toMatchObject({components: []});
  } finally {
    f.collector.stop();
  }
});

test('older Andong-style load failure cannot overwrite newer successful playback', async () => {
  const slow = Promise.withResolvers<LavalinkResponse>();
  const started = Promise.withResolvers<void>();
  let count = 0;
  const f = await fixture(async () => {
    if (++count === 1) {
      started.resolve();
      return slow.promise;
    }
    return response('newer');
  });
  try {
    const first = f.select(0);
    await started.promise;
    await f.select(1);
    const countAfterSuccess = f.replies.mock.calls.length;
    slow.resolve({loadType: LoadType.ERROR, data: {message: 'Read timed out', severity: 'suspicious', cause: 'timeout'}});
    await first;
    expect(f.replies).toHaveBeenCalledTimes(countAfterSuccess);
    expect(f.player.playTrack).toHaveBeenCalledTimes(1);
    expect(f.radio()?.getCurrent()?.encoded).toBe('newer');
    expect(f.radio()?.station?.name).toBe(radioRegions[0]?.stations[1]?.name);
  } finally {
    f.collector.stop();
  }
});

test('failed next-station lookup preserves current radio and view controls', async () => {
  let count = 0;
  const f = await fixture(async () => (++count === 1 ? response('working') : {loadType: LoadType.EMPTY, data: {}}));
  try {
    await f.select(0);
    await f.select(1);
    expect(f.radio()?.getCurrent()?.encoded).toBe('working');
    expect(f.collector.ended).toBe(false);
    expect(f.player.playTrack).toHaveBeenCalledTimes(1);
    const last = f.replies.mock.calls.at(-1)?.[1];
    const embed = last && typeof last !== 'string' ? last.embeds?.[0] : undefined;
    expect(embed && 'toJSON' in embed ? embed.toJSON().title : embed?.title).toContain('라디오에 연결할 수 없어요');
  } finally {
    f.collector.stop();
  }
});

test('an old tuner arrow cannot retune a replacement radio session', async () => {
  const f = await fixture(async () => response('working'));
  try {
    await f.select(0);
    await f.context.destroySession(f.radio()?.sessionId ?? '');
    await f.context.createRadioSession(options);
    await f.press('higher');
    expect(f.manager.loadRadio).toHaveBeenCalledTimes(1);
    expect(f.radio()?.getCurrent()).toBeNull();
  } finally {
    f.collector.stop();
  }
});

test('public tuner accepts other listeners while retaining voice authorization', async () => {
  const f = await fixture(async () => response('working'));
  try {
    const reply = f.replies.mock.calls[0]?.[1];
    expect(reply && typeof reply !== 'string' ? reply.flags : undefined).toBeUndefined();
    const otherSelection: StringSelectMenuInteraction = Object.assign(Object.create(null), {user: {id: 'listener'}, customId: 'radio:station:seoul:fm'});
    expect(await f.registration.mock.calls[0]?.[0]?.filter?.(otherSelection, f.collector.collected)).toBe(true);
    await f.select(0, 'listener');
    expect(f.radio()?.getCurrent()?.requester?.id).toBe('listener');
    spyOn(guards, 'getPlaybackOptions').mockResolvedValue(undefined);
    await f.select(1, 'outsider');
    expect(f.manager.loadRadio).toHaveBeenCalledTimes(1);
  } finally {
    f.collector.stop();
  }
});

test('a rejected initial play cleans the newly created radio connection', async () => {
  const f = await fixture(async () => response('working'));
  try {
    spyOn(f.player, 'playTrack').mockRejectedValue(new Error('Disconnected'));
    await f.select(0);
    expect(f.radio()).toBeUndefined();
    expect(f.shoukaku.leaveVoiceChannel).toHaveBeenCalledTimes(1);
    expect(f.queues.size).toBe(0);
  } finally {
    f.collector.stop();
  }
});

test('confirmed radio switch updates the tuner without a duplicate announcement', async () => {
  const f = await fixture(async () => response('working'));
  try {
    spyOn(switches, 'requestPlaybackAction').mockImplementation(async (selection, _target, execute) => {
      const confirmation: ButtonInteraction = Object.assign(Object.create(null), {client: selection.client, guildId: 'guild', channelId: 'text', user: selection.user});
      await execute(confirmation, f.context, options);
      return true;
    });
    await f.select(0);
    expect(f.replies).toHaveBeenCalledTimes(1);
    expect(f.edits).toHaveBeenCalledTimes(1);
    const update = f.edits.mock.calls[0]?.[1];
    expect(update).toMatchObject({embeds: [expect.anything()]});
    expect(f.radio()?.station?.name).toBe(radioRegions[0]?.stations[0]?.name);
  } finally {
    f.collector.stop();
  }
});
