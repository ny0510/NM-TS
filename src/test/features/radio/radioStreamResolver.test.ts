import {expect, test} from 'bun:test';
import {radioRegions} from '@/features/radio/radioStations';
import {createRadioStreamResolver} from '@/features/radio/radioStreamResolver';
import {parseRadioStreams, radioStreams} from '@/features/radio/radioStreams';
import {LavalinkManager} from '@/managers/LavalinkManager';

test('every catalog station has local stream configuration', () => {
  const ids = [...new Set(radioRegions.flatMap(region => region.stations.map(station => station.id)))];
  expect(Object.keys(radioStreams).sort()).toEqual(ids.sort());
});

test('uses the configured regional address without a network request', async () => {
  const resolve = createRadioStreamResolver({
    streams: {'cbs:sfm:busan': {type: 'direct', url: 'https://broadcast.example/new.m3u8'}},
    readApi: async () => {
      throw new TypeError('Direct streams must not call an API');
    },
  });

  const result = await resolve('cbs:sfm:busan');

  expect(result).toBe('https://broadcast.example/new.m3u8');
});

test('refreshes signed API addresses for every connection', async () => {
  const calls: string[] = [];
  const resolve = createRadioStreamResolver({
    readApi: async url => {
      calls.push(url);
      return `https://broadcast.example/live.m3u8?token=${calls.length}`;
    },
  });
  const url = 'mbc:sfm:default';

  const results = await Promise.all([resolve(url), resolve(url)]);

  expect(results).toEqual(['https://broadcast.example/live.m3u8?token=1', 'https://broadcast.example/live.m3u8?token=2']);
  expect(calls).toEqual(Array(2).fill('https://sminiplay.imbc.com/aacplay.ashx?agent=webapp&channel=sfm'));
});

test('loads a regional KBS station from its configured official API', async () => {
  const calls: string[] = [];
  const resolve = createRadioStreamResolver({
    readApi: async url => {
      calls.push(url);
      return JSON.stringify({channel_item: [{service_url: 'https://broadcast.example/signed.m3u8'}]});
    },
  });

  const result = await resolve('kbs:1radio:busan');

  expect(result).toBe('https://broadcast.example/signed.m3u8');
  expect(calls).toEqual(['https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/10_21']);
});

test.each([
  ['2026-10-21T14:59:59Z', 'sjhqsh'],
  ['2026-10-21T15:00:00Z', 'sjhqss'],
])('calculates Busan MBC date codes at KST midnight: %s', async (instant, code) => {
  const resolve = createRadioStreamResolver({now: () => new Date(instant)});

  const result = await resolve('mbc:sfm:busan');

  expect(result).toBe(`https://brook.bsmbc.com/live/BusanMBC_AM_onairstream.${code}/playlist.m3u8`);
});

test('a reused resolver reads the new date after KST midnight', async () => {
  let instant = '2026-10-21T14:59:59Z';
  const resolve = createRadioStreamResolver({now: () => new Date(instant)});
  const url = 'mbc:sfm:busan';
  await resolve(url);
  instant = '2026-10-21T15:00:00Z';

  expect(await resolve(url)).toBe('https://brook.bsmbc.com/live/BusanMBC_AM_onairstream.sjhqss/playlist.m3u8');
});

test('extracts MBC visual-radio JSONP without executing it', async () => {
  const resolve = createRadioStreamResolver({readApi: async () => '__boraplay({"BoraURL":"https://broadcast.example/bora.m3u8"});'});

  expect(await resolve('mbc:bora:default')).toBe('https://broadcast.example/bora.m3u8');
});

test('combines the AFN API host with the configured stream path', async () => {
  const resolve = createRadioStreamResolver({readApi: async () => '<ip>first.example</ip><ip>last.example</ip>'});

  expect(await resolve('afn:default:humphreys')).toBe('https://last.example/AFNP_OSNAAC.aac');
});

test.each(['file:///etc/passwd', '<html>API error</html>', 'https://radio.bsod.kr/stream?stn=kbs'])('rejects an invalid address returned by a broadcaster: %s', async response => {
  const resolve = createRadioStreamResolver({readApi: async () => response});

  await expect(resolve('mbc:sfm:default')).rejects.toThrow();
});

test('rejects uncatalogued URLs before any network request', async () => {
  let called = false;
  const resolve = createRadioStreamResolver({
    readApi: async () => {
      called = true;
      return '';
    },
  });

  const result = await resolve('https://radio.bsod.kr/stream?stn=attacker');

  expect(result).toBeUndefined();
  expect(called).toBe(false);
});

test('reports missing local stream configuration', async () => {
  const resolve = createRadioStreamResolver({streams: {}});

  await expect(resolve('cbs:sfm:default')).rejects.toThrow('Missing radio stream configuration');
});

test('rejects bsod URLs in local stream configuration', () => {
  expect(() => parseRadioStreams({'kbs:1radio:default': {type: 'direct', url: 'https://radio.bsod.kr/stream?stn=kbs'}})).toThrow();
});

test('cancels an in-flight broadcaster lookup and forwards the signal', async () => {
  const pending = Promise.withResolvers<string>();
  const controller = new AbortController();
  let received: AbortSignal | undefined;
  const resolve = createRadioStreamResolver({
    readApi: async (_url, signal) => {
      received = signal;
      return pending.promise;
    },
  });
  const resolving = resolve('mbc:sfm:default', controller.signal);

  controller.abort();
  await expect(resolving).rejects.toThrow();
  pending.resolve('https://broadcast.example/live');

  expect(received).toBe(controller.signal);
});

test('does not contact Lavalink after a radio resolution is cancelled', async () => {
  const controller = new AbortController();
  let contacted = false;
  const manager: LavalinkManager = Object.create(LavalinkManager.prototype);
  Object.assign(manager, {
    radioStreamResolver: async () => {
      controller.abort();
      return 'https://broadcast.example/live';
    },
    shoukaku: {
      getIdealNode: () => {
        contacted = true;
        return undefined;
      },
    },
    logger: {error: () => {}},
  });

  await expect(manager.loadRadio('kbs:1radio:default', undefined, controller.signal)).rejects.toThrow();

  expect(contacted).toBe(false);
});
