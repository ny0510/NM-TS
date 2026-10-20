import {expect, test} from 'bun:test';
import type {EmbedBuilder} from 'discord.js';
import {Constants, type Player, PlayerEventType, type Shoukaku} from 'shoukaku';
import type {NMClient} from '@/client';
import {Queue} from '@/features/music/queue/Queue';
import {handleTrackStart} from '@/managers/lavalink/trackStart';
import type {QueueTrack} from '@/types/music';

test.each(['matching', 'different', 'early'] as const)('uses queued metadata for the matching track-start event (%s)', async scenario => {
  // Given: Lavalink returns generic metadata for the encoded radio track.
  const original: QueueTrack = {encoded: 'radio', info: {identifier: 'radio', title: 'Unknown title', author: 'Unknown artist', uri: 'https://cdn.example/stream', isStream: true, isSeekable: false, length: 0, position: 0, sourceName: 'http'}, pluginInfo: undefined};
  const player: Player = Object.create(null);
  const shoukaku: Shoukaku = Object.create(null);
  const queue = new Queue({player, shoukaku, guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text'});
  const stationUrl = 'https://radio.bsod.kr/stream?stn=kbs&ch=1radio';
  const matching = scenario !== 'different';
  const queuedTrack = {...original, encoded: matching ? original.encoded : 'different-track', info: {...original.info, title: 'KBS 1라디오', author: 'KBS', uri: stationUrl}};
  queue.setCurrent(queuedTrack);
  const sent: EmbedBuilder[] = [];
  const client: NMClient = Object.create(null);
  Object.assign(client, {
    channels: {
      cache: new Map([
        [
          'text',
          {
            isSendable: () => true,
            send: async (payload: {embeds: EmbedBuilder[]}) => {
              sent.push(...payload.embeds);
              return {id: 'announcement'};
            },
          },
        ],
      ]),
    },
  });

  // When: the original Lavalink track-start event arrives.
  const announce = () => handleTrackStart({queue, client, guildId: 'guild', guildName: 'test'}, {op: Constants.OpCodes.EVENT, type: PlayerEventType.TRACK_START_EVENT, guildId: 'guild', track: original});
  if (scenario === 'early') {
    queue.setCurrent(null);
    queue.add(queuedTrack);
    Object.assign(player, {playTrack: announce, setGlobalVolume: async () => undefined});
    await queue.play();
  } else {
    await announce();
  }

  // Then: the announcement identifies the selected station and its stream URL.
  expect(sent[0]?.data.description).toContain(matching ? 'KBS 1라디오' : original.info.title);
  expect(sent[0]?.data.url).toBe(matching ? stationUrl : original.info.uri);
  expect(sent[0]?.data.footer?.text).toContain(matching ? '라디오' : '음악');
});
