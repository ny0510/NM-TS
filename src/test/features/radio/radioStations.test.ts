import {describe, expect, test} from 'bun:test';
import {createHash} from 'node:crypto';

import {findRadioStation, getAdjacentStation, getFmStations, isAllowedRadioUrl, radioRegions, resolveRadioRegionKey} from '@/features/radio/radioStations';
import {isRadioTrack, isRadioUrl} from '@/shared/playback/radioUrl';
import type {RadioRegion, RadioStation} from '@/types/radio';

describe('radio catalog preservation and identity', () => {
  test('preserves all 226 region/stream entries from the pre-separation catalog', () => {
    const urls = radioRegions.flatMap(region => region.stations.map(station => station.url)).sort();
    expect(urls).toHaveLength(226);
    expect(createHash('sha256').update(urls.join('\n')).digest('hex')).toBe('5510e0c1a7ea9246319d40e9534759110fc5c12dacf734177b9fb92b8fce605b');
    for (const region of radioRegions) {
      expect(new Set(region.stations.map(station => station.id)).size).toBe(region.stations.length);
      for (const station of region.stations) expect(findRadioStation(region.key, station.id)).toBe(station);
    }
  });

  test('moves local stations into their own region and resolves legacy grouped snapshot keys', () => {
    expect(findRadioStation('busan', 'mbc:sfm:ulsan')).toBeUndefined();
    expect(findRadioStation('ulsan', 'mbc:sfm:ulsan')?.frequencyKHz).toBe(97500);
    expect(findRadioStation('gyeongnam', 'kbs:1radio:changwon')).toBeDefined();
    expect(findRadioStation('jeonnam', 'mbc:sfm:mokpo')).toBeDefined();
    expect(resolveRadioRegionKey('busan', 'mbc:sfm:ulsan')).toBe('ulsan');
    expect(resolveRadioRegionKey('gwangju', 'mbc:sfm:mokpo')).toBe('jeonnam');
    expect(resolveRadioRegionKey('daegu', 'kbs:1radio:andong')).toBe('gyeongbuk');
    expect(resolveRadioRegionKey('seoul', 'mbc:sfm:ulsan')).toBe('seoul');
  });

  test('looks up station IDs only within the requested region', () => {
    expect(findRadioStation('seoul', 'kbs:1radio:busan')).toBeUndefined();
    expect(findRadioStation('invalid', 'ebs:fm:default')).toBeUndefined();
    const seoul = findRadioStation('seoul', 'ebs:fm:default');
    const busan = findRadioStation('busan', 'ebs:fm:default');
    expect(seoul?.url).toBe(busan?.url);
    expect(seoul?.frequencyKHz).toBe(104500);
    expect(busan?.frequencyKHz).toBe(107700);
    expect(seoul?.locality).not.toBe(busan?.locality);
  });

  test('only exposes known integer FM frequencies and retains unknown/non-FM entries', () => {
    for (const region of radioRegions) {
      for (const station of region.stations) {
        if (station.band === 'fm') {
          expect(Number.isInteger(station.frequencyKHz)).toBe(true);
          expect(station.frequencyKHz).toBeGreaterThanOrEqual(87500);
          expect(station.frequencyKHz).toBeLessThanOrEqual(108000);
          expect(station.locality).toBeTruthy();
        } else {
          expect(station.frequencyKHz).toBeUndefined();
        }
      }
    }
    expect(findRadioStation('seoul', 'ebs:bandi:default')?.band).toBe('other');
    expect(findRadioStation('seoul', 'kbs:hanminjok:default')?.band).toBe('other');
    expect(findRadioStation('seoul', 'community:gwanakfm:default')?.band).toBe('unknown');
    expect(findRadioStation('busan', 'bbs:default:busan')?.frequencyKHz).toBe(89900);
    expect(findRadioStation('gangwon', 'sbs:powerfm:chuncheon')?.frequencyKHz).toBe(105100);
    expect(findRadioStation('jeju', 'kookbang:default:default')?.locality).toBe('서귀포');
  });
});

describe('radio URL boundaries', () => {
  test('requires exact catalog URLs for authorization', () => {
    for (const region of radioRegions) {
      for (const station of region.stations) {
        expect(isAllowedRadioUrl(station.url)).toBe(true);
        expect(isRadioTrack({info: {uri: station.url}})).toBe(true);
      }
    }
    for (const url of [
      'https://radio.bsod.kr/stream?stn=madeup',
      'https://radio.bsod.kr/stream?stn=kbs&ch=1radio&redirect=https://example.com',
      'https://radio.bsod.kr/stream?stn=kbs&ch=1radio#fragment',
      'https://radio.bsod.kr/stream?ch=1radio&stn=kbs',
      'http://radio.bsod.kr/stream?stn=kbs&ch=1radio',
      'https://radio.bsod.kr.evil.example/stream?stn=kbs',
    ])
      expect(isAllowedRadioUrl(url)).toBe(false);
  });

  test('classification rejects lookalikes, credentials, arbitrary queries and missing URLs', () => {
    for (const url of [undefined, null, 'invalid', 'https://radio.bsod.kr@evil.example/stream?stn=kbs', 'https://radio.bsod.kr/stream?stn=kbs&next=https://evil.example', 'https://radio.bsod.kr/stream?stn=kbs\n']) {
      expect(isRadioUrl(url)).toBe(false);
    }
    expect(isRadioTrack(null)).toBe(false);
    expect(isRadioTrack({info: {}})).toBe(false);
  });
});

const station = (id: string, frequencyKHz?: number): RadioStation => ({id, name: id, url: id, provider: 'test', band: frequencyKHz === undefined ? 'unknown' : 'fm', frequencyKHz});
const low = station('low', 90000);
const middleA = station('middle-a', 95000);
const middleB = station('middle-b', 95000);
const high = station('high', 101000);
const unknown = station('unknown');
const region: RadioRegion = {key: 'test', label: 'test', stations: [high, middleB, unknown, low, middleA]};

describe('FM tuning', () => {
  test('orders numerically and skips same-frequency ties in either direction', () => {
    expect(getFmStations(region).map(item => item.id)).toEqual(['low', 'middle-a', 'middle-b', 'high']);
    expect(getAdjacentStation(region, low, 'higher')).toBe(middleA);
    expect(getAdjacentStation(region, high, 'lower')).toBe(middleA);
    expect(getAdjacentStation(region, middleA, 'higher')).toBe(high);
    expect(getAdjacentStation(region, middleB, 'lower')).toBe(low);
    expect(region.stations[0]).toBe(high);
  });

  test('wraps at edges and enters FM from an unknown or absent selection', () => {
    expect(getAdjacentStation(region, low, 'lower')).toBe(high);
    expect(getAdjacentStation(region, high, 'higher')).toBe(low);
    expect(getAdjacentStation(region, unknown, 'higher')).toBe(low);
    expect(getAdjacentStation(region, undefined, 'lower')).toBe(high);
    expect(getAdjacentStation({...region, stations: []}, undefined, 'higher')).toBeUndefined();
    expect(getAdjacentStation({...region, stations: [unknown]}, unknown, 'lower')).toBeUndefined();
    expect(getAdjacentStation({...region, stations: [low]}, low, 'higher')).toBe(low);
  });
});
