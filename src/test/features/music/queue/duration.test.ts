import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {ChatInputCommandInteraction, Client} from 'discord.js';
import type {Player, Shoukaku} from 'shoukaku';
import type {NMClient} from '@/client';
import {command as nowCommand} from '@/commands/now';
import {buildQueueEmbed} from '@/features/music/interaction/embedBuilder';
import {Queue} from '@/features/music/queue/Queue';
import {getEmbedMeta} from '@/features/music/track/embeds';
import type {QueueTrack} from '@/types/music';

afterEach(() => mock.restore());

function createTrack(isStream: boolean, sourceName = 'http'): QueueTrack {
  return {
    encoded: 'track',
    info: {identifier: 'track', title: 'track', author: 'author', uri: sourceName === 'http' ? 'https://radio.bsod.kr/stream?stn=kbs&ch=2radio' : 'https://www.youtube.com/watch?v=live', isStream, isSeekable: !isStream, length: isStream ? 9_223_372_036_854_776_000 : 180_000, position: 0, sourceName},
    pluginInfo: undefined,
  };
}

function createQueue(current: QueueTrack | null, tracks: QueueTrack[]): Queue {
  const player: Player = Object.create(null);
  const shoukaku: Shoukaku = Object.create(null);
  const queue = new Queue({player, shoukaku, guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text'});
  queue.setCurrent(current);
  queue.add(tracks);
  queue.playing = true;
  return queue;
}

test.each(['http', 'youtube'])('shows live duration for a queue containing a %s stream', sourceName => {
  // Given: a live track with Lavalink's unbounded length and a normal song.
  const queue = createQueue(createTrack(false), [createTrack(true, sourceName)]);
  const client: NMClient = Object.create(null);
  // When: the queue embed is built.
  const embed = buildQueueEmbed(client, queue, 1);
  // Then: the total duration is displayed as a live stream.
  expect(embed.data.title).toBe('📋 현재 대기열 (실시간 스트리밍)');
});

test('shows live duration in the added-radio footer', async () => {
  // Given: a radio is waiting behind another radio.
  const radio = createTrack(true);
  const queue = createQueue(createTrack(true), [radio]);
  // When: the add-track metadata is rendered.
  const {footerText} = await getEmbedMeta(radio, false, queue, 'add');
  // Then: the pending queue has a live duration.
  expect(footerText).toBe('추가된 라디오 · 실시간 스트리밍 | 대기열에 1곡 · 실시간 스트리밍');
});

test('keeps finite pending duration when only the current track is live', async () => {
  // Given: a normal song waits behind a live radio.
  const song = createTrack(false, 'youtube');
  const queue = createQueue(createTrack(true), [song]);
  // When: pending-queue metadata is rendered.
  const {footerText} = await getEmbedMeta(song, false, queue, 'add');
  // Then: only the waiting song contributes to its duration.
  expect(footerText).toBe('추가된 음악 · 03:00 | 대기열에 1곡 · 03:00');
});

test('shows live duration in /now remaining queue', async () => {
  // Given: the currently playing radio and pending radio both have unbounded lengths.
  const queue = createQueue(createTrack(true), [createTrack(true)]);
  const client = Object.assign(new Client({intents: []}), {queues: new Map([['guild', queue]]), services: {lavalinkManager: {getRadioSession: () => undefined}}, logger: {warn: () => undefined, error: () => undefined}});
  const post = spyOn(client.rest, 'post').mockResolvedValue({});
  const interaction: ChatInputCommandInteraction = Object.create(ChatInputCommandInteraction.prototype);
  Object.assign(interaction, {id: 'now-stream-duration', applicationId: 'application', token: 'test-token', client, guildId: 'guild', deferred: false, replied: false});
  // When: the real command handles the interaction.
  await nowCommand.execute(interaction);
  // Then: Discord receives a live duration in the remaining-queue field.
  expect(post.mock.calls[0]?.[1]?.body).toMatchObject({data: {embeds: [{fields: expect.arrayContaining([{name: '📋 남은 대기열', value: '`1곡` · `실시간 스트리밍`', inline: true}])}]}});
});

test('preserves normal and empty queue durations', () => {
  // Given: a queue of two three-minute songs and an empty queue.
  const songs = createQueue(createTrack(false), [createTrack(false)]);
  const empty = createQueue(null, []);
  // When: their durations are calculated.
  const durations = [songs.duration(), empty.duration()];
  // Then: finite duration arithmetic is unchanged.
  expect(durations).toEqual([360_000, 0]);
});
