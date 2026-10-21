import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {ButtonInteraction, Client, MessageFlags} from 'discord.js';
import type {Player, Shoukaku} from 'shoukaku';

import * as database from '@/db';
import {handleFavToggleButton} from '@/features/favorites/favToggleHandler';
import {addFavorite} from '@/features/favorites/service';
import {createPlayerControls} from '@/features/music/button/controlsBuilder';
import {Queue} from '@/features/music/queue/Queue';
import type {QueueTrack} from '@/types/music';

afterEach(() => mock.restore());

const song: QueueTrack = {
  encoded: 'song',
  info: {identifier: 'song', title: 'Song', author: 'Artist', uri: 'https://www.youtube.com/watch?v=song', sourceName: 'youtube', isStream: false, isSeekable: true, length: 180_000, position: 0},
  pluginInfo: undefined,
};
const radio: QueueTrack = {
  ...song,
  info: {...song.info, identifier: 'https://localradio-relay.gscdn.kbs.co.kr/daegu/1radio/ts:playlist.m3u8', uri: 'https://radio.bsod.kr/stream?stn=kbs&ch=1radio&city=daegu', sourceName: 'http', isStream: true, isSeekable: false, length: 9_223_372_036_854_776_000},
};
const youtubeLive: QueueTrack = {...song, info: {...song.info, isStream: true, isSeekable: false}};

function createQueue(track: QueueTrack): Queue {
  const player: Player = Object.create(null);
  const shoukaku: Shoukaku = Object.create(null);
  const queue = new Queue({player, shoukaku, guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text'});
  queue.setCurrent(track);
  queue.playing = true;
  return queue;
}

test.each([
  {name: 'radio', track: radio, disabled: true},
  {name: 'song', track: song, disabled: false},
  {name: 'YouTube live', track: youtubeLive, disabled: false},
])('favorite button eligibility for $name', ({track, disabled}) => {
  const controls = createPlayerControls(createQueue(track), track.info.uri ?? '').toJSON();
  const button = controls.components.find(component => 'custom_id' in component && component.custom_id === 'fav_toggle');
  expect(button).toBeDefined();
  expect(button?.disabled ?? false).toBe(disabled);
});

test('rejects radio favorites before accessing the database', async () => {
  const getDb = spyOn(database, 'getDb').mockImplementation(() => {
    throw new TypeError('Unexpected database access');
  });

  expect(await addFavorite('user', radio)).toBe(false);
  expect(getDb).not.toHaveBeenCalled();
});

test.each([
  {name: 'song', track: song},
  {name: 'YouTube live', track: youtubeLive},
])('keeps $name favorites on the database save path', async ({track}) => {
  const getDb = spyOn(database, 'getDb').mockImplementation(() => {
    throw new TypeError('Database save path reached');
  });

  await expect(addFavorite('user', track)).rejects.toThrow('Database save path reached');
  expect(getDb).toHaveBeenCalledTimes(1);
});

test('an existing radio favorite button replies privately without accessing the database', async () => {
  const getDb = spyOn(database, 'getDb').mockImplementation(() => {
    throw new TypeError('Unexpected database access');
  });
  const client = Object.assign(new Client({intents: []}), {
    queues: new Map([['guild', createQueue(radio)]]),
    logger: {warn: () => undefined, error: () => undefined},
  });
  const post = spyOn(client.rest, 'post').mockResolvedValue({});
  const interaction: ButtonInteraction = Object.create(ButtonInteraction.prototype);
  Object.assign(interaction, {
    id: 'radio-favorite-blocked',
    applicationId: 'application',
    token: 'test-token',
    client,
    guildId: 'guild',
    user: {id: 'user'},
    member: {voice: {channel: {id: 'voice'}}},
    message: {embeds: []},
    deferred: false,
    replied: false,
  });

  await handleFavToggleButton(interaction);

  expect(interaction.replied).toBe(true);
  expect(post.mock.calls[0]?.[1]?.body).toMatchObject({
    type: 4,
    data: {flags: MessageFlags.Ephemeral, embeds: [{title: '라디오는 즐겨찾기에 추가할 수 없어요.'}]},
  });
  expect(getDb).not.toHaveBeenCalled();
});
