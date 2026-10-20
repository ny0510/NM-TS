import {expect, mock, test} from 'bun:test';
import {LoadType} from 'shoukaku';
import {radioRegions} from '@/features/music/radio/radioStations';
import {LavalinkManager} from '@/managers/LavalinkManager';

function createManager() {
  const resolve = mock(async (_query: string) => ({loadType: LoadType.EMPTY, data: {}}));
  const manager: LavalinkManager = Object.create(LavalinkManager.prototype);
  Object.assign(manager, {shoukaku: {getIdealNode: () => ({rest: {resolve}})}, config: {LAVALINK_SEARCH_PREFIX: 'ytsearch:'}, logger: {error: () => undefined}});
  return {manager, resolve};
}

test.each([
  'https://attacker.example/audio.mp3',
  'http://127.0.0.1:8080/private',
  'https://youtube.com.attacker.example/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com@attacker.example/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/redirect?q=https://attacker.example/',
  'https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ',
  'https://radio.bsod.kr/stream?stn=cbs&ch=joy4u',
  'https://m-aac.cbs.co.kr/mweb_cbscmc/_definst_/cbscmc.stream/playlist.m3u8',
  'http://[::1]/private',
  'file:///etc/passwd',
  'icy://attacker.example/stream',
])('rejects unapproved inputs before contacting Lavalink: %s', async query => {
  // Given: a normal music request with an unapproved URL.
  const {manager, resolve} = createManager();
  // When: a play, search, or favorites caller uses the shared loader.
  const result = await manager.search(query);
  // Then: the URL never reaches Lavalink.
  expect(result).toBeUndefined();
  expect(resolve).not.toHaveBeenCalled();
});

test.each([
  ['노래 제목', 'ytsearch:노래 제목'],
  ['scsearch:음악', 'scsearch:음악'],
  ['https://youtu.be/dQw4w9WgXcQ?si=share', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['https://www.youtube.com/playlist?list=PL_example', 'https://www.youtube.com/playlist?list=PL_example'],
  ['https://youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&index=3', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&index=3'],
  ['https://open.spotify.com/track/abc123?si=share', 'https://open.spotify.com/track/abc123'],
  ['https://soundcloud.com/artist/song?si=share', 'https://soundcloud.com/artist/song'],
  ['https://artist.bandcamp.com/track/song', 'https://artist.bandcamp.com/track/song'],
  ['https://www.twitch.tv/videos/12345', 'https://www.twitch.tv/videos/12345'],
  ['https://vimeo.com/12345', 'https://vimeo.com/12345'],
  ['https://www.nicovideo.jp/watch/sm12345', 'https://www.nicovideo.jp/watch/sm12345'],
])('keeps approved music inputs working: %s', async (query, expected) => {
  // Given: a supported music link or search term.
  const {manager, resolve} = createManager();
  // When: it is loaded through the normal path.
  await manager.search(query);
  // Then: only the canonical music request reaches Lavalink.
  expect(resolve).toHaveBeenCalledWith(expected);
});

test('radio loading accepts only the registered station list', async () => {
  // Given: a known station and a forged radio URL.
  const {manager, resolve} = createManager();
  const station = radioRegions[0]?.stations[0];
  if (!station) throw new TypeError('Missing radio station');
  // When: both URLs are offered to the radio-only loader.
  await manager.loadRadio(station.url);
  await manager.loadRadio('https://radio.bsod.kr/stream?url=https://attacker.example');
  // Then: only the registered station is resolved.
  expect(resolve).toHaveBeenCalledTimes(1);
  expect(resolve).toHaveBeenCalledWith(station.url);
});
