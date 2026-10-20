import {describe, expect, test} from 'bun:test';

import {getRadioStreamUrl, isRadioTrack, radioRegions} from '@/features/music/radio/radioStations';
import type {QueueTrack} from '@/types/music';

const createTrack = (uri: string | null): QueueTrack => ({encoded: 'encoded', info: {identifier: 'id', isSeekable: false, author: 'author', length: 0, isStream: true, position: 0, title: 'title', uri: uri ?? undefined, sourceName: 'http'}, pluginInfo: undefined});

describe('getRadioStreamUrl', () => {
  test('builds radio.bsod.kr stream URLs in stn, ch, city order and omits missing parameters', () => {
    expect(getRadioStreamUrl({stn: 'kbs', ch: '1radio'})).toBe('https://radio.bsod.kr/stream?stn=kbs&ch=1radio');
    expect(getRadioStreamUrl({stn: 'mbc', ch: 'sfm', city: 'busan'})).toBe('https://radio.bsod.kr/stream?stn=mbc&ch=sfm&city=busan');
    expect(getRadioStreamUrl({stn: 'tbn', city: 'jeju'})).toBe('https://radio.bsod.kr/stream?stn=tbn&city=jeju');
    expect(getRadioStreamUrl({stn: 'kookbang'})).toBe('https://radio.bsod.kr/stream?stn=kookbang');
  });
});

describe('radioRegions', () => {
  test('lists every region in order with unique stream URLs per region', () => {
    expect(radioRegions.map(region => region.label)).toEqual(['서울', '부산', '대구', '광주', '대전', '강원', '충북', '전북', '제주']);
    expect(radioRegions.map(region => region.stations.length)).toEqual([38, 37, 32, 32, 18, 23, 15, 16, 15]);

    for (const region of radioRegions) {
      expect(new Set(region.stations.map(station => station.url)).size).toBe(region.stations.length);
      expect(region.stations.every(station => station.name && station.provider)).toBe(true);
    }
  });
});

describe('isRadioTrack', () => {
  test('matches only radio.bsod.kr stream tracks', () => {
    const stationUrl = radioRegions[0]?.stations[0]?.url ?? '';

    expect(isRadioTrack(createTrack(stationUrl))).toBe(true);
    expect(isRadioTrack(createTrack('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))).toBe(false);
    expect(isRadioTrack(createTrack(null))).toBe(false);
    expect(isRadioTrack(null)).toBe(false);
  });
});
