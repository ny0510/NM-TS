import {EmbedBuilder, type HexColorString} from 'discord.js';
import {type Player, type Track} from 'magmastream';

import {getEmbedMeta} from './playerUtils';
import type {NMClient} from '@/client/Client';
import {hyperlink, truncateWithEllipsis} from '@/utils/formatting';
import {Logger} from '@/utils/logger';

const logger = new Logger('Autoplay');

export interface TrackFingerprint {
  identifier: string;
  title: string;
  author: string;
  duration: number;
  normalizedTitle: string;
  normalizedAuthor: string;
}

const calculateSimilarity = (str1: string, str2: string): number => {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
  const a = normalize(str1);
  const b = normalize(str2);

  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(matrix[i - 1]![j]!, matrix[i]![j - 1]!, matrix[i - 1]![j - 1]!) + 1;
      }
    }
  }

  const maxLength = Math.max(a.length, b.length);
  return (maxLength - matrix[b.length]![a.length]!) / maxLength;
};

export const createTrackFingerprint = (track: Track): TrackFingerprint => {
  let normalizedTitle = track.title
    .replace(/\s*\([^)]*\)/g, '') // 괄호 () 제거
    .replace(/\s*\[[^\]]*\]/g, '') // 대괄호 [] 제거
    .replace(/\s*\{[^}]*\}/g, '') // 중괄호 {} 제거
    .replace(/\s*［[^］]*］\s*/g, '') // 전각 대괄호 ［］ 제거
    .replace(/\s*【[^】]*】\s*/g, '') // 전각 중괄호 【】 제거
    .replace(/\s*〈[^〉]*〉\s*/g, '') // 전각 꺾쇠 〈〉 제거
    .replace(/\s*\|.*$/g, '') // 파이프 이후 모든 텍스트 제거
    .replace(/\s*-\s*.*?\s*(remix|cover|ver|version|live|acoustic|instrumental|karaoke|official|mv|pv)\s*$/gi, '') // 리믹스/커버 등 버전 정보 제거
    .replace(/\s*(official|mv|pv|music\s*video|audio|lyric|lyrics)\s*$/gi, '') // 공식/뮤비/가사 등 미디어 타입 제거
    .replace(/\s*(ft\.?|feat\.?|featuring)\s*[^-]*$/gi, '') // 피처링 아티스트 제거
    .replace(/[^\w\s가-힣]/g, '') // 특수문자 제거 (한글, 영숫자, 공백만 유지)
    .replace(/\s+/g, ' ') // 연속된 공백을 하나로 통합
    .trim()
    .toLowerCase();

  let normalizedAuthor = track.author
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s*［[^］]*］\s*/g, '')
    .replace(/\s*【[^】]*】\s*/g, '')
    .replace(/\s*(official|channel|music|entertainment|records?|label)\s*$/gi, '')
    .replace(/\s*-\s*topic\s*$/gi, '')
    .replace(/[^\w\s가-힣]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const isTopicChannel = track.author.toLowerCase().includes('topic');
  if (isTopicChannel) {
    normalizedAuthor = '';
  }

  if (!isTopicChannel && normalizedTitle.includes('-')) {
    const titleParts = normalizedTitle.split(/\s*-\s*/);
    if (titleParts.length === 2) {
      const [part1, part2] = titleParts;
      if (part1 && calculateSimilarity(part1.trim(), normalizedAuthor) > 0.8) {
        normalizedTitle = part2?.trim() || normalizedTitle;
      } else if (part2 && calculateSimilarity(part2.trim(), normalizedAuthor) > 0.8) {
        normalizedTitle = part1?.trim() || normalizedTitle;
      }
    }
  }

  if (!isTopicChannel && normalizedAuthor.length > 2 && normalizedTitle.includes(normalizedAuthor)) {
    const withoutArtist = normalizedTitle.replace(new RegExp(`\\b${normalizedAuthor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '').trim();
    if (withoutArtist.length > 2) {
      normalizedTitle = withoutArtist;
    }
  }

  return {
    identifier: track.identifier,
    title: track.title,
    author: track.author,
    duration: track.duration,
    normalizedTitle,
    normalizedAuthor,
  };
};

const compareTrackFingerprints = (fp1: TrackFingerprint, fp2: TrackFingerprint): number => {
  if (fp1.identifier === fp2.identifier) return 1.0;

  const titleSimilarity = calculateSimilarity(fp1.normalizedTitle, fp2.normalizedTitle);

  const authorSimilarity = fp1.normalizedAuthor === '' || fp2.normalizedAuthor === '' ? 0 : calculateSimilarity(fp1.normalizedAuthor, fp2.normalizedAuthor);

  const durationDiff = Math.abs(fp1.duration - fp2.duration);
  const durationSimilarity = durationDiff < Math.max(fp1.duration, fp2.duration) * 0.1 ? 1.0 : Math.max(0, 1 - durationDiff / Math.max(fp1.duration, fp2.duration));

  if (fp1.normalizedAuthor === '' || fp2.normalizedAuthor === '') {
    if (fp1.normalizedTitle === fp2.normalizedTitle) {
      return Math.max(0.9, titleSimilarity * 0.8 + durationSimilarity * 0.2);
    }
    return titleSimilarity * 0.8 + durationSimilarity * 0.2;
  }

  if (fp1.normalizedTitle === fp2.normalizedTitle && authorSimilarity > 0.7) {
    return Math.max(0.9, titleSimilarity * 0.7 + authorSimilarity * 0.3);
  }

  if (fp1.normalizedAuthor === fp2.normalizedAuthor && titleSimilarity > 0.7) {
    return Math.max(0.9, titleSimilarity * 0.7 + authorSimilarity * 0.3);
  }

  return titleSimilarity * 0.7 + authorSimilarity * 0.25 + durationSimilarity * 0.05;
};

export const isDuplicateTrackEnhanced = (track: Track, playHistory: TrackFingerprint[], autoplayHistory: TrackFingerprint[], threshold: number = 0.75): boolean => {
  const trackFingerprint = createTrackFingerprint(track);

  for (const historyFp of playHistory) {
    const similarity = compareTrackFingerprints(trackFingerprint, historyFp);
    if (similarity >= threshold) {
      return true;
    }
  }

  for (const autoplayFp of autoplayHistory) {
    const similarity = compareTrackFingerprints(trackFingerprint, autoplayFp);
    if (similarity >= threshold) {
      return true;
    }
  }

  return false;
};

export const getRelatedTracks = async (client: NMClient, track: Track, limit: number = 10, player: Player): Promise<Track[]> => {
  const maxLimit = 50; // 최대 한도 증가
  if (limit > maxLimit) throw new Error(`Limit exceeds maximum value of ${maxLimit}.`);

  const searchQuery = `${track.author} - ${track.title}`;
  const ytSearchResult = await client.manager.search(searchQuery, {requester: '자동재생'});

  if (!ytSearchResult || !ytSearchResult.tracks.length) return [];

  const videoId = ytSearchResult.tracks[0]?.identifier;
  const relatedUri = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;

  try {
    const result = await client.manager.search(relatedUri, {requester: '자동재생'});
    if (!result || !result.tracks.length) return [];

    const playHistory: TrackFingerprint[] = player.get('playHistory') || [];
    const autoplayHistory: TrackFingerprint[] = player.get('autoplayHistory') || [];
    const queueFingerprints = [...player.queue].map(t => createTrackFingerprint(t));
    if (player.queue.current) {
      queueFingerprints.push(createTrackFingerprint(player.queue.current));
    }

    const allHistory = [...playHistory, ...autoplayHistory, ...queueFingerprints];
    const historySet = new Set(allHistory.map(fp => fp.identifier));

    // 처음부터 더 많은 양을 가져와서 필터링 (limit * 5 정도로 여유있게)
    const filteredTracks = result.tracks.filter(relatedTrack => {
      if (historySet.has(relatedTrack.identifier)) return false;
      return !isDuplicateTrackEnhanced(relatedTrack, allHistory, [], 0.7);
    });

    // 필터링된 결과에서 필요한 만큼만 반환
    return filteredTracks.slice(0, limit);
  } catch (error) {
    logger.error(`Error fetching related tracks: ${error}`);
    return [];
  }
};

const getAdditionalRelatedTracks = async (client: NMClient, baseTrack: Track, needed: number, existingHistory: TrackFingerprint[]): Promise<Track[]> => {
  try {
    const artistSearchResult = await client.manager.search(`${baseTrack.author} songs`, {requester: '자동재생'});
    if (!artistSearchResult?.tracks.length) return [];

    return artistSearchResult.tracks.filter(track => !isDuplicateTrackEnhanced(track, existingHistory, [], 0.7)).slice(0, needed);
  } catch (error) {
    logger.warn(`Additional track search failed: ${error}`);
    return [];
  }
};

export const addRelatedTracksToQueue = async (client: NMClient, player: Player, currentTrack: Track, count: number = 20): Promise<Track[]> => {
  try {
    // 더 많은 양을 한 번에 가져오기
    const relatedTracks = await getRelatedTracks(client, currentTrack, count, player);

    if (relatedTracks.length > 0) {
      relatedTracks.forEach(track => {
        Object.assign(track, {requester: '자동재생'});
      });

      player.queue.add(relatedTracks);

      const newFingerprints = relatedTracks.map(track => createTrackFingerprint(track));
      const autoplayHistory: TrackFingerprint[] = player.get('autoplayHistory') || [];
      const updatedAutoplayHistory = [...autoplayHistory, ...newFingerprints].slice(-100);
      player.set('autoplayHistory', updatedAutoplayHistory);

      return relatedTracks;
    }

    return [];
  } catch (error) {
    logger.error(`Failed to add related tracks: ${error}`);
    return [];
  }
};

export const initializeAutoplay = async (client: NMClient, player: Player): Promise<{success: boolean; addedTracks: Track[]; error?: string}> => {
  try {
    const currentTrack = player.queue.current;
    if (!currentTrack) {
      return {success: false, addedTracks: [], error: '현재 재생중인 음악이 없어요.'};
    }

    // 초기화할 때 더 많은 양을 한 번에 가져오기
    const addedTracks = await addRelatedTracksToQueue(client, player, currentTrack, 20);
    return {success: true, addedTracks};
  } catch (error) {
    return {success: false, addedTracks: [], error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.'};
  }
};

export const checkAndAddAutoplayTracks = async (client: NMClient, player: Player): Promise<{added: boolean; addedTracks: Track[]}> => {
  try {
    // 자동재생이 비활성화되어 있거나 대기열이 충분히 많으면 추가하지 않음
    if (!player.get('autoplayEnabled') || player.queue.size > 5) {
      return {added: false, addedTracks: []};
    }

    const currentTrack = player.queue.current;
    if (!currentTrack) return {added: false, addedTracks: []};

    // 대기열이 부족할 때 더 많은 양을 한 번에 가져오기
    const addedTracks = await addRelatedTracksToQueue(client, player, currentTrack, 15);
    return {added: addedTracks.length > 0, addedTracks};
  } catch (error) {
    logger.error(`Autoplay check failed: ${error}`);
    return {added: false, addedTracks: []};
  }
};

// 자동재생 embed 생성
export const createAutoplayEmbed = async (tracks: Track[], player: Player, client: NMClient, title: string, additionalFooterText?: string): Promise<EmbedBuilder> => {
  const tracksMeta = await getEmbedMeta(tracks, true, player);
  const [tracksColor, tracksFooterText] = [tracksMeta.colors, tracksMeta.footerText];

  const trackList = tracks
    .slice(0, 5)
    .map((autoTrack, index) => `${index + 1}. ${hyperlink(truncateWithEllipsis(autoTrack.title, 50), autoTrack.uri)}`)
    .join('\n');

  const remainingCount = tracks.length - 5;
  const additionalText = remainingCount > 0 ? `\n... 그리고 ${remainingCount}곡 더` : '';
  const footerText = additionalFooterText ? `${tracksFooterText}\n${additionalFooterText}` : tracksFooterText;

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${tracks.length}곡을 대기열에 추가했어요.\n\n${trackList}${additionalText}`)
    .setFooter({text: footerText})
    .setThumbnail(tracks[0]?.artworkUrl ?? null)
    .setColor((tracksColor[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString);
};

export const manageTrackHistory = (player: Player, track: Track): void => {
  const playHistory: TrackFingerprint[] = player.get('playHistory') || [];
  const trackFingerprint = createTrackFingerprint(track);

  const isDuplicate = playHistory.some(h => h.identifier === track.identifier);
  if (!isDuplicate) {
    playHistory.push(trackFingerprint);
    const updatedHistory = playHistory.slice(-50);
    player.set('playHistory', updatedHistory);
  }
};

export const handleAutoplayOnTrackStart = async (client: NMClient, player: Player): Promise<{success: boolean; addedTracks: Track[]; error?: string}> => {
  try {
    const autoplayResult = await checkAndAddAutoplayTracks(client, player);
    return {
      success: true,
      addedTracks: autoplayResult.added ? autoplayResult.addedTracks : [],
    };
  } catch (error) {
    return {
      success: false,
      addedTracks: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
