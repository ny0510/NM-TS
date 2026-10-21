import type {RadioRegion} from '@/types/radio';

interface RegionGroup {
  readonly key: string;
  readonly label: string;
  readonly cities: readonly string[];
  readonly stationIds?: readonly string[];
}

const REGION_GROUPS: Readonly<Record<string, readonly RegionGroup[]>> = {
  busan: [
    {key: 'ulsan', label: '울산', cities: ['ulsan']},
    {key: 'gyeongnam', label: '경남', cities: ['changwon', 'jinju', 'gyeongnam'], stationIds: ['community:namhaefm:default']},
  ],
  daegu: [{key: 'gyeongbuk', label: '경북', cities: ['andong', 'pohang', 'gyeongbuk'], stationIds: ['community:yeongjufm:default', 'community:sjfm:default', 'community:sangjufm:default', 'kookbang:default:default']}],
  gwangju: [{key: 'jeonnam', label: '전남', cities: ['mokpo', 'suncheon', 'yeosu', 'jeonnam'], stationIds: ['community:suncheonfm:default']}],
  daejeon: [
    {key: 'sejong', label: '세종', cities: [], stationIds: ['community:sejongfm:default']},
    {key: 'chungnam', label: '충남', cities: ['chungnam'], stationIds: ['community:keumkangfm:default']},
  ],
};

export function splitRadioRegion(region: RadioRegion): RadioRegion[] {
  const groups = REGION_GROUPS[region.key];
  if (!groups) return [region];
  const assigned = new Set<string>();
  const subdivisions = groups.map(group => {
    const stations = region.stations.filter(station => group.cities.includes(station.id.split(':')[2] ?? '') || group.stationIds?.includes(station.id));
    for (const station of stations) assigned.add(station.id);
    return {key: group.key, label: group.label, stations};
  });
  return [{...region, stations: region.stations.filter(station => !assigned.has(station.id))}, ...subdivisions];
}

export function resolveRadioRegionKey(regions: readonly RadioRegion[], regionKey: string, stationId: string): string {
  if (regions.find(region => region.key === regionKey)?.stations.some(station => station.id === stationId)) return regionKey;
  const groups = REGION_GROUPS[regionKey];
  return groups?.find(group => regions.find(region => region.key === group.key)?.stations.some(station => station.id === stationId))?.key ?? regionKey;
}
